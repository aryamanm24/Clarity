use std::collections::HashMap;
use crate::types::{CognitiveBias, LogicalGraph};

/// Detect cognitive biases based on Kahneman's dual-process theory.
/// Each bias has a structural signature in the reasoning graph.
///
/// Severity scales with centrality: high-centrality biased nodes are more severe
/// because more argument paths depend on them.
pub fn detect_biases(
    graph: &LogicalGraph,
    centrality: &HashMap<String, f64>,
) -> Vec<CognitiveBias> {
    let mut biases = Vec::new();
    let mut counter = 0u32;

    // ── 1. ANCHORING EFFECT (Chapter 11) ──
    // Signal: Assumption with confidence "unstated_as_absolute" AND
    // zero incoming "supports" edges AND is_anchored = true.
    for prop in &graph.propositions {
        if prop.prop_type == "assumption"
            && prop.confidence == "unstated_as_absolute"
        {
            let support_count = graph
                .get_relationships_to(&prop.id)
                .iter()
                .filter(|r| r.rel_type == "supports")
                .count();

            if support_count == 0 {
                counter += 1;
                let severity = severity_from_centrality(centrality.get(&prop.id));

                biases.push(CognitiveBias {
                    id: format!("bias-anchoring-{}", counter),
                    name: "Anchoring Effect".to_string(),
                    kahneman_reference: "Thinking, Fast and Slow, Chapter 11: Anchors"
                        .to_string(),
                    description: format!(
                        "The assumption \"{}\" is stated as an absolute without any supporting \
                         evidence. This is a classic anchoring pattern: an initial value or belief \
                         is accepted by System 1 without verification, and all subsequent reasoning \
                         is adjusted relative to this anchor rather than being independently evaluated. \
                         {}",
                        prop.statement,
                        if prop.is_anchored {
                            "This proposition has been flagged as an anchoring point."
                        } else {
                            "Consider what evidence would be needed to verify this assumption."
                        }
                    ),
                    affected_node_ids: vec![prop.id.clone()],
                    severity,
                    system: 1,
                });
            }
        }
    }

    // ── 2. CONFIRMATION BIAS (Chapter 7) ──
    // Signal: A claim where ALL incoming relationships are "supports" type
    // and ZERO are "contradicts" or "attacks".
    // The person only gathered supporting evidence, never looked for counter-evidence.
    for prop in graph.get_propositions_by_type("claim") {
        let incoming = graph.get_relationships_to(&prop.id);
        if incoming.is_empty() {
            continue;
        }

        let support_count = incoming.iter().filter(|r| r.rel_type == "supports").count();
        let challenge_count = incoming
            .iter()
            .filter(|r| r.rel_type == "contradicts" || r.rel_type == "attacks")
            .count();

        // All support, zero challenges, and at least 2 supports
        if support_count >= 2 && challenge_count == 0 {
            counter += 1;
            let severity = severity_from_centrality(centrality.get(&prop.id));

            biases.push(CognitiveBias {
                id: format!("bias-confirmation-{}", counter),
                name: "Confirmation Bias".to_string(),
                kahneman_reference:
                    "Thinking, Fast and Slow, Chapter 7: A Machine for Jumping to Conclusions"
                        .to_string(),
                description: format!(
                    "The claim \"{}\" has {} supporting pieces of evidence but zero \
                     contradicting or challenging inputs. This one-sided evidence pattern \
                     suggests confirmation bias: the reasoner sought only evidence that \
                     supports their conclusion and did not actively look for counter-evidence. \
                     A robust argument should include and address opposing viewpoints.",
                    prop.statement, support_count
                ),
                affected_node_ids: std::iter::once(prop.id.clone())
                    .chain(
                        incoming
                            .iter()
                            .filter(|r| r.rel_type == "supports")
                            .map(|r| r.from_id.clone()),
                    )
                    .collect(),
                severity,
                system: 1,
            });
        }
    }

    // ── 3. AVAILABILITY HEURISTIC (Chapter 12) ──
    // Signal: Evidence with high confidence that uses subjective/emotional terms
    // ("feels", "seems", "looks like") rather than data-based terms.
    let subjective_indicators = [
        "feels", "seems", "looks like", "appears", "intuition",
        "gut", "sense", "impression", "vibe",
    ];

    for prop in graph.get_propositions_by_type("evidence") {
        let stmt_lower = prop.statement.to_lowercase();
        let expr_lower = prop.formal_expression.to_lowercase();

        let has_subjective = subjective_indicators
            .iter()
            .any(|kw| stmt_lower.contains(kw) || expr_lower.contains(kw));

        if has_subjective && (prop.confidence == "high" || prop.confidence == "medium") {
            counter += 1;
            let severity = severity_from_centrality(centrality.get(&prop.id));

            let trigger_word = subjective_indicators
                .iter()
                .find(|kw| stmt_lower.contains(*kw) || expr_lower.contains(*kw))
                .unwrap_or(&"subjective language");

            biases.push(CognitiveBias {
                id: format!("bias-availability-{}", counter),
                name: "Availability Heuristic".to_string(),
                kahneman_reference:
                    "Thinking, Fast and Slow, Chapter 12: The Science of Availability"
                        .to_string(),
                description: format!(
                    "The evidence \"{}\" uses the subjective term \"{}\" which suggests \
                     a System 1 judgment based on what is easily available in memory rather \
                     than systematic analysis. Vivid, recent, or emotionally salient information \
                     is being treated as representative data. This evidence should be \
                     supplemented with objective measurements.",
                    prop.statement, trigger_word
                ),
                affected_node_ids: vec![prop.id.clone()],
                severity,
                system: 1,
            });
        }
    }

    // ── 4. PLANNING FALLACY (Chapter 23) ──
    // Signal: A complex claim (load-bearing, high confidence) with no
    // decomposition into sub-claims via "depends_on" relationships.
    for prop in graph.get_propositions_by_type("claim") {
        if !prop.is_load_bearing {
            continue;
        }

        let outgoing_deps = graph
            .get_relationships_from(&prop.id)
            .iter()
            .filter(|r| r.rel_type == "depends_on" || r.rel_type == "assumes")
            .count();

        // Load-bearing claim with no decomposition
        if outgoing_deps == 0 && prop.confidence == "high" {
            // Check if there are constraint or risk nodes that relate to this claim
            let has_constraints = graph
                .get_relationships_to(&prop.id)
                .iter()
                .any(|r| {
                    graph
                        .get_proposition(&r.from_id)
                        .map(|p| p.prop_type == "constraint" || p.prop_type == "risk")
                        .unwrap_or(false)
                });

            if !has_constraints {
                counter += 1;
                let severity = severity_from_centrality(centrality.get(&prop.id));

                biases.push(CognitiveBias {
                    id: format!("bias-planning-{}", counter),
                    name: "Planning Fallacy".to_string(),
                    kahneman_reference:
                        "Thinking, Fast and Slow, Chapter 23: The Outside View"
                            .to_string(),
                    description: format!(
                        "The claim \"{}\" is load-bearing and stated with high confidence, \
                         but has no decomposition into sub-tasks, dependencies, or constraints. \
                         This is a hallmark of the Planning Fallacy: overly optimistic planning \
                         that fails to account for the complexity of execution. \
                         Consider breaking this into concrete, measurable sub-goals.",
                        prop.statement
                    ),
                    affected_node_ids: vec![prop.id.clone()],
                    severity,
                    system: 1,
                });
            }
        }
    }

    // ── 5. ATTRIBUTE SUBSTITUTION (Chapter 9) ──
    // Signal: A claim whose evidence uses a different metric than the claim itself.
    // E.g., claim is about "outcome quality" but evidence measures "deal size".
    for prop in graph.get_propositions_by_type("claim") {
        let claim_vars = extract_variables(&prop.formal_expression);
        if claim_vars.is_empty() {
            continue;
        }

        let supporters: Vec<_> = graph
            .get_relationships_to(&prop.id)
            .iter()
            .filter(|r| r.rel_type == "supports")
            .filter_map(|r| graph.get_proposition(&r.from_id))
            .collect();

        for evidence in &supporters {
            let evidence_vars = extract_variables(&evidence.formal_expression);
            if evidence_vars.is_empty() {
                continue;
            }

            // Check if evidence measures something different from the claim
            let overlap: Vec<_> = claim_vars
                .iter()
                .filter(|v| evidence_vars.contains(v))
                .collect();

            if overlap.is_empty() && !claim_vars.is_empty() && !evidence_vars.is_empty() {
                counter += 1;
                let severity = severity_from_centrality(centrality.get(&prop.id));

                biases.push(CognitiveBias {
                    id: format!("bias-substitution-{}", counter),
                    name: "Attribute Substitution".to_string(),
                    kahneman_reference:
                        "Thinking, Fast and Slow, Chapter 9: Answering an Easier Question"
                            .to_string(),
                    description: format!(
                        "The claim \"{}\" appears to be about [{}], but the supporting evidence \
                         \"{}\" measures [{}]. System 1 may be substituting an easy-to-measure \
                         proxy for the actual question being asked. Verify that the evidence \
                         directly addresses the claim's core variable.",
                        prop.statement,
                        claim_vars.join(", "),
                        evidence.statement,
                        evidence_vars.join(", ")
                    ),
                    affected_node_ids: vec![prop.id.clone(), evidence.id.clone()],
                    severity,
                    system: 1,
                });
            }
        }
    }

    biases
}

