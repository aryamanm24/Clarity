# CLARITY — Complete Technical Documentation

> Comprehensive technical reference for the CLARITY reasoning analysis system.  
> For Devpost submission and developer onboarding.

---

## SECTION 1: PROJECT OVERVIEW

### What is CLARITY?

**CLARITY** is a reasoning analysis system that maps your arguments into formal logic, verifies contradictions with mathematical proofs, and surfaces hidden assumptions, logical fallacies, and practical tensions. It combines AI (Gemini) for natural language understanding with deterministic algorithms (SAT solvers, graph algorithms) for formal verification — so you get both semantic insight and mathematical certainty.

### What Problem Does It Solve?

People make arguments every day — in meetings, in writing, in their heads. But most reasoning contains:
- **Logical contradictions** — statements that cannot both be true
- **Hidden assumptions** — premises taken for granted that may be wrong
- **Fallacies** — circular reasoning, hasty generalizations, false dilemmas
- **Ambiguities** — terms used in multiple senses (equivocation)
- **Tensions** — goals that pull in different directions without being strictly contradictory

CLARITY surfaces these issues and helps users think more clearly.

### What Makes It Unique?

1. **Formal logic + SAT solver** — Not just AI pattern matching. Contradictions are verified by converting propositions to CNF and running a SAT solver (Glucose3). If the formula is UNSAT, the contradiction is *mathematically proven*.
2. **Graph-based fallacy detection** — Circular reasoning, hasty generalization, false dilemma are detected via graph algorithms (NetworkX): cycle detection, centrality, structural patterns.
3. **Dual-pipeline voice architecture** — Voice input uses Gemini Live for Phase 1 (brief acknowledgment) and a separate SSE streaming pipeline for analysis. "Ask CLARITY" pre-generates explanation text and uses Gemini Live in read-aloud mode for instant playback.
4. **Accumulate-then-play audio** — Avoids streaming audio gaps by buffering all chunks and playing as one continuous clip.
5. **Multi-round conversation** — Propositions accumulate across turns; temporal drift detection catches contradictions over time.

---

## SECTION 2: TECH STACK

### Frontend

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4, Framer Motion |
| Graph | @xyflow/react (React Flow) |
| Layout | dagre (hierarchical), custom radial layout |
| Icons | lucide-react |

### Backend

| Category | Technology |
|----------|------------|
| Framework | FastAPI |
| Language | Python 3.12 |
| Server | Uvicorn |
| CORS | FastAPI CORSMiddleware |

### AI/ML

| Model | Use Case | Integration |
|-------|----------|--------------|
| gemini-2.0-flash | Proposition parsing, validity, contradictions (fallback), ambiguity, tension, reconstruction, explanation generation | google-genai SDK, `call_gemini` / `call_gemini_json` |
| gemini-2.5-flash-native-audio-preview | Gemini Live: voice acknowledgment (Phase 1), read-aloud (Ask CLARITY) | google.genai Live API |

### Logic Engine

| Component | Technology |
|-----------|------------|
| SAT Solver | python-sat (Glucose3) |
| Logic parsing | sympy (optional, for complex expressions) |
| Graph algorithms | NetworkX |
| Formal representation | CNF (Conjunctive Normal Form), propositional logic |

### Voice

| Component | Technology |
|-----------|------------|
| User speech → text | Web Speech API (SpeechRecognition) |
| Mic → backend | WebSocket, PCM 16-bit 16kHz, base64 |
| Gemini Live | Bidirectional audio, PCM 16-bit 24kHz output |
| Playback | AudioWorklet (`pcm-playback-processor.js`), or accumulate-then-play via AudioContext |

### Infrastructure

| Communication | Protocol |
|---------------|----------|
| Analysis (text/voice) | REST → Next.js API route → Python `/analyze/stream` (SSE) |
| Voice mode | WebSocket `ws://localhost:8000/ws/voice` |
| Ask CLARITY | WebSocket `ws://localhost:8000/ws/explain` |
| Pre-generate explanation | REST `POST /api/generate-explanation` (via Next.js proxy) |

---

## SECTION 3: ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
         │                                    │
         │ Text                               │ Voice
         ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────────────────────────────────┐
