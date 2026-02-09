use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================
// Rust types matching the TypeScript data contract (src/lib/types.ts)
// ============================================================
// Using String types for enum-like fields for flexibility and
// serde(rename_all = "camelCase") for automatic JS field name mapping.
// ============================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Proposition {
    pub id: String,
    pub statement: String,
    pub formal_expression: String,
    #[serde(rename = "type")]
    pub prop_type: String, // "claim" | "evidence" | "assumption" | "constraint" | "risk"
    pub confidence: String, // "high" | "medium" | "low" | "unstated_as_absolute"
    pub is_implicit: bool,
    pub is_load_bearing: bool,
    pub is_anchored: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Relationship {
    pub id: String,
    pub from_id: String,
    pub to_id: String,
    #[serde(rename = "type")]
    pub rel_type: String, // "supports" | "contradicts" | "depends_on" | "attacks" | "assumes"
    pub strength: String, // "strong" | "moderate" | "weak"
    pub label: Option<String>,
}

// --- INPUT: What JavaScript sends us ---

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LogicalGraph {
    pub propositions: Vec<Proposition>,
    pub relationships: Vec<Relationship>,
}

impl LogicalGraph {
    /// Look up a proposition by ID.
    pub fn get_proposition(&self, id: &str) -> Option<&Proposition> {
        self.propositions.iter().find(|p| p.id == id)
    }

    /// Get all relationships originating FROM a given node.
    pub fn get_relationships_from(&self, id: &str) -> Vec<&Relationship> {
        self.relationships.iter().filter(|r| r.from_id == id).collect()
    }

    /// Get all relationships pointing TO a given node.
    pub fn get_relationships_to(&self, id: &str) -> Vec<&Relationship> {
        self.relationships.iter().filter(|r| r.to_id == id).collect()
    }

    /// Build a directed adjacency list (from_id → [to_id, ...]).
    /// Only includes dependency edges: "supports", "depends_on", "assumes".
    pub fn get_dependency_adjacency(&self) -> HashMap<String, Vec<String>> {
        let mut adj: HashMap<String, Vec<String>> = HashMap::new();
        // Ensure every proposition has an entry (even if no outgoing edges)
        for p in &self.propositions {
            adj.entry(p.id.clone()).or_default();
        }
        for rel in &self.relationships {
            if is_dependency_edge(&rel.rel_type) {
                adj.entry(rel.from_id.clone())
                    .or_default()
                    .push(rel.to_id.clone());
            }
        }
        adj
    }

    /// Build a full directed adjacency list (all edge types).
    pub fn get_adjacency_list(&self) -> HashMap<String, Vec<String>> {
        let mut adj: HashMap<String, Vec<String>> = HashMap::new();
        for p in &self.propositions {
            adj.entry(p.id.clone()).or_default();
        }
        for rel in &self.relationships {
            adj.entry(rel.from_id.clone())
                .or_default()
                .push(rel.to_id.clone());
        }
        adj
    }

    /// Get all propositions of a specific type.
    pub fn get_propositions_by_type(&self, prop_type: &str) -> Vec<&Proposition> {
        self.propositions.iter().filter(|p| p.prop_type == prop_type).collect()
    }
}

/// Check if an edge type is a dependency edge (creates logical dependency).
pub fn is_dependency_edge(rel_type: &str) -> bool {
    matches!(rel_type, "supports" | "depends_on" | "assumes")
}

// --- OUTPUT types ---

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Contradiction {
    pub id: String,
    pub proposition_ids: Vec<String>,
    #[serde(rename = "type")]
    pub contradiction_type: String, // "logical" | "temporal" | "empirical"
    pub severity: String,           // "critical" | "major" | "minor"
    pub formal_proof: String,
    pub human_explanation: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Fallacy {
    pub id: String,
    pub name: String,
    pub description: String,
    pub affected_node_ids: Vec<String>,
    pub pattern_type: String, // "cycle" | "false_dilemma" | "hasty_generalization" | "appeal_to_authority" | "straw_man"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CognitiveBias {
    pub id: String,
    pub name: String,
    pub kahneman_reference: String,
    pub description: String,
    pub affected_node_ids: Vec<String>,
    pub severity: String, // "high" | "medium" | "low"
    pub system: u8,       // 1 or 2
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ArgumentScore {
    pub proposition_id: String,
    pub score: f64,
    pub evidence_paths: u32,
    pub contradiction_count: u32,
    pub vulnerable_assumptions: u32,
}

// --- Master Result ---

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub contradictions: Vec<Contradiction>,
    pub fallacies: Vec<Fallacy>,
    pub biases: Vec<CognitiveBias>,
    pub argument_scores: Vec<ArgumentScore>,
    pub cycles: Vec<Vec<String>>,
    pub topological_order: Vec<String>,
}

// --- Test helpers ---

#[cfg(test)]
pub mod test_helpers {
    use super::*;

    pub fn make_prop(id: &str, prop_type: &str, confidence: &str) -> Proposition {
        Proposition {
            id: id.to_string(),
            statement: format!("Test {} proposition", prop_type),
            formal_expression: format!("{} → true", id),
            prop_type: prop_type.to_string(),
            confidence: confidence.to_string(),
            is_implicit: false,
            is_load_bearing: prop_type == "claim",
            is_anchored: false,
        }
    }

    pub fn make_rel(id: &str, from: &str, to: &str, rel_type: &str) -> Relationship {
        Relationship {
            id: id.to_string(),
            from_id: from.to_string(),
            to_id: to.to_string(),
            rel_type: rel_type.to_string(),
            strength: "strong".to_string(),
            label: None,
        }
    }

    pub fn make_graph(props: Vec<Proposition>, rels: Vec<Relationship>) -> LogicalGraph {
        LogicalGraph {
            propositions: props,
            relationships: rels,
        }
    }
}
