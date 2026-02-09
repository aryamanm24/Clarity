use crate::types::{Contradiction, LogicalGraph};

/// Detect contradictions in the proposition set.
///
/// Strategy (pragmatic for hackathon, but real computation):
/// 1. EXPLICIT contradictions: relationships of type "contradicts"
/// 2. TEMPORAL contradictions: incompatible time constraints
/// 3. LOGICAL contradictions: "X → Y" vs "X → ¬Y" patterns in formal expressions
/// 4. RESOURCE contradictions: competing constraints on same variable
pub fn detect_contradictions(graph: &LogicalGraph) -> Vec<Contradiction> {
    let mut contradictions = Vec::new();
    let mut counter = 0u32;

    // ── Strategy 1: Explicit contradiction relationships ──
    for rel in &graph.relationships {
        if rel.rel_type == "contradicts" {
            let from = graph.get_proposition(&rel.from_id);
            let to = graph.get_proposition(&rel.to_id);
            if let (Some(from_prop), Some(to_prop)) = (from, to) {
                counter += 1;
                let severity = if from_prop.is_load_bearing || to_prop.is_load_bearing {
                    "critical"
                } else {
                    "major"
                };

                contradictions.push(Contradiction {
                    id: format!("contradiction-explicit-{}", counter),
                    proposition_ids: vec![rel.from_id.clone(), rel.to_id.clone()],
                    contradiction_type: "logical".to_string(),
                    severity: severity.to_string(),
                    formal_proof: format!(
                        "{} ∧ {} → ⊥",
                        from_prop.formal_expression, to_prop.formal_expression
                    ),
                    human_explanation: format!(
                        "\"{}\" directly contradicts \"{}\". These two propositions cannot both be true simultaneously.",
                        from_prop.statement, to_prop.statement
                    ),
                });
            }
        }
    }

    // ── Strategy 2: Temporal contradiction detection ──
    // Look for propositions with time-related formal expressions that conflict
    let time_keywords = [
        "month", "year", "week", "day", "quarter", "time", "duration",
        "deadline", "runway", "period",
    ];

    let time_props: Vec<&crate::types::Proposition> = graph
        .propositions
        .iter()
        .filter(|p| {
            let expr_lower = p.formal_expression.to_lowercase();
            let stmt_lower = p.statement.to_lowercase();
            time_keywords.iter().any(|kw| expr_lower.contains(kw) || stmt_lower.contains(kw))
        })
        .collect();

    // Check pairs of time-related propositions for conflicts
    for i in 0..time_props.len() {
        for j in (i + 1)..time_props.len() {
            let a = time_props[i];
            let b = time_props[j];

            // Detect "takes > X" vs "needs < Y" where X > Y
            if let Some(explanation) = detect_temporal_conflict(a, b) {
                counter += 1;
                let severity = if a.is_load_bearing || b.is_load_bearing {
                    "critical"
                } else {
                    "major"
                };

                contradictions.push(Contradiction {
                    id: format!("contradiction-temporal-{}", counter),
                    proposition_ids: vec![a.id.clone(), b.id.clone()],
                    contradiction_type: "temporal".to_string(),
                    severity: severity.to_string(),
                    formal_proof: format!(
                        "{} ∧ {} → temporal_conflict",
                        a.formal_expression, b.formal_expression
                    ),
                    human_explanation: explanation,
                });
            }
        }
    }

    // ── Strategy 3: Logical implication conflicts ──
    // Parse formal expressions for "X → Y" and "X → ¬Y" patterns
    for i in 0..graph.propositions.len() {
        for j in (i + 1)..graph.propositions.len() {
            let a = &graph.propositions[i];
            let b = &graph.propositions[j];

            if let Some(explanation) = detect_logical_conflict(a, b) {
                counter += 1;
                let severity = if a.is_load_bearing && b.is_load_bearing {
                    "critical"
                } else {
                    "major"
                };
                contradictions.push(Contradiction {
                    id: format!("contradiction-logical-{}", counter),
                    proposition_ids: vec![a.id.clone(), b.id.clone()],
                    contradiction_type: "logical".to_string(),
                    severity: severity.to_string(),
                    formal_proof: format!(
                        "{} ∧ {} → ⊥",
                        a.formal_expression, b.formal_expression
                    ),
                    human_explanation: explanation,
                });
            }
        }
    }

    // ── Strategy 4: Resource / numeric contradictions ──
    // Check if savings / expenses math doesn't add up
    detect_resource_contradictions(graph, &mut contradictions, &mut counter);

    contradictions
}

