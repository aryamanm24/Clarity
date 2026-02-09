"""
Pydantic models matching the TypeScript types in src/lib/types.ts.
These are the data contract between Python backend and React frontend.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal

# --- Core Argument Structure ---

class Proposition(BaseModel):
    """A single logical proposition extracted from natural language."""
    id: str
    statement: str
    formal_expression: str = Field(alias="formalExpression")
    type: Literal["premise", "conclusion", "claim", "evidence", "assumption", "constraint", "risk"]
    confidence: Literal["high", "medium", "low", "unstated_as_absolute"]
    is_implicit: bool = Field(alias="isImplicit")
    is_load_bearing: bool = Field(alias="isLoadBearing")
    is_anchored: bool = Field(alias="isAnchored")
    input_timestamp: Optional[float] = Field(None, alias="inputTimestamp")
    input_turn_number: Optional[int] = Field(None, alias="inputTurnNumber")
    
    class Config:
        populate_by_name = True


class Relationship(BaseModel):
    """A logical relationship between two propositions."""
    id: str
    from_id: str = Field(alias="fromId")
    to_id: str = Field(alias="toId")
    type: Literal["supports", "contradicts", "depends_on", "attacks", "assumes", "concludes_from"]
    strength: Literal["strong", "moderate", "weak"]
    label: Optional[str] = None
    
    class Config:
        populate_by_name = True


# --- Argument Structure ---

class ArgumentStructure(BaseModel):
    """The formal structure of an argument: premises → conclusion."""
    premises: list[str]
    conclusion: Optional[str]
    missing_premises: list[str] = Field(alias="missingPremises")
    inference_type: Literal["deductive", "inductive", "abductive", "analogical"] = Field(alias="inferenceType")
    is_valid: bool = Field(alias="isValid")
    validity_explanation: str = Field(alias="validityExplanation")
    
    class Config:
        populate_by_name = True


# --- Issue Types (The Four Tiers) ---

class Contradiction(BaseModel):
    """Tier 1: Hard contradiction — two premises cannot both be true."""
    id: str
    proposition_ids: list[str] = Field(alias="propositionIds")
    type: Literal["logical", "temporal", "empirical"]
    severity: Literal["critical", "major", "minor"]
    formal_proof: str = Field(alias="formalProof")
    human_explanation: str = Field(alias="humanExplanation")
    
    class Config:
        populate_by_name = True


class Ambiguity(BaseModel):
    """Tier 2: A term is used ambiguously — could mean different things."""
    id: str
    ambiguous_term: str = Field(alias="ambiguousTerm")
    proposition_ids: list[str] = Field(alias="propositionIds")
    possible_meanings: list[str] = Field(alias="possibleMeanings")
    question_for_user: str = Field(alias="questionForUser")
    if_resolved_as: dict[str, str] = Field(alias="ifResolvedAs")
    
    class Config:
        populate_by_name = True


class Tension(BaseModel):
    """Tier 3: Soft practical tension — not logically invalid but competing goals."""
    id: str
    proposition_ids: list[str] = Field(alias="propositionIds")
    description: str
    probing_question: str = Field(alias="probingQuestion")
    cultural_context: Optional[str] = Field(None, alias="culturalContext")
    is_resolved: bool = Field(False, alias="isResolved")
    resolution: Optional[str] = None
    
    class Config:
        populate_by_name = True


class TemporalDrift(BaseModel):
    """Tier 4: User contradicted themselves over time without realizing."""
    id: str
    earlier_proposition_id: str = Field(alias="earlierPropositionId")
    later_proposition_id: str = Field(alias="laterPropositionId")
    earlier_timestamp: Optional[float] = Field(None, alias="earlierTimestamp")
    later_timestamp: Optional[float] = Field(None, alias="laterTimestamp")
    explanation: str
    
    class Config:
        populate_by_name = True


class Fallacy(BaseModel):
    """A named logical fallacy detected in the argument structure."""
    id: str
    name: str
    description: str
    affected_node_ids: list[str] = Field(alias="affectedNodeIds")
    pattern_type: str = Field(alias="patternType")
    formal_structure: Optional[str] = Field(None, alias="formalStructure")
    
    class Config:
        populate_by_name = True


class CognitiveBias(BaseModel):
    """A cognitive bias detected in the reasoning pattern."""
    id: str
    name: str
    kahneman_reference: str = Field(alias="kahnemanReference")
    description: str
    affected_node_ids: list[str] = Field(alias="affectedNodeIds")
    severity: Literal["high", "medium", "low"]
    system: Literal[1, 2]
    
    class Config:
        populate_by_name = True


class GroundingResult(BaseModel):
    """Result from fact-checking a proposition via Google Search."""
    query: str
    claim: str
    verdict: Literal["supported", "contradicted", "insufficient_data"]
    evidence: str
    sources: list[dict]
    proposition_id: str = Field(alias="propositionId")
    
    class Config:
        populate_by_name = True


class ThoughtSummary(BaseModel):
    """Gemini's reasoning chain summary."""
    text: str
    timestamp: float


class Insight(BaseModel):
    """An actionable insight from one of CLARITY's reasoning engines."""
    id: str
    engine_type: str = Field(alias="engineType")
    content: str
    key_question: Optional[str] = Field(None, alias="keyQuestion")
    affected_node_ids: list[str] = Field(alias="affectedNodeIds")
    grounding_results: Optional[list[GroundingResult]] = Field(None, alias="groundingResults")
    
    class Config:
        populate_by_name = True


class ArgumentScore(BaseModel):
    """Strength score for a proposition."""
    proposition_id: str = Field(alias="propositionId")
    score: float
    evidence_paths: int = Field(alias="evidencePaths")
    contradiction_count: int = Field(alias="contradictionCount")
    vulnerable_assumptions: int = Field(alias="vulnerableAssumptions")
    
    class Config:
        populate_by_name = True


class Reconstruction(BaseModel):
    """Reconstructed valid argument from messy input."""
    reconstructed_conclusion: str = Field(alias="reconstructedConclusion")
    required_premises: list[dict] = Field(alias="requiredPremises")
    suggested_modifications: list[dict] = Field(alias="suggestedModifications")
    presentable_argument: str = Field(alias="presentableArgument")
    strength_score: float = Field(alias="strengthScore")
    strength_explanation: str = Field(alias="strengthExplanation")
    
    class Config:
        populate_by_name = True


# --- Master Analysis Result ---

class AnalysisResult(BaseModel):
    """Complete analysis output — sent to the frontend."""
    propositions: list[Proposition]
    relationships: list[Relationship]
    argument_structure: Optional[ArgumentStructure] = Field(None, alias="argumentStructure")
    contradictions: list[Contradiction]
    ambiguities: list[Ambiguity]
    tensions: list[Tension]
    temporal_drifts: list[TemporalDrift] = Field(default_factory=list, alias="temporalDrifts")
    fallacies: list[Fallacy]
    biases: list[CognitiveBias]
    insights: list[Insight]
    thought_summaries: list[ThoughtSummary] = Field(alias="thoughtSummaries")
    grounding_results: list[GroundingResult] = Field(alias="groundingResults")
    argument_scores: list[ArgumentScore] = Field(alias="argumentScores")
    reconstruction: Optional[Reconstruction] = None
    
    class Config:
        populate_by_name = True


# Backward compatibility alias
GraphState = AnalysisResult
