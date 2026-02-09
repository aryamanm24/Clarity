"""
Graph-theoretic algorithms for detecting structural logical fallacies.
"""

import networkx as nx
from typing import List, Dict, Tuple
import uuid


class GraphAnalyzer:
    """
    Analyzes argument structure using graph algorithms.
    Detects circular reasoning, load-bearing assumptions, and other structural issues.
    """
    
    def __init__(self):
        self.graph = nx.DiGraph()
    
    def build_graph(
        self, 
        propositions: List[dict], 
        relationships: List[dict]
    ) -> nx.DiGraph:
        """Build directed graph from propositions and relationships."""
        self.graph.clear()
        
        # Add nodes
        for prop in propositions:
            prop_id = prop.get("id", "")
            self.graph.add_node(
                prop_id,
                statement=prop.get("statement", ""),
                type=prop.get("type", ""),
                confidence=prop.get("confidence", "")
            )
        
        # Add edges
        for rel in relationships:
            from_id = rel.get("fromId") or rel.get("source") or rel.get("from_id")
            to_id = rel.get("toId") or rel.get("target") or rel.get("to_id")
            rel_type = rel.get("type", "")
            
            if from_id and to_id and rel_type in ["supports", "depends_on", "concludes_from"]:
                self.graph.add_edge(
                    from_id,
                    to_id,
                    type=rel_type,
                    strength=rel.get("strength", "")
                )
        
        return self.graph
    
    def detect_circular_reasoning(self) -> List[dict]:
        """
        Find cycles in the argument graph (circular reasoning).
        Uses DFS-based cycle detection.
        """
        fallacies = []
        
        try:
            cycles = list(nx.simple_cycles(self.graph))
        except:
            cycles = []
        
        for i, cycle in enumerate(cycles):
            if len(cycle) < 2:
                continue
            
            # Build description
            cycle_statements = [
                self.graph.nodes[node_id].get('statement', node_id)
                for node_id in cycle
            ]
            
            description = "Circular reasoning detected:\n"
            for j, stmt in enumerate(cycle_statements):
                description += f"  {j+1}. {stmt}\n"
                if j < len(cycle_statements) - 1:
                    description += f"     ↓ supports\n"
            description += f"  (loops back to 1)"
            
            fallacy = {
                "id": f"fallacy_circular_{uuid.uuid4().hex[:8]}",
                "name": "Circular Reasoning (Begging the Question)",
                "description": description,
                "affectedNodeIds": cycle,
                "patternType": "circular"
            }
            fallacies.append(fallacy)
        
        return fallacies
    
    def detect_hasty_generalization(
        self, 
        propositions: List[dict]
    ) -> List[dict]:
        """
        Detect claims with high confidence but insufficient evidence.
        Pattern: High confidence + 0-1 supporting evidence nodes.
        """
        fallacies = []
        prop_dict = {p.get("id", ""): p for p in propositions if p.get("id")}
        
        for prop in propositions:
            prop_type = prop.get("type", "")
            confidence = prop.get("confidence", "")
            prop_id = prop.get("id", "")
            
            if prop_type not in ("claim", "conclusion") or confidence not in ("high", "unstated_as_absolute"):
                continue
            
            # Count evidence supporting this claim
            try:
                predecessors = list(self.graph.predecessors(prop_id))
            except:
                predecessors = []
            
            evidence_count = sum(
                1 for pred_id in predecessors
                if prop_dict.get(pred_id, {}).get("type") == "evidence"
            )
            
            if evidence_count <= 1:
                fallacy = {
                    "id": f"fallacy_hasty_{uuid.uuid4().hex[:8]}",
                    "name": "Hasty Generalization",
                    "description": f"High confidence claim supported by only {evidence_count} piece(s) of evidence:\n  \"{prop.get('statement', '')}\"",
                    "affectedNodeIds": [prop_id],
                    "patternType": "hasty_generalization"
                }
                fallacies.append(fallacy)
        
        return fallacies
    
    def find_load_bearing_assumptions(
        self, 
        propositions: List[dict]
    ) -> List[str]:
        """
        Find assumptions that many conclusions depend on (high betweenness centrality).
        These are vulnerable points in the argument.
        """
        if len(self.graph.nodes) < 3:
            return []
        
        try:
            centrality = nx.betweenness_centrality(self.graph)
        except:
            return []
        
        # Find assumptions with high centrality
        prop_dict = {p.get("id", ""): p for p in propositions if p.get("id")}
        load_bearing = []
        
        for node_id, score in centrality.items():
            prop = prop_dict.get(node_id)
            if prop and prop.get("type") == "assumption" and score > 0.3:
                load_bearing.append(node_id)
        
        return load_bearing
    
    def detect_false_dilemma(
        self, 
        propositions: List[dict]
    ) -> List[dict]:
        """
        Detect false dilemma: claim presents only 2 options when more exist.
        Pattern: Claim with exactly 2 "depends_on" edges and formal expression containing "OR".
        """
        fallacies = []
        
        for prop in propositions:
            prop_type = prop.get("type", "")
            prop_id = prop.get("id", "")
            
            if prop_type not in ("claim", "conclusion"):
                continue
            
            # Check if claim has exactly 2 dependencies
            try:
                dependencies = list(self.graph.predecessors(prop_id))
            except:
                dependencies = []
            
            if len(dependencies) == 2:
                # Check if formal expression suggests binary choice
                formal = (prop.get("formalExpression") or prop.get("formal_expression", "")).lower()
                if "∨" in formal or " or " in formal:
                    fallacy = {
                        "id": f"fallacy_dilemma_{uuid.uuid4().hex[:8]}",
                        "name": "False Dilemma (False Dichotomy)",
                        "description": f"Argument presents only two options when more may exist:\n  \"{prop.get('statement', '')}\"",
                        "affectedNodeIds": [prop_id] + dependencies,
                        "patternType": "false_dilemma"
                    }
                    fallacies.append(fallacy)
        
        return fallacies
    
    def analyze_all(
        self, 
        propositions: List[dict], 
        relationships: List[dict]
    ) -> Tuple[List[dict], List[str]]:
        """
        Run all graph-based analyses.
        Returns: (fallacies, load_bearing_assumption_ids)
        """
        self.build_graph(propositions, relationships)
        
        fallacies = []
        fallacies.extend(self.detect_circular_reasoning())
        fallacies.extend(self.detect_hasty_generalization(propositions))
        fallacies.extend(self.detect_false_dilemma(propositions))
        
        load_bearing = self.find_load_bearing_assumptions(propositions)
        
        return fallacies, load_bearing


__all__ = ['GraphAnalyzer']
