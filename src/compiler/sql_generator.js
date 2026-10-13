/**
 * SQL Generator / Decompiler
 * Principles of Compiler Design (PCD)
 * Reconstructs formatted, human-readable SQL queries from Logical Plan Intermediate Representation (IR)
 */

import { exprToString } from './relational_algebra.js';

export class SQLGenerator {
  /**
   * Generate formatted SQL from a LogicalPlanNode tree.
   * @param {LogicalPlanNode} planRoot 
   * @param {Object} options
   * @param {'flat'|'subquery'} [options.style='flat'] - 'flat' (standard SQL) or 'subquery' (explicit pushdown)
   * @param {boolean} [options.uppercase=true]
   * @returns {string} Formatted SQL query
   */
  static generate(planRoot, options = {}) {
    if (!planRoot) return '';

    const style = options.style || 'flat';
    const state = {
      projections: [],
      groupBy: [],
      having: null,
      whereConditions: [],
      fromClause: '',
      orderBy: [],
      limit: null,
      offset: null,
      scans: []
    };

    this.collectPlanElements(planRoot, state, style);

    return this.assembleSQL(state, style);
  }

  /**
   * Walk the Logical Plan tree and collect query clauses
   */
  static collectPlanElements(node, state, style) {
    if (!node) return;

    if (node.type === 'LogicalLimit') {
      state.limit = node.limit;
      state.offset = node.offset;
      if (node.children[0]) {
        this.collectPlanElements(node.children[0], state, style);
      }
      return;
    }

    if (node.type === 'LogicalSort') {
      state.orderBy = (node.orderByItems || []).map(item => {
        const dir = item.direction || 'ASC';
        return `${exprToString(item.expression)} ${dir}`;
      });
      if (node.children[0]) {
        this.collectPlanElements(node.children[0], state, style);
      }
      return;
    }

    if (node.type === 'LogicalProject') {
      state.projections = (node.projections || []).map(p => {
        const exprStr = exprToString(p.expression || p.expr);
        return p.alias ? `${exprStr} AS ${p.alias}` : exprStr;
      });
      if (node.children[0]) {
        this.collectPlanElements(node.children[0], state, style);
      }
      return;
    }

    if (node.type === 'LogicalFilter') {
      // Check if child is Aggregate -> this filter is a HAVING clause
      if (node.children[0] && node.children[0].type === 'LogicalAggregate') {
        state.having = exprToString(node.condition);
        this.collectPlanElements(node.children[0], state, style);
        return;
      }

      // Otherwise it's a WHERE condition
      const condStr = exprToString(node.condition);
      if (condStr && condStr !== 'true' && condStr !== '1 = 1') {
        state.whereConditions.push(condStr);
      }
      if (node.children[0]) {
        this.collectPlanElements(node.children[0], state, style);
      }
      return;
    }

    if (node.type === 'LogicalAggregate') {
      state.groupBy = (node.groupBy || []).map(exprToString);
      // Aggregates themselves are reflected in Projections, or collected here
      if (node.children[0]) {
        this.collectPlanElements(node.children[0], state, style);
      }
      return;
    }

    // FROM & JOIN sources
    state.fromClause = this.buildFromClause(node, style, state);
  }

  /**
   * Build FROM and JOIN clauses from LogicalJoin / LogicalScan nodes
   */
  static buildFromClause(node, style, state) {
    if (!node) return '';

    if (node.type === 'LogicalScan') {
      state.scans.push(node);
      return this.formatScanSource(node, style);
    }

    if (node.type === 'LogicalJoin') {
      const leftPart = this.buildFromClause(node.children[0], style, state);
      const rightPart = this.buildFromClause(node.children[1], style, state);
      const joinType = node.joinType || 'INNER';
      const condStr = node.condition ? ` ON ${exprToString(node.condition)}` : '';
      return `${leftPart}\n  ${joinType} JOIN ${rightPart}${condStr}`;
    }

    if (node.children && node.children.length > 0) {
      return this.buildFromClause(node.children[0], style, state);
    }

    return '';
  }

  /**
   * Format a single table scan, either as plain table name or subquery
   */
  static formatScanSource(scanNode, style) {
    const table = scanNode.tableName;
    const alias = scanNode.alias;
    const hasAlias = alias && alias.toLowerCase() !== table.toLowerCase();
    const pushedPreds = (scanNode.pushedPredicates || []).map(exprToString).filter(Boolean);
    const cols = scanNode.projectedColumns || ['*'];
    const hasColPruning = cols.length > 0 && !cols.includes('*');

    if (style === 'subquery' && (pushedPreds.length > 0 || hasColPruning)) {
      const colStr = cols.join(', ');
      const wherePart = pushedPreds.length > 0 ? ` WHERE ${pushedPreds.join(' AND ')}` : '';
      const aliasName = hasAlias ? alias : table;
      return `(\n    SELECT ${colStr}\n    FROM ${table}${wherePart}\n  ) AS ${aliasName}`;
    }

    return hasAlias ? `${table} AS ${alias}` : table;
  }

  /**
   * Combine collected clauses into formatted SQL
   */
  static assembleSQL(state, style) {
    const lines = [];

    // SELECT
    const selectItems = state.projections.length > 0 ? state.projections.join(',\n  ') : '*';
    lines.push(`SELECT\n  ${selectItems}`);

    // FROM
    if (state.fromClause) {
      lines.push(`FROM ${state.fromClause}`);
    }

    // WHERE (in 'flat' mode, combine un-pushed filters + pushed scan filters if needed)
    const allWhere = [...state.whereConditions];
    if (style === 'flat') {
      // Include pushed scan predicates if they are not already represented
      for (const scan of state.scans) {
        if (scan.pushedPredicates && scan.pushedPredicates.length > 0) {
          scan.pushedPredicates.forEach(p => {
            const s = exprToString(p);
            if (s && !allWhere.includes(s) && s !== 'true' && s !== '1 = 1') {
              allWhere.push(s);
            }
          });
        }
      }
    }

    if (allWhere.length > 0) {
      lines.push(`WHERE ${allWhere.join('\n  AND ')}`);
    }

    // GROUP BY
    if (state.groupBy.length > 0) {
      lines.push(`GROUP BY ${state.groupBy.join(', ')}`);
    }

    // HAVING
    if (state.having) {
      lines.push(`HAVING ${state.having}`);
    }

    // ORDER BY
    if (state.orderBy.length > 0) {
      lines.push(`ORDER BY ${state.orderBy.join(', ')}`);
    }

    // LIMIT & OFFSET
    if (state.limit !== null && state.limit !== undefined) {
      let limitLine = `LIMIT ${state.limit}`;
      if (state.offset !== null && state.offset !== undefined) {
        limitLine += ` OFFSET ${state.offset}`;
      }
      lines.push(limitLine);
    }

    return lines.join('\n') + ';';
  }
}
