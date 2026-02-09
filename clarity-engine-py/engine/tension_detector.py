"""
Tension Detector: Finds practical tensions that aren't logical contradictions.

Tier 3 — Soft Tension:
  "I want a girlfriend" + "I don't wanna go to parties"
  Not logically contradictory — you CAN want a girlfriend AND avoid parties.
  But practically, in many contexts, social events are how people meet.
  
CLARITY's job: Surface the tension, ask a probing question, help the user
think through it. Maybe they have a great answer ("I prefer meeting through
mutual friends"). Or maybe the tension reveals they haven't thought it through.
"""

import uuid
from .gemini_client import call_gemini_json


TENSION_SYSTEM_PROMPT = """You are a practical tension detector for the CLARITY reasoning system.

A "tension" is when two statements aren't logically contradictory, but they pull in different
practical directions — one makes the other HARDER (not impossible) to achieve.

THIS IS NOT A CONTRADICTION. Do NOT treat it as one. It's a thinking prompt.

Examples:
- "I want to save money" + "I eat out every day" — not contradictory (you CAN do both if you earn enough), but there's tension
- "I believe in work-life balance" + "I expect 15-minute Slack response times in evenings" — tension between stated value and actual expectation
- "I want a girlfriend" + "I don't go to social events" — tension in typical social contexts

For each tension:
- propositionIds: the two (or more) propositions in tension
- description: explain the tension clearly and respectfully
- probingQuestion: a question that helps the user THINK DEEPER — not to prove them wrong, but to help them clarify their own position
- culturalContext: if the tension is context-dependent, explain the context (e.g., "In US college culture, parties are a primary way people meet")
- The tone should be: curious, not judgmental. "Help me understand..." not "You're wrong because..."

IMPORTANT: Only flag MEANINGFUL tensions. Don't flag every slight preference difference.
The tension should be something that would actually affect the person's ability to achieve their stated goals.

Respond with JSON:
{
  "tensions": [
    {
      "propositionIds": ["prop_1", "prop_3"],
      "description": "You want X but your stated approach makes X harder to achieve",
      "probingQuestion": "How do you plan to achieve X given your preference for Y? You might have a great answer — I'd love to hear it.",
      "culturalContext": "In the context of..."
    }
  ]
}

If no meaningful tensions exist, return: {"tensions": []}
"""


def detect_tensions(propositions: list[dict], relationships: list[dict]) -> list[dict]:
    """Detect soft practical tensions between propositions."""
    
    prompt = "Find practical tensions in these propositions:\n\n"
    for p in propositions:
        prompt += f"- [{p['id']}] {p['statement']} (type: {p.get('type', '?')}, confidence: {p.get('confidence', '?')})\n"
    
    try:
        result = call_gemini_json(
            prompt=prompt,
            system_instruction=TENSION_SYSTEM_PROMPT,
            temperature=0.3,  # Slightly higher for creative tension detection
        )
        
        tensions = result.get("tensions", [])
        for t in tensions:
            if "id" not in t:
                t["id"] = f"tension_{uuid.uuid4().hex[:8]}"
            t["isResolved"] = False
            t["resolution"] = None
        
        return tensions
    except Exception as e:
        print(f"Warning: Gemini tension detection failed: {e}")
        return []
