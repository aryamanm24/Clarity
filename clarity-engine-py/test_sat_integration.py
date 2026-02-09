"""
Quick integration test to verify SAT solver works.
"""

from engine.sat_verifier import SATVerifier


def test_sat_solver():
    """Test that SAT solver catches the cow milk contradiction."""
    
    print("🧪 Testing SAT Solver Integration\n")
    
    # Mock propositions (what Gemini would return)
    propositions = [
        {
            "id": "prop_1",
            "statement": "I love cow milk",
            "formalExpression": "p",
            "type": "premise"
        },
        {
            "id": "prop_2",
            "statement": "I hate all cow-based products",
            "formalExpression": "¬q",
            "type": "premise"
        },
        {
            "id": "prop_3",
            "statement": "Cow milk is a cow-based product",
            "formalExpression": "p → q",
            "type": "assumption"
        }
    ]
    
    # Mock relationships
    relationships = [
        {
            "fromId": "prop_1",
            "toId": "prop_3",
            "type": "depends_on"
        },
        {
            "fromId": "prop_2",
            "toId": "prop_3",
            "type": "contradicts"
        }
    ]
    
    print("Input propositions:")
    for p in propositions:
        print(f"  - {p['statement']} (formal: {p['formalExpression']})")
    print()
    
    # Run SAT solver
    verifier = SATVerifier()
    contradictions = verifier.detect_contradictions(propositions, relationships)
    
    if contradictions:
        print(f"✅ SUCCESS: Detected {len(contradictions)} contradiction(s)\n")
        for c in contradictions:
            print(f"Contradiction ID: {c['id']}")
            print(f"Type: {c['type']}")
            print(f"Severity: {c['severity']}")
            print(f"Propositions involved: {c['propositionIds']}")
            print(f"\n{c['formalProof']}\n")
        return True
    else:
        print("❌ FAILED: No contradictions detected")
        print("The SAT solver should have caught this contradiction!")
        return False


def test_valid_argument():
    """Test that SAT solver correctly identifies valid arguments."""
    
    print("\n🧪 Testing Valid Argument (Should Pass)\n")
    
    # Valid Modus Ponens
    propositions = [
        {
            "id": "prop_1",
            "statement": "If it rains, the ground gets wet",
            "formalExpression": "p → q",
            "type": "premise"
        },
        {
            "id": "prop_2",
            "statement": "It is raining",
            "formalExpression": "p",
            "type": "premise"
        },
        {
            "id": "prop_3",
            "statement": "The ground is wet",
            "formalExpression": "q",
            "type": "conclusion"
        }
    ]
    
    relationships = [
        {
            "fromId": "prop_1",
            "toId": "prop_3",
            "type": "supports"
        },
        {
            "fromId": "prop_2",
            "toId": "prop_3",
            "type": "supports"
        }
    ]
    
    print("Input: Valid Modus Ponens")
    for p in propositions:
        print(f"  - {p['statement']}")
    print()
    
    verifier = SATVerifier()
    contradictions = verifier.detect_contradictions(propositions, relationships)
    
    if not contradictions:
        print("✅ SUCCESS: No contradictions detected (as expected)")
        return True
    else:
        print(f"❌ FAILED: False positive - detected {len(contradictions)} contradiction(s)")
        return False


if __name__ == "__main__":
    test1 = test_sat_solver()
    test2 = test_valid_argument()
    
    print("\n" + "="*60)
    print(f"RESULTS: {'✅ ALL TESTS PASSED' if test1 and test2 else '❌ SOME TESTS FAILED'}")
    print("="*60)
    
    exit(0 if test1 and test2 else 1)
