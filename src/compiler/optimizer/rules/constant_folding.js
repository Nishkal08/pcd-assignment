/**
 * Optimization Rule: Constant Folding & Expression Simplification
 * Principles of Compiler Design - Phase 5: Machine-Independent Optimization
 */

import { LiteralNode, BinaryOpNode, UnaryOpNode } from '../../ast.js';

export class ConstantFoldingRule {
  constructor() {
    this.name = 'Constant Folding & Algebraic Simplification';
    this.description = 'Evaluates constant arithmetic, simplifies boolean tautologies (e.g., 1=1 -> TRUE, x AND TRUE -> x), and simplifies redundant logic.';
  }

  apply(plan) {
    let modified = false;

    const traverse = (node) => {
      if (!node) return;

      // Fold expressions in Filter nodes
      if (node.type === 'LogicalFilter' && node.condition) {
        const folded = this.foldExpression(node.condition);
        if (JSON.stringify(folded) !== JSON.stringify(node.condition)) {
          node.condition = folded;
          modified = true;
        }
      }

      // Fold expressions in Join conditions
      if (node.type === 'LogicalJoin' && node.condition) {
        const folded = this.foldExpression(node.condition);
        if (JSON.stringify(folded) !== JSON.stringify(node.condition)) {
          node.condition = folded;
          modified = true;
        }
      }

      // Fold expressions in Project items
      if (node.type === 'LogicalProject' && node.projections) {
        for (const proj of node.projections) {
          const target = proj.expression || proj.expr;
          if (target) {
            const folded = this.foldExpression(target);
            if (proj.expression) proj.expression = folded;
            if (proj.expr) proj.expr = folded;
          }
        }
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(plan);
    return { plan, modified };
  }

  foldExpression(expr) {
    if (!expr) return expr;

    switch (expr.type) {
      case 'BinaryOp': {
        const left = this.foldExpression(expr.left);
        const right = this.foldExpression(expr.right);
        const op = expr.operator.toUpperCase();

        // 1. Both operands are literals -> evaluate directly at compile time
        if (left.type === 'Literal' && right.type === 'Literal') {
          const lv = left.value;
          const rv = right.value;

          // Arithmetic folding
          if (typeof lv === 'number' && typeof rv === 'number') {
            if (op === '+') return new LiteralNode(lv + rv, 'NUMBER');
            if (op === '-') return new LiteralNode(lv - rv, 'NUMBER');
            if (op === '*') return new LiteralNode(lv * rv, 'NUMBER');
            if (op === '/') return new LiteralNode(rv !== 0 ? lv / rv : null, 'NUMBER');
            if (op === '%') return new LiteralNode(lv % rv, 'NUMBER');
          }

          // Comparison folding
          if (op === '=') return new LiteralNode(lv === rv, 'BOOLEAN');
          if (op === '!=' || op === '<>') return new LiteralNode(lv !== rv, 'BOOLEAN');
          if (op === '<') return new LiteralNode(lv < rv, 'BOOLEAN');
          if (op === '<=') return new LiteralNode(lv <= rv, 'BOOLEAN');
          if (op === '>') return new LiteralNode(lv > rv, 'BOOLEAN');
          if (op === '>=') return new LiteralNode(lv >= rv, 'BOOLEAN');

          // Boolean folding
          if (op === 'AND') return new LiteralNode(Boolean(lv && rv), 'BOOLEAN');
          if (op === 'OR') return new LiteralNode(Boolean(lv || rv), 'BOOLEAN');
        }

        // 2. Algebraic simplification with one boolean literal
        if (op === 'AND') {
          if (left.type === 'Literal' && left.value === true) return right;
          if (right.type === 'Literal' && right.value === true) return left;
          if (left.type === 'Literal' && left.value === false) return new LiteralNode(false, 'BOOLEAN');
          if (right.type === 'Literal' && right.value === false) return new LiteralNode(false, 'BOOLEAN');
        }

        if (op === 'OR') {
          if (left.type === 'Literal' && left.value === true) return new LiteralNode(true, 'BOOLEAN');
          if (right.type === 'Literal' && right.value === true) return new LiteralNode(true, 'BOOLEAN');
          if (left.type === 'Literal' && left.value === false) return right;
          if (right.type === 'Literal' && right.value === false) return left;
        }

        return new BinaryOpNode(expr.operator, left, right);
      }

      case 'UnaryOp': {
        const operand = this.foldExpression(expr.operand);
        const op = expr.operator.toUpperCase();

        if (operand.type === 'Literal') {
          if (op === 'NOT' && typeof operand.value === 'boolean') {
            return new LiteralNode(!operand.value, 'BOOLEAN');
          }
          if (op === '-' && typeof operand.value === 'number') {
            return new LiteralNode(-operand.value, 'NUMBER');
          }
        }

        return new UnaryOpNode(expr.operator, operand);
      }

      default:
        return expr;
    }
  }
}
