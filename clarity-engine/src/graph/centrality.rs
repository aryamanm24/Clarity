use crate::types::LogicalGraph;
use std::collections::{HashMap, VecDeque};

/// Compute betweenness centrality for each node using Brandes' algorithm.
///
/// High centrality = many argument paths pass through this node.
/// A high-centrality assumption is "load-bearing" — the argument collapses without it.
///
/// Only follows dependency edges ("supports", "depends_on", "assumes").
/// Normalizes scores to 0.0–1.0 range.
pub fn betweenness_centrality(graph: &LogicalGraph) -> HashMap<String, f64> {
    let n = graph.propositions.len();
    let adj = graph.get_dependency_adjacency();
    let ids: Vec<&str> = graph.propositions.iter().map(|p| p.id.as_str()).collect();

    let mut centrality: HashMap<String, f64> = HashMap::new();
    for id in &ids {
        centrality.insert(id.to_string(), 0.0);
    }

    if n < 2 {
        return centrality;
    }

    // Brandes' algorithm: for each source node, BFS to find shortest paths,
    // then backtrack to accumulate betweenness contributions.
    for &source in &ids {
        // BFS from source
        let mut stack: Vec<&str> = Vec::new();
        let mut predecessors: HashMap<&str, Vec<&str>> = HashMap::new();
        let mut sigma: HashMap<&str, f64> = HashMap::new(); // number of shortest paths
        let mut dist: HashMap<&str, i64> = HashMap::new();  // distance from source

        for &id in &ids {
            predecessors.insert(id, Vec::new());
            sigma.insert(id, 0.0);
            dist.insert(id, -1);
        }
        sigma.insert(source, 1.0);
        dist.insert(source, 0);

        let mut queue: VecDeque<&str> = VecDeque::new();
        queue.push_back(source);

        while let Some(v) = queue.pop_front() {
            stack.push(v);
            let v_dist = dist[v];

            if let Some(neighbors) = adj.get(v) {
                for neighbor in neighbors {
                    let w = neighbor.as_str();
                    // Find w in our id set (ensure it's a valid node)
                    if !dist.contains_key(w) {
                        continue;
                    }

                    // w found for the first time?
                    if dist[w] < 0 {
                        dist.insert(w, v_dist + 1);
                        queue.push_back(
                            ids.iter().find(|&&id| id == w).copied().unwrap_or(w)
                        );
                    }

                    // shortest path to w via v?
                    if dist[w] == v_dist + 1 {
                        *sigma.get_mut(w).unwrap() += sigma[v];
                        predecessors.get_mut(w).unwrap().push(v);
                    }
                }
            }
        }

        // Back-propagation of dependencies
        let mut delta: HashMap<&str, f64> = HashMap::new();
        for &id in &ids {
            delta.insert(id, 0.0);
        }

        while let Some(w) = stack.pop() {
            if w == source {
                continue;
            }
            let sigma_w = sigma[w];
            if sigma_w == 0.0 {
                continue;
            }

            for &v in &predecessors[w] {
                let contribution = (sigma[v] / sigma_w) * (1.0 + delta[w]);
                *delta.get_mut(v).unwrap() += contribution;
            }

            // For undirected graphs we'd divide by 2, but our graph is directed
            *centrality.get_mut(w).unwrap() += delta[w];
        }
    }

    // Normalize to 0.0–1.0
    let normalization = if n > 2 {
        ((n - 1) * (n - 2)) as f64
    } else {
        1.0
    };

    for val in centrality.values_mut() {
        *val /= normalization;
        // Clamp to [0, 1]
        if *val > 1.0 {
            *val = 1.0;
        }
    }

    centrality
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::test_helpers::*;

    #[test]
    fn test_star_graph_center_highest() {
        // Center node C, with A→C, B→C, D→C, E→C
        // Then C→F
        // C should have highest centrality (all paths go through C)
        let graph = make_graph(
            vec![
                make_prop("A", "evidence", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "assumption", "medium"),
                make_prop("D", "evidence", "high"),
                make_prop("E", "evidence", "high"),
                make_prop("F", "claim", "high"),
            ],
            vec![
                make_rel("r1", "A", "C", "supports"),
                make_rel("r2", "B", "C", "supports"),
                make_rel("r3", "D", "C", "supports"),
                make_rel("r4", "E", "C", "supports"),
                make_rel("r5", "C", "F", "supports"),
            ],
        );
        let centrality = betweenness_centrality(&graph);
        let c_score = centrality["C"];
        // C should have higher centrality than leaf nodes
        assert!(c_score > centrality["A"], "Center should beat leaf A");
        assert!(c_score > centrality["F"], "Center should beat endpoint F");
    }

    #[test]
    fn test_linear_chain_middle_highest() {
        // A → B → C → D
        // B and C should have higher centrality than A and D
        let graph = make_graph(
            vec![
                make_prop("A", "evidence", "high"),
                make_prop("B", "evidence", "high"),
                make_prop("C", "evidence", "high"),
                make_prop("D", "claim", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "B", "C", "supports"),
                make_rel("r3", "C", "D", "supports"),
            ],
        );
        let centrality = betweenness_centrality(&graph);
        assert!(centrality["B"] > centrality["A"], "Middle node B > endpoint A");
        assert!(centrality["C"] > centrality["D"], "Middle node C > endpoint D");
    }

    #[test]
    fn test_disconnected_graph() {
        // Two disconnected components: A→B and C→D
        let graph = make_graph(
            vec![
                make_prop("A", "evidence", "high"),
                make_prop("B", "claim", "high"),
                make_prop("C", "evidence", "high"),
                make_prop("D", "claim", "high"),
            ],
            vec![
                make_rel("r1", "A", "B", "supports"),
                make_rel("r2", "C", "D", "supports"),
            ],
        );
        let centrality = betweenness_centrality(&graph);
        // Leaf nodes in small components should have 0 centrality
        assert_eq!(centrality["A"], 0.0);
        assert_eq!(centrality["B"], 0.0);
    }

    #[test]
    fn test_single_node() {
        let graph = make_graph(
            vec![make_prop("A", "claim", "high")],
            vec![],
        );
        let centrality = betweenness_centrality(&graph);
        assert_eq!(centrality["A"], 0.0);
    }
}