/// Detect temporal conflicts between two propositions.
/// Returns Some(explanation) if a conflict is found.
fn detect_temporal_conflict(
    a: &crate::types::Proposition,
    b: &crate::types::Proposition,
) -> Option<String> {
    let a_expr = a.formal_expression.to_lowercase();
    let b_expr = b.formal_expression.to_lowercase();
    let a_stmt = a.statement.to_lowercase();
    let b_stmt = b.statement.to_lowercase();

    // Look for duration indicators: "> N months/years" or "< N months/years"
    let a_duration = extract_duration(&a_expr).or_else(|| extract_duration(&a_stmt));
    let b_duration = extract_duration(&b_expr).or_else(|| extract_duration(&b_stmt));

    if let (Some((a_op, a_val)), Some((b_op, b_val))) = (a_duration, b_duration) {
        // "takes > 12 months" vs "needs results in < 6 months" → conflict
        if a_op == ">" && b_op == "<" && a_val > b_val {
            return Some(format!(
                "Temporal conflict: \"{}\" implies a duration of more than {} months, \
                 but \"{}\" requires completion within {} months. \
                 These time constraints are incompatible.",
                a.statement, a_val, b.statement, b_val
            ));
        }
        if b_op == ">" && a_op == "<" && b_val > a_val {
            return Some(format!(
                "Temporal conflict: \"{}\" implies a duration of more than {} months, \
                 but \"{}\" requires completion within {} months. \
                 These time constraints are incompatible.",
                b.statement, b_val, a.statement, a_val
            ));
        }
    }

    // Check for urgency vs long duration
    let a_urgent = a_stmt.contains("now") || a_stmt.contains("immediately") || a_stmt.contains("should");
    let b_urgent = b_stmt.contains("now") || b_stmt.contains("immediately") || b_stmt.contains("should");
    let a_long = a_stmt.contains(">12") || a_stmt.contains("over a year") || a_stmt.contains("> 12");
    let b_long = b_stmt.contains(">12") || b_stmt.contains("over a year") || b_stmt.contains("> 12");

    if (a_urgent && b_long) || (b_urgent && a_long) {
        return Some(format!(
            "Temporal conflict: \"{}\" implies urgency, \
             but \"{}\" indicates a lengthy timeline. \
             The urgency and the required duration are incompatible.",
            if a_urgent { &a.statement } else { &b.statement },
            if a_long { &a.statement } else { &b.statement },
        ));
    }

    None
}

/// Extract a duration from text like "> 12 months" or "< 6 months"
/// Returns (operator, value_in_months)
fn extract_duration(text: &str) -> Option<(String, f64)> {
    // Pattern: "> N month" or "< N month" or "> N year"
    let patterns: &[(&str, f64)] = &[
        ("month", 1.0),
        ("year", 12.0),
        ("week", 0.25),
    ];

    for &(unit, multiplier) in patterns {
        if let Some(pos) = text.find(unit) {
            // Look backwards from the unit for a number and operator
            let before = text[..pos].trim_end();
            // Find the last number in the string before the unit
            let mut parts: Vec<&str> = before.split_whitespace().collect();
            parts.reverse();
            for (i, part) in parts.iter().enumerate() {
                let trimmed: String = part.chars().filter(|c| c.is_ascii_digit() || *c == '.').collect();
                if let Ok(val) = trimmed.parse::<f64>() {
                    // Check for operator
                    let op = if i + 1 < parts.len() {
                        match parts[i + 1] {
                            ">" | ">=" => ">",
                            "<" | "<=" => "<",
                            _ => {
                                // Check if current part has operator prefix
                                if part.starts_with('>') { ">" }
                                else if part.starts_with('<') { "<" }
                                else { "=" }
                            }
                        }
                    } else if part.starts_with('>') { ">" }
                      else if part.starts_with('<') { "<" }
                      else { "=" };

                    return Some((op.to_string(), val * multiplier));
                }
            }
        }
    }
    None
}

