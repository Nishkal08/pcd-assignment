/**
 * Optimization Rule: Predicate Pushdown (Selection Pushdown)
 * Principles of Compiler Design - Phase 5: Machine-Independent Optimization
 * Transforms: σ_c(R ⨝ S) -> σ_c1(R) ⨝ σ_c2(S)
 */

import { BinaryOpNode, LiteralNode } from '../../ast.js';
import { LogicalFilterNode } from '../../relational_algebra.js';

export class PredicatePushdownRule {
  constructor() {
    this.name = 'Predicate Pushdown (Selection Pushdown)';
    this.description = 'Pushes filtering conditions (σ) down past Joins and Projections directly to base Scan operators (R) to filter records at storage before expensive join operations.';
  }

  apply(rootPlan) {
    let modified = false;

    // We process the plan tree recursively.
    // If a Filter node is encountered, we extract its conjuncts (AND terms),
    // and push each conjunct as far down as possible.
    const transform = (node) => {
      if (!node) return null;

      // First recursively transform children
      for (let i = 0; i < node.children.length; i++) {
        node.children[i] = transform(node.children[i]);
      }

      if (node.type === 'LogicalFilter') {
        const conjuncts = this.splitConjuncts(node.condition);
        const child = node.children[0];

        const remainingConjuncts = [];

        for (const conj of conjuncts) {
          const pushed = this.pushPredicateDown(conj, child);
          if (pushed) {
            modified = true;
          } else {
            remainingConjuncts.push(conj);
          }
        }

        // If all predicates were pushed down, eliminate this Filter node
        if (remainingConjuncts.length === 0) {
          modified = true;
          return child;
        }

        // Otherwise rebuild filter with remaining conjuncts
        node.condition = this.combineConjuncts(remainingConjuncts);
        return node;
      }

      return node;
    };

    const newPlan = transform(rootPlan);
    return { plan: newPlan, modified };
  }

  // Push an individual conjunct down into the subtree
  pushPredicateDown(predicate, node) {
    if (!node) return false;

    const tables = this.getReferencedTables(predicate);

    // 1. If target is a Scan Node
    if (node.type === 'LogicalScan') {
      const scanTable = (node.alias || node.tableName).toLowerCase();
      // If predicate has no table ref or matches this scan table
      if (tables.size === 0 || (tables.size === 1 && tables.has(scanTable))) {
        node.pushedPredicates.push(predicate);
        return true;
      }
      return false;
    }

    // 2. If target is a Join Node
    if (node.type === 'LogicalJoin') {
      const leftChild = node.children[0];
      const rightChild = node.children[1];

      const leftTables = this.collectSubtreeTables(leftChild);
      const rightTables = this.collectSubtreeTables(rightChild);

      const isSubOfLeft = Array.from(tables).every(t => leftTables.has(t));
      const isSubOfRight = Array.from(tables).every(t => rightTables.has(t));

      // Push to left subtree
      if (isSubOfLeft) {
        return this.pushPredicateDown(predicate, leftChild);
      }

      // Push to right subtree (only if INNER join or matching side)
      if (isSubOfRight && node.joinType === 'INNER') {
        return this.pushPredicateDown(predicate, rightChild);
      }

      // If it references both sides and this is an INNER join, attach it to Join ON condition!
      if (node.joinType === 'INNER') {
        if (!node.condition || (node.condition.type === 'Literal' && node.condition.value === true)) {
          node.condition = predicate;
        } else {
          node.condition = new BinaryOpNode('AND', node.condition, predicate);
        }
        return true;
      }

      return false;
    }

    // 3. If target is a Project Node
    if (node.type === 'LogicalProject') {
      // Push through projection if child can accept it
      return this.pushPredicateDown(predicate, node.children[0]);
    }

    // 4. If target is a Sort / Limit Node
    if (node.type === 'LogicalSort') {
      return this.pushPredicateDown(predicate, node.children[0]);
    }

    return false;
  }

  // Decompose `A AND B AND C` into `[A, B, C]`
  splitConjuncts(expr) {
    if (!expr) return [];
    if (expr.type === 'BinaryOp' && expr.operator.toUpperCase() === 'AND') {
      return [...this.splitConjuncts(expr.left), ...this.splitConjuncts(expr.right)];
    }
    return [expr];
  }

  // Combine `[A, B, C]` into `(A AND B) AND C`
  combineConjuncts(list) {
    if (list.length === 0) return new LiteralNode(true, 'BOOLEAN');
    if (list.length === 1) return list[0];

    let result = list[0];
    for (let i = 1; i < list.length; i++) {
      result = new BinaryOpNode('AND', result, list[i]);
    }
    return result;
  }

  // Collect all table aliases referenced in an expression
  getReferencedTables(expr) {
    const tables = new Set();
    const findTables = (e) => {
      if (!e) return;
      if (e.type === 'ColumnRef') {
        if (e.table) {
          tables.add(e.table.toLowerCase());
        } else if (e.resolvedAlias || e.resolvedTable) {
          tables.add((e.resolvedAlias || e.resolvedTable).toLowerCase());
        }
      }
      if (e.left) findTables(e.left);
      if (e.right) findTables(e.right);
      if (e.operand) findTables(e.operand);
      if (e.expr) findTables(e.expr);
      if (e.low) findTables(e.low);
      if (e.high) findTables(e.high);
      if (e.args) e.args.forEach(findTables);
      if (e.values) e.values.forEach(findTables);
    };
    findTables(expr);
    return tables;
  }

  // Collect all table aliases available in a subtree
  collectSubtreeTables(node) {
    const tables = new Set();
    const collect = (n) => {
      if (!n) return;
      if (n.type === 'LogicalScan') {
        tables.add((n.alias || n.tableName).toLowerCase());
      }
      for (const child of n.children) {
        collect(child);
      }
    };
    collect(node);
    return tables;
  }
}
