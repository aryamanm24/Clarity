"""
WebSocket server for real-time voice analysis.
Handles streaming transcription, incremental parsing, and live updates.
"""

import asyncio
import json
import websockets
from typing import Dict, Set, Optional
from datetime import datetime
import uuid

# Import our existing engines
from .proposition_parser import parse_propositions
from .contradiction_detector import detect_contradictions
from .fallacy_detector import detect_fallacies


class LiveAnalysisSession:
    """
    Manages a single user's live analysis session.
    Maintains state across multiple speech fragments.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.propositions: list = []
        self.relationships: list = []
        self.contradictions = []
        self.fallacies = []
        self.insights = []
        self.transcript_buffer = ""
        self.last_update = datetime.now()
        self.prop_counter = 0
        self.rel_counter = 0

    async def add_transcript_fragment(self, text: str, is_final: bool) -> dict:
        """
        Process a new fragment of transcribed speech.
        Returns updates to send to frontend.
        """
        self.transcript_buffer += " " + text
        self.last_update = datetime.now()

        # If final or complete thought, process it
        if is_final or self._is_complete_thought():
            return await self._process_complete_thought()
        else:
            # Just return the partial transcript for display
            return {
                "type": "transcript_update",
                "data": {
                    "partial_transcript": self.transcript_buffer,
                    "is_complete": False,
                },
            }

    def _is_complete_thought(self) -> bool:
        """Determine if we have a complete thought to analyze."""
        text = self.transcript_buffer.strip()
        if text.endswith((".", "!", "?", "...")):
            return True
        if len(text) > 100:
            return True
        return False

    async def _process_complete_thought(self) -> dict:
        """Process accumulated transcript as a complete thought."""
        thought_text = self.transcript_buffer.strip()
        self.transcript_buffer = ""

        if not thought_text:
            return {"type": "no_update"}

        print(f"[Session {self.session_id}] Processing: {thought_text[:50]}...")

        try:
            # Parse into propositions
            parse_result = parse_propositions(thought_text)
            new_propositions = parse_result.get("propositions", [])
            new_relationships = parse_result.get("relationships", [])

            # Ensure unique IDs for this session
            # Map old prop IDs to new unique IDs
            prop_id_map = {}
            for prop in new_propositions:
                old_id = prop.get("id", "")
                new_id = f"prop_{self.session_id}_{self.prop_counter}"
                prop["id"] = new_id
                prop_id_map[old_id] = new_id
                self.prop_counter += 1
            
            # Update relationship IDs and fix proposition references
            for rel in new_relationships:
                rel["id"] = f"rel_{self.session_id}_{self.rel_counter}"
                self.rel_counter += 1
                
                # Update proposition references to use new IDs
                if "fromId" in rel and rel["fromId"] in prop_id_map:
                    rel["fromId"] = prop_id_map[rel["fromId"]]
                if "from_id" in rel and rel["from_id"] in prop_id_map:
                    rel["from_id"] = prop_id_map[rel["from_id"]]
                if "toId" in rel and rel["toId"] in prop_id_map:
                    rel["toId"] = prop_id_map[rel["toId"]]
                if "to_id" in rel and rel["to_id"] in prop_id_map:
                    rel["to_id"] = prop_id_map[rel["to_id"]]

            # Add to session state
            self.propositions.extend(new_propositions)
            self.relationships.extend(new_relationships)

            # Detect contradictions
            all_contradictions = await detect_contradictions(
                self.propositions, self.relationships
            )

            new_contradictions = [
                c
                for c in all_contradictions
                if c.get("id") not in [e.get("id", "") for e in self.contradictions]
            ]
            self.contradictions = all_contradictions

            # Detect fallacies
            all_fallacies = detect_fallacies(self.propositions, self.relationships)
            new_fallacies = [
                f
                for f in all_fallacies
                if f.get("id") not in [e.get("id", "") for e in self.fallacies]
            ]
            self.fallacies = all_fallacies

            # Determine if we should interrupt
            should_interrupt = self._should_interrupt(
                new_contradictions, new_fallacies
            )
            interruption_message = None

            if should_interrupt:
                interruption_message = self._generate_interruption(
                    new_contradictions, new_fallacies
                )

            return {
                "type": "analysis_update",
                "data": {
                    "new_propositions": new_propositions,
                    "new_relationships": new_relationships,
                    "new_contradictions": new_contradictions,
                    "new_fallacies": new_fallacies,
                    "should_interrupt": should_interrupt,
                    "interruption_message": interruption_message,
                    "thought_text": thought_text,
                },
            }

        except Exception as e:
            print(f"[Session] Error processing thought: {e}")
            return {"type": "error", "error": str(e)}

    def _should_interrupt(self, new_contradictions, new_fallacies) -> bool:
        """Decide if voice agent should interrupt user."""
        if any(c.get("severity") == "critical" for c in new_contradictions):
            return True
        if any(
            f.get("patternType") == "circular"
            or f.get("pattern_type") == "circular"
            for f in new_fallacies
        ):
            return True
        return False

    def _generate_interruption(self, contradictions, fallacies) -> str:
        """Generate a natural-sounding interruption message."""
        if contradictions:
            c = contradictions[0]
            prop_ids = c.get("propositionIds") or c.get("proposition_ids") or []
            prop_dict = {p.get("id"): p for p in self.propositions}

            if len(prop_ids) >= 2:
                p1 = prop_dict.get(prop_ids[0])
                p2 = prop_dict.get(prop_ids[1])

                if p1 and p2:
                    return f"Hold on - you said '{p1.get('statement', '')}' but you also said '{p2.get('statement', '')}'. How do you reconcile that?"

        if fallacies:
            f = fallacies[0]
            pattern = f.get("patternType") or f.get("pattern_type")
            if pattern == "circular":
                return "Wait, I think I'm hearing circular reasoning here. Can you walk me through the logic without using the conclusion to support itself?"

        return "Hold on, I noticed a logical issue. Can we pause and examine that?"


class VoiceAnalysisServer:
    """WebSocket server for real-time voice analysis."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8001):
        self.host = host
        self.port = port
        self.sessions: Dict[str, LiveAnalysisSession] = {}
        self.connections: Set = set()

    async def handler(self, connection):
        """Handle WebSocket connection from frontend."""
        print(f"[WebSocket] New connection from {connection.remote_address}")
        self.connections.add(connection)

        session_id = None

        try:
            async for message in connection:
                data = json.loads(message)
                message_type = data.get("type")

                if message_type == "start_session":
                    session_id = data.get("session_id", f"session_{datetime.now().timestamp()}")
                    self.sessions[session_id] = LiveAnalysisSession(session_id)

                    await connection.send(
                        json.dumps({"type": "session_started", "session_id": session_id})
                    )
                    print(f"[WebSocket] Started session {session_id}")

                elif message_type == "transcript_fragment":
                    if session_id and session_id in self.sessions:
                        session = self.sessions[session_id]
                        text = data.get("text", "")
                        is_final = data.get("is_final", False)

                        result = await session.add_transcript_fragment(text, is_final)

                        await connection.send(json.dumps(result))

                elif message_type == "end_session":
                    if session_id and session_id in self.sessions:
                        del self.sessions[session_id]
                        print(f"[WebSocket] Ended session {session_id}")

        except websockets.exceptions.ConnectionClosed:
            print("[WebSocket] Connection closed")
        except Exception as e:
            print(f"[WebSocket] Error: {e}")
        finally:
            self.connections.discard(connection)
            if session_id and session_id in self.sessions:
                del self.sessions[session_id]

    async def start(self):
        """Start the WebSocket server."""
        print(f"[WebSocket] Starting server on {self.host}:{self.port}")
        async with websockets.serve(self.handler, self.host, self.port):
            await asyncio.Future()  # Run forever


__all__ = ["VoiceAnalysisServer", "LiveAnalysisSession"]