│  InputBar (text)    │            │  InputBar (voice)                                │
│  - Text input       │            │  - useSpeechRecognition (Web Speech API)         │
│  - Enter / submit   │            │  - useGeminiLive (WebSocket ws/voice)             │
│                     │            │    - Mic → PCM 16kHz → base64 → WebSocket         │
└──────────┬──────────┘            │    - Gemini Live Phase 1: acknowledgment audio    │
           │                       │  - Stop → transcript → triggerVoiceAnalysis       │
           │                       └──────────────────────┬────────────────────────────┘
           │                                              │
           ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          useAnalysisStream                                           │
│  startAnalysis() / triggerVoiceAnalysis()                                             │
│  POST /api/analyze/stream → fetches Next.js → proxies to Python /analyze/stream       │
└─────────────────────────────────────────────────────────────────────────────────────┘
           │
           │ SSE stream
           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     Python Backend (FastAPI)                                         │
│                                                                                      │
│  /analyze/stream (SSE):                                                              │
│    1. parse_propositions (Gemini)     → propositions_parsed                           │
│    2. PARALLEL: validity, contradictions, fallacies, ambiguities, tensions, temporal│
│    3. reconstruct_argument            → argument_reconstructed                       │
│    4. analysis_complete                                                              │
│                                                                                      │
│  /ws/voice:                                                                          │
│    - Receives audio from browser → Gemini Live → Phase 1 acknowledgment               │
│    - Receives {"type":"analyze","text":"..."} → run_analysis_and_send()              │
│      (same pipeline as /analyze/stream, streams graph → contradictions → fallacies)  │
│                                                                                      │
│  /ws/explain:                                                                        │
│    - Receives pre-generated text → Gemini Live read-aloud → PCM 24kHz → base64       │
│                                                                                      │
│  /api/generate-explanation:                                                          │
│    - POST {contradictions, fallacies, insights} → Gemini → {explanation}            │
└─────────────────────────────────────────────────────────────────────────────────────┘
           │
           │ graphState updates
           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND STATE                                               │
