/**
 * Logical Plan Generator
 * Principles of Compiler Design - Phase 4: AST to Intermediate Representation Translation
 */

import {
  LogicalScanNode,
  LogicalFilterNode,
  LogicalProjectNode,
  LogicalJoinNode,
  LogicalAggregateNode,
  LogicalSortNode,
  LogicalLimitNode,
  resetNodeIdCounter
} from './relational_algebra.js';

export class LogicalPlanner {
  constructor(catalog) {
    this.catalog = catalog;
  }

  generatePlan(ast, semanticResult) {
    resetNodeIdCounter();

    if (!ast) return null;

    // 1. Build Base Relation Scans & Joins
    let currentPlan = this.buildTableSource(ast);

    // 2. Apply WHERE Clause Filter (Naive Canonical: Filter is placed directly above Join tree)
    if (ast.where) {
      const filterNode = new LogicalFilterNode(ast.where, currentPlan);
      currentPlan = filterNode;
    }

    // 3. Handle Aggregation (GROUP BY or presence of aggregate functions)
    const hasAggregates = this.detectAggregates(ast.columns) || ast.groupBy !== null || ast.having !== null;
    if (hasAggregates) {
      const aggregates = this.extractAggregates(ast.columns);
      const aggNode = new LogicalAggregateNode(ast.groupBy || [], aggregates, currentPlan);
      currentPlan = aggNode;

      // 4. Apply HAVING Filter on top of Aggregation
      if (ast.having) {
        const havingFilter = new LogicalFilterNode(ast.having, currentPlan);
        currentPlan = havingFilter;
      }
    }

    // 5. Apply Projection (π)
    const projectNode = new LogicalProjectNode(ast.columns, currentPlan);
    currentPlan = projectNode;

    // 6. Apply ORDER BY (τ)
    if (ast.orderBy && ast.orderBy.length > 0) {
      const sortNode = new LogicalSortNode(ast.orderBy, currentPlan);
      currentPlan = sortNode;
    }

    // 7. Apply LIMIT & OFFSET (L)
    if (ast.limit !== null || ast.offset !== null) {
      const limitNode = new LogicalLimitNode(ast.limit, ast.offset, currentPlan);
      currentPlan = limitNode;
    }

    return currentPlan;
  }

  buildTableSource(ast) {
    if (!ast.from) {
      // Dummy scan
      return new LogicalScanNode('dual', 'dual', ['*']);
    }

    // Initial base scan
    let root = new LogicalScanNode(
      ast.from.name.toLowerCase(),
      ast.from.alias || ast.from.name.toLowerCase(),
      ['*']
    );

    // Chain JOINs sequentially
    for (const join of ast.joins) {
      const rightScan = new LogicalScanNode(
        join.table.name.toLowerCase(),
        join.table.alias || join.table.name.toLowerCase(),
        ['*']
      );

      root = new LogicalJoinNode(
        join.joinType,
        join.condition,
        root,
        rightScan
      );
    }

    return root;
  }

  detectAggregates(selectItems) {
    for (const item of selectItems) {
      if (this.containsAggregate(item.expression)) {
        return true;
      }
    }
    return false;
  }

  containsAggregate(expr) {
    if (!expr) return false;
    if (expr.type === 'FunctionCall') {
      const fn = expr.name.toUpperCase();
      if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(fn)) return true;
    }
    if (expr.type === 'BinaryOp') {
      return this.containsAggregate(expr.left) || this.containsAggregate(expr.right);
    }
    if (expr.type === 'UnaryOp') {
      return this.containsAggregate(expr.operand);
    }
    return false;
  }

  extractAggregates(selectItems) {
    const aggs = [];
    let aggCounter = 1;

    for (const item of selectItems) {
      this.collectAggregatesFromExpr(item.expression, item.alias, aggs, () => `agg_${aggCounter++}`);
    }

    return aggs;
  }

  collectAggregatesFromExpr(expr, alias, aggs, nextAlias) {
    if (!expr) return;
    if (expr.type === 'FunctionCall') {
      const fn = expr.name.toUpperCase();
      if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(fn)) {
        aggs.push({
          fnName: fn,
          arg: expr.args[0] || null,
          isDistinct: !!expr.isDistinct,
          alias: alias || nextAlias()
        });
        return;
      }
    }
    if (expr.type === 'BinaryOp') {
      this.collectAggregatesFromExpr(expr.left, null, aggs, nextAlias);
      this.collectAggregatesFromExpr(expr.right, null, aggs, nextAlias);
    }
    if (expr.type === 'UnaryOp') {
      this.collectAggregatesFromExpr(expr.operand, null, aggs, nextAlias);
    }
  }
}