/// Map centrality score to severity string.
/// High centrality (load-bearing node) → "high" severity
fn severity_from_centrality(score: Option<&f64>) -> String {
    match score {
        Some(&s) if s > 0.3 => "high".to_string(),
        Some(&s) if s > 0.1 => "medium".to_string(),
        _ => "low".to_string(),
    }
}

/// Extract variable names from a formal expression.
/// Looks for identifiers in patterns like "func(var)" or standalone words.
fn extract_variables(expr: &str) -> Vec<String> {
    let mut vars = Vec::new();
    // Extract function arguments: word(arg1, arg2)
    let mut chars = expr.chars().peekable();
    let mut current_word = String::new();
    let mut in_parens = false;

    while let Some(ch) = chars.next() {
        match ch {
            '(' => {
                if !current_word.is_empty() {
                    // This is a function name, skip it — we want the args
                    current_word.clear();
                }
                in_parens = true;
            }
            ')' => {
                if !current_word.is_empty() && in_parens {
                    vars.push(current_word.clone());
                    current_word.clear();
                }
                in_parens = false;
            }
            ',' | ' ' => {
                if !current_word.is_empty() && in_parens {
                    vars.push(current_word.clone());
                    current_word.clear();
                }
            }
            _ if ch.is_alphanumeric() || ch == '_' => {
                current_word.push(ch);
            }
            _ => {
                if !current_word.is_empty() && !in_parens {
                    // Standalone variable (outside function calls)
                    // Only add if it looks like a variable (contains underscore or is lowercase)
                    if current_word.contains('_') || current_word.chars().all(|c| c.is_lowercase() || c == '_') {
                        vars.push(current_word.clone());
                    }
                }
                current_word.clear();
            }
        }
    }
    // Handle trailing word
    if !current_word.is_empty() {
        if in_parens || current_word.contains('_') || current_word.chars().all(|c| c.is_lowercase() || c == '_') {
            vars.push(current_word);
        }
    }

    // Deduplicate
    vars.sort();
    vars.dedup();
    // Filter out common operators and short noise
    vars.retain(|v| v.len() > 1 && !["true", "false", "and", "or", "not"].contains(&v.as_str()));
    vars
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::test_helpers::*;

    #[test]
    fn test_anchoring_effect() {
        let mut assumption = make_prop("A1", "assumption", "unstated_as_absolute");
        assumption.statement = "Larger deals = better outcome".to_string();
        assumption.is_anchored = true;
        assumption.is_load_bearing = true;

        let graph = make_graph(vec![assumption], vec![]);
        let centrality = HashMap::from([("A1".to_string(), 0.5)]);
        let biases = detect_biases(&graph, &centrality);

        assert!(
            biases.iter().any(|b| b.name == "Anchoring Effect"),
            "Should detect anchoring effect"
        );
        let anchoring = biases.iter().find(|b| b.name == "Anchoring Effect").unwrap();
        assert!(anchoring.kahneman_reference.contains("Chapter 11"));
        assert_eq!(anchoring.system, 1);
    }

    #[test]
    fn test_confirmation_bias() {
        let claim = make_prop("C1", "claim", "high");
        let e1 = make_prop("E1", "evidence", "high");
        let e2 = make_prop("E2", "evidence", "high");

        let graph = make_graph(
            vec![claim, e1, e2],
            vec![
                make_rel("r1", "E1", "C1", "supports"),
                make_rel("r2", "E2", "C1", "supports"),
                // No contradicts or attacks edges
            ],
        );
        let centrality = HashMap::from([
            ("C1".to_string(), 0.2),
            ("E1".to_string(), 0.0),
            ("E2".to_string(), 0.0),
        ]);
        let biases = detect_biases(&graph, &centrality);

        assert!(
            biases.iter().any(|b| b.name == "Confirmation Bias"),
            "Should detect confirmation bias"
        );
        let conf = biases.iter().find(|b| b.name == "Confirmation Bias").unwrap();
        assert!(conf.kahneman_reference.contains("Chapter 7"));
    }

    #[test]
    fn test_no_confirmation_bias_with_challenge() {
        let claim = make_prop("C1", "claim", "high");
        let e1 = make_prop("E1", "evidence", "high");
        let e2 = make_prop("E2", "evidence", "high");
        let counter = make_prop("X1", "evidence", "high");

        let graph = make_graph(
            vec![claim, e1, e2, counter],
            vec![
                make_rel("r1", "E1", "C1", "supports"),
                make_rel("r2", "E2", "C1", "supports"),
                make_rel("r3", "X1", "C1", "contradicts"),
            ],
        );
        let centrality = HashMap::new();
        let biases = detect_biases(&graph, &centrality);

        assert!(
            !biases.iter().any(|b| b.name == "Confirmation Bias"),
            "Should NOT detect confirmation bias when counter-evidence exists"
        );
    }

    #[test]
    fn test_availability_heuristic() {
        let mut evidence = make_prop("E1", "evidence", "high");
        evidence.statement = "Market timing feels right".to_string();
        evidence.formal_expression = "market_sentiment = positive".to_string();

        let graph = make_graph(vec![evidence], vec![]);
        let centrality = HashMap::from([("E1".to_string(), 0.1)]);
        let biases = detect_biases(&graph, &centrality);

        assert!(
            biases.iter().any(|b| b.name == "Availability Heuristic"),
            "Should detect availability heuristic"
        );
    }

    #[test]
    fn test_severity_scales_with_centrality() {
        let mut assumption = make_prop("A1", "assumption", "unstated_as_absolute");
        assumption.is_anchored = true;

        let graph = make_graph(vec![assumption], vec![]);

        // Low centrality → low severity
        let low_c = HashMap::from([("A1".to_string(), 0.01)]);
        let biases_low = detect_biases(&graph, &low_c);
        let sev_low = &biases_low[0].severity;

        // High centrality → high severity
        let high_c = HashMap::from([("A1".to_string(), 0.5)]);
        let biases_high = detect_biases(&graph, &high_c);
        let sev_high = &biases_high[0].severity;

        assert_eq!(sev_low, "low");
        assert_eq!(sev_high, "high");
    }
}