│  graphState: { propositions, relationships, contradictions, fallacies, insights }    │
│  analysisPhase: 'idle' | 'parsing' | 'analyzing' | 'complete' | 'error'              │
└─────────────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────────┐
│  ClarityGraph       │  │  Sidebar            │  │  Ask CLARITY                    │
│  - React Flow       │  │  - FormalProofViewer│  │  - cachedExplanation            │
│  - Dagre / Radial   │  │  - CircularReasoning│  │  - POST /api/generate-explanation│
│  - Nodes, edges     │  │  - Insights         │  │  - WS /ws/explain               │
│  - Contradiction    │  │  - Summary cards    │  │  - accumulate-then-play         │
│    flash            │  │                     │  │                                 │
└─────────────────────┘  └─────────────────────┘  └─────────────────────────────────┘
```

---

## SECTION 4: FRONTEND COMPONENTS

### Pages

| File | Purpose | Key elements |
|------|---------|--------------|
| `src/app/page.tsx` | Home page | Examples, text input, mic → `/analyze?mode=voice` |
| `src/app/analyze/page.tsx` | Core analyze experience | Graph, sidebar, InputBar, voice mode, Ask CLARITY, useAnalysisStream, useGeminiLive |
| `src/app/benchmarks/page.tsx` | Benchmarks | BenchmarkDashboard, methodology |
| `src/app/how-it-works/page.tsx` | How It Works | Explains pipeline |
| `src/app/about/page.tsx` | About | Project info |
| `src/app/voice/page.tsx` | Voice page | Voice-specific entry |

### Layout & Shared

| File | Purpose | Renders |
|------|---------|---------|
| `src/components/layout/Header.tsx` | Nav + theme toggle | Links: Home, Analyze, Benchmarks, How It Works; Sun/Moon toggle |
| `src/app/layout.tsx` | Root layout | Provides theme context |

### Graph

| File | Purpose | Props | State |
|------|---------|-------|-------|
| `src/components/graph/ClarityGraph.tsx` | Argument map | `graphState`, `onNodeSelect`, `selectedNodeId`, `isAnalyzing` | `layoutMode` (dagre/radial), `hoveredNodeId`, `showContradictionFlash` |
| `src/components/graph/nodes/ClaimNode.tsx` | Claim node | — | — |
| `src/components/graph/nodes/EvidenceNode.tsx` | Evidence node | — | — |
| `src/components/graph/nodes/AssumptionNode.tsx` | Assumption node | — | — |

### Sidebar Components

| File | Purpose | Props |
|------|---------|-------|
| `src/components/proof/FormalProofViewer.tsx` | Contradiction + formal proof | `contradiction`, `propositions`, `variant` |
| `src/components/proof/CircularReasoningViewer.tsx` | Circular fallacy | `fallacy`, `propositions`, `variant` |
| `src/components/panels/InsightPanel.tsx` | Insights list | — |
| `src/components/panels/BiasDashboard.tsx` | Bias dashboard | — |
| `src/components/panels/ExportPanel.tsx` | Export | — |

### Input & Voice

| File | Purpose | Props |
|------|---------|-------|
| `src/components/input/InputBar.tsx` | Text + voice input | `onAnalyze`, `isAnalyzing`, `geminiLive`, `onStopVoice`, `micBarExpanded` |

### Hooks

| File | Purpose | Returns |
|------|---------|---------|
| `src/hooks/useAnalysisStream.ts` | SSE analysis | `graphState`, `isAnalyzing`, `analysisPhase`, `error`, `startAnalysis`, `reset`, `applyVoiceResult`, `triggerVoiceAnalysis` |
| `src/hooks/useGeminiLive.ts` | Voice WebSocket + playback | `startRecording`, `stopAndAnalyze`, `stopPlayback`, `initAudioPlayback`, `queueAudioChunk`, `isRecording`, `isGeminiSpeaking`, etc. |
| `src/hooks/useSpeechRecognition.ts` | Web Speech API | `transcript`, `interimTranscript`, `isListening`, `startListening`, `stopListening`, `resetTranscript` |
| `src/hooks/useVoiceMode.ts` | Voice mode orchestration | — |
| `src/hooks/useBackendData.ts` | Backend data fetch | — |
| `src/hooks/useLiveAnalysis.ts` | Live analysis | — |
| `src/hooks/useMockStream.ts` | Mock stream | — |

---

## SECTION 5: BACKEND ENDPOINTS

| Route | Method | Purpose | Request | Response |
|-------|--------|---------|---------|----------|
| `/health` | GET | Health check | — | `{status, version, service}` |
| `/parse` | POST | Layer 1 only | `{input}` | `{propositions, relationships, argumentStructure, thoughtSummary}` |
| `/analyze` | POST | Full pipeline (blocking) | `{input, session_id?, engines?}` | Full analysis JSON |
| `/analyze/stream` | POST | SSE streaming | `{input, session_id?, engines?}` | SSE: `propositions_parsed`, `validity_checked`, `contradictions_found`, `fallacies_found`, etc. |
| `/api/generate-explanation` | POST | Pre-generate explanation | `{contradictions, fallacies, insights, round, userText}` | `{explanation}` |
| `/api/explain` | POST | Legacy text explanation | Same as generate-explanation | `{explanation}` |
| `/ws/voice` | WebSocket | Voice mode | `{type:"audio", data:base64}` or `{type:"analyze", text, round}` | `{type:"audio"|"graph"|"contradictions"|"fallacies"|"insights"|"analysis_complete"|"turn_complete"}` |
| `/ws/explain` | WebSocket | Ask CLARITY voice | `{summary, mode:"read_aloud"}` | `{type:"audio", data:base64}` then `{type:"turn_complete"}` |

### SSE Event Types (from `/analyze/stream`)

- `analysis_started`
- `propositions_parsed` — graph data
- `validity_checked`
- `contradictions_found`
- `fallacies_found`
- `ambiguities_found`
- `tensions_found`
- `temporal_drift_found`
- `argument_reconstructed`
- `analysis_complete`
- `error`

---

## SECTION 6: ANALYSIS PIPELINE (THE CORE ENGINE)

### 1. Proposition Parser (`engine/proposition_parser.py`)

**Purpose:** Turn natural language into formal propositions and relationships.

**Input:** `user_input: str`, optional `previous_propositions`, `turn_number`

**Output:** `{propositions, relationships, argumentStructure, thoughtSummary}`

**Model:** `gemini-2.0-flash` via `call_gemini_json`. Prompt: `PARSER_SYSTEM_PROMPT` + `ENHANCED_FORMAL_EXPRESSION_GUIDELINES`.

**Proposition types:** premise, conclusion, assumption, evidence, constraint, risk.

**Relationship types:** concludes_from, supports, contradicts, depends_on, assumes.

**Confidence:** high, medium, low, unstated_as_absolute.

**Consolidation:** If >15 propositions, `_consolidate_propositions()` merges similar ones (85% word overlap).

**Fallback:** On failure, `_fallback_parse()` splits on sentence boundaries into atomic propositions.

**Typical duration:** ~2–5 seconds.

---

### 2. SAT Solver / Contradiction Detector (`engine/contradiction_detector.py` + `engine/sat_verifier.py`)

**Purpose:** Detect contradictions with formal proofs.

**Tiers:**
- **Tier 0:** `_extract_semantic_implications()` — Gemini extracts implicit relationships (e.g. vegan + eggs → contradiction).
- **Tier 1:** `SATVerifier.detect_contradictions()` — Primary. Converts propositions + relationships to CNF, runs Glucose3. If UNSAT → contradiction. Minimal unsatisfiable core + formal proof.
- **Tier 2:** Explicit `contradicts` relationships from parser.
- **Tier 3:** Gemini semantic analysis (fallback if SAT finds nothing).

**SAT library:** `pysat` (Glucose3). Optional `sympy` for complex expressions.

**CNF conversion:** `_parse_formal_expression()` handles ¬, ∧, ∨, →, ↔. Relationships: supports → `¬from ∨ to`, contradicts → `¬from ∨ ¬to`.

**Minimal Unsatisfiable Core:** Smallest subset of propositions that still yields UNSAT. Heuristic: remove each proposition and re-run SAT.

**Output:** `{id, propositionIds, type, severity, formalProof, humanExplanation}`

---

### 3. Fallacy Detector (`engine/fallacy_detector.py` + `engine/graph_analyzer.py`)

**Purpose:** Detect structural logical fallacies.

**Method:** `GraphAnalyzer.analyze_all()` builds a NetworkX DiGraph and runs:

- **Circular reasoning:** `nx.simple_cycles()` — cycles in supports/depends_on edges.
- **Hasty generalization:** High-confidence claims with ≤1 evidence predecessor.
- **False dilemma:** Claims with exactly 2 dependencies and formal expression containing "OR".
- **Load-bearing assumptions:** `nx.betweenness_centrality()`, assumptions with score > 0.3.

**Output:** `{id, name, description, affectedNodeIds, patternType}`

---

### 4. Validity Checker (`engine/validity_checker.py`)

**Purpose:** Decide if the argument is valid (conclusion follows from premises).

**Model:** `call_gemini_json` with `VALIDITY_SYSTEM_PROMPT`.

**Checks:** Modus Ponens, Modus Tollens, Affirming the Consequent, Denying the Antecedent, missing premises, soundness.

**Output:** `{isValid, argumentForm, validityExplanation, missingPremises, formalFallacies, soundnessNotes}`

---

### 5. Insight Generator

**Source:** `main.py` builds insights from validity, reconstruction, tensions, ambiguities. Not a separate model call.

**Types:** precision (validity), signal (reconstruction), adversarial (tensions), assumption (ambiguities).

---

### 6. Other Engines

| Engine | File | Purpose |
|--------|------|---------|
| Ambiguity | `engine/ambiguity_detector.py` | Find ambiguous terms (equivocation), ask clarifying questions |
| Tension | `engine/tension_detector.py` | Find practical tensions (not contradictions) |
| Temporal | `engine/temporal_tracker.py` | Detect drift across turns |
| Reconstruction | `engine/argument_reconstructor.py` | Rebuild argument into a valid, presentable form |

---

## SECTION 7: VOICE MODE ARCHITECTURE

### 1. User Speaks

- **Input:** Microphone via `navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } })`
- **Processing:** `ScriptProcessorNode` (4096 samples) → Float32 → Int16 → Uint8 → base64
- **Transcription:** Web Speech API (`useSpeechRecognition`) for live transcript; Gemini Live does *not* transcribe (policy issues)

### 2. Gemini Live Phase 1

- **WebSocket:** `ws://localhost:8000/ws/voice`
- **Flow:** User audio → backend → `gemini_session.send_audio()` → Gemini Live
- **Response:** Brief acknowledgment audio (PCM 24kHz) streamed back
- **System instruction:** "Acknowledge in 1–2 sentences. Say 'Let me analyze that for you.' Do NOT analyze."

