"""
Proposition Parser: Translates natural language into formal logical propositions.
This is Layer 1 of CLARITY's pipeline.

The key insight from formal logic:
- Every argument is: Premises → Conclusion
- A VALID argument means: IF premises are true, conclusion MUST be true
- We can check validity by examining the STRUCTURE, regardless of content

This parser extracts that structure from messy human speech.
"""

import uuid
import json
import time
from .gemini_client import call_gemini_json


ENHANCED_FORMAL_EXPRESSION_GUIDELINES = """
FORMAL EXPRESSION GUIDELINES (use rich logical structure, NOT just p, q, r):

For simple atomic claims: "X is true" → X, "X is not true" → ¬X
For conjunctions: "X and Y" → X ∧ Y
For disjunctions: "X or Y" → X ∨ Y
For implications: "If X then Y" → X → Y, "Because X, Y" → X → Y, "X is necessary for Y" → Y → X
For bi-conditionals: "X if and only if Y" → X ↔ Y
For negations: "It is not the case that X" → ¬X
For quantifiers: "All X are Y" → ∀x(X(x) → Y(x)), "Some X are Y" → ∃x(X(x) ∧ Y(x))
For set membership: "X is a type of Y" → X ∈ Y
For comparisons: "X is greater than Y" → X > Y, "X equals Y" → X = Y

Domain patterns (use predicate logic):
- Financial: "cannot afford to lose principal" → preserve_capital ∧ loss_tolerance = 0
- Capacity: "at 120% capacity" → capacity_used = 1.2 × capacity_max
- Preferences: "I love X" → prefer(X), "I hate X" → ¬prefer(X)
- Constraints: "X is optimal" → ∀y (y ≠ X → utility(X) > utility(y))

IMPORTANT: Use predicate logic for properties/relationships, propositional for simple true/false.
Preserve semantic meaning - don't oversimplify to just p, q, r.
When in doubt, use MORE structure rather than less.
"""

PARSER_SYSTEM_PROMPT = """You are a formal logic parser for the CLARITY reasoning analysis system.

Your job: Take natural language input and extract the formal logical structure of the argument.

Every argument has this structure:
  Premise 1
  Premise 2
  ...
  Premise N
  ∴ Conclusion

Your task is to identify:
1. PREMISES — statements offered as reasons/evidence/support
2. CONCLUSION — the claim being argued for (what the person is trying to convince you of)
3. IMPLICIT ASSUMPTIONS — premises that must be true for the argument to work, but were NOT stated
4. EVIDENCE — factual claims offered as support
5. CONSTRAINTS — limitations or blockers mentioned
6. RISKS — potential negative outcomes mentioned

For EACH proposition, provide:
- statement: the natural language version
- formalExpression: translate into RICH symbolic logic notation (NOT just p, q, r)
""" + ENHANCED_FORMAL_EXPRESSION_GUIDELINES + """
- type: "premise", "conclusion", "assumption", "evidence", "constraint", or "risk"
- confidence: 
  * "high" — stated as definite fact
  * "medium" — implied or qualified
  * "low" — speculative or ambiguous (CRITICAL: if a term could mean multiple things, mark as "low")
  * "unstated_as_absolute" — assumed without any justification (anchoring bias signal)
- isImplicit: true if the person didn't explicitly say this but it must be true for their argument to work
- isLoadBearing: true if removing this proposition makes the conclusion unsupported
- isAnchored: true if this appears to be an arbitrary starting value the person fixated on

For RELATIONSHIPS, identify:
- Which premises support the conclusion (type: "concludes_from")
- Which propositions support others (type: "supports")  
- Which propositions contradict each other (type: "contradicts")
- Which propositions depend on assumptions (type: "depends_on" or "assumes")
- Strength: "strong" (direct logical entailment), "moderate" (reasonable inference), "weak" (loose connection)

For the ARGUMENT STRUCTURE, determine:
- Which propositions are premises and which is the conclusion
- What type of inference is being used (deductive, inductive, abductive, analogical)
- Are there MISSING PREMISES? (gaps in the logical chain that the person skipped)
- Is the argument VALID? (does the conclusion logically follow from the premises?)

CRITICAL RULES:
1. Be EXHAUSTIVE with implicit assumptions. Most people's arguments have 2-3x more implicit assumptions than explicit premises.
2. Every "because" signals a premise→conclusion relationship.
3. Every "but" signals a potential tension or contradiction.
4. Every "I think" or "I feel" signals low confidence (System 1 intuition, not System 2 analysis).
5. Every absolute statement without evidence ("this IS the case") signals potential anchoring.
6. If a term is AMBIGUOUS (could mean different things), mark the proposition confidence as "low" and create an implicit assumption making the specific meaning explicit. This prevents false contradiction detection.

Respond with a JSON object with these exact fields:
{
  "propositions": [...],
  "relationships": [...],
  "argumentStructure": {
    "premises": ["id1", "id2"],
    "conclusion": "id3" or null,
    "missingPremises": ["description of gap 1", "description of gap 2"],
    "inferenceType": "deductive" | "inductive" | "abductive" | "analogical",
    "isValid": true | false,
    "validityExplanation": "Why this argument is valid/invalid"
  },
  "thoughtSummary": "Brief explanation of how you parsed this argument"
}

Generate unique IDs for each proposition (use format "prop_1", "prop_2", etc.) and relationship ("rel_1", "rel_2", etc.).
"""


