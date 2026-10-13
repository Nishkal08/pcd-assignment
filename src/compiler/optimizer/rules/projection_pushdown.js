/**
 * Optimization Rule: Projection Pushdown & Column Pruning
 * Principles of Compiler Design - Phase 5: Machine-Independent Optimization
 * Transforms: π_L(R ⨝ S) -> π_L(π_L1(R) ⨝ π_L2(S))
 */

export class ProjectionPushdownRule {
  constructor() {
    this.name = 'Projection Pushdown & Column Pruning';
    this.description = 'Prunes unused columns early from Scan operators (R) so only columns needed by upstream operators (JOIN, WHERE, SELECT) are loaded into memory.';
  }

  apply(rootPlan) {
    let modified = false;

    // 1. Gather all required columns throughout the entire query
    const requiredColumnsByTable = new Map(); // tableAlias -> Set of colNames

    const addCol = (tableAlias, colName) => {
      if (!colName || colName === '*') return;
      const tbl = (tableAlias || '').toLowerCase();
      const col = colName.toLowerCase();
      if (!requiredColumnsByTable.has(tbl)) {
        requiredColumnsByTable.set(tbl, new Set());
      }
      requiredColumnsByTable.get(tbl).add(col);
    };

    const extractCols = (expr) => {
      if (!expr) return;
      if (expr.type === 'ColumnRef') {
        const tbl = expr.resolvedAlias || expr.resolvedTable || expr.table || '';
        addCol(tbl, expr.resolvedColumn || expr.column);
      }
      if (expr.left) extractCols(expr.left);
      if (expr.right) extractCols(expr.right);
      if (expr.operand) extractCols(expr.operand);
      if (expr.expr) extractCols(expr.expr);
      if (expr.low) extractCols(expr.low);
      if (expr.high) extractCols(expr.high);
      if (expr.args) expr.args.forEach(extractCols);
      if (expr.values) expr.values.forEach(extractCols);
      if (expr.expression) extractCols(expr.expression);
    };

    // Traverse tree to collect all column references
    const collectRequired = (node) => {
      if (!node) return;

      if (node.type === 'LogicalProject') {
        for (const p of node.projections) {
          extractCols(p.expression || p.expr);
        }
      }

      if (node.type === 'LogicalFilter') {
        extractCols(node.condition);
      }

      if (node.type === 'LogicalJoin') {
        extractCols(node.condition);
      }

      if (node.type === 'LogicalAggregate') {
        for (const gb of node.groupBy) extractCols(gb);
        for (const agg of node.aggregates) extractCols(agg.arg);
      }

      if (node.type === 'LogicalSort') {
        for (const item of node.orderByItems) extractCols(item.expression);
      }

      if (node.type === 'LogicalScan' && node.pushedPredicates) {
        for (const p of node.pushedPredicates) extractCols(p);
      }

      for (const child of node.children) {
        collectRequired(child);
      }
    };

    collectRequired(rootPlan);

    // 2. Apply pruned column sets to LogicalScan nodes
    const applyPruning = (node) => {
      if (!node) return;

      if (node.type === 'LogicalScan') {
        const alias = (node.alias || node.tableName).toLowerCase();
        const needed = requiredColumnsByTable.get(alias) || requiredColumnsByTable.get(node.tableName.toLowerCase());

        // If specific columns were identified and not wildcard
        if (needed && needed.size > 0 && !needed.has('*')) {
          const newCols = Array.from(needed);
          if (JSON.stringify(node.projectedColumns) !== JSON.stringify(newCols)) {
            node.projectedColumns = newCols;
            modified = true;
          }
        }
      }

      for (const child of node.children) {
        applyPruning(child);
      }
    };

    applyPruning(rootPlan);
    return { plan: rootPlan, modified };
  }
}
