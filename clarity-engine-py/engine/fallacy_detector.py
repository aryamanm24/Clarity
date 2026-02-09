"""
Fallacy detection using graph algorithms (primary) and Gemini (secondary).
"""

from typing import List
from .graph_analyzer import GraphAnalyzer


def detect_fallacies(
    propositions: list[dict],
    relationships: list[dict]
) -> list[dict]:
    """
    Detect logical fallacies.
    
    Priority order:
    1. Graph-based structural fallacies (deterministic, provable)
    2. Load-bearing assumption identification
    """
    
    fallacies = []
    
    # PRIMARY: Graph-based detection
    graph_analyzer = GraphAnalyzer()
    graph_fallacies, load_bearing_ids = graph_analyzer.analyze_all(
        propositions,
        relationships
    )
    fallacies.extend(graph_fallacies)
    
    # Mark load-bearing assumptions in the propositions
    for prop in propositions:
        if prop.get("id") in load_bearing_ids:
            prop["isLoadBearing"] = True
    
    return fallacies


__all__ = ['detect_fallacies']
