/**
 * In-Memory Query Execution Engine & Performance Profiler
 * Principles of Compiler Design - Phase 6: Code Generation & Execution Engine
 */

import { generateDatabase } from './dataset.js';
import { PhysicalPlanner } from '../physical_planner.js';

export class QueryExecutor {
  constructor() {
    this.database = generateDatabase();
    this.planner = new PhysicalPlanner(this.database);
  }

  executeComparative(unoptimizedPlan, optimizedPlan) {
    const unoptResult = this.executePlan(unoptimizedPlan, false); // unoptimized uses nested loop join & unpushed filters
    const optResult = this.executePlan(optimizedPlan, true);      // optimized uses hash joins & pushed predicates

    const rowsScannedReduction = unoptResult.metrics.totalRowsScanned > 0
      ? Math.max(0, ((unoptResult.metrics.totalRowsScanned - optResult.metrics.totalRowsScanned) / unoptResult.metrics.totalRowsScanned) * 100)
      : 0;

    return {
      results: optResult.rows,
      rowCount: optResult.rows.length,
      columns: optResult.columns,
      unoptimized: {
        metrics: unoptResult.metrics,
        operatorTraces: unoptResult.operatorTraces
      },
      optimized: {
        metrics: optResult.metrics,
        operatorTraces: optResult.operatorTraces
      },
      comparison: {
        speedupMultiplier: Number(Math.max(1, unoptResult.metrics.totalRowsScanned / Math.max(1, optResult.metrics.totalRowsScanned)).toFixed(2)),
        rowsScannedReductionPercent: Number(rowsScannedReduction.toFixed(1)),
        timeSavedMs: Number(Math.max(0, unoptResult.metrics.executionTimeMs - optResult.metrics.executionTimeMs).toFixed(3))
      }
    };
  }

  executePlan(logicalPlan, useOptimizations = true) {
    if (!logicalPlan) {
      return { rows: [], columns: [], metrics: { totalRowsScanned: 0, tuplesProduced: 0, executionTimeMs: 0 }, operatorTraces: [] };
    }

    const rootIterator = this.planner.buildExecutionPipeline(logicalPlan, useOptimizations);
    const rows = [];
    const operatorTraces = [];

    const startTime = performance.now();
    rootIterator.open();

    let tuple;
    while ((tuple = rootIterator.next()) !== null) {
      rows.push(tuple);
    }

    rootIterator.close();
    const totalTimeMs = Number((performance.now() - startTime).toFixed(3));

    // Recursively collect operator metrics
    let totalRowsScanned = 0;
    const collectTraces = (iter) => {
      if (!iter) return;
      const m = iter.collectMetrics();
      operatorTraces.push(m);
      totalRowsScanned += m.tuplesScanned;

      if (iter.child) collectTraces(iter.child);
      if (iter.outer) collectTraces(iter.outer);
      if (iter.inner) collectTraces(iter.inner);
      if (iter.buildChild) collectTraces(iter.buildChild);
      if (iter.probeChild) collectTraces(iter.probeChild);
    };

    collectTraces(rootIterator);

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      rows,
      columns,
      metrics: {
        totalRowsScanned,
        tuplesProduced: rows.length,
        executionTimeMs: Math.max(0.05, totalTimeMs)
      },
      operatorTraces
    };
  }
}
