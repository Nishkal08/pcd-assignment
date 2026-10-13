/**
 * Physical Plan Generator
 * Principles of Compiler Design - Phase 6: Code Generation (Logical to Physical Tree)
 */

import {
  SeqScanIterator,
  FilterIterator,
  ProjectIterator,
  NestedLoopJoinIterator,
  HashJoinIterator,
  HashAggregateIterator,
  SortIterator,
  LimitIterator
} from './engine/iterators.js';

export class PhysicalPlanner {
  constructor(database) {
    this.database = database;
  }

  buildExecutionPipeline(logicalPlan, useHashJoins = true) {
    if (!logicalPlan) return null;

    const buildIterator = (node) => {
      switch (node.type) {
        case 'LogicalScan': {
          const tableName = node.tableName.toLowerCase();
          const tableData = this.database[tableName] || [];
          return new SeqScanIterator(
            node.tableName,
            tableData,
            node.alias,
            node.projectedColumns,
            node.pushedPredicates || []
          );
        }

        case 'LogicalFilter': {
          const childIter = buildIterator(node.children[0]);
          return new FilterIterator(childIter, node.condition);
        }

        case 'LogicalProject': {
          const childIter = buildIterator(node.children[0]);
          return new ProjectIterator(childIter, node.projections);
        }

        case 'LogicalJoin': {
          const leftIter = buildIterator(node.children[0]);
          const rightIter = buildIterator(node.children[1]);

          // Use HashJoin if enabled and condition exists, else NestedLoop
          if (useHashJoins && node.condition) {
            return new HashJoinIterator(rightIter, leftIter, node.joinType, node.condition);
          }
          return new NestedLoopJoinIterator(leftIter, rightIter, node.joinType, node.condition);
        }

        case 'LogicalAggregate': {
          const childIter = buildIterator(node.children[0]);
          return new HashAggregateIterator(childIter, node.groupBy, node.aggregates);
        }

        case 'LogicalSort': {
          const childIter = buildIterator(node.children[0]);
          return new SortIterator(childIter, node.orderByItems);
        }

        case 'LogicalLimit': {
          const childIter = buildIterator(node.children[0]);
          return new LimitIterator(childIter, node.limit, node.offset);
        }

        default:
          throw new Error(`Unsupported logical node type: ${node.type}`);
      }
    };

    return buildIterator(logicalPlan);
  }
}
