use crate::types::{Fallacy, LogicalGraph};

/// Detect logical fallacies via graph structure patterns.
/// Each fallacy has a specific structural signature we can detect computationally.
pub fn detect_fallacies(graph: &LogicalGraph, cycles: &[Vec<String>]) -> Vec<Fallacy> {
    let mut fallacies = Vec::new();
    let mut counter = 0u32;

    // ── 1. CIRCULAR REASONING (Petitio Principii) ──
    // Signal: cycles detected by cycle_detection
    for cycle in cycles {
        counter += 1;
        let cycle_labels: Vec<String> = cycle
            .iter()
            .filter_map(|id| graph.get_proposition(id).map(|p| format!("\"{}\"", p.statement)))
            .collect();

        fallacies.push(Fallacy {
            id: format!("fallacy-circular-{}", counter),
            name: "Circular Reasoning (Petitio Principii)".to_string(),
            description: format!(
                "A circular dependency was detected: {} form a logical loop where each \
                 proposition ultimately depends on itself. This means the argument is \
                 self-supporting with no independent foundation.",
                cycle_labels.join(" → ")
            ),
            affected_node_ids: cycle.clone(),
            pattern_type: "cycle".to_string(),
        });
    }

    // ── 2. HASTY GENERALIZATION ──
    // Signal: A claim with confidence "high" that has fewer than 2 independent
    // evidence paths supporting it.
    let min_evidence_threshold = 2;

    for prop in graph.get_propositions_by_type("claim") {
        if prop.confidence != "high" {
            continue;
        }

        // Count incoming "supports" edges
        let support_count = graph
            .get_relationships_to(&prop.id)
            .iter()
            .filter(|r| r.rel_type == "supports")
            .count();

        if support_count > 0 && support_count < min_evidence_threshold {
            counter += 1;
            let supporters: Vec<String> = graph
                .get_relationships_to(&prop.id)
                .iter()
                .filter(|r| r.rel_type == "supports")
                .filter_map(|r| graph.get_proposition(&r.from_id))
                .map(|p| format!("\"{}\"", p.statement))
                .collect();

            fallacies.push(Fallacy {
                id: format!("fallacy-hasty-{}", counter),
                name: "Hasty Generalization".to_string(),
                description: format!(
                    "The claim \"{}\" is stated with high confidence but is supported by only {} \
                     piece(s) of evidence: {}. High-confidence conclusions typically require \
                     multiple independent lines of evidence. No counter-evidence has been \
                     considered.",
                    prop.statement,
                    support_count,
                    supporters.join(", ")
                ),
                affected_node_ids: std::iter::once(prop.id.clone())
                    .chain(
                        graph
                            .get_relationships_to(&prop.id)
                            .iter()
                            .filter(|r| r.rel_type == "supports")
                            .map(|r| r.from_id.clone()),
                    )
                    .collect(),
                pattern_type: "hasty_generalization".to_string(),
            });
        }
    }

    // ── 3. FALSE DILEMMA ──
    // Signal: A claim depends on exactly 2 supporting propositions with no
    // alternatives considered, and both supporters frame binary options.
    for prop in graph.get_propositions_by_type("claim") {
        let incoming = graph.get_relationships_to(&prop.id);
        let support_edges: Vec<_> = incoming.iter().filter(|r| r.rel_type == "supports").collect();
        let contradict_edges: Vec<_> = incoming.iter().filter(|r| r.rel_type == "contradicts" || r.rel_type == "attacks").collect();

        // Exactly 2 supports and no contradictions → possible false dilemma
        if support_edges.len() == 2 && contradict_edges.is_empty() {
            // Check if the formal expressions suggest binary framing
            let supporters: Vec<_> = support_edges
                .iter()
                .filter_map(|r| graph.get_proposition(&r.from_id))
                .collect();

            let binary_indicators = ["or", "either", "only", "∨"];
            let has_binary_framing = supporters.iter().any(|s| {
                let expr = s.formal_expression.to_lowercase();
                let stmt = s.statement.to_lowercase();
                binary_indicators.iter().any(|kw| expr.contains(kw) || stmt.contains(kw))
            });

            if has_binary_framing {
                counter += 1;
                fallacies.push(Fallacy {
                    id: format!("fallacy-dilemma-{}", counter),
                    name: "False Dilemma".to_string(),
                    description: format!(
                        "The claim \"{}\" is presented as depending on exactly two options, \
                         with no alternatives considered. This binary framing may exclude \
                         viable middle-ground positions or alternative approaches.",
                        prop.statement
                    ),
                    affected_node_ids: std::iter::once(prop.id.clone())
                        .chain(supporters.iter().map(|s| s.id.clone()))
                        .collect(),
                    pattern_type: "false_dilemma".to_string(),
                });
            }
        }
    }

    // ── 4. APPEAL TO AUTHORITY ──
    // Signal: Evidence whose formal expression references authority rather than data
    let authority_patterns = [
        "says", "according", "expert", "authority", "believes", "argues",
        "claims", "stated",
    ];

    for prop in graph.get_propositions_by_type("evidence") {
        let expr_lower = prop.formal_expression.to_lowercase();
        let stmt_lower = prop.statement.to_lowercase();

        let has_authority = authority_patterns
            .iter()
            .any(|kw| expr_lower.contains(kw) || stmt_lower.contains(kw));

        if has_authority {
            // Check if there's actual data backing it up (supporting edges to this evidence)
            let backing = graph
                .get_relationships_to(&prop.id)
                .iter()
                .filter(|r| r.rel_type == "supports")
                .count();

            if backing == 0 {
                counter += 1;
                fallacies.push(Fallacy {
                    id: format!("fallacy-authority-{}", counter),
                    name: "Appeal to Authority".to_string(),
                    description: format!(
                        "The evidence \"{}\" references an authority or source rather than \
                         providing independent logical justification. Authority-based evidence \
                         should be supplemented with verifiable data.",
                        prop.statement
                    ),
                    affected_node_ids: vec![prop.id.clone()],
                    pattern_type: "appeal_to_authority".to_string(),
                });
            }
        }
    }

    fallacies
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::test_helpers::*;

    #[test]
    fn test_circular_reasoning_from_cycles() {
        let graph = make_graph(
            vec![
                make_prop("A", "claim", "high"),
                make_prop("B", "evidence", "high"),
            ],
            vec![],
        );
        let cycles = vec![vec!["A".to_string(), "B".to_string()]];
        let fallacies = detect_fallacies(&graph, &cycles);
        assert_eq!(fallacies.len(), 1);
        assert_eq!(fallacies[0].pattern_type, "cycle");
        assert!(fallacies[0].name.contains("Circular"));
    }

    #[test]
    fn test_hasty_generalization() {
        // High-confidence claim with only 1 supporting evidence
        let mut claim = make_prop("C1", "claim", "high");
        claim.statement = "We should pivot to Enterprise".to_string();
        let evidence = make_prop("E1", "evidence", "high");

        let graph = make_graph(
            vec![claim, evidence],
            vec![make_rel("r1", "E1", "C1", "supports")],
        );
        let fallacies = detect_fallacies(&graph, &[]);
        assert!(
            fallacies.iter().any(|f| f.pattern_type == "hasty_generalization"),
            "Should detect hasty generalization"
        );
    }

    #[test]
    fn test_no_hasty_gen_with_enough_evidence() {
        // High-confidence claim with 3 supporting evidence pieces → NOT hasty
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
        let fallacies = detect_fallacies(&graph, &[]);
        assert!(
            !fallacies.iter().any(|f| f.pattern_type == "hasty_generalization"),
            "Should NOT detect hasty generalization with 3 evidence paths"
        );
    }

    #[test]
    fn test_appeal_to_authority() {
        let mut evidence = make_prop("E1", "evidence", "high");
        evidence.statement = "Expert says market timing is right".to_string();
        evidence.formal_expression = "expert_opinion(market_timing) = positive".to_string();

        let claim = make_prop("C1", "claim", "high");

        let graph = make_graph(
            vec![evidence, claim],
            vec![make_rel("r1", "E1", "C1", "supports")],
        );
        let fallacies = detect_fallacies(&graph, &[]);
        assert!(
            fallacies.iter().any(|f| f.pattern_type == "appeal_to_authority"),
            "Should detect appeal to authority"
        );
    }

    #[test]
    fn test_no_fallacies_clean_graph() {
        // Well-supported claim with medium confidence → no fallacies
        let mut claim = make_prop("C1", "claim", "medium");
        claim.statement = "Revenue will increase".to_string();
        let e1 = make_prop("E1", "evidence", "high");
        let e2 = make_prop("E2", "evidence", "high");

        let graph = make_graph(
            vec![claim, e1, e2],
            vec![
                make_rel("r1", "E1", "C1", "supports"),
                make_rel("r2", "E2", "C1", "supports"),
            ],
        );
        let fallacies = detect_fallacies(&graph, &[]);
        assert_eq!(fallacies.len(), 0, "Clean graph should have no fallacies");
    }
}
