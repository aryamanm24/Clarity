use crate::types::LogicalGraph;
use std::collections::{HashMap, VecDeque};

/// Topological sort using Kahn's algorithm.
///
/// Orders propositions by logical dependency (most fundamental first).
/// Only considers dependency edges ("supports", "depends_on", "assumes").
///
/// If cycles exist, the cyclic nodes are omitted — only acyclic nodes
/// appear in the result, in correct dependency order.
pub fn topological_sort(graph: &LogicalGraph) -> Vec<String> {
    let adj = graph.get_dependency_adjacency();

    // Compute in-degree for each node (only from dependency edges)
    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    for p in &graph.propositions {
        in_degree.entry(p.id.as_str()).or_insert(0);
    }
    for rel in &graph.relationships {
        if crate::types::is_dependency_edge(&rel.rel_type) {
            *in_degree.entry(rel.to_id.as_str()).or_insert(0) += 1;
        }
    }

    // Initialize queue with all zero-in-degree nodes
    let mut queue: VecDeque<String> = VecDeque::new();
    for (&node, &deg) in &in_degree {
        if deg == 0 {
            queue.push_back(node.to_string());
        }
    }

    // Sort the initial queue for deterministic output
    let mut initial: Vec<String> = queue.drain(..).collect();
    initial.sort();
    for n in initial {
        queue.push_back(n);
    }

    let mut result: Vec<String> = Vec::new();

    while let Some(node) = queue.pop_front() {
        result.push(node.clone());

        // Reduce in-degree of all neighbors
        if let Some(neighbors) = adj.get(&node) {
            // Sort neighbors for deterministic output
            let mut sorted_neighbors = neighbors.clone();
            sorted_neighbors.sort();
            for neighbor in &sorted_neighbors {
                if let Some(deg) = in_degree.get_mut(neighbor.as_str()) {
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push_back(neighbor.clone());
                    }
                }
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::test_helpers::*;

    #[test]
    fn test_linear_chain() {
        // A → B → C (A supports B, B supports C)
        // Topo order: A should come first (it has no incoming deps)
        let graph = make_graph(
            vec![
                make_prop("A", "evidence", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "claim", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "B", "C", "supports"),
            ],
        );
        let order = topological_sort(&graph);
        assert_eq!(order.len(), 3);
        // A must come before B, B must come before C
        let pos_a = order.iter().position(|x| x == "A").unwrap();
        let pos_b = order.iter().position(|x| x == "B").unwrap();
        let pos_c = order.iter().position(|x| x == "C").unwrap();
        assert!(pos_a < pos_b, "A should come before B");
        assert!(pos_b < pos_c, "B should come before C");
    }

    #[test]
    fn test_diamond_dependency() {
        //   A
        //  / \
        // B   C
        //  \ /
        //   D
        let graph = make_graph(
            vec![
                make_prop("A", "evidence", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "evidence", "high"),
                make_prop("D", "claim", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "A", "C", "supports"),
                make_rel("r3", "B", "D", "supports"),
                make_rel("r4", "C", "D", "supports"),
            ],
        );
        let order = topological_sort(&graph);
        assert_eq!(order.len(), 4);
        let pos_a = order.iter().position(|x| x == "A").unwrap();
        let pos_d = order.iter().position(|x| x == "D").unwrap();
        assert!(pos_a < pos_d, "A should come before D");
    }

    #[test]
    fn test_cycle_excluded() {
        // A → B → A (cycle), C independent
        let graph = make_graph(
            vec![
                make_prop("A", "claim", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "evidence", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "B", "A", "supports"),
            ],
        );
        let order = topological_sort(&graph);
        // C has zero in-degree and is not in a cycle
        assert!(order.contains(&"C".to_string()), "C should be in result");
        // A and B are in a cycle — never reach in-degree 0
        assert_eq!(order.len(), 1, "Only non-cyclic nodes should appear");
    }

    #[test]
    fn test_ignores_non_dependency_edges() {
        // A contradicts B — should NOT create a dependency
        let graph = make_graph(
            vec![
                make_prop("A", "claim", "high"),
                make_prop("B", "claim", "high"),
            ],
            vec![make_rel("r1", "A", "B", "contradicts")],
        );
        let order = topological_sort(&graph);
        assert_eq!(order.len(), 2, "Both nodes should appear — contradicts is not a dependency");
    }
}
