"""
Contradiction Detector: Finds premises that cannot both be true.

Uses SAT solver (primary) for formal logical contradictions,
semantic extraction for domain-specific implications,
then Gemini (fallback) for semantic contradictions.

Tier 0 — Semantic implications: Extract implicit relationships (vegan + eggs → contradiction)
Tier 1 — Hard Contradictions: SAT solver
Tier 2 — Explicit contradiction relationships
Tier 3 — Gemini semantic analysis (fallback)
"""

import asyncio
import uuid
from .gemini_client import call_gemini_json

# Import SAT solver (with fallback if not available)
try:
    from .sat_verifier import SATVerifier
    SAT_AVAILABLE = True
except ImportError as e:
    print(f"Warning: SAT solver not available: {e}")
    SAT_AVAILABLE = False
    SATVerifier = None


SEMANTIC_IMPLICATIONS_PROMPT = """Analyze these propositions for implicit semantic relationships:

{prop_summary}

Identify relationships that are logically implied by domain knowledge:

Examples:
- "I'm vegan" + "I eat eggs" → contradiction (eggs are animal products, vegans don't eat animal products)
- "Capital preservation" + "High-risk investment" → contradiction (high-risk implies possible loss)
- "At capacity" + "Take more work" → contradiction (capacity limit prevents more work)
- "X is necessary for Y" + "Y without X" → contradiction

Return relationships as JSON:
{{
  "relationships": [
    {{
      "from_index": <1-based int>,
      "to_index": <1-based int>,
      "type": "contradicts" | "supports" | "depends_on",
      "reason": "<why this relationship exists>",
      "strength": <0.0 to 1.0>
    }}
  ]
}}

Only include relationships that are logically certain based on domain knowledge, not just probable or possible.
Use 1-based indices (first proposition is 1).
"""

CONTRADICTION_SYSTEM_PROMPT = """You are a contradiction detector for logical arguments.

Given a set of propositions, find ALL pairs (or groups) that CANNOT both be true.

Types of contradictions:
1. LOGICAL: Direct P ∧ ¬P. One proposition affirms what another denies.
   Example: "I like cow milk" + "I don't like cow-based products"
   (cow milk is a cow-based product, so liking cow milk ∧ not liking cow products = contradiction)

2. TEMPORAL: Time-based impossibility.
   Example: "The project takes 12 months" + "We need results in 3 months"

3. EMPIRICAL: Factual incompatibility that requires world knowledge.
   Example: "We'll grow revenue 50% while cutting all marketing spend"

For EACH contradiction found, provide:
- The IDs of the conflicting propositions (minimum set)
- Type: "logical", "temporal", or "empirical"
- Severity: "critical" if both propositions are important to the argument, "major" if one is, "minor" if neither
- A formal proof showing WHY they conflict (use the formal expressions)
- A clear human explanation

IMPORTANT: Do NOT flag things as contradictions if they merely SEEM conflicting but could coexist.
Only flag genuine logical, temporal, or empirical impossibilities.
If two propositions are in TENSION but not strictly contradictory, say so — do NOT call it a contradiction.

Respond with JSON:
{
  "contradictions": [
    {
      "propositionIds": ["id1", "id2"],
      "type": "logical" | "temporal" | "empirical",
      "severity": "critical" | "major" | "minor",
      "formalProof": "p = likes(cow_milk), cow_milk → cow_product, ¬likes(cow_products). p → likes(cow_products) ∧ ¬likes(cow_products). Contradiction.",
      "humanExplanation": "Clear explanation for the user"
    }
  ]
}

If there are NO contradictions, return: {"contradictions": []}
"""


