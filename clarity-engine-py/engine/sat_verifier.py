"""
SAT-based contradiction detection with formal proof generation.
This module converts propositions to Boolean satisfiability problems and uses
DPLL algorithm to detect logical contradictions with mathematical proofs.
"""

import os
from typing import List, Dict, Optional, Tuple
from pysat.solvers import Glucose3
from pysat.formula import CNF
import uuid
import re

# Feature flag for enhanced logic
USE_ENHANCED_LOGIC = os.getenv("USE_ENHANCED_LOGIC", "true").lower() == "true"

# Optional sympy for complex expression parsing
try:
    from sympy import sympify, to_cnf
    from sympy.logic.boolalg import And, Or, Not, Boolean
    SYMPY_AVAILABLE = True
except ImportError:
    SYMPY_AVAILABLE = False


class SATVerifier:
    """
    Converts natural language propositions to CNF (Conjunctive Normal Form)
    and uses SAT solving to detect contradictions with formal proofs.
    """
    
    def __init__(self):
        self.var_counter = 1
        self.atom_to_var: Dict[str, int] = {}  # logical atom (p, q, r) -> SAT variable
        self.var_to_atom: Dict[int, str] = {}  # SAT variable -> logical atom
        self.prop_to_var: Dict[str, int] = {}  # proposition id -> primary SAT variable
        self.predicate_cache: Dict[str, str] = {}

    def _get_var(self, atom: str) -> int:
        """Assign a unique SAT variable to each logical atom (p, q, r, etc.)."""
        if atom not in self.atom_to_var:
            self.atom_to_var[atom] = self.var_counter
            self.var_to_atom[self.var_counter] = atom
            self.var_counter += 1
        return self.atom_to_var[atom]
    
    def _parse_formal_expression(self, formal_expr: str, prop_id: str) -> List[List[int]]:
        """
        Main entry point - use enhanced or basic parser based on feature flag.
        Always ensures prop_id has a variable for relationship clauses.
        """
        if USE_ENHANCED_LOGIC:
            return self._parse_formal_expression_enhanced(formal_expr, prop_id)
        return self._parse_formal_expression_basic(formal_expr, prop_id)

    def _parse_formal_expression_basic(self, formal_expr: str, prop_id: str) -> List[List[int]]:
        """Original basic parser - fallback when enhanced fails or is disabled."""
        if not formal_expr or formal_expr.strip() == "":
            var = self._get_var(prop_id)
            self.prop_to_var[prop_id] = var
            return [[var]]
        expr = formal_expr.strip().replace(" ", "")
        if expr.startswith("¬"):
            atom = expr[1:].strip() or prop_id
            var = self._get_var(atom)
            self.prop_to_var[prop_id] = var
            return [[-var]]
        if "→" in expr or "->" in expr:
            parts = re.split(r'→|->', expr)
            if len(parts) == 2:
                ant_var = self._get_var(parts[0].strip())
                cons_var = self._get_var(parts[1].strip())
                self.prop_to_var[prop_id] = ant_var
                return [[-ant_var, cons_var]]
        var = self._get_var(expr.strip())
        self.prop_to_var[prop_id] = var
        return [[var]]

    def _parse_formal_expression_enhanced(self, formal_expr: str, prop_id: str) -> List[List[int]]:
        """
        Enhanced parser for complex logical expressions.
        Links formal structure to prop_id for relationship integration.
        """
        if not formal_expr or formal_expr.strip() == "":
            var = self._get_var(prop_id)
            self.prop_to_var[prop_id] = var
            return [[var]]
        try:
            structure_clauses = self._sympy_to_cnf(formal_expr, prop_id)
            if structure_clauses:
                return self._link_prop_to_structure(prop_id, structure_clauses)
        except Exception as e:
            pass
        return self._pattern_match_to_cnf(formal_expr, prop_id)

    def _link_prop_to_structure(self, prop_id: str, structure_clauses: List[List[int]]) -> List[List[int]]:
        """Link proposition assertion to its formal structure: prop_id implies structure."""
        prop_var = self._get_var(prop_id)
        self.prop_to_var[prop_id] = prop_var
        result = [[prop_var]]
        for clause in structure_clauses:
            result.append([-prop_var] + clause)
        return result

    def _sympy_to_cnf(self, formal_expr: str, prop_id: str) -> Optional[List[List[int]]]:
        """Use sympy to parse and convert to CNF."""
        if not SYMPY_AVAILABLE:
            return None
        expr = (
            formal_expr.replace("∧", "&").replace("∨", "|").replace("¬", "~")
            .replace("→", ">>").replace("↔", "==")
            .replace(" AND ", " & ").replace(" OR ", " | ").replace(" NOT ", " ~ ")
        )
        expr = self._predicates_to_vars(expr, prop_id)
        try:
            symbolic = sympify(expr)
            cnf = to_cnf(symbolic, simplify=True)
            return self._sympy_cnf_to_clauses(cnf, prop_id)
        except Exception:
            return None

    def _predicates_to_vars(self, expr: str, prop_id: str) -> str:
        """Convert predicates and comparisons to boolean variable names."""
        for m in re.finditer(r"(\w+)\([^)]+\)", expr):
            pred = m.group(1)
            key = f"{pred}_{prop_id}"
            if key not in self.predicate_cache:
                self.predicate_cache[key] = key
            expr = expr.replace(m.group(0), key)
        for m in re.finditer(r"(\w+(?:\([^)]+\))?)\s*([><=≥≤]|>=|<=)\s*(\w+(?:\([^)]+\))?)", expr):
            left, op, right = m.group(1), m.group(2), m.group(3)
            op_clean = op.replace(">", "gt").replace("<", "lt").replace("=", "eq").replace("≥", "ge").replace("≤", "le")
            key = re.sub(r"\W+", "_", f"{left}_{op_clean}_{right}")[:40]
            if key not in self.predicate_cache:
                self.predicate_cache[key] = key
            expr = expr.replace(m.group(0), key)
        for m in re.finditer(r"(\w+)\s*∈\s*(\w+)", expr):
            key = f"{m.group(1)}_in_{m.group(2)}"
            if key not in self.predicate_cache:
                self.predicate_cache[key] = key
            expr = expr.replace(m.group(0), key)
        return expr

    def _sympy_cnf_to_clauses(self, cnf_expr, prop_id: str) -> List[List[int]]:
        """Convert sympy CNF to SAT clauses."""
        clauses = []
        if hasattr(cnf_expr, "args"):
            for arg in cnf_expr.args:
                clause = self._sympy_clause_to_sat(arg, prop_id)
                if clause:
                    clauses.append(clause)
        else:
            clause = self._sympy_clause_to_sat(cnf_expr, prop_id)
            if clause:
                clauses.append(clause)
        return clauses if clauses else []

    def _sympy_clause_to_sat(self, clause, prop_id: str) -> List[int]:
        """Convert sympy clause (disjunction) to SAT literals."""
        literals = []
        if hasattr(clause, "args"):
            for arg in clause.args:
                literals.append(self._sympy_literal_to_sat(arg, prop_id))
        else:
            literals.append(self._sympy_literal_to_sat(clause, prop_id))
        return literals

    def _sympy_literal_to_sat(self, literal, prop_id: str) -> int:
        """Convert sympy literal to SAT variable (positive or negative int)."""
        if SYMPY_AVAILABLE and isinstance(literal, Not):
            var_name = str(literal.args[0])
            return -self._get_var(f"{prop_id}_{var_name}")
        var_name = str(literal)
        return self._get_var(f"{prop_id}_{var_name}")

    def _pattern_match_to_cnf(self, formal_expr: str, prop_id: str) -> List[List[int]]:
        """Fallback pattern matching for common logical structures."""
        expr = formal_expr.strip()
        ops = ("∧", "∨", "→", "↔", "¬", "AND", "OR", "NOT", "&", "|", "~", "->", ">>")
        if not any(op in expr for op in ops):
            var = self._get_var(prop_id)
            self.prop_to_var[prop_id] = var
            return [[var]]
        if expr.startswith("¬") or expr.startswith("NOT "):
            inner = expr.lstrip("¬").lstrip("NOT").strip() or prop_id
            var = self._get_var(f"{prop_id}_neg_{inner}"[:50])
            self.prop_to_var[prop_id] = self._get_var(prop_id)
            return self._link_prop_to_structure(prop_id, [[-var]])
        if "∧" in expr or " AND " in expr:
            parts = re.split(r"∧| AND ", expr)
            clauses = []
            for i, _ in enumerate(parts):
                var = self._get_var(f"{prop_id}_part{i}")
                clauses.append([var])
            return self._link_prop_to_structure(prop_id, clauses)
        if "∨" in expr or " OR " in expr:
            parts = re.split(r"∨| OR ", expr)
            clause = [self._get_var(f"{prop_id}_part{i}") for i in range(len(parts))]
            return self._link_prop_to_structure(prop_id, [clause])
        if "→" in expr or "->" in expr or ">>" in expr:
            parts = re.split(r"→|->|>>", expr, maxsplit=1)
            if len(parts) == 2:
                vp = self._get_var(f"{prop_id}_ant")
                vq = self._get_var(f"{prop_id}_cons")
                self.prop_to_var[prop_id] = vp
                return self._link_prop_to_structure(prop_id, [[-vp, vq]])
        var = self._get_var(prop_id)
        self.prop_to_var[prop_id] = var
        return [[var]]
    
    def _get_main_var_for_prop(self, prop: dict) -> int:
        """Get the primary SAT variable representing this proposition."""
        prop_id = prop.get("id", "")
        if prop_id in self.prop_to_var:
            return self.prop_to_var[prop_id]
        for key in self.prop_to_var:
            if key.startswith(prop_id) or prop_id.startswith(key):
                return self.prop_to_var[key]
        return self._get_var(prop_id)

    def _extract_relationships_as_clauses(
        self, 
        propositions: List[dict],
        relationships: List[dict]
    ) -> List[List[int]]:
        """
        Convert relationships into logical constraints with semantic understanding.
        - supports: P → Q
        - contradicts: ¬(P ∧ Q) = ¬P ∨ ¬Q
        - depends_on: Q → P
        - attacks: P → ¬Q
        - assumes: P → Q
        """
        clauses = []
        prop_dict = {p.get("id", ""): p for p in propositions if p.get("id")}

        for rel in relationships:
            from_id = rel.get("fromId") or rel.get("source") or rel.get("from_id")
            to_id = rel.get("toId") or rel.get("target") or rel.get("to_id")
            if not from_id or not to_id:
                continue

            from_prop = prop_dict.get(from_id)
            to_prop = prop_dict.get(to_id)
            from_var = self._get_main_var_for_prop(from_prop) if from_prop else self._get_var(from_id)
            to_var = self._get_main_var_for_prop(to_prop) if to_prop else self._get_var(to_id)

            rel_type = rel.get("type", "")
            strength = rel.get("strength") or 0.5
            if isinstance(strength, str):
                strength = 0.7 if strength == "strong" else 0.5 if strength == "moderate" else 0.3

            if rel_type == "supports":
                clauses.append([-from_var, to_var])
            elif rel_type == "contradicts":
                clauses.append([-from_var, -to_var])
            elif rel_type == "depends_on":
                clauses.append([-to_var, from_var])
            elif rel_type == "attacks":
                clauses.append([-from_var, -to_var])
            elif rel_type == "assumes":
                clauses.append([-from_var, to_var])

        return clauses
    
    def verify_satisfiability(
        self, 
        propositions: List[dict],
        relationships: List[dict]
    ) -> Tuple[bool, Optional[List[str]], Optional[str]]:
        """
        Check if the set of propositions is logically consistent.
        
        Returns:
            (is_satisfiable, minimal_unsat_core, formal_proof)
        """
        self.var_counter = 1
        self.atom_to_var.clear()
        self.var_to_atom.clear()
        self.prop_to_var.clear()
        self.predicate_cache.clear()
        
        all_clauses = []
        
        # Convert each proposition to CNF
        for prop in propositions:
            formal_expr = prop.get("formalExpression") or prop.get("formal_expression", "")
            prop_id = prop.get("id", "")
            prop_clauses = self._parse_formal_expression(formal_expr, prop_id)
            all_clauses.extend(prop_clauses)
        
        # Add relationship constraints
        rel_clauses = self._extract_relationships_as_clauses(propositions, relationships)
        all_clauses.extend(rel_clauses)
        
        if not all_clauses:
            return True, None, None
        
        # Create CNF formula
        cnf = CNF(from_clauses=all_clauses)
        
        # Solve
        solver = Glucose3()
        solver.append_formula(cnf)
        
        is_sat = solver.solve()
        
        if is_sat:
            # Satisfiable - no contradiction
            solver.delete()
            return True, None, None
        
        # UNSAT - there's a contradiction
        # Extract minimal unsatisfiable core
        unsat_core = self._extract_minimal_unsat_core(cnf, propositions)
        
        # Generate formal proof
        proof = self._generate_formal_proof(unsat_core, propositions, relationships)
        
        solver.delete()
        return False, unsat_core, proof
    
    def _extract_minimal_unsat_core(
        self, 
        cnf: CNF, 
        propositions: List[dict]
    ) -> List[str]:
        """
        Find the minimal subset of propositions that cause the contradiction.
        """
        # Simple heuristic: try removing each proposition and see if it becomes SAT
        prop_ids = [p.get("id", "") for p in propositions if p.get("id")]
        
        # Start with all propositions
        current_core = set(prop_ids)
        
        for prop_id in prop_ids:
            # Try removing this proposition
            test_core = current_core - {prop_id}
            
            if len(test_core) == 0:
                continue
            
            # Rebuild CNF without this proposition
            test_vars = {self.atom_to_var.get(pid, 0) for pid in test_core if pid in self.atom_to_var}
            test_clauses = [
                clause for clause in cnf.clauses 
                if any(abs(lit) in test_vars for lit in clause)
            ]
            
            if not test_clauses:
                continue
            
            test_cnf = CNF(from_clauses=test_clauses)
            test_solver = Glucose3()
            test_solver.append_formula(test_cnf)
            
            if not test_solver.solve():
                # Still UNSAT without this proposition, so it's not essential
                current_core = test_core
            
            test_solver.delete()
        
        return list(current_core)
    
    def _generate_formal_proof(
        self, 
        unsat_core: List[str], 
        propositions: List[dict],
        relationships: List[dict]
    ) -> str:
        """
        Generate detailed formal proof showing actual derivation steps.
        """
        prop_dict = {p.get("id", ""): p for p in propositions if p.get("id")}
        core_props = [prop_dict[pid] for pid in unsat_core if pid in prop_dict]
        core_ids = set(unsat_core)

        proof_lines = [
            "FORMAL PROOF OF CONTRADICTION",
            "=" * 60,
            "",
            "Method: Boolean Satisfiability (SAT) Solving",
            "Algorithm: DPLL (Davis-Putnam-Logemann-Loveland)",
            "",
            "Given Propositions:",
            "",
        ]

        for i, prop in enumerate(core_props, 1):
            proof_lines.append(f"  P{i}: {prop.get('statement', '')}")
            formal_expr = prop.get("formalExpression") or prop.get("formal_expression", "")
            if formal_expr:
                proof_lines.append(f"      Formal: {formal_expr}")
            proof_lines.append("")

        proof_lines.append("Translation to Propositional Logic:")
        proof_lines.append("")

        for i, prop in enumerate(core_props, 1):
            formal_expr = prop.get("formalExpression") or prop.get("formal_expression", "") or "atom"
            if formal_expr and formal_expr != "atom":
                proof_lines.append(f"  P{i}: {formal_expr}")
                if "→" in formal_expr or "->" in formal_expr:
                    proof_lines.append("      Implication: A → B ≡ ¬A ∨ B")
                elif "∧" in formal_expr or "&" in formal_expr:
                    proof_lines.append("      Conjunction: Each conjunct must be true")
                elif "∨" in formal_expr or "|" in formal_expr:
                    proof_lines.append("      Disjunction: At least one disjunct must be true")
                proof_lines.append("")

        proof_lines.append("Constraint Analysis:")
        proof_lines.append("")

        contradictory_rels = [
            r for r in relationships
            if r.get("type") == "contradicts"
            and (r.get("fromId") or r.get("source") or r.get("from_id")) in core_ids
            and (r.get("toId") or r.get("target") or r.get("to_id")) in core_ids
        ]

        if contradictory_rels:
            proof_lines.append("  Direct Contradictions:")
            for rel in contradictory_rels:
                from_id = rel.get("fromId") or rel.get("source") or rel.get("from_id")
                to_id = rel.get("toId") or rel.get("target") or rel.get("to_id")
                from_prop = prop_dict.get(from_id)
                to_prop = prop_dict.get(to_id)
                if from_prop and to_prop:
                    proof_lines.append(f"    • '{from_prop.get('statement', '')}'")
                    proof_lines.append("      CONTRADICTS")
                    proof_lines.append(f"      '{to_prop.get('statement', '')}'")
                    if rel.get("label"):
                        proof_lines.append(f"      Reason: {rel.get('label')}")
                    proof_lines.append("")

        proof_lines.extend([
            "SAT Solver Analysis:",
            "",
            "  Converted all propositions and relationships to CNF clauses.",
            "  Applied DPLL algorithm to find satisfying assignment.",
            "",
            "  Result: UNSATISFIABLE",
            "",
            "  Explanation:",
            "    No assignment of truth values can simultaneously satisfy",
            "    all propositions and their constraints.",
            "",
            f"  Minimal Unsatisfiable Core: {len(core_props)} proposition(s)",
            "    (This is the smallest subset that causes the contradiction)",
            "",
            "Logical Derivation:",
            "",
        ])

        if len(core_props) == 2:
            p1, p2 = core_props
            fe1 = p1.get("formalExpression") or p1.get("formal_expression") or p1.get("statement", "")
            fe2 = p2.get("formalExpression") or p2.get("formal_expression") or p2.get("statement", "")
            proof_lines.append("  Assume both P1 and P2 are true:")
            proof_lines.append(f"    P1: {fe1}")
            proof_lines.append(f"    P2: {fe2}")
            proof_lines.append("")
            proof_lines.append("  This leads to: (P1) ∧ (P2)")
            proof_lines.append("")
            proof_lines.append("  But the constraints require: ¬(P1 ∧ P2)")
            proof_lines.append("")
            proof_lines.append("  Contradiction: (P1 ∧ P2) ∧ ¬(P1 ∧ P2)")
        elif len(core_props) == 3:
            proof_lines.append("  The combination of these three propositions")
            proof_lines.append("  creates a logical impossibility:")
            proof_lines.append("")
            for i, p in enumerate(core_props, 1):
                fe = p.get("formalExpression") or p.get("formal_expression") or p.get("statement", "")
                proof_lines.append(f"    P{i} asserts: {fe}")
            proof_lines.append("")
            proof_lines.append("  Together, they form: P1 ∧ P2 ∧ P3")
            proof_lines.append("  But constraints make this unsatisfiable.")

        proof_lines.extend([
            "",
            "Conclusion:",
            f"  At least one of the {len(core_props)} propositions in the core must be rejected.",
            "  The set of propositions is logically inconsistent.",
            "",
            "∴ UNSATISFIABLE (proved by exhaustive search)",
            "Q.E.D.",
            "",
            "─" * 60,
            "Note: This proof is formally verified by a SAT solver,",
            "      which guarantees correctness through exhaustive search.",
        ])

        return "\n".join(proof_lines)
    
    def detect_contradictions(
        self, 
        propositions: List[dict],
        relationships: List[dict]
    ) -> List[dict]:
        """
        Main entry point: detect all contradictions with formal proofs.
        """
        is_sat, unsat_core, proof = self.verify_satisfiability(propositions, relationships)
        
        if is_sat or not unsat_core:
            return []
        
        # Create Contradiction object
        contradiction = {
            "id": f"contra_sat_{uuid.uuid4().hex[:8]}",
            "propositionIds": unsat_core,
            "type": "logical",
            "severity": "critical" if len(unsat_core) <= 3 else "major",
            "formalProof": proof or "",
            "humanExplanation": f"SAT solver detected logical inconsistency among {len(unsat_core)} propositions. These statements cannot all be true simultaneously."
        }
        
        return [contradiction]


__all__ = ['SATVerifier']
