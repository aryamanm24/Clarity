"""
CLARITY Engine API — FastAPI server.

Endpoints:
  POST /analyze        — Full analysis pipeline (parse → check → detect → reconstruct)
  POST /analyze/stream — SSE streaming version
  POST /parse          — Just parse propositions (Layer 1)
  POST /validate       — Just check validity
  GET  /health         — Health check
  POST /api/explain    — Generate spoken explanation (text; legacy fallback)
  WS   /ws/voice       — Voice mode (Gemini Live — Phase 1 acknowledgment only)
  WS   /ws/explain     — One-shot Gemini Live session for Ask CLARITY voice explanation
"""

from dotenv import load_dotenv
load_dotenv()

from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import time
import uuid

from engine.proposition_parser import parse_propositions
from engine.validity_checker import check_validity
from engine.contradiction_detector import detect_contradictions  # Now uses SAT solver


def _safe_serialize(obj):
    """Convert to JSON-serializable form. Catch unawaited coroutines."""
    if asyncio.iscoroutine(obj):
        print(f"⚠️ WARNING: Unawaited coroutine passed to serialize: {obj}")
        return None
    if obj is None:
        return None
    if isinstance(obj, list):
        return [_safe_serialize(item) for item in obj]
    if isinstance(obj, dict):
        return {str(k): _safe_serialize(v) for k, v in obj.items()}
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)
from engine.fallacy_detector import detect_fallacies  # Now uses graph algorithms
from engine.ambiguity_detector import detect_ambiguities
from engine.tension_detector import detect_tensions
from engine.temporal_tracker import detect_temporal_drift
from engine.argument_reconstructor import reconstruct_argument

try:
    from engine.gemini_client import call_gemini, SDK_AVAILABLE as GEMINI_SDK_AVAILABLE
except ImportError:
    GEMINI_SDK_AVAILABLE = False
    call_gemini = None

import base64

# Gemini Live for voice mode (replaces Deepgram + ElevenLabs)
try:
    from gemini_live import GeminiLiveSession
    from google.genai import types as genai_types

    GEMINI_LIVE_AVAILABLE = True
except ImportError as e:
    print(f"[Voice] Gemini Live not available: {e}")
    GEMINI_LIVE_AVAILABLE = False
    GeminiLiveSession = None  # type: ignore
    genai_types = None


class Timer:
    def __init__(self, label: str):
        self.label = label

    def __enter__(self):
        self.start = time.time()
        return self

    def __exit__(self, *args):
        elapsed = time.time() - self.start
        print(f"⏱️  {self.label}: {elapsed:.2f}s")


def map_types_for_react_flow(propositions: list[dict], relationships: list[dict]):
    """
    Map Python backend types to Person B's React Flow component types.
    
    Python returns: "premise", "conclusion", "concludes_from"
    React Flow expects: "claim", "evidence", "assumption", "constraint", "risk"
                        "supports", "contradicts", "depends_on", "attacks"
    """
    # Map proposition types
    type_mapping = {
        "premise": "claim",
        "conclusion": "claim",
        # Keep existing types as-is
        "claim": "claim",
        "evidence": "evidence",
        "assumption": "assumption",
        "constraint": "constraint",
        "risk": "risk",
    }
    
    for prop in propositions:
        old_type = prop.get("type", "")
        prop["type"] = type_mapping.get(old_type, old_type)
    
    # Map relationship types
    rel_type_mapping = {
        "concludes_from": "supports",
        # Keep existing types as-is
        "supports": "supports",
        "contradicts": "contradicts",
        "depends_on": "depends_on",
        "attacks": "attacks",
        "assumes": "assumes",
    }
    
    for rel in relationships:
        old_type = rel.get("type", "")
        rel["type"] = rel_type_mapping.get(old_type, old_type)

app = FastAPI(title="CLARITY Engine", version="0.1.0")

# CORS — allow Next.js frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session storage (for multi-turn conversations)
sessions: dict[str, dict] = {}

# Thread pool for sync Gemini calls — enables true parallelism
executor = ThreadPoolExecutor(max_workers=8)


import random


async def safe_call(name: str, func, *args, default=None):
    """Run sync function in executor; catch errors; return fallback. Per-task timer."""
    try:
        with Timer(f"  └─ {name}"):
            if asyncio.iscoroutinefunction(func):
                return await func(*args)
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(executor, lambda: func(*args))
    except Exception as e:
        print(f"⚠️  {name} failed: {e}")
        return [] if name in ("contradictions", "fallacies", "ambiguities", "tensions") else default or {}


