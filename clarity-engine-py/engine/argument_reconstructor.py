"""
Argument Reconstructor: Takes messy reasoning and rebuilds it as a proper argument.

This is the ZOOMED-OUT vision of CLARITY:
Take what people say → Find the logical structure → Fix the gaps → 
Return a clean, valid argument they can present to their boss, investors, etc.
"""

from .gemini_client import call_gemini_json


RECONSTRUCTOR_SYSTEM_PROMPT = """You are an argument reconstruction assistant.

Given:
1. The user's original propositions (their raw thinking)
2. Any issues found (contradictions, ambiguities, tensions, missing premises)

Your job: Reconstruct their argument as a PROPER, VALID logical argument.

Output:
1. A clear statement of what they're really arguing for (the conclusion)
2. The minimum set of premises needed to validly support that conclusion
3. Any premises they need to ADD (currently missing)
4. Any premises they need to REMOVE or MODIFY (contradictory or ambiguous)
5. The reconstructed argument in a clean format they could present to someone

The tone: You're a helpful colleague helping them organize their thoughts.
Not: "Your argument is bad." 
Instead: "Here's what I think you're really saying, organized clearly."

Respond with JSON:
{
  "reconstructedConclusion": "The clear, one-sentence conclusion",
  "requiredPremises": [
    {"statement": "Premise 1 in clear language", "status": "present" | "missing" | "needs_modification"},
    ...
  ],
  "suggestedModifications": [
    {"original": "What they said", "suggested": "Clearer version", "reason": "Why this change helps"}
  ],
  "presentableArgument": "A clean 3-5 sentence version of their argument that is logically valid and persuasive",
  "strengthScore": 0.0 to 1.0,
  "strengthExplanation": "Why this score"
}
"""


def reconstruct_argument(
    propositions: list[dict],
    contradictions: list[dict],
    ambiguities: list[dict],
    tensions: list[dict],
    validity_result: dict,
) -> dict:
    """Reconstruct the user's messy input as a proper, valid argument."""
    
    prompt = "Reconstruct this argument properly.\n\n"
    prompt += "ORIGINAL PROPOSITIONS:\n"
    for p in propositions:
        prompt += f"- [{p['type']}] {p['statement']}\n"
    
    if contradictions:
        prompt += f"\nCONTRADICTIONS FOUND: {len(contradictions)}\n"
        for c in contradictions:
            prompt += f"- {c.get('humanExplanation', c.get('explanation', ''))}\n"
    
    if ambiguities:
        prompt += f"\nAMBIGUITIES FOUND: {len(ambiguities)}\n"
        for a in ambiguities:
            prompt += f"- Term '{a.get('ambiguousTerm', '')}': {a.get('questionForUser', '')}\n"
    
    if tensions:
        prompt += f"\nTENSIONS FOUND: {len(tensions)}\n"
        for t in tensions:
            prompt += f"- {t.get('description', '')}\n"
    
    if validity_result:
        prompt += f"\nVALIDITY: {'Valid' if validity_result.get('isValid') else 'Invalid'}\n"
        prompt += f"Explanation: {validity_result.get('validityExplanation', '')}\n"
        if validity_result.get("missingPremises"):
            prompt += f"Missing premises: {validity_result['missingPremises']}\n"
    
    try:
        result = call_gemini_json(
            prompt=prompt,
            system_instruction=RECONSTRUCTOR_SYSTEM_PROMPT,
            temperature=0.3,
        )
        return result
    except Exception as e:
        print(f"Warning: Argument reconstruction failed: {e}")
        return {
            "reconstructedConclusion": "Unable to reconstruct",
            "requiredPremises": [],
            "suggestedModifications": [],
            "presentableArgument": "Reconstruction failed due to API error",
            "strengthScore": 0.0,
            "strengthExplanation": str(e),
        }
