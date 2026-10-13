/**
 * Cost-Based Optimization (CBO) Formulas & Selectivity Estimation
 * Principles of Compiler Design - Phase 5: Cost-Based Optimizer
 */

export const COST_CONSTANTS = {
  PAGE_IO_COST: 1.0,         // Cost of reading 1 disk block / memory page (4KB)
  TUPLE_CPU_COST: 0.01,      // CPU cost to process / evaluate one tuple predicate
  HASH_BUILD_PROBE_COST: 0.02,// CPU cost to hash and probe one tuple
  SORT_CPU_COST: 0.05,       // CPU cost to compare tuples during sorting
  INDEX_TREE_HEIGHT: 3       // Default B+ Tree height for index traversal
};

export class CostModel {
  constructor(catalog) {
    this.catalog = catalog;
  }

  // Calculate selectivity factor [0.0 to 1.0] of a predicate expression
  estimateSelectivity(predicate, tableName) {
    if (!predicate) return 1.0;

    const tableSchema = this.catalog.tables[tableName.toLowerCase()];
    if (!tableSchema) return 1.0;

    const stats = tableSchema.statistics;

    switch (predicate.type) {
      case 'Literal':
        return predicate.value ? 1.0 : 0.0;

      case 'BinaryOp': {
        const op = predicate.operator.toUpperCase();

        if (op === 'AND') {
          const s1 = this.estimateSelectivity(predicate.left, tableName);
          const s2 = this.estimateSelectivity(predicate.right, tableName);
          return s1 * s2;
        }

        if (op === 'OR') {
          const s1 = this.estimateSelectivity(predicate.left, tableName);
          const s2 = this.estimateSelectivity(predicate.right, tableName);
          return s1 + s2 - (s1 * s2);
        }

        // Single column comparison e.g. salary > 50000 or dept_id = 2
        const colRef = predicate.left.type === 'ColumnRef' ? predicate.left :
                       predicate.right.type === 'ColumnRef' ? predicate.right : null;
        const lit = predicate.left.type === 'Literal' ? predicate.left :
                    predicate.right.type === 'Literal' ? predicate.right : null;

        if (colRef && lit) {
          const colName = (colRef.resolvedColumn || colRef.column).toLowerCase();
          const colStat = stats.columns[colName];

          if (!colStat) return 0.2; // default heuristic

          if (op === '=') {
            const dv = colStat.distinctValues || 10;
            return 1.0 / Math.max(1, dv);
          }

          if (op === '!=' || op === '<>') {
            const dv = colStat.distinctValues || 10;
            return 1.0 - (1.0 / Math.max(1, dv));
          }

          if (['>', '>=', '<', '<='].includes(op)) {
            if (typeof lit.value === 'number' && colStat.min !== undefined && colStat.max !== undefined && colStat.max > colStat.min) {
              const val = Math.max(colStat.min, Math.min(colStat.max, lit.value));
              const range = colStat.max - colStat.min;
              if (op === '>' || op === '>=') {
                return Math.max(0.01, Math.min(0.99, (colStat.max - val) / range));
              } else {
                return Math.max(0.01, Math.min(0.99, (val - colStat.min) / range));
              }
            }
            return 0.33; // standard 1/3 default range selectivity
          }
        }

        return 0.2;
      }

      case 'BetweenOp': {
        const colRef = predicate.expr.type === 'ColumnRef' ? predicate.expr : null;
        if (colRef && predicate.low.type === 'Literal' && predicate.high.type === 'Literal') {
          const colName = (colRef.resolvedColumn || colRef.column).toLowerCase();
          const colStat = stats.columns[colName];
          if (colStat && colStat.min !== undefined && colStat.max !== undefined && colStat.max > colStat.min) {
            const low = Math.max(colStat.min, predicate.low.value);
            const high = Math.min(colStat.max, predicate.high.value);
            const range = colStat.max - colStat.min;
            const sel = Math.max(0.01, (high - low) / range);
            return predicate.isNot ? (1.0 - sel) : sel;
          }
        }
        return predicate.isNot ? 0.8 : 0.2;
      }

      case 'InOp': {
        const numItems = predicate.values.length;
        const sel = Math.min(0.9, numItems * 0.1);
        return predicate.isNot ? (1.0 - sel) : sel;
      }

      case 'LikeOp': {
        return predicate.isNot ? 0.9 : 0.1;
      }

      case 'UnaryOp': {
        if (predicate.operator === 'NOT') {
          return 1.0 - this.estimateSelectivity(predicate.operand, tableName);
        }
        return 0.5;
      }

      default:
        return 0.5;
    }
  }

