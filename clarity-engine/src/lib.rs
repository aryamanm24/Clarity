pub mod types;
mod sat_solver;
mod fallacy_detector;
mod bias_detector;
mod argument_scorer;
pub mod graph;

use wasm_bindgen::prelude::*;

/// Main analysis entry point — called from JavaScript via WASM.
/// Takes a JSON string of propositions and relationships.
/// Returns a JSON string of analysis results.
#[wasm_bindgen]
pub fn analyze(graph_json: &str) -> Result<String, JsValue> {
    analyze_native(graph_json).map_err(|e| JsValue::from_str(&e))
}

/// Native entry point for testing (no JsValue dependency).
/// Same logic as `analyze` but returns `Result<String, String>`.
pub fn analyze_native(graph_json: &str) -> Result<String, String> {
    let graph: types::LogicalGraph = serde_json::from_str(graph_json)
        .map_err(|e| format!("Parse error: {}", e))?;

    let contradictions = sat_solver::detect_contradictions(&graph);
    let cycles = graph::cycle_detection::detect_cycles(&graph);
    let topo_order = graph::topo_sort::topological_sort(&graph);
    let centrality = graph::centrality::betweenness_centrality(&graph);
    let scores = argument_scorer::score_arguments(&graph, &contradictions, &centrality);
    let fallacies = fallacy_detector::detect_fallacies(&graph, &cycles);
    let biases = bias_detector::detect_biases(&graph, &centrality);

    let result = types::AnalysisResult {
        contradictions,
        fallacies,
        biases,
        argument_scores: scores,
        cycles,
        topological_order: topo_order,
    };

    serde_json::to_string(&result).map_err(|e| format!("Serialize error: {}", e))
}