async def safe_call_with_retry(name: str, func, *args, default=None, max_retries=2):
    """Call with retry on 429 RESOURCE_EXHAUSTED."""
    for attempt in range(max_retries + 1):
        try:
            with Timer(f"  └─ {name}"):
                if asyncio.iscoroutinefunction(func):
                    return await func(*args)
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(executor, lambda: func(*args))
        except Exception as e:
            error_str = str(e)
            if ("429" in error_str or "RESOURCE_EXHAUSTED" in error_str) and attempt < max_retries:
                wait = (2**attempt) + random.uniform(0, 1)
                print(f"⚠️  {name}: Rate limited, retrying in {wait:.1f}s (attempt {attempt + 1})")
                await asyncio.sleep(wait)
                continue
            print(f"⚠️  {name} failed: {e}")
            if name in ("contradictions", "fallacies", "ambiguities", "tensions"):
                return []
            return default if default is not None else {}
    return default if default is not None else []


class AnalyzeRequest(BaseModel):
    input: str
    session_id: Optional[str] = None
    engines: list[str] = ["all"]


class ParseRequest(BaseModel):
    input: str


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0", "service": "CLARITY Python Engine"}


@app.post("/api/generate-explanation")
async def generate_explanation(request: Request):
    """Pre-generate explanation text when analysis completes. Fast — no Live session."""
    body = await request.json()
    contradictions = body.get("contradictions", [])
    fallacies = body.get("fallacies", [])
    insights = body.get("insights", [])
    round_num = body.get("round", 1)
    user_text = body.get("userText", "")

    prompt = _build_explanation_prompt(
        contradictions, fallacies, insights, round_num, user_text
    )
    fallback = _build_fallback_explanation(contradictions, fallacies, insights)

    if not GEMINI_SDK_AVAILABLE or not call_gemini:
        return {"explanation": fallback}

    try:
        loop = asyncio.get_event_loop()
        explanation = await loop.run_in_executor(
            executor,
            lambda: call_gemini(
                prompt,
                temperature=0.7,
                response_mime_type="text/plain",
                model="gemini-3-flash-preview",
            ),
        )
        result = (explanation or "").strip() or fallback
        print(f"📝 Pre-generated explanation: {result[:80]}...")
        return {"explanation": result}
    except Exception as e:
        print(f"❌ Explanation generation failed: {e}")
        return {"explanation": fallback}


def _build_fallback_explanation(contradictions: list, fallacies: list, insights: list) -> str:
    """Simple fallback if Gemini call fails."""
    parts = []
    if contradictions and len(contradictions) > 0:
        parts.append(
            f"I found {len(contradictions)} logical contradiction{'s' if len(contradictions) > 1 else ''} in your reasoning."
        )
    if fallacies and len(fallacies) > 0:
        parts.append(
            f"There {'are' if len(fallacies) > 1 else 'is'} {len(fallacies)} logical fallacy detected."
        )
    if not parts:
        parts.append("Your reasoning appears logically consistent.")
    parts.append("Check the graph for the full formal proof.")
    return " ".join(parts)


@app.post("/api/explain")
async def explain_analysis(request: Request):
    """
    Generate a spoken explanation of analysis results using Gemini.
    Returns text; frontend uses browser SpeechSynthesis to speak it.
    Called when user clicks "Ask CLARITY 🎙️" after analysis is complete.
    """
    body = await request.json()
    contradictions = body.get("contradictions", [])
    fallacies = body.get("fallacies", [])
    insights = body.get("insights", [])
    round_num = body.get("round", 1)
    user_text = body.get("userText", "")

    prompt = _build_explanation_prompt(
        contradictions, fallacies, insights, round_num, user_text
    )

    fallback = "I found some interesting patterns in your reasoning. Check the graph and sidebar for details."

    if not GEMINI_SDK_AVAILABLE or not call_gemini:
        return {"explanation": fallback}

    try:
        loop = asyncio.get_event_loop()
        explanation = await loop.run_in_executor(
            executor,
            lambda: call_gemini(
                prompt,
                temperature=0.7,
                response_mime_type="text/plain",
                model="gemini-3-flash-preview",
            ),
        )
        return {"explanation": (explanation or "").strip() or fallback}
    except Exception as e:
        print(f"❌ Explain error: {e}")
        return {"explanation": fallback}


