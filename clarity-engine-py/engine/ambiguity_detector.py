"""
Ambiguity Detector: Finds terms that could mean different things.

Tier 2 — Ambiguity:
  "I like milk" + "I don't like cow-based products"
  "Milk" is ambiguous — could be cow milk, oat milk, almond milk.
  If cow milk → contradiction. If non-cow milk → no contradiction.
  CLARITY should ask, not assume.

This prevents false contradiction detection and surfaces equivocation fallacies.
"""

import uuid
from .gemini_client import call_gemini_json


AMBIGUITY_SYSTEM_PROMPT = """You are an ambiguity detector for logical arguments.

Given propositions, find terms or phrases that are AMBIGUOUS — they could mean different things,
and the argument's validity DEPENDS on which meaning is intended.

This matters because:
1. Using a word in two different senses is the FALLACY OF EQUIVOCATION
2. A seeming contradiction might dissolve if we clarify what the person meant
3. A seemingly valid argument might become invalid once we pin down definitions

For each ambiguity found:
- ambiguousTerm: the word or phrase that's ambiguous
- propositionIds: which propositions use this term
- possibleMeanings: list of distinct meanings it could have
- questionForUser: a clear, respectful question to ask the user to clarify
- ifResolvedAs: for each possible meaning, what happens to the argument
  (e.g., "cow milk" → "creates contradiction with proposition X", "non-cow milk" → "no contradiction")

ONLY flag genuine ambiguities that affect the argument's logic.
Do NOT flag normal conversational vagueness that doesn't matter.

Respond with JSON:
{
  "ambiguities": [
    {
      "ambiguousTerm": "milk",
      "propositionIds": ["prop_1"],
      "possibleMeanings": ["cow milk", "plant-based milk (oat, almond, soy)", "any animal milk"],
      "questionForUser": "When you say 'milk', do you mean cow milk specifically, or are you including plant-based milks?",
      "ifResolvedAs": {
        "cow milk": "This would contradict your statement about not liking cow-based products",
        "plant-based milk": "No contradiction — you like non-cow milk and dislike cow products, which is consistent",
        "any animal milk": "Partially conflicts — cow is an animal, so this would include cow milk"
      }
    }
  ]
}

If no meaningful ambiguities exist, return: {"ambiguities": []}
"""


def detect_ambiguities(propositions: list[dict]) -> list[dict]:
    """Detect ambiguous terms that affect argument validity."""
    
    prompt = "Find ambiguities in these propositions:\n\n"
    for p in propositions:
        prompt += f"- [{p['id']}] {p['statement']}\n"
    
    try:
        result = call_gemini_json(
            prompt=prompt,
            system_instruction=AMBIGUITY_SYSTEM_PROMPT,
            temperature=0.2,
        )
        
        ambiguities = result.get("ambiguities", [])
        for amb in ambiguities:
            if "id" not in amb:
                amb["id"] = f"amb_{uuid.uuid4().hex[:8]}"
        
        return ambiguities
    except Exception as e:
        print(f"Warning: Gemini ambiguity detection failed: {e}")
        return []