  // Cost of Sequential Scan
  calculateSeqScanCost(tableName, selectivity = 1.0) {
    const table = this.catalog.tables[tableName.toLowerCase()];
    if (!table) return { cost: 10, rows: 100 };

    const pageCount = table.statistics.pageCount;
    const rowCount = table.statistics.rowCount;

    const ioCost = pageCount * COST_CONSTANTS.PAGE_IO_COST;
    const cpuCost = rowCount * COST_CONSTANTS.TUPLE_CPU_COST;
    const totalCost = ioCost + cpuCost;
    const outputRows = Math.max(1, Math.round(rowCount * selectivity));

    return {
      type: 'SeqScan',
      ioCost,
      cpuCost,
      totalCost,
      outputRows
    };
  }

  // Cost of Index Scan (B+ Tree)
  calculateIndexScanCost(tableName, indexName, selectivity = 0.1) {
    const table = this.catalog.tables[tableName.toLowerCase()];
    if (!table) return this.calculateSeqScanCost(tableName, selectivity);

    const pageCount = table.statistics.pageCount;
    const rowCount = table.statistics.rowCount;

    // Index traversal + selective page fetches
    const indexPages = Math.ceil(COST_CONSTANTS.INDEX_TREE_HEIGHT + (pageCount * selectivity));
    const ioCost = indexPages * COST_CONSTANTS.PAGE_IO_COST;
    const outputRows = Math.max(1, Math.round(rowCount * selectivity));
    const cpuCost = outputRows * COST_CONSTANTS.TUPLE_CPU_COST;
    const totalCost = ioCost + cpuCost;

    return {
      type: 'IndexScan',
      indexName,
      ioCost,
      cpuCost,
      totalCost,
      outputRows
    };
  }

  // Cost of Hash Join vs Nested Loop Join
  evaluateJoinCost(outerRows, innerRows, outerPages, innerPages, joinPredicate = null) {
    // 1. Nested Loop Join Cost: Outer_Scan + Outer_Rows * Inner_Scan
    const nljIoCost = (outerPages + outerRows * innerPages) * COST_CONSTANTS.PAGE_IO_COST;
    const nljCpuCost = (outerRows * innerRows) * COST_CONSTANTS.TUPLE_CPU_COST;
    const nljTotalCost = nljIoCost + nljCpuCost;

    // 2. In-Memory Hash Join Cost: 3 * (Outer_Pages + Inner_Pages) + (Outer_Rows + Inner_Rows) * Hash_Cost
    const hashIoCost = 2 * (outerPages + innerPages) * COST_CONSTANTS.PAGE_IO_COST;
    const hashCpuCost = (outerRows + innerRows) * COST_CONSTANTS.HASH_BUILD_PROBE_COST;
    const hashTotalCost = hashIoCost + hashCpuCost;

    const isHashPreferred = hashTotalCost < nljTotalCost;
    const estimatedOutputRows = Math.max(1, Math.round((outerRows * innerRows) * 0.1));

    return {
      nestedLoop: {
        algorithm: 'NestedLoopJoin',
        ioCost: nljIoCost,
        cpuCost: nljCpuCost,
        totalCost: nljTotalCost
      },
      hashJoin: {
        algorithm: 'HashJoin',
        ioCost: hashIoCost,
        cpuCost: hashCpuCost,
        totalCost: hashTotalCost
      },
      recommendedAlgorithm: isHashPreferred ? 'HashJoin' : 'NestedLoopJoin',
      recommendedCost: isHashPreferred ? hashTotalCost : nljTotalCost,
      outputRows: estimatedOutputRows
    };
  }
}
