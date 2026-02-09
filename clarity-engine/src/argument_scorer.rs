use std::collections::HashMap;
use crate::types::{ArgumentScore, Contradiction, LogicalGraph};

/// Score each proposition on a 0.0 to 1.0 scale.
/// Higher = better supported, lower = more vulnerable.
///
/// Score formula:
///   base = evidence_paths / (evidence_paths + 1)
///   penalty = contradiction_count * 0.3 + vulnerable_assumptions * 0.2
///   bonus = centrality * 0.1 (being well-connected is a mild positive)
///   score = clamp(base - penalty + bonus, 0.0, 1.0)
pub fn score_arguments(
    graph: &LogicalGraph,
    contradictions: &[Contradiction],
    centrality: &HashMap<String, f64>,
) -> Vec<ArgumentScore> {
    graph
        .propositions
        .iter()
        .map(|prop| {
            // Count incoming "supports" edges
            let evidence_paths = graph
                .get_relationships_to(&prop.id)
                .iter()
                .filter(|r| r.rel_type == "supports")
                .count() as u32;

            // Count contradictions involving this proposition
            let contradiction_count = contradictions
                .iter()
                .filter(|c| c.proposition_ids.contains(&prop.id))
                .count() as u32;

            // Count vulnerable assumptions this proposition depends on
            // An assumption is "vulnerable" if it's load-bearing AND has zero supporting evidence
            let vulnerable_assumptions = count_vulnerable_assumptions(graph, &prop.id);

            // Compute score
            let base = evidence_paths as f64 / (evidence_paths as f64 + 1.0);
            let penalty =
                contradiction_count as f64 * 0.3 + vulnerable_assumptions as f64 * 0.2;
            let centrality_bonus = centrality.get(&prop.id).copied().unwrap_or(0.0) * 0.1;

            let score = (base - penalty + centrality_bonus).clamp(0.0, 1.0);

            ArgumentScore {
                proposition_id: prop.id.clone(),
                score,
                evidence_paths,
                contradiction_count,
                vulnerable_assumptions,
            }
        })
        .collect()
}

/// Count how many vulnerable assumptions a proposition depends on.
/// Walks the "depends_on" and "assumes" edges to find assumptions
/// that are load-bearing but have zero supporting evidence.
fn count_vulnerable_assumptions(graph: &LogicalGraph, prop_id: &str) -> u32 {
    let mut count = 0u32;

    // Direct depends_on / assumes edges from this proposition
    let outgoing = graph.get_relationships_from(prop_id);
    for rel in &outgoing {
        if rel.rel_type == "depends_on" || rel.rel_type == "assumes" {
            if let Some(target) = graph.get_proposition(&rel.to_id) {
                if target.prop_type == "assumption" && target.is_load_bearing {
                    let support_count = graph
                        .get_relationships_to(&target.id)
                        .iter()
                        .filter(|r| r.rel_type == "supports")
                        .count();
                    if support_count == 0 {
                        count += 1;
                    }
                }
            }
        }
    }

    // Also check reverse: assumptions that depend_on this node
    let incoming = graph.get_relationships_to(prop_id);
    for rel in &incoming {
        if rel.rel_type == "depends_on" || rel.rel_type == "assumes" {
            if let Some(source) = graph.get_proposition(&rel.from_id) {
                if source.prop_type == "assumption" && source.is_load_bearing {
                    let support_count = graph
                        .get_relationships_to(&source.id)
                        .iter()
                        .filter(|r| r.rel_type == "supports")
                        .count();
                    if support_count == 0 {
                        count += 1;
                    }
                }
            }
        }
    }

    count
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::test_helpers::*;

    #[test]
    fn test_well_supported_claim() {
        let claim = make_prop("C1", "claim", "high");
        let e1 = make_prop("E1", "evidence", "high");
        let e2 = make_prop("E2", "evidence", "high");
        let e3 = make_prop("E3", "evidence", "high");

        let graph = make_graph(
            vec![claim, e1, e2, e3],
            vec![
                make_rel("r1", "E1", "C1", "supports"),
                make_rel("r2", "E2", "C1", "supports"),
                make_rel("r3", "E3", "C1", "supports"),
            ],
        );
        let scores = score_arguments(&graph, &[], &HashMap::new());
        let claim_score = scores.iter().find(|s| s.proposition_id == "C1").unwrap();

        assert!(claim_score.score > 0.6, "Well-supported claim should score > 0.6, got {}", claim_score.score);
        assert_eq!(claim_score.evidence_paths, 3);
        assert_eq!(claim_score.contradiction_count, 0);
    }

    #[test]
    fn test_contradicted_claim() {
        let claim = make_prop("C1", "claim", "high");
        let e1 = make_prop("E1", "evidence", "high");

        let graph = make_graph(
            vec![claim, e1],
            vec![make_rel("r1", "E1", "C1", "supports")],
        );

        let contradiction = Contradiction {
            id: "c1".to_string(),
            proposition_ids: vec!["C1".to_string()],
            contradiction_type: "logical".to_string(),
            severity: "critical".to_string(),
            formal_proof: "test".to_string(),
            human_explanation: "test".to_string(),
        };

        let scores = score_arguments(&graph, &[contradiction], &HashMap::new());
        let claim_score = scores.iter().find(|s| s.proposition_id == "C1").unwrap();

        assert!(claim_score.score < 0.5, "Contradicted claim should score < 0.5, got {}", claim_score.score);
        assert_eq!(claim_score.contradiction_count, 1);
    }

    #[test]
    fn test_unsupported_claim_scores_low() {
        let claim = make_prop("C1", "claim", "high");
        let graph = make_graph(vec![claim], vec![]);
        let scores = score_arguments(&graph, &[], &HashMap::new());
        let claim_score = scores.iter().find(|s| s.proposition_id == "C1").unwrap();

        assert!(claim_score.score < 0.1, "Unsupported claim should score near 0, got {}", claim_score.score);
        assert_eq!(claim_score.evidence_paths, 0);
    }

    #[test]
    fn test_vulnerable_assumption_penalty() {
        let mut claim = make_prop("C1", "claim", "high");
        claim.is_load_bearing = true;
        let mut assumption = make_prop("A1", "assumption", "unstated_as_absolute");
        assumption.is_load_bearing = true;

        let graph = make_graph(
            vec![claim, assumption],
            vec![make_rel("r1", "C1", "A1", "depends_on")],
        );

        let scores = score_arguments(&graph, &[], &HashMap::new());
        let claim_score = scores.iter().find(|s| s.proposition_id == "C1").unwrap();

        assert_eq!(claim_score.vulnerable_assumptions, 1);
        assert!(claim_score.score < 0.1, "Claim depending on vulnerable assumption should score low");
    }

    #[test]
    fn test_all_propositions_scored() {
        let graph = make_graph(
            vec![
                make_prop("A", "claim", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "assumption", "medium"),
            ],
            vec![],
        );
        let scores = score_arguments(&graph, &[], &HashMap::new());
        assert_eq!(scores.len(), 3, "Every proposition should get a score");
    }
}
