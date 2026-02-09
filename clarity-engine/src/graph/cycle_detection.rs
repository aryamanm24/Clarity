use crate::types::LogicalGraph;
use std::collections::{HashMap, HashSet};

/// Detect all cycles in the logical graph using DFS with three-color marking.
///
/// Only follows dependency edges ("supports", "depends_on", "assumes") —
/// "contradicts" and "attacks" are adversarial, not circular dependency.
///
/// Returns: Vec of cycles, each cycle is a Vec of proposition IDs in cycle order.
pub fn detect_cycles(graph: &LogicalGraph) -> Vec<Vec<String>> {
    let adj = graph.get_dependency_adjacency();
    // Use owned Strings to avoid lifetime headaches
    let mut color: HashMap<String, u8> = HashMap::new(); // 0=white, 1=gray, 2=black
    let mut cycles: Vec<Vec<String>> = Vec::new();

    // Initialize all nodes as white (unvisited)
    for p in &graph.propositions {
        color.insert(p.id.clone(), 0);
    }

    let ids: Vec<String> = graph.propositions.iter().map(|p| p.id.clone()).collect();
    for start in &ids {
        if color.get(start) == Some(&0) {
            let mut path: Vec<String> = Vec::new();
            dfs_visit(start, &adj, &mut color, &mut cycles, &mut path);
        }
    }

    // Deduplicate cycles: normalize each cycle to start with its smallest ID
    deduplicate_cycles(&mut cycles);

    cycles
}

fn dfs_visit(
    node: &str,
    adj: &HashMap<String, Vec<String>>,
    color: &mut HashMap<String, u8>,
    cycles: &mut Vec<Vec<String>>,
    path: &mut Vec<String>,
) {
    color.insert(node.to_string(), 1); // Mark gray (in current DFS path)
    path.push(node.to_string());

    if let Some(neighbors) = adj.get(node) {
        for neighbor in neighbors {
            // Self-loop detection
            if neighbor == node {
                cycles.push(vec![node.to_string()]);
                continue;
            }

            match color.get(neighbor.as_str()).copied() {
                Some(0) => {
                    // White: unvisited — recurse
                    dfs_visit(neighbor, adj, color, cycles, path);
                }
                Some(1) => {
                    // Gray: back edge found — extract cycle from path
                    let cycle = extract_cycle_from_path(path, neighbor);
                    if !cycle.is_empty() {
                        cycles.push(cycle);
                    }
                }
                _ => {
                    // Black (2) or unknown: fully processed — skip
                }
            }
        }
    }

    path.pop();
    color.insert(node.to_string(), 2); // Mark black (fully processed)
}

/// Extract a cycle from the current DFS path.
/// The cycle starts at `cycle_start` and ends at the current tail of `path`.
fn extract_cycle_from_path(path: &[String], cycle_start: &str) -> Vec<String> {
    if let Some(start_idx) = path.iter().position(|n| n == cycle_start) {
        path[start_idx..].to_vec()
    } else {
        Vec::new()
    }
}

/// Deduplicate cycles by normalizing: rotate each cycle so the smallest ID is first,
/// then remove duplicates.
fn deduplicate_cycles(cycles: &mut Vec<Vec<String>>) {
    let mut seen: HashSet<Vec<String>> = HashSet::new();
    cycles.retain(|cycle| {
        let normalized = normalize_cycle(cycle);
        seen.insert(normalized)
    });
}

/// Rotate a cycle so the lexicographically smallest element is first.
fn normalize_cycle(cycle: &[String]) -> Vec<String> {
    if cycle.len() <= 1 {
        return cycle.to_vec();
    }
    let min_idx = cycle
        .iter()
        .enumerate()
        .min_by_key(|(_, v)| v.as_str())
        .map(|(i, _)| i)
        .unwrap_or(0);

    let mut normalized = Vec::with_capacity(cycle.len());
    for i in 0..cycle.len() {
        normalized.push(cycle[(min_idx + i) % cycle.len()].clone());
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::test_helpers::*;

    #[test]
    fn test_triangle_cycle() {
        // A → B → C → A  (all "supports" edges)
        let graph = make_graph(
            vec![
                make_prop("A", "claim", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "evidence", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "B", "C", "supports"),
                make_rel("r3", "C", "A", "supports"),
            ],
        );
        let cycles = detect_cycles(&graph);
        assert_eq!(cycles.len(), 1, "Should detect exactly one cycle");
        assert_eq!(cycles[0].len(), 3, "Cycle should have 3 nodes");
    }

    #[test]
    fn test_linear_chain_no_cycle() {
        // A → B → C (no cycle)
        let graph = make_graph(
            vec![
                make_prop("A", "claim", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "evidence", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "B", "C", "supports"),
            ],
        );
        let cycles = detect_cycles(&graph);
        assert_eq!(cycles.len(), 0, "Linear chain should have no cycles");
    }

    #[test]
    fn test_self_loop() {
        // A → A (self-loop)
        let graph = make_graph(
            vec![make_prop("A", "claim", "high")],
            vec![make_rel("r1", "A", "A", "depends_on")],
        );
        let cycles = detect_cycles(&graph);
        assert_eq!(cycles.len(), 1, "Should detect self-loop");
        assert_eq!(cycles[0].len(), 1);
    }

    #[test]
    fn test_two_separate_cycles() {
        // Cycle 1: A → B → A
        // Cycle 2: C → D → C
        let graph = make_graph(
            vec![
                make_prop("A", "claim", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "claim", "high"),
                make_prop("D", "evidence", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "B", "A", "supports"),
                make_rel("r3", "C", "D", "depends_on"),
                make_rel("r4", "D", "C", "depends_on"),
            ],
        );
        let cycles = detect_cycles(&graph);
        assert_eq!(cycles.len(), 2, "Should detect two separate cycles");
    }

    #[test]
    fn test_cycle_embedded_in_acyclic_structure() {
        // E1 → C1, E2 → C1, C1 → A1, A1 → C1 (cycle between C1 and A1)
        let graph = make_graph(
            vec![
                make_prop("E1", "evidence", "high"),
                make_prop("E2", "evidence", "high"),
                make_prop("C1", "claim", "high"),
                make_prop("A1", "assumption", "medium"),
            ],
            vec![
                make_rel("r1", "E1", "C1", "supports"),
                make_rel("r2", "E2", "C1", "supports"),
                make_rel("r3", "C1", "A1", "depends_on"),
                make_rel("r4", "A1", "C1", "supports"),
            ],
        );
        let cycles = detect_cycles(&graph);
        assert_eq!(cycles.len(), 1, "Should detect exactly one cycle in mixed graph");
        let cycle = &cycles[0];
        assert!(cycle.contains(&"C1".to_string()));
        assert!(cycle.contains(&"A1".to_string()));
    }

    #[test]
    fn test_ignores_contradiction_edges() {
        // A → B (supports), B → A (contradicts) — NOT a dependency cycle
        let graph = make_graph(
            vec![
                make_prop("A", "claim", "high"),
                make_prop("B", "evidence", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "B", "A", "contradicts"),
            ],
        );
        let cycles = detect_cycles(&graph);
        assert_eq!(cycles.len(), 0, "contradicts edges should not form cycles");
    }
}