### 3. Analysis Trigger

- **On stop:** `onStopVoice(getTranscript)` → `triggerVoiceAnalysis(fullText, roundNumber)`
- **Path:** `POST /api/analyze/stream` (SSE) — same as text mode
- **Voice WebSocket:** When user sends `{type:"analyze", text, round}`, backend runs `run_analysis_and_send()` and streams graph, contradictions, fallacies, insights

### 4. Ask CLARITY

- **Pre-generation:** When `analysisPhase === 'complete'`, `preGenerateExplanation()` calls `POST /api/generate-explanation` with contradictions, fallacies, insights
- **Caching:** `cachedExplanation` stored in state; button enabled when `isExplanationReady`
- **On click:** `handleAskClarity()` opens `ws://localhost:8000/ws/explain`, sends `{summary: cachedExplanation, mode: 'read_aloud'}`
- **Backend:** Gemini Live with system instruction "Read the following text aloud exactly as written."

### 5. Audio Playback

**Accumulate-then-play (primary for Ask CLARITY):**
1. Collect all `{type:"audio", data:base64}` chunks in `audioChunksRef`
2. On `turn_complete`, concatenate → Int16 → Float32 → `AudioBuffer` → single `BufferSource` → play
3. No streaming; avoids gaps

**AudioWorklet (used for Phase 1 voice):** `public/pcm-playback-processor.js` — ring buffer, 300ms pre-buffer, 24kHz.