@app.websocket("/ws/explain")
async def explain_websocket(websocket: WebSocket):
    """One-shot Gemini Live session to speak pre-generated explanation (read-aloud mode)."""
    if not GEMINI_LIVE_AVAILABLE or not GeminiLiveSession or not genai_types:
        await websocket.close(code=1011, reason="Gemini Live not configured")
        return

    await websocket.accept()
    gemini_session = GeminiLiveSession()
    chunks_sent = 0

    try:
        gemini_session.system_instruction = (
            "Read the following text aloud exactly as written. "
            "Do not add anything. Do not analyze further. "
            "Just speak the text naturally and clearly. "
            "Speak at a normal pace."
        )

        await gemini_session.connect()
        print("🎙️ Explain session connected")

        msg = await websocket.receive_json()
        text_to_speak = msg.get("summary", "")

        if not text_to_speak.strip():
            await websocket.send_json({"type": "turn_complete"})
            return

        print(f"🎙️ Speaking: {text_to_speak[:80]}...")

        await gemini_session.session.send_client_content(
            turns=genai_types.Content(
                role="user",
                parts=[genai_types.Part(text=text_to_speak)],
            ),
            turn_complete=True,
        )

        async for msg_type, data in gemini_session.receive_responses():
            try:
                if msg_type == "audio":
                    audio_b64 = base64.b64encode(data).decode("utf-8")
                    await websocket.send_json({"type": "audio", "data": audio_b64})
                    chunks_sent += 1
                elif msg_type == "turn_complete":
                    print(f"🎙️ Turn complete — sent {chunks_sent} audio chunks to browser")
                    await websocket.send_json({"type": "turn_complete"})
                    await asyncio.sleep(1)  # Ensure message is delivered before closing
                    break
                elif msg_type == "interrupted":
                    print("⚠️ Gemini was interrupted")
                    await websocket.send_json({"type": "turn_complete"})
                    break
            except Exception as e:
                print(f"⚠️ Send to browser failed (chunk #{chunks_sent}): {e}")
                break

    except Exception as e:
        print(f"❌ Explain session error: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await gemini_session.close()
        try:
            await websocket.close()
        except Exception:
            pass
        print(f"🎙️ Explain session closed (sent {chunks_sent} chunks)")


@app.post("/parse")
async def parse_endpoint(req: ParseRequest):
    """Parse natural language into propositions (Layer 1 only)."""
    result = parse_propositions(req.input)
    return result


@app.post("/analyze")
async def analyze_endpoint(req: AnalyzeRequest):
    """
    Full analysis pipeline:
    1. Parse input → propositions (BLOCKING — everything depends on this)
    2. Parallel: validity, contradictions, fallacies, ambiguities, tensions, temporal_drift
    3. Reconstruct argument (depends on phase 2 results)
    """
    total_start = time.time()
    print(f"Received request: {req.input[:100]}{'...' if len(req.input) > 100 else ''}")

    session_id = req.session_id or str(uuid.uuid4())
    session = sessions.get(session_id, {"propositions": [], "turn": 0, "prop_counter": 0, "rel_counter": 0})
    session["turn"] += 1
    turn_number = session["turn"]
    previous_propositions = session["propositions"]

    # PHASE 1: Parse (MUST run first — everything depends on this)
    with Timer("1. Proposition Parsing"):
        parse_result = parse_propositions(
            req.input,
            previous_propositions=previous_propositions if previous_propositions else None,
            turn_number=turn_number,
        )

    propositions = parse_result.get("propositions", [])
    relationships = parse_result.get("relationships", [])
    argument_structure = parse_result.get("argumentStructure", None)
    thought_summary = parse_result.get("thoughtSummary", "")

    # Ensure unique IDs across multiple turns by remapping Gemini's IDs
    prop_id_map = {}
    for prop in propositions:
        old_id = prop.get("id", "")
        new_id = f"prop_{session['prop_counter']}"
        prop["id"] = new_id
        prop_id_map[old_id] = new_id
        session["prop_counter"] += 1

    # Update relationship IDs and references (handle fromId/from_id/source/from, toId/to_id/target/to)
    for rel in relationships:
        old_from = (
            rel.get("fromId") or rel.get("from_id") or rel.get("source") or rel.get("from") or ""
        )
        old_to = rel.get("toId") or rel.get("to_id") or rel.get("target") or rel.get("to") or ""

        rel["id"] = f"rel_{session['rel_counter']}"
        session["rel_counter"] += 1

        # Remap proposition references
        if old_from in prop_id_map:
            rel["fromId"] = prop_id_map[old_from]
            rel["from_id"] = prop_id_map[old_from]
        if old_to in prop_id_map:
            rel["toId"] = prop_id_map[old_to]
            rel["to_id"] = prop_id_map[old_to]

    # Map types for React Flow compatibility (Person B's components)
    map_types_for_react_flow(propositions, relationships)

    # Merge with previous propositions for cumulative analysis
    all_propositions = previous_propositions + propositions

    # PHASE 2: Run analysis engines in PARALLEL (ThreadPoolExecutor for sync Gemini calls)
    def _temporal_drift_wrapper():
        if previous_propositions:
            return detect_temporal_drift(previous_propositions, propositions)
        return {"temporalDrifts": [], "refinements": []}

    with Timer("2. Parallel Analysis (validity, contradictions, fallacies, ambiguities, tensions, temporal)"):
        (
            validity_result,
            contradictions,
            fallacies,
            ambiguities,
            tensions,
            temporal_result,
        ) = await asyncio.gather(
            safe_call("validity", check_validity, all_propositions, relationships, argument_structure, default={}),
            safe_call("contradictions", detect_contradictions, all_propositions, relationships),
            safe_call("fallacies", detect_fallacies, all_propositions, relationships),
            safe_call("ambiguities", detect_ambiguities, all_propositions),
            safe_call("tensions", detect_tensions, all_propositions, relationships),
            safe_call("temporal_drift", _temporal_drift_wrapper, default={"temporalDrifts": [], "refinements": []}),
        )

    validity_result = validity_result or {}
    contradictions = contradictions or []
    fallacies = fallacies or []
    ambiguities = ambiguities or []
    tensions = tensions or []
    temporal_result = temporal_result or {"temporalDrifts": [], "refinements": []}

    # PHASE 3: Reconstruct argument (depends on phase 2 results)
    reconstruction = await safe_call(
        "reconstruction",
        reconstruct_argument,
        all_propositions,
        contradictions,
        ambiguities,
        tensions,
        validity_result,
        default=None,
    )
    
    # Update session
    session["propositions"] = all_propositions
    sessions[session_id] = session
    
    # Build response matching frontend's expected shape
    # Convert to the GraphState / AnalysisResult shape the frontend expects
    
    # Generate argument scores
    argument_scores = []
    for prop in propositions:
        support_count = sum(1 for r in relationships if r.get("toId") == prop["id"] and r.get("type") == "supports")
        contra_count = sum(1 for c in contradictions if prop["id"] in (c.get("propositionIds") or c.get("proposition_ids") or []))
        base = support_count / (support_count + 1)
        penalty = contra_count * 0.3
        score = max(0.0, min(1.0, base - penalty))
        argument_scores.append({
            "propositionId": prop["id"],
            "score": round(score, 2),
            "evidencePaths": support_count,
            "contradictionCount": contra_count,
            "vulnerableAssumptions": sum(1 for p in propositions if p.get("isLoadBearing") and p.get("isImplicit")),
        })
    
    # Add fallacies from validity check to graph-detected fallacies
    for ff in validity_result.get("formalFallacies", []):
        fallacies.append({
            "id": f"fallacy_{uuid.uuid4().hex[:8]}",
            "name": ff.get("name", "Unknown Fallacy"),
            "description": ff.get("description", ""),
            "affectedNodeIds": ff.get("affectedPropositionIds", []),
            "patternType": "invalid_form",
            "formalStructure": ff.get("formalStructure", ""),
        })
    
    # Build insights
    insights = []
    
    # Validity insight
    if validity_result:
        insights.append({
            "id": f"insight_{uuid.uuid4().hex[:8]}",
            "engineType": "precision",
            "content": validity_result.get("validityExplanation", ""),
            "keyQuestion": None,
            "affectedNodeIds": [p["id"] for p in propositions if p.get("type") in ("conclusion", "claim")],
        })
    
    # Reconstruction insight
    if reconstruction:
        insights.append({
            "id": f"insight_{uuid.uuid4().hex[:8]}",
            "engineType": "signal",
            "content": reconstruction.get("presentableArgument", ""),
            "keyQuestion": None,
            "affectedNodeIds": [p["id"] for p in propositions],
        })
    
    # Probing questions from tensions
    for t in tensions:
        insights.append({
            "id": f"insight_{uuid.uuid4().hex[:8]}",
            "engineType": "adversarial",
            "content": t.get("description", ""),
            "keyQuestion": t.get("probingQuestion", None),
            "affectedNodeIds": t.get("propositionIds", []),
        })
    
    # Ambiguity questions
    for a in ambiguities:
        insights.append({
            "id": f"insight_{uuid.uuid4().hex[:8]}",
            "engineType": "assumption",
            "content": f"The term '{a.get('ambiguousTerm', '')}' is ambiguous in your argument.",
            "keyQuestion": a.get("questionForUser", None),
            "affectedNodeIds": a.get("propositionIds", []),
        })
    
    response_payload = {
        "sessionId": session_id,
        "turnNumber": turn_number,
        "propositions": propositions,
        "relationships": relationships,
        "argumentStructure": argument_structure,
        "contradictions": contradictions,
        "ambiguities": ambiguities,
        "tensions": tensions,
        "temporalDrifts": temporal_result.get("temporalDrifts", []),
        "refinements": temporal_result.get("refinements", []),
        "fallacies": fallacies,
        "biases": [],  # TODO: Kahneman bias detection
        "insights": insights,
        "thoughtSummaries": [{"text": thought_summary, "timestamp": time.time()}],
        "groundingResults": [],  # TODO: Google Search grounding
        "argumentScores": argument_scores,
        "reconstruction": reconstruction,
        "validity": validity_result,
    }
    total_elapsed = time.time() - total_start
    print(f"\n🏁 TOTAL PIPELINE: {total_elapsed:.2f}s\n")
    return response_payload


@app.post("/analyze/stream")
async def analyze_stream_endpoint(req: AnalyzeRequest):
    """SSE streaming — sends graph first, then analysis results as each completes in parallel."""

    async def event_stream():
        def send_event(event_type: str, data: dict):
            safe_data = _safe_serialize(data)
            event = {"type": event_type, "data": safe_data, "timestamp": time.time()}
            return f"data: {json.dumps(event)}\n\n"

        session_id = req.session_id or str(uuid.uuid4())
        session = sessions.get(
            session_id, {"propositions": [], "turn": 0, "prop_counter": 0, "rel_counter": 0}
        )
        session["turn"] += 1
        turn_number = session["turn"]
        previous_propositions = session["propositions"]

        try:
            yield send_event("analysis_started", {"step": "parsing"})

            # Phase 1: Parse (must complete first)
            parse_result = parse_propositions(
                req.input,
                previous_propositions=previous_propositions if previous_propositions else None,
                turn_number=turn_number,
            )
            propositions = parse_result.get("propositions", [])
            relationships = parse_result.get("relationships", [])
            argument_structure = parse_result.get("argumentStructure", None)
            thought_summary = parse_result.get("thoughtSummary", "")

            # ID remapping
            prop_id_map = {}
            for prop in propositions:
                old_id = prop.get("id", "")
                new_id = f"prop_{session['prop_counter']}"
                prop["id"] = new_id
                prop_id_map[old_id] = new_id
                session["prop_counter"] += 1
            for rel in relationships:
                old_from = rel.get("fromId") or rel.get("from_id") or rel.get("source") or rel.get("from") or ""
                old_to = rel.get("toId") or rel.get("to_id") or rel.get("target") or rel.get("to") or ""
                rel["id"] = f"rel_{session['rel_counter']}"
                session["rel_counter"] += 1
                if old_from in prop_id_map:
                    rel["fromId"] = rel["from_id"] = prop_id_map[old_from]
                if old_to in prop_id_map:
                    rel["toId"] = rel["to_id"] = prop_id_map[old_to]

            map_types_for_react_flow(propositions, relationships)
            all_propositions = previous_propositions + propositions

            # Send graph immediately — user sees nodes + edges while analysis runs
            yield send_event("propositions_parsed", {
                "propositions": propositions,
                "relationships": relationships,
                "argumentStructure": argument_structure,
                "thoughtSummaries": [{"text": thought_summary, "timestamp": time.time()}],
            })

            # Phase 2: Fire all analysis engines in PARALLEL; stream each as it completes
            def _temporal_wrapper():
                if previous_propositions:
                    return detect_temporal_drift(previous_propositions, propositions)
                return {"temporalDrifts": [], "refinements": []}

            task_to_event = {}
            task_to_event[asyncio.create_task(
                asyncio.to_thread(check_validity, all_propositions, relationships, argument_structure)
            )] = ("validity_checked", "validity", lambda r: {"validity": r})
            task_to_event[asyncio.create_task(
                detect_contradictions(all_propositions, relationships)
            )] = ("contradictions_found", "contradictions", lambda r: {"contradictions": r})
            task_to_event[asyncio.create_task(
                asyncio.to_thread(detect_fallacies, all_propositions, relationships)
            )] = ("fallacies_found", "fallacies", lambda r: {"fallacies": r})
            task_to_event[asyncio.create_task(
                asyncio.to_thread(detect_ambiguities, all_propositions)
            )] = ("ambiguities_found", "ambiguities", lambda r: {"ambiguities": r})
            task_to_event[asyncio.create_task(
                asyncio.to_thread(detect_tensions, all_propositions, relationships)
            )] = ("tensions_found", "tensions", lambda r: {"tensions": r})
            task_to_event[asyncio.create_task(
                asyncio.to_thread(_temporal_wrapper)
            )] = ("temporal_drift_found", "temporal", lambda r: r)

            results = {}
            pending = set(task_to_event.keys())
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    event_type, key, payload_fn = task_to_event[task]
                    try:
                        result = task.result()  # raises if task failed
                        if isinstance(result, Exception):
                            print(f"⚠️ {event_type} failed: {result}")
                            continue
                        if asyncio.iscoroutine(result):
                            print(f"⚠️ {event_type} returned unawaited coroutine: {result}")
                            continue
                        results[key] = result
                        if event_type == "temporal_drift_found" and not result.get("temporalDrifts"):
                            continue
                        payload = payload_fn(result) if event_type != "temporal_drift_found" else result
                        yield send_event(event_type, payload)
                    except Exception as e:
                        print(f"⚠️ {event_type} failed: {e}")

            # Phase 3: Reconstruction (depends on validity, contradictions, ambiguities, tensions)
            validity_result = results.get("validity", {}) or {}
            contradictions = results.get("contradictions", []) or []
            ambiguities = results.get("ambiguities", []) or []
            tensions = results.get("tensions", []) or []
            reconstruction = reconstruct_argument(
                all_propositions, contradictions, ambiguities, tensions, validity_result
            )
            yield send_event("argument_reconstructed", {"reconstruction": reconstruction})

            session["propositions"] = all_propositions
            sessions[session_id] = session
            yield send_event("analysis_complete", {"sessionId": session_id})

        except Exception as e:
            err_msg = str(e)
            # Never send coroutine repr to frontend
            if "coroutine object" in err_msg:
                err_msg = "An internal error occurred during analysis."
                print(f"⚠️ Caught exception containing coroutine: {e}")
            yield send_event("error", {"message": err_msg})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


def _build_explanation_prompt(
    contradictions: list,
    fallacies: list,
    insights: list,
    round_num: int,
    user_text: str,
) -> str:
    """Build prompt for Gemini to generate a conversational explanation (used by POST /api/explain)."""
    parts = []
    parts.append(
        "You are CLARITY, a reasoning analyst. Generate a brief, conversational "
        "explanation of these analysis results. Speak as if talking to the user directly. "
        "Keep it under 4 sentences. Be warm but precise."
    )
    if round_num > 1:
        parts.append("This is a follow-up round. Only mention NEW findings.")
    parts.append(f"\nThe user said: \"{user_text[:200]}\"")
    if contradictions and len(contradictions) > 0:
        parts.append("\nContradictions found:")
        for c in contradictions[:2]:
            desc = (c.get("description") or c.get("explanation") or "") if isinstance(c, dict) else str(c)
            if desc:
                parts.append(f"  - {desc[:150]}")
    if fallacies and len(fallacies) > 0:
        parts.append("\nFallacies:")
        for f in fallacies[:2]:
            name = (f.get("name") or f.get("type") or "") if isinstance(f, dict) else ""
            if name:
                parts.append(f"  - {name}")
    if not contradictions and not fallacies:
        if insights and len(insights) > 0:
            parts.append("\nKey insight:")
            ins = insights[0]
            text = (
                ins
                if isinstance(ins, str)
                else (ins.get("content") or ins.get("text") or str(ins))
                if isinstance(ins, dict)
                else str(ins)
            )
            parts.append(f"  - {text[:150]}")
        else:
            parts.append("\nNo major issues found. The reasoning appears consistent.")
    parts.append("\nGenerate ONLY the spoken explanation. No preamble, no markdown.")
    return "\n".join(parts)


async def run_analysis_and_send(
    websocket: WebSocket,
    text: str,
    round_num: int = 1,
):
    """
    Run CLARITY's analysis pipeline and stream results to frontend.
    NO Gemini Live injection — analysis is separate from voice.
    """
    total_start = time.time()
    print(f"🔬 Starting analysis pipeline round {round_num}: {len(text)} chars")

    try:
        if not text.strip():
            await websocket.send_json({"type": "error", "message": "No text to analyze"})
            return

        session_data = {"propositions": [], "turn": 1, "prop_counter": 0, "rel_counter": 0}

        loop = asyncio.get_event_loop()
        parse_result = await loop.run_in_executor(executor, lambda: parse_propositions(text.strip()))
        propositions = parse_result.get("propositions", []) if isinstance(parse_result, dict) else []
        relationships = parse_result.get("relationships", []) if isinstance(parse_result, dict) else []
        argument_structure = parse_result.get("argumentStructure") if isinstance(parse_result, dict) else None

        parsing_degraded = len(propositions) > 0 and len(relationships) == 0
        if parsing_degraded:
            print(f"⚠️ Parsing degraded (0 relationships) — likely 429 fallback")
        print(f"⏱️ Parsing: {time.time() - total_start:.2f}s — {len(propositions)} propositions, {len(relationships)} relationships")

        prop_id_map = {}
        for prop in propositions:
            old_id = prop.get("id", "")
            new_id = f"prop_{session_data['prop_counter']}"
            prop["id"] = new_id
            prop_id_map[old_id] = new_id
            session_data["prop_counter"] += 1
        for rel in relationships:
            old_from = rel.get("fromId") or rel.get("from_id") or rel.get("source") or rel.get("from") or ""
            old_to = rel.get("toId") or rel.get("to_id") or rel.get("target") or rel.get("to") or ""
            rel["id"] = f"rel_{session_data['rel_counter']}"
            session_data["rel_counter"] += 1
            if old_from in prop_id_map:
                rel["fromId"] = rel["from_id"] = prop_id_map[old_from]
            if old_to in prop_id_map:
                rel["toId"] = rel["to_id"] = prop_id_map[old_to]

        map_types_for_react_flow(propositions, relationships)
        all_propositions = propositions

        await websocket.send_json({
            "type": "graph",
            "data": _safe_serialize({
                "propositions": propositions,
                "relationships": relationships,
                "round": round_num,
                "degraded": parsing_degraded,
            }),
        })

        def _temporal_wrapper():
            return {"temporalDrifts": [], "refinements": []}

        # Stagger analysis calls to avoid 429 burst
        contradiction_task = asyncio.create_task(
            safe_call_with_retry("contradictions", detect_contradictions, all_propositions, relationships)
        )
        await asyncio.sleep(0.5)
        (
            validity_result,
            fallacies,
            ambiguities,
            tensions,
            temporal_result,
        ) = await asyncio.gather(
            safe_call_with_retry("validity", check_validity, all_propositions, relationships, argument_structure, default={}),
            safe_call_with_retry("fallacies", detect_fallacies, all_propositions, relationships),
            safe_call_with_retry("ambiguities", detect_ambiguities, all_propositions),
            safe_call_with_retry("tensions", detect_tensions, all_propositions, relationships),
            safe_call("temporal_drift", _temporal_wrapper, default={"temporalDrifts": [], "refinements": []}),
        )
        contradictions = await contradiction_task

        validity_result = validity_result or {}
        contradictions = contradictions or []
        fallacies = fallacies or []
        ambiguities = ambiguities or []
        tensions = tensions or []
        print(f"📊 Analysis results: {len(contradictions)} contradictions, {len(fallacies)} fallacies")

        for ff in validity_result.get("formalFallacies", []):
            fallacies.append({
                "id": f"fallacy_{uuid.uuid4().hex[:8]}",
                "name": ff.get("name", "Unknown Fallacy"),
                "description": ff.get("description", ""),
                "affectedNodeIds": ff.get("affectedPropositionIds", []),
                "patternType": "invalid_form",
            })

        reconstruction = await safe_call_with_retry(
            "reconstruction",
            reconstruct_argument,
            all_propositions,
            contradictions,
            ambiguities,
            tensions,
            validity_result,
            default=None,
        )

        insights = []
        if validity_result.get("validityExplanation"):
            insights.append({
                "id": f"insight_{uuid.uuid4().hex[:8]}",
                "engineType": "precision",
                "content": validity_result.get("validityExplanation", ""),
                "keyQuestion": None,
                "affectedNodeIds": [p["id"] for p in propositions if p.get("type") in ("conclusion", "claim")],
            })
        if reconstruction and reconstruction.get("presentableArgument"):
            insights.append({
                "id": f"insight_{uuid.uuid4().hex[:8]}",
                "engineType": "signal",
                "content": reconstruction.get("presentableArgument", ""),
                "keyQuestion": None,
                "affectedNodeIds": [p["id"] for p in propositions],
            })
        for t in tensions:
            insights.append({
                "id": f"insight_{uuid.uuid4().hex[:8]}",
                "engineType": "adversarial",
                "content": t.get("description", ""),
                "keyQuestion": t.get("probingQuestion"),
                "affectedNodeIds": t.get("propositionIds", []),
            })
        for a in ambiguities:
            insights.append({
                "id": f"insight_{uuid.uuid4().hex[:8]}",
                "engineType": "assumption",
                "content": f"The term '{a.get('ambiguousTerm', '')}' is ambiguous in your argument.",
                "keyQuestion": a.get("questionForUser"),
                "affectedNodeIds": a.get("propositionIds", []),
            })

        await websocket.send_json({"type": "contradictions", "data": _safe_serialize(contradictions)})
        await websocket.send_json({"type": "fallacies", "data": _safe_serialize(fallacies)})
        await websocket.send_json({"type": "insights", "data": _safe_serialize(insights)})
        await websocket.send_json({"type": "analysis_complete"})
        print(f"🏁 Analysis round {round_num}: {time.time() - total_start:.2f}s")

    except Exception as e:
        print(f"❌ Analysis pipeline error: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({"type": "error", "message": f"Analysis failed: {str(e)}"})
        except Exception:
            pass


@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    """
    WebSocket for voice mode: Gemini Live Phase 1 (brief acknowledgment) + analysis pipeline.

    NO Phase 2 injection — analysis results go to frontend only; user clicks "Ask CLARITY"
    for spoken explanation via POST /api/explain.

    Client sends:
      {"type": "audio", "data": "<base64 PCM>"} — stream mic audio to Gemini
      {"type": "analyze", "text": "...", "round": N} — run CLARITY analysis (no Gemini injection)

    Server sends:
      {"type": "audio", "data": "<base64>"} — Gemini Phase 1 acknowledgment
      {"type": "turn_complete"} {"type": "interrupted"}
      {"type": "graph", "data": {...}} {"type": "contradictions", "data": [...]}
      {"type": "fallacies", "data": [...]} {"type": "insights", "data": [...]}
      {"type": "analysis_complete"} {"type": "error", "message": "..."}
    """
    if not GEMINI_LIVE_AVAILABLE:
        await websocket.close(code=1011, reason="Gemini Live not configured")
        return

    await websocket.accept()
    gemini_session = None
    analysis_task = None

    try:
        gemini_session = GeminiLiveSession()
        await gemini_session.connect()
        print("✅ Gemini Live connected")

        async def forward_gemini_responses():
            try:
                async for msg_type, data in gemini_session.receive_responses():
                    if msg_type == "audio":
                        audio_b64 = base64.b64encode(data).decode("utf-8")
                        await websocket.send_json({"type": "audio", "data": audio_b64})
                    elif msg_type == "text":
                        await websocket.send_json({"type": "transcript", "text": data})
                    elif msg_type == "turn_complete":
                        await websocket.send_json({"type": "turn_complete"})
                    elif msg_type == "interrupted":
                        await websocket.send_json({"type": "interrupted"})
            except Exception as e:
                print(f"⚠️ Gemini Live session ended: {e}")
                try:
                    await websocket.send_json({
                        "type": "gemini_error",
                        "message": "Voice session ended. Analysis continues.",
                    })
                except Exception:
                    pass

        async def handle_browser_messages():
            nonlocal analysis_task
            try:
                while True:
                    data = await websocket.receive_json()
                    if data.get("type") == "audio":
                        audio_b64 = data.get("data", "")
                        if audio_b64:
                            audio_bytes = base64.b64decode(audio_b64)
                            await gemini_session.send_audio(audio_bytes)
                    elif data.get("type") == "analyze":
                        text_to_analyze = data.get("text", "").strip()
                        round_num = data.get("round", 1)
                        print(f"📝 Received analyze request round {round_num}: {len(text_to_analyze)} chars")
                        if text_to_analyze:
                            analysis_task = asyncio.create_task(
                                run_analysis_and_send(websocket, text_to_analyze, round_num)
                            )
                        else:
                            print("⚠️ Empty text — skipping analysis")
            except WebSocketDisconnect:
                print("Browser disconnected")
            except Exception as e:
                print(f"Browser message handling error: {e}")

        await asyncio.gather(
            forward_gemini_responses(),
            handle_browser_messages(),
            return_exceptions=True,
        )

    except Exception as e:
        print(f"Voice WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        if gemini_session:
            await gemini_session.close()
        if analysis_task and not analysis_task.done():
            analysis_task.cancel()
        print("Voice session closed")


# Import WebSocket server
try:
    from engine.websocket_server import VoiceAnalysisServer
    WEBSOCKET_AVAILABLE = True
except ImportError as e:
    print(f"Warning: WebSocket server not available: {e}")
    WEBSOCKET_AVAILABLE = False


def start_websocket_server():
    """Start WebSocket server in background thread."""
    if not WEBSOCKET_AVAILABLE:
        print("[WebSocket] Skipping WebSocket server - dependencies not installed")
        return
    
    try:
        import threading
        import asyncio

        def run_websocket():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                # Bind to 0.0.0.0 so connections work from localhost, 127.0.0.1, or LAN IP
                server = VoiceAnalysisServer(host="0.0.0.0", port=8001)
                print("[WebSocket] Starting server on ws://localhost:8001")
                loop.run_until_complete(server.start())
            except Exception as e:
                print(f"[WebSocket] Error starting server: {e}")
                import traceback
                traceback.print_exc()

        websocket_thread = threading.Thread(target=run_websocket, daemon=True)
        websocket_thread.start()
        print("[FastAPI] WebSocket server thread started")
    except Exception as e:
        print(f"[FastAPI] Error launching WebSocket thread: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    import uvicorn
    
    # Start WebSocket server before FastAPI
    print("[Main] Starting WebSocket server...")
    start_websocket_server()
    print("[Main] WebSocket server started, now starting FastAPI...")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