async def _extract_semantic_implications(propositions: list[dict]) -> list[dict]:
    """
    Use Gemini to extract implicit semantic relationships.
    Example: "I'm vegan" + "I eat eggs" → implicit contradiction
    """
    if len(propositions) < 2:
        return []

    prop_summary = "\n".join([
        f"{i+1}. {p.get('statement', '')} (formal: {p.get('formalExpression', p.get('formal_expression', 'N/A'))})"
        for i, p in enumerate(propositions)
    ])

    prompt = SEMANTIC_IMPLICATIONS_PROMPT.format(prop_summary=prop_summary)

    try:
        result = await asyncio.to_thread(
            call_gemini_json,
            prompt=prompt,
            system_instruction="You are a logic expert identifying implicit semantic relationships.",
            temperature=0.1,
        )
    except Exception as e:
        print(f"Semantic extraction failed: {e}")
        return []

    rels = []
    for r in result.get("relationships", []):
        from_idx = int(r.get("from_index", 1)) - 1
        to_idx = int(r.get("to_index", 1)) - 1
        if 0 <= from_idx < len(propositions) and 0 <= to_idx < len(propositions):
            from_id = propositions[from_idx].get("id", "")
            to_id = propositions[to_idx].get("id", "")
            if from_id and to_id:
                rels.append({
                    "id": f"semantic_rel_{uuid.uuid4().hex[:8]}",
                    "fromId": from_id,
                    "toId": to_id,
                    "from_id": from_id,
                    "to_id": to_id,
                    "type": r.get("type", "contradicts"),
                    "strength": r.get("strength", 0.8),
                    "label": r.get("reason", ""),
                })
    return rels


async def detect_contradictions(propositions: list[dict], relationships: list[dict]) -> list[dict]:
    """
    Detect hard contradictions between propositions.
    
    Priority order:
    1. SAT solver (formal logical contradictions with proofs)
    2. Explicit contradiction relationships from parser
    3. Gemini semantic analysis (only if SAT found nothing)
    """
    
    contradictions = []

    # TIER 0: Extract implicit semantic relationships
    semantic_rels = await _extract_semantic_implications(propositions)
    all_relationships = list(relationships) + semantic_rels

    # TIER 1: SAT-based formal contradictions (PRIMARY METHOD)
    if SAT_AVAILABLE and SATVerifier is not None:
        try:
            sat_verifier = SATVerifier()
            sat_contradictions = sat_verifier.detect_contradictions(propositions, all_relationships)
            contradictions.extend(sat_contradictions)
        except Exception as e:
            print(f"Warning: SAT solver failed: {e}")
    
    # TIER 2: Check explicit contradiction relationships
    # (Already marked by the proposition parser)
    for rel in all_relationships:
        if rel.get("type") == "contradicts":
            # Handle both fromId/toId and source/target naming conventions
            from_id = rel.get("fromId") or rel.get("source") or rel.get("from_id")
            to_id = rel.get("toId") or rel.get("target") or rel.get("to_id")
            from_prop = next((p for p in propositions if p.get("id") == from_id), None)
            to_prop = next((p for p in propositions if p.get("id") == to_id), None)
            if from_prop and to_prop:
                contradictions.append({
                    "id": f"contra_{uuid.uuid4().hex[:8]}",
                    "propositionIds": [from_id, to_id],
                    "type": "logical",
                    "severity": "critical" if from_prop.get("isLoadBearing") or to_prop.get("isLoadBearing") else "major",
                    "formalProof": f"Explicit contradiction:\n  {from_prop.get('formalExpression', from_prop.get('formal_expression', '?'))}\n  ⊥ (contradicts)\n  {to_prop.get('formalExpression', to_prop.get('formal_expression', '?'))}",
                    "humanExplanation": f"'{from_prop.get('statement', '')}' directly conflicts with '{to_prop.get('statement', '')}'",
                })
    
    # TIER 3: Use Gemini to detect semantic contradictions (FALLBACK)
    # Only if SAT found nothing (to catch subtle semantic issues)
    if len(contradictions) == 0 and len(propositions) >= 2:
        prompt = "Find all contradictions in these propositions:\n\n"
        for p in propositions:
            prompt += f"- [{p.get('id', '')}] {p.get('statement', '')} (formal: {p.get('formalExpression', p.get('formal_expression', 'N/A'))})\n"

        try:
            gemini_result = await asyncio.to_thread(
                call_gemini_json,
                prompt=prompt,
                system_instruction=CONTRADICTION_SYSTEM_PROMPT,
                temperature=0.1,
            )
            
            # Add Gemini-detected contradictions
            for gc in gemini_result.get("contradictions", []):
                gc["id"] = f"contra_{uuid.uuid4().hex[:8]}"
                contradictions.append(gc)
        except Exception as e:
            print(f"Warning: Gemini contradiction detection failed: {e}")
    
    return contradictions