### 6. Multi-round Conversation

- `conversationHistory` accumulates transcripts
- `triggerVoiceAnalysis(fullText, roundNumber)` sends full text each time
- Backend session stores `previous_propositions`; temporal tracker compares new vs previous

---

## SECTION 8: GRAPH VISUALIZATION

**Library:** @xyflow/react (React Flow)

**Layout:**
- **Dagre (Tree):** `computeLayout()` in `graph-layout.ts` — top-to-bottom, `rankdir: 'TB'`, supports edges reversed so claims appear above evidence
- **Radial:** `computeRadialLayout()` — center = most connected claim, inner/outer rings

**Node types:** claim, evidence, assumption (conclusion/premise/constraint/risk map to these)

**Edge types:** supports (green), contradicts (red dashed, animated), assumes (amber dashed), depends_on, attacks, weakens

**Styling:** `edgeStyles` in `ClarityGraph.tsx` — contradicts: `#ef4444`, strokeDasharray `8 4`, animated

**Interactions:** Click node → select; hover → dim non-connected; pane click → deselect

**Contradiction edges:** Added from `contradictions` data in `useAnalysisStream` when `propositionIds` has ≥2 elements

---

## SECTION 9: DATA FLOW (End-to-End)

### Text Mode

```
User types → InputBar handleSubmit
  → startAnalysis(input)
  → POST /api/analyze/stream (Next.js proxy → Python)
  → parse_propositions (Gemini) ~2–5s
  → propositions_parsed (SSE) → graph renders
  → PARALLEL: validity, contradictions, fallacies, ambiguities, tensions, temporal
  → Each completes → SSE event → updateState()
  → argument_reconstructed
  → analysis_complete
  → preGenerateExplanation() triggered
  → POST /api/generate-explanation → cachedExplanation
Total: ~10–20s
```

### Voice Mode

```
User speaks → Web Speech API transcript
  → Stop → onStopVoice(getTranscript)
  → triggerVoiceAnalysis(fullText, round)
  → POST /api/analyze/stream (same as text)
  → Same SSE flow → graph + sidebar

User clicks Ask CLARITY
  → handleAskClarity()
  → WS /ws/explain
  → Send cachedExplanation
  → Gemini Live read-aloud → audio chunks
  → Accumulate chunks → turn_complete
  → playAccumulatedAudio() → single clip
  → source.onended → setIsClarityExplaining(false)
```

---

