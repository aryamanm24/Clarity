"""
Temporal Tracker: Detects when a user contradicts themselves over time.

Tier 4 — Temporal Drift:
  Minute 5: "Our revenue grew 15% in Q3"
  Minute 27: "Revenue has been flat this year"
  
The user doesn't realize they've contradicted themselves because
humans don't have working memory for 30-minute speeches.
CLARITY does.
"""

import uuid
from .gemini_client import call_gemini_json


TEMPORAL_SYSTEM_PROMPT = """You are analyzing whether a user has contradicted themselves across multiple statements made at different times.

You are given:
1. PREVIOUS propositions (from earlier in the conversation)
2. NEW propositions (from the latest input)

Check if any NEW proposition contradicts, weakens, or conflicts with any PREVIOUS proposition.

This is specifically for catching TEMPORAL DRIFT — when someone says something at one point
and then says something incompatible later, without realizing the inconsistency.

For each temporal drift found:
- earlierPropositionId: ID of the earlier proposition
- laterPropositionId: ID of the newer proposition
- explanation: "Earlier you said [X]. Just now you said [Y]. These appear to conflict because [reason]."

ONLY flag genuine contradictions or serious inconsistencies.
If the user is simply REFINING or UPDATING their position (which is good!), 
note that positively: "You've updated your position on X — previously you said Y, now you say Z."

Respond with JSON:
{
  "temporalDrifts": [
    {
      "earlierPropositionId": "prop_1",
      "laterPropositionId": "prop_5",
      "explanation": "..."
    }
  ],
  "refinements": [
    {
      "earlierPropositionId": "prop_2",
      "laterPropositionId": "prop_6",
      "explanation": "You've clarified your position: previously you said X, now you specify Y. This is a positive refinement."
    }
  ]
}
"""


def detect_temporal_drift(
    previous_propositions: list[dict],
    new_propositions: list[dict],
) -> dict:
    """
    Compare new propositions against previous ones to detect temporal drift.
    
    Returns dict with 'temporalDrifts' and 'refinements' lists.
    """
    
    if not previous_propositions:
        return {"temporalDrifts": [], "refinements": []}
    
    prompt = "PREVIOUS STATEMENTS:\n"
    for p in previous_propositions:
        timestamp = p.get("inputTimestamp", "?")
        turn = p.get("inputTurnNumber", "?")
        prompt += f"- [{p['id']}] (Turn {turn}) {p['statement']}\n"
    
    prompt += "\nNEW STATEMENTS:\n"
    for p in new_propositions:
        prompt += f"- [{p['id']}] {p['statement']}\n"
    
    try:
        result = call_gemini_json(
            prompt=prompt,
            system_instruction=TEMPORAL_SYSTEM_PROMPT,
            temperature=0.2,
        )
        
        # Add IDs to drifts
        for drift in result.get("temporalDrifts", []):
            if "id" not in drift:
                drift["id"] = f"drift_{uuid.uuid4().hex[:8]}"
        
        return result
    except Exception as e:
        print(f"Warning: Gemini temporal tracking failed: {e}")
        return {"temporalDrifts": [], "refinements": []}
