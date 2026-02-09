use clarity_engine::analyze_native;

#[test]
fn test_analyze_empty_graph() {
    let graph_json = r#"{"propositions":[],"relationships":[]}"#;
    let result = analyze_native(graph_json);
    assert!(result.is_ok());

    let result_str = result.unwrap();
    assert!(result_str.contains("contradictions"));
    assert!(result_str.contains("fallacies"));
    assert!(result_str.contains("biases"));
    assert!(result_str.contains("argumentScores"));
    assert!(result_str.contains("topologicalOrder"));
}

#[test]
fn test_analyze_invalid_json() {
    let result = analyze_native("not valid json");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Parse error"));
}

#[test]
fn test_analyze_single_proposition() {
    let graph_json = r#"{
        "propositions": [{
            "id": "p1",
            "statement": "Test claim",
            "formalExpression": "test → true",
            "type": "claim",
            "confidence": "high",
            "isImplicit": false,
            "isLoadBearing": true,
            "isAnchored": false
        }],
        "relationships": []
    }"#;

    let result = analyze_native(graph_json);
    assert!(result.is_ok());
    let json: serde_json::Value = serde_json::from_str(&result.unwrap()).unwrap();
    assert_eq!(json["argumentScores"].as_array().unwrap().len(), 1);
}

#[test]
fn test_full_founder_pivot_scenario() {
    let graph_json = r#"{
        "propositions": [
            {
                "id": "fp-p1",
                "statement": "We should pivot to Enterprise",
                "formalExpression": "pivot_enterprise → optimal_outcome",
                "type": "claim",
                "confidence": "high",
                "isImplicit": false,
                "isLoadBearing": true,
                "isAnchored": false
            },
            {
                "id": "fp-p2",
                "statement": "Enterprise deal sizes are 5x larger",
                "formalExpression": "deal_size(enterprise) > 5 * deal_size(smb)",
                "type": "evidence",
                "confidence": "high",
                "isImplicit": false,
                "isLoadBearing": false,
                "isAnchored": false
            },
            {
                "id": "fp-p3",
                "statement": "Current SMB growth is stalling",
                "formalExpression": "growth_rate(smb) <= 0.03",
                "type": "evidence",
                "confidence": "medium",
                "isImplicit": false,
                "isLoadBearing": false,
                "isAnchored": false
            },
            {
                "id": "fp-p4",
                "statement": "Larger deals necessarily lead to better outcomes",
                "formalExpression": "deal_size(x) > deal_size(y) → outcome(x) > outcome(y)",
                "type": "assumption",
                "confidence": "unstated_as_absolute",
                "isImplicit": true,
                "isLoadBearing": true,
                "isAnchored": true
            },
            {
                "id": "fp-p5",
                "statement": "Product rebuild would take >12 months",
                "formalExpression": "time(rebuild_enterprise) > 12_months",
                "type": "constraint",
                "confidence": "high",
                "isImplicit": false,
                "isLoadBearing": false,
                "isAnchored": false
            }
        ],
        "relationships": [
            {"id": "r1", "fromId": "fp-p2", "toId": "fp-p1", "type": "supports", "strength": "strong"},
            {"id": "r2", "fromId": "fp-p3", "toId": "fp-p1", "type": "supports", "strength": "moderate"},
            {"id": "r3", "fromId": "fp-p1", "toId": "fp-p4", "type": "depends_on", "strength": "strong"},
            {"id": "r4", "fromId": "fp-p5", "toId": "fp-p1", "type": "contradicts", "strength": "strong"}
        ]
    }"#;

    let result = analyze_native(graph_json);
    assert!(result.is_ok(), "Should parse and analyze successfully");

    let json: serde_json::Value = serde_json::from_str(&result.unwrap()).unwrap();

    // Should detect the explicit contradiction (fp-p5 contradicts fp-p1)
    let contradictions = json["contradictions"].as_array().unwrap();
    assert!(!contradictions.is_empty(), "Should find at least one contradiction");

    // Should detect anchoring bias on fp-p4
    let biases = json["biases"].as_array().unwrap();
    assert!(!biases.is_empty(), "Should find at least one bias");
    assert!(
        biases.iter().any(|b| {
            b["name"].as_str().unwrap_or("").contains("Anchoring")
        }),
        "Should detect Anchoring Effect on fp-p4"
    );

    // Should score all 5 propositions
    let scores = json["argumentScores"].as_array().unwrap();
    assert_eq!(scores.len(), 5, "Should score all 5 propositions");

    // The contradicted claim (fp-p1) should have a lower score
    let p1_score = scores.iter()
        .find(|s| s["propositionId"] == "fp-p1")
        .unwrap()["score"]
        .as_f64()
        .unwrap();
    assert!(p1_score < 0.6, "Contradicted claim should score below 0.6, got {}", p1_score);
}