def parse_propositions(
    user_input: str,
    previous_propositions: list[dict] | None = None,
    turn_number: int = 1,
    session_start_timestamp: float | None = None,
) -> dict:
    """
    Parse natural language input into formal propositions.
    
    Args:
        user_input: The user's natural language text
        previous_propositions: Propositions from earlier turns (for multi-turn analysis)
        turn_number: Which turn in the conversation (1, 2, 3...)
        session_start_timestamp: When the session started (for temporal tracking)
    
    Returns:
        Dict with keys: propositions, relationships, argumentStructure, thoughtSummary
    """
    
    # Build the prompt
    prompt = f'Analyze this argument:\n\n"{user_input}"'
    
    if previous_propositions:
        prompt += f"\n\nIMPORTANT CONTEXT — The user has made previous statements in this session. Here are the propositions from earlier turns:\n{json.dumps(previous_propositions, indent=2)}\n\nCheck if any NEW statements conflict with, resolve, or build upon these previous statements."
    
    # Call Gemini with fast model and temperature 0 for speed (with fallback on failure)
    try:
        result = call_gemini_json(
            prompt=prompt,
            system_instruction=PARSER_SYSTEM_PROMPT,
            temperature=0,
            model="gemini-3-flash-preview",
        )
    except Exception as e:
        print(f"Enhanced parsing failed: {e}")
        return _fallback_parse(
            user_input,
            turn_number=turn_number,
        )
    
    # Add metadata to each proposition
    current_time = time.time()
    
    for prop in result.get("propositions", []):
        prop["inputTimestamp"] = current_time
        prop["inputTurnNumber"] = turn_number
        # Ensure required fields exist with defaults
        prop.setdefault("isImplicit", False)
        prop.setdefault("isLoadBearing", False)
        prop.setdefault("isAnchored", False)
        prop.setdefault("confidence", "medium")
        # Generate ID if missing
        if "id" not in prop:
            prop["id"] = f"prop_{uuid.uuid4().hex[:8]}"
    
    # CONSOLIDATE propositions to reduce graph density (target 10-15 nodes)
    original_count = len(result.get("propositions", []))
    if original_count > 15:
        result["propositions"] = _consolidate_propositions(result["propositions"])
        consolidated_count = len(result["propositions"])
        # Update thought summary
        if "thoughtSummary" in result:
            result["thoughtSummary"] += f" (consolidated {original_count} → {consolidated_count} nodes)"
    
    for rel in result.get("relationships", []):
        if "id" not in rel:
            rel["id"] = f"rel_{uuid.uuid4().hex[:8]}"
    
    return result


