/**
 * Cost-Based Optimizer (CBO)
 * Principles of Compiler Design - Phase 5: Cost-Based Plan Estimation
 */

import { CostModel, COST_CONSTANTS } from './cost_model.js';

export class CostBasedOptimizer {
  constructor(catalog) {
    this.catalog = catalog;
    this.costModel = new CostModel(catalog);
  }

  annotateAndEstimate(plan) {
    if (!plan) return { plan: null, totalCost: 0, estimatedRows: 0, breakdown: [] };

    const breakdown = [];
    const annotated = plan.clone();

    const computeNodeCost = (node) => {
      // Recursively calculate children cost first
      let childCostSum = 0;
      for (const child of node.children) {
        computeNodeCost(child);
        childCostSum += child.estimatedCost;
      }

      switch (node.type) {
        case 'LogicalScan': {
          const tableName = node.tableName.toLowerCase();
          const table = this.catalog.tables[tableName];
          const totalRows = table ? table.statistics.rowCount : 100;
          const totalPages = table ? table.statistics.pageCount : 10;

          // Estimate selectivity across all pushed predicates
          let cumulativeSelectivity = 1.0;
          for (const pred of node.pushedPredicates || []) {
            cumulativeSelectivity *= this.costModel.estimateSelectivity(pred, tableName);
          }

          // Check if index can be used
          const hasIndex = table && table.indexes && table.indexes.length > 0;
          let scanDetails;

          if (hasIndex && cumulativeSelectivity < 0.25) {
            const index = table.indexes[0];
            scanDetails = this.costModel.calculateIndexScanCost(tableName, index.name, cumulativeSelectivity);
            node.scanType = `IndexScan(${index.name})`;
          } else {
            scanDetails = this.costModel.calculateSeqScanCost(tableName, cumulativeSelectivity);
            node.scanType = 'SeqScan';
          }

          node.estimatedRows = scanDetails.outputRows;
          node.estimatedCost = Number(scanDetails.totalCost.toFixed(2));
          node.selectivity = Number(cumulativeSelectivity.toFixed(4));

          breakdown.push({
            nodeId: node.id,
            operator: `${node.scanType} ON ${node.tableName}`,
            selectivity: node.selectivity,
            ioCost: scanDetails.ioCost,
            cpuCost: scanDetails.cpuCost,
            totalCost: node.estimatedCost,
            estimatedRows: node.estimatedRows,
            explanation: `Scanned ${node.tableName} with ${node.pushedPredicates.length} pushed predicates (selectivity: ${(cumulativeSelectivity * 100).toFixed(1)}%)`
          });
          break;
        }

        case 'LogicalFilter': {
          const child = node.children[0];
          const sel = this.costModel.estimateSelectivity(node.condition, 'unknown');
          node.estimatedRows = Math.max(1, Math.round((child ? child.estimatedRows : 100) * sel));
          const cpuCost = (child ? child.estimatedRows : 100) * COST_CONSTANTS.TUPLE_CPU_COST;
          node.estimatedCost = Number((childCostSum + cpuCost).toFixed(2));

          breakdown.push({
            nodeId: node.id,
            operator: `Filter (σ)`,
            selectivity: Number(sel.toFixed(4)),
            ioCost: 0,
            cpuCost: Number(cpuCost.toFixed(2)),
            totalCost: node.estimatedCost,
            estimatedRows: node.estimatedRows,
            explanation: `Evaluated unpushed filter with selectivity ${(sel * 100).toFixed(1)}%`
          });
          break;
        }

        case 'LogicalJoin': {
          const leftChild = node.children[0];
          const rightChild = node.children[1];

          const outerRows = leftChild ? leftChild.estimatedRows : 100;
          const innerRows = rightChild ? rightChild.estimatedRows : 100;
          const outerPages = Math.max(1, Math.ceil(outerRows / 20));
          const innerPages = Math.max(1, Math.ceil(innerRows / 20));

          const joinEval = this.costModel.evaluateJoinCost(outerRows, innerRows, outerPages, innerPages, node.condition);
          node.recommendedAlgorithm = joinEval.recommendedAlgorithm;
          node.estimatedRows = joinEval.outputRows;
          node.estimatedCost = Number((childCostSum + joinEval.recommendedCost).toFixed(2));

          breakdown.push({
            nodeId: node.id,
            operator: `${node.recommendedAlgorithm} (⨝)`,
            joinType: node.joinType,
            outerRows,
            innerRows,
            nestedLoopCost: Number(joinEval.nestedLoop.totalCost.toFixed(2)),
            hashJoinCost: Number(joinEval.hashJoin.totalCost.toFixed(2)),
            totalCost: node.estimatedCost,
            estimatedRows: node.estimatedRows,
            explanation: `Selected ${node.recommendedAlgorithm} over alternative due to lower total cost (${joinEval.recommendedCost.toFixed(1)} vs ${node.recommendedAlgorithm === 'HashJoin' ? joinEval.nestedLoop.totalCost.toFixed(1) : joinEval.hashJoin.totalCost.toFixed(1)})`
          });
          break;
        }

        case 'LogicalAggregate': {
          const child = node.children[0];
          const inputRows = child ? child.estimatedRows : 100;
          const outputRows = Math.max(1, Math.round(inputRows * 0.2));
          const cpuCost = inputRows * COST_CONSTANTS.HASH_BUILD_PROBE_COST;
          node.estimatedRows = outputRows;
          node.estimatedCost = Number((childCostSum + cpuCost).toFixed(2));

          breakdown.push({
            nodeId: node.id,
            operator: 'HashAggregate (γ)',
            ioCost: 0,
            cpuCost: Number(cpuCost.toFixed(2)),
            totalCost: node.estimatedCost,
            estimatedRows: node.estimatedRows,
            explanation: `Hash aggregated ${inputRows} tuples into ~${outputRows} groups`
          });
          break;
        }

        case 'LogicalSort': {
          const child = node.children[0];
          const inputRows = child ? child.estimatedRows : 100;
          const cpuCost = inputRows * Math.log2(Math.max(2, inputRows)) * COST_CONSTANTS.SORT_CPU_COST;
          node.estimatedRows = inputRows;
          node.estimatedCost = Number((childCostSum + cpuCost).toFixed(2));

          breakdown.push({
            nodeId: node.id,
            operator: 'Sort (τ)',
            ioCost: 0,
            cpuCost: Number(cpuCost.toFixed(2)),
            totalCost: node.estimatedCost,
            estimatedRows: node.estimatedRows,
            explanation: `Sorted ${inputRows} tuples with N*log(N) comparisons`
          });
          break;
        }

        case 'LogicalProject': {
          const child = node.children[0];
          node.estimatedRows = child ? child.estimatedRows : 100;
          const cpuCost = node.estimatedRows * 0.002;
          node.estimatedCost = Number((childCostSum + cpuCost).toFixed(2));
          break;
        }

        case 'LogicalLimit': {
          const child = node.children[0];
          node.estimatedRows = node.limit ? Math.min(node.limit, child ? child.estimatedRows : 10) : (child ? child.estimatedRows : 10);
          node.estimatedCost = Number(childCostSum.toFixed(2));
          break;
        }

        default:
          node.estimatedCost = Number(childCostSum.toFixed(2));
          break;
      }
    };

    computeNodeCost(annotated);

    return {
      annotatedPlan: annotated,
      totalCost: annotated.estimatedCost,
      estimatedRows: annotated.estimatedRows,
      breakdown
    };
  }

  comparePlans(unoptimizedPlan, optimizedPlan) {
    const unopt = this.annotateAndEstimate(unoptimizedPlan);
    const opt = this.annotateAndEstimate(optimizedPlan);

    const costReduction = unopt.totalCost > 0
      ? Math.max(0, ((unopt.totalCost - opt.totalCost) / unopt.totalCost) * 100)
      : 0;

    return {
      unoptimized: {
        totalCost: unopt.totalCost,
        estimatedRows: unopt.estimatedRows,
        plan: unopt.annotatedPlan.toJSON(),
        breakdown: unopt.breakdown
      },
      optimized: {
        totalCost: opt.totalCost,
        estimatedRows: opt.estimatedRows,
        plan: opt.annotatedPlan.toJSON(),
        breakdown: opt.breakdown
      },
      speedupMultiplier: opt.totalCost > 0 ? Number((unopt.totalCost / opt.totalCost).toFixed(2)) : 1.0,
      costReductionPercent: Number(costReduction.toFixed(1))
    };
  }
}