/// Detect logical conflicts: "X → Y" in one prop and "X → ¬Y" in another.
fn detect_logical_conflict(
    a: &crate::types::Proposition,
    b: &crate::types::Proposition,
) -> Option<String> {
    let a_expr = &a.formal_expression;
    let b_expr = &b.formal_expression;

    // Look for implication pattern: "X → Y" and "X → ¬Y"
    if let (Some((a_lhs, a_rhs)), Some((b_lhs, b_rhs))) =
        (parse_implication(a_expr), parse_implication(b_expr))
    {
        let a_lhs_t = a_lhs.trim();
        let b_lhs_t = b_lhs.trim();
        let a_rhs_t = a_rhs.trim();
        let b_rhs_t = b_rhs.trim();

        // Same antecedent, negated consequent
        if a_lhs_t == b_lhs_t {
            let a_negated = format!("¬{}", a_rhs_t);
            let b_negated = format!("¬{}", b_rhs_t);
            let a_stripped = a_rhs_t.trim_start_matches('¬').trim();
            let b_stripped = b_rhs_t.trim_start_matches('¬').trim();

            if a_rhs_t == b_negated || b_rhs_t == a_negated || a_stripped == b_stripped && a_rhs_t != b_rhs_t {
                return Some(format!(
                    "Logical conflict: \"{}\" implies {} → {}, \
                     but \"{}\" implies {} → {}. \
                     Given the same condition ({}), these lead to contradictory conclusions.",
                    a.statement, a_lhs_t, a_rhs_t,
                    b.statement, b_lhs_t, b_rhs_t,
                    a_lhs_t
                ));
            }
        }
    }

    None
}

/// Parse an implication "X → Y" from a formal expression.
fn parse_implication(expr: &str) -> Option<(String, String)> {
    // Try "→" first, then "->"
    let arrow_patterns = ["→", "->"];
    for arrow in &arrow_patterns {
        if let Some(pos) = expr.find(arrow) {
            let lhs = expr[..pos].trim().to_string();
            let rhs = expr[pos + arrow.len()..].trim().to_string();
            if !lhs.is_empty() && !rhs.is_empty() {
                return Some((lhs, rhs));
            }
        }
    }
    None
}

/// Detect resource/numeric contradictions (e.g., savings vs expenses math).
fn detect_resource_contradictions(
    graph: &LogicalGraph,
    contradictions: &mut Vec<Contradiction>,
    counter: &mut u32,
) {
    // Look for propositions that define numeric values for related variables
    // e.g., "savings = $80K" and "expenses = $8K/month" with "savings sufficient" assumption
    let numeric_props: Vec<(&crate::types::Proposition, f64)> = graph
        .propositions
        .iter()
        .filter_map(|p| {
            extract_numeric_value(&p.formal_expression)
                .or_else(|| extract_numeric_value(&p.statement))
                .map(|v| (p, v))
        })
        .collect();

    // Check for "sufficient" assumptions that don't hold under the numbers
    for p in &graph.propositions {
        if p.prop_type == "assumption"
            && (p.formal_expression.contains("≥")
                || p.formal_expression.contains(">=")
                || p.statement.to_lowercase().contains("sufficient"))
        {
            // Find numeric constraints this assumption depends on
            let deps_from = graph.get_relationships_from(&p.id);
            let deps_to = graph.get_relationships_to(&p.id);

            let related_ids: Vec<&str> = deps_from
                .iter()
                .map(|r| r.to_id.as_str())
                .chain(deps_to.iter().map(|r| r.from_id.as_str()))
                .collect();

            let related_nums: Vec<(&crate::types::Proposition, f64)> = numeric_props
                .iter()
                .filter(|(prop, _)| related_ids.contains(&prop.id.as_str()))
                .cloned()
                .collect();

            if related_nums.len() >= 2 {
                // Flag as potential resource contradiction — the assumption
                // may not hold given the numeric constraints
                *counter += 1;
                let affected_ids: Vec<String> = std::iter::once(p.id.clone())
                    .chain(related_nums.iter().map(|(prop, _)| prop.id.clone()))
                    .collect();

                contradictions.push(Contradiction {
                    id: format!("contradiction-resource-{}", counter),
                    proposition_ids: affected_ids,
                    contradiction_type: "empirical".to_string(),
                    severity: if p.is_load_bearing { "critical" } else { "major" }.to_string(),
                    formal_proof: format!(
                        "{} — requires verification against numeric constraints",
                        p.formal_expression
                    ),
                    human_explanation: format!(
                        "The assumption \"{}\" may not hold when checked against the actual numbers: {}. \
                         Verify that the math supports this claim.",
                        p.statement,
                        related_nums
                            .iter()
                            .map(|(prop, val)| format!("\"{}\" ({})", prop.statement, val))
                            .collect::<Vec<_>>()
                            .join(", ")
                    ),
                });
            }
        }
    }
}