def _calculate_similarity(text1: str, text2: str) -> float:
    """
    Calculate text similarity using simple word overlap (Jaccard similarity).
    Returns a value between 0.0 (no similarity) and 1.0 (identical).
    """
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    
    return len(intersection) / len(union) if union else 0.0


def _consolidate_propositions(propositions: list) -> list:
    """
    Consolidate similar/redundant propositions to reduce graph density.
    Target: 10-15 nodes instead of 40+.
    
    Algorithm:
    - Group propositions by similarity (>85% word overlap)
    - Keep the highest-confidence version from each group
    - Preserve load-bearing and implicit propositions
    """
    if len(propositions) <= 15:
        return propositions  # Already at target density
    
    consolidated = []
    used_indices = set()
    
    for i, prop1 in enumerate(propositions):
        if i in used_indices:
            continue
        
        # Always keep load-bearing and implicit propositions
        if prop1.get("isLoadBearing") or prop1.get("isImplicit"):
            consolidated.append(prop1)
            used_indices.add(i)
            continue
        
        # Check if this proposition is very similar to any we've already kept
        is_redundant = False
        for kept_prop in consolidated:
            similarity = _calculate_similarity(
                prop1.get("statement", ""),
                kept_prop.get("statement", "")
            )
            
            if similarity > 0.85:  # 85% similar = consolidate
                # Merge into existing proposition (keep higher confidence version)
                conf_map = {"high": 3, "medium": 2, "low": 1, "unstated_as_absolute": 2}
                prop1_conf = conf_map.get(prop1.get("confidence", "medium"), 2)
                kept_conf = conf_map.get(kept_prop.get("confidence", "medium"), 2)
                
                if prop1_conf > kept_conf:
                    # Replace with higher-confidence version
                    kept_prop["statement"] = prop1["statement"]
                    if "formalExpression" in prop1:
                        kept_prop["formalExpression"] = prop1["formalExpression"]
                    if "formal_expression" in prop1:
                        kept_prop["formal_expression"] = prop1["formal_expression"]
                    kept_prop["confidence"] = prop1.get("confidence", "medium")
                
                is_redundant = True
                used_indices.add(i)
                break
        
        if not is_redundant:
            consolidated.append(prop1)
            used_indices.add(i)
    
    reduction = len(propositions) - len(consolidated)
    if reduction > 0:
        print(f"[Consolidation] {len(propositions)} → {len(consolidated)} propositions (removed {reduction} redundant)")
    
    return consolidated


def _fallback_parse(
    user_input: str,
    turn_number: int = 1,
) -> dict:
    """
    Fallback to simpler parsing if enhanced parsing fails.
    Splits into sentences and creates atomic propositions.
    """
    import re
    # Split on sentence boundaries
    sentences = [
        s.strip()
        for s in re.split(r'[.!?]\s+|\n+', user_input)
        if s.strip() and len(s.strip()) > 3
    ]
    if not sentences:
        sentences = [user_input.strip()] if user_input.strip() else ["(no content)"]

    propositions = []
    for i, sentence in enumerate(sentences):
        prop = {
            "id": f"prop_{uuid.uuid4().hex[:8]}",
            "statement": sentence,
            "formalExpression": f"p{i}",
            "formal_expression": f"p{i}",
            "type": "claim",
            "confidence": "medium",
            "isImplicit": False,
            "isLoadBearing": False,
            "isAnchored": False,
            "inputTimestamp": time.time(),
            "inputTurnNumber": turn_number,
        }
        propositions.append(prop)

    return {
        "propositions": propositions,
        "relationships": [],
        "argumentStructure": None,
        "thoughtSummary": f"Used fallback parsing for {len(propositions)} propositions",
    }
