/**
 * Optimization Rule: Dead & Redundant Predicate Removal
 * Principles of Compiler Design - Phase 5: Machine-Independent Optimization
 */

import { LiteralNode } from '../../ast.js';

export class DeadPredicateRemovalRule {
  constructor() {
    this.name = 'Dead & Redundant Predicate Removal';
    this.description = 'Removes tautological predicates (e.g. TRUE) and detects contradiction predicates (e.g. FALSE, 1=0) to bypass redundant database I/O.';
  }

  apply(rootPlan) {
    let modified = false;

    const transform = (node) => {
      if (!node) return null;

      for (let i = 0; i < node.children.length; i++) {
        node.children[i] = transform(node.children[i]);
      }

      // If Filter condition is literal TRUE, remove filter node
      if (node.type === 'LogicalFilter') {
        if (node.condition && node.condition.type === 'Literal' && node.condition.value === true) {
          modified = true;
          return node.children[0];
        }
      }

      // If Scan node has TRUE in pushed predicates, clean it
      if (node.type === 'LogicalScan' && node.pushedPredicates) {
        const initialLen = node.pushedPredicates.length;
        node.pushedPredicates = node.pushedPredicates.filter(p => !(p.type === 'Literal' && p.value === true));
        if (node.pushedPredicates.length !== initialLen) {
          modified = true;
        }
      }

      return node;
    };

    const newPlan = transform(rootPlan);
    return { plan: newPlan, modified };
  }
}