## SECTION 10: KEY ALGORITHMS AND INNOVATIONS

1. **Formal logic verification** — Propositions have `formalExpression` in symbolic logic (∧, ∨, →, ¬, etc.). Validity and contradictions are checked against this structure.

2. **SAT solver integration** — `SATVerifier` converts to CNF, runs Glucose3. UNSAT ⇒ provable contradiction. Minimal unsatisfiable core narrows the culprit set.

3. **Parallel analysis** — Validity, contradictions, fallacies, ambiguities, tensions, temporal run in parallel via `asyncio.gather` or `asyncio.wait`.

4. **Dual-pipeline voice** — Phase 1: Gemini Live for acknowledgment. Phase 2: SSE analysis pipeline. No injection of analysis into Live session.

5. **Accumulate-then-play** — Avoids streaming glitches by buffering and playing one continuous buffer.

6. **Incremental graph** — Round 2+ merges new propositions with previous; temporal drift compares across turns.

---

## SECTION 11: FILE TREE

```
clarity/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Home
│   │   ├── layout.tsx                 # Root layout
│   │   ├── analyze/page.tsx           # Core analyze
│   │   ├── benchmarks/page.tsx
│   │   ├── how-it-works/page.tsx
│   │   ├── about/page.tsx
│   │   ├── voice/page.tsx
│   │   └── api/
│   │       ├── analyze/
│   │       │   ├── route.ts
│   │       │   └── stream/route.ts     # SSE proxy
│   │       ├── generate-explanation/route.ts
│   │       ├── explain/route.ts
│   │       ├── parse/route.ts
│   │       └── ...
│   ├── components/
│   │   ├── graph/
│   │   │   ├── ClarityGraph.tsx
│   │   │   ├── nodes/ClaimNode.tsx, EvidenceNode.tsx, AssumptionNode.tsx
│   │   │   └── edges/*.tsx
│   │   ├── input/InputBar.tsx
│   │   ├── layout/Header.tsx
│   │   ├── proof/FormalProofViewer.tsx, CircularReasoningViewer.tsx
│   │   ├── panels/*.tsx
│   │   └── effects/ParticleBackground.tsx
│   ├── hooks/
│   │   ├── useAnalysisStream.ts
│   │   ├── useGeminiLive.ts
│   │   ├── useSpeechRecognition.ts
│   │   └── ...
│   ├── lib/
│   │   ├── types.ts
│   │   ├── graph-layout.ts
│   │   ├── design-tokens.ts
│   │   └── gemini-client.ts
│   └── contexts/ThemeContext.tsx
├── public/
│   └── pcm-playback-processor.js       # AudioWorklet
├── package.json
└── next.config.ts

clarity-engine-py/
├── main.py                             # FastAPI + WebSocket handlers
├── gemini_live.py                     # Gemini Live wrapper
├── engine/
│   ├── proposition_parser.py
│   ├── contradiction_detector.py
│   ├── sat_verifier.py
│   ├── fallacy_detector.py
│   ├── graph_analyzer.py
│   ├── validity_checker.py
│   ├── ambiguity_detector.py
│   ├── tension_detector.py
│   ├── temporal_tracker.py
│   ├── argument_reconstructor.py
│   ├── gemini_client.py
│   └── models.py
├── requirements.txt
└── .env                                # GEMINI_API_KEY
```

---

## SECTION 12: SETUP AND RUNNING

### Prerequisites

- Node.js 20+
- Python 3.12+
- `GEMINI_API_KEY` (Google AI Studio)

### Environment Variables

**Backend (`.env` in `clarity-engine-py/`):**
```
GEMINI_API_KEY=your_key
```

**Frontend (`.env.local`):**
```
GEMINI_API_KEY=your_key
PYTHON_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/voice
```

### Install

```bash
# Frontend
cd clarity
pnpm install

# Backend
cd clarity-engine-py
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Run

```bash
# Terminal 1: Backend
cd clarity-engine-py
python main.py
# or: uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd clarity
pnpm dev
```

Open http://localhost:3000

### Development Notes

- Hard refresh (Cmd+Shift+R) after changing `pcm-playback-processor.js` to clear AudioWorklet cache
- Backend logs: `⏱️`, `🎙️`, `📝`, `📊`, `🏁` for timing and status
