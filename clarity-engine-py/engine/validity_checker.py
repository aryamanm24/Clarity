"""
Validity Checker: Determines if an argument's conclusion follows from its premises.

This is the core intellectual engine of CLARITY.

A valid deductive argument: If ALL premises are true, the conclusion MUST be true.
An invalid argument: The premises could be true while the conclusion is false.

Common valid forms:
  - Modus Ponens: P → Q, P ∴ Q
  - Modus Tollens: P → Q, ¬Q ∴ ¬P
  - Hypothetical Syllogism: P → Q, Q → R ∴ P → R
  - Disjunctive Syllogism: P ∨ Q, ¬P ∴ Q

Common INVALID forms (formal fallacies):
  - Affirming the Consequent: P → Q, Q ∴ P  (INVALID!)
  - Denying the Antecedent: P → Q, ¬P ∴ ¬Q  (INVALID!)
  - Undistributed Middle: All A are B, All C are B ∴ All A are C  (INVALID!)
"""

from .gemini_client import call_gemini_json
import json


VALIDITY_SYSTEM_PROMPT = """You are a formal logic validity checker.

Given an argument structure (premises and conclusion in symbolic logic), determine:

1. Is this argument VALID? (Does the conclusion follow from the premises by the rules of logic?)
   - A valid argument: it's IMPOSSIBLE for premises to be true and conclusion false
   - An invalid argument: premises COULD be true while conclusion is false

2. What FORM does this argument take?
   - Is it Modus Ponens, Modus Tollens, Hypothetical Syllogism, etc.?
   - Or is it an INVALID form like Affirming the Consequent, Denying the Antecedent?

3. Are there MISSING PREMISES?
   - Sometimes an argument is invalid AS STATED but would become valid with an additional premise
   - Identify what premise is missing and state it explicitly
   - Example: "Socrates is a man, therefore Socrates is mortal" is MISSING "All men are mortal"

4. Is the argument SOUND? (Valid AND all premises are actually true?)
   - You may not be able to determine this without fact-checking, so flag premises that need verification

Respond with JSON:
{
  "isValid": true/false,
  "argumentForm": "Name of the logical form (e.g., Modus Ponens, Affirming the Consequent)",
  "validityExplanation": "Step-by-step explanation of why valid or invalid",
  "missingPremises": ["Any missing premises needed to make the argument valid"],
  "formalFallacies": [
    {
      "name": "Name of fallacy",
      "description": "Explanation",
      "formalStructure": "The invalid logical form shown symbolically",
      "affectedPropositionIds": ["id1", "id2"]
    }
  ],
  "soundnessNotes": "Which premises need fact-checking to determine soundness"
}
"""


def check_validity(
    propositions: list[dict],
    relationships: list[dict],
    argument_structure: dict | None = None,
) -> dict:
    """
    Check whether an argument is logically valid.
    
    Args:
        propositions: List of proposition dicts
        relationships: List of relationship dicts
        argument_structure: Optional pre-parsed argument structure
    
    Returns:
        Validity analysis dict
    """
    
    # Build a clear representation of the argument for Gemini
    premises = []
    conclusion = None
    
    for prop in propositions:
        if prop.get("type") in ("premise", "evidence", "assumption"):
            premises.append(prop)
        elif prop.get("type") == "conclusion":
            conclusion = prop
    
    # If no explicit conclusion was identified, the last claim might be it
    if conclusion is None:
        claims = [p for p in propositions if p.get("type") == "claim"]
        if claims:
            conclusion = claims[-1]
    
    prompt = "Check the validity of this argument:\n\n"
    prompt += "PREMISES:\n"
    for i, p in enumerate(premises, 1):
        prompt += f"  P{i}: {p['statement']}\n"
        prompt += f"      Formal: {p.get('formalExpression', 'N/A')}\n"
    
    if conclusion:
        prompt += f"\nCONCLUSION:\n"
        prompt += f"  C: {conclusion['statement']}\n"
        prompt += f"     Formal: {conclusion.get('formalExpression', 'N/A')}\n"
    else:
        prompt += "\nNO EXPLICIT CONCLUSION FOUND. Identify what the user is implicitly arguing for.\n"
    
    if argument_structure:
        prompt += f"\nPre-parsed structure: {json.dumps(argument_structure)}\n"
    
    result = call_gemini_json(
        prompt=prompt,
        system_instruction=VALIDITY_SYSTEM_PROMPT,
        temperature=0.1,
    )
    
    return result