/// Extract a numeric value from text (e.g., "$80,000" → 80000, "$8K" → 8000).
fn extract_numeric_value(text: &str) -> Option<f64> {
    let text = text.replace(',', "");
    // Look for $N, $NK, $NM patterns
    for word in text.split_whitespace() {
        let cleaned = word.trim_matches(|c: char| !c.is_ascii_digit() && c != '.' && c != 'K' && c != 'k' && c != 'M' && c != 'm');
        if cleaned.is_empty() {
            continue;
        }
        let multiplier = if cleaned.ends_with('K') || cleaned.ends_with('k') {
            1000.0
        } else if cleaned.ends_with('M') || cleaned.ends_with('m') {
            1_000_000.0
        } else {
            1.0
        };
        let num_part = cleaned.trim_end_matches(|c: char| c == 'K' || c == 'k' || c == 'M' || c == 'm');
        if let Ok(val) = num_part.parse::<f64>() {
            return Some(val * multiplier);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::test_helpers::*;

    #[test]
    fn test_explicit_contradiction() {
        let mut p1 = make_prop("p1", "claim", "high");
        p1.statement = "We should pivot to Enterprise".to_string();
        p1.formal_expression = "pivot_enterprise → optimal_outcome".to_string();

        let mut p2 = make_prop("p2", "constraint", "high");
        p2.statement = "Rebuild takes >12 months".to_string();
        p2.formal_expression = "time(rebuild) > 12_months".to_string();

        let graph = make_graph(
            vec![p1, p2],
            vec![make_rel("r1", "p2", "p1", "contradicts")],
        );

        let result = detect_contradictions(&graph);
        assert_eq!(result.len(), 1, "Should detect the explicit contradiction");
        assert_eq!(result[0].contradiction_type, "logical");
        assert!(result[0].proposition_ids.contains(&"p1".to_string()));
        assert!(result[0].proposition_ids.contains(&"p2".to_string()));
    }

    #[test]
    fn test_no_contradictions() {
        let graph = make_graph(
            vec![
                make_prop("p1", "claim", "high"),
                make_prop("p2", "evidence", "high"),
            ],
            vec![make_rel("r1", "p2", "p1", "supports")],
        );
        let result = detect_contradictions(&graph);
        assert_eq!(result.len(), 0, "No contradictions should be found");
    }

    #[test]
    fn test_logical_implication_conflict() {
        let mut p1 = make_prop("p1", "claim", "high");
        p1.formal_expression = "growth → success".to_string();
        let mut p2 = make_prop("p2", "claim", "high");
        p2.formal_expression = "growth → ¬success".to_string();

        let graph = make_graph(vec![p1, p2], vec![]);
        let result = detect_contradictions(&graph);
        assert!(result.len() >= 1, "Should detect logical implication conflict");
        assert!(
            result.iter().any(|c| c.contradiction_type == "logical"),
            "Should be classified as logical"
        );
    }

    #[test]
    fn test_multiple_contradictions() {
        let mut p1 = make_prop("p1", "claim", "high");
        p1.statement = "We should pivot now".to_string();
        let mut p2 = make_prop("p2", "constraint", "high");
        p2.statement = "Rebuild takes 18 months".to_string();
        let mut p3 = make_prop("p3", "claim", "high");
        p3.formal_expression = "X → Y".to_string();
        let mut p4 = make_prop("p4", "claim", "high");
        p4.formal_expression = "X → ¬Y".to_string();

        let graph = make_graph(
            vec![p1, p2, p3, p4],
            vec![make_rel("r1", "p2", "p1", "contradicts")],
        );

        let result = detect_contradictions(&graph);
        assert!(result.len() >= 2, "Should detect multiple contradictions, got {}", result.len());
    }

    #[test]
    fn test_extract_duration() {
        assert!(extract_duration("> 12 months").is_some());
        assert!(extract_duration("takes > 6 months").is_some());
        let (op, val) = extract_duration("> 12 months").unwrap();
        assert_eq!(op, ">");
        assert!((val - 12.0).abs() < 0.01);
    }
}
