/**
 * Relational Algebra Intermediate Representation (IR)
 * Principles of Compiler Design - Phase 4: Intermediate Code Generation (Logical IR)
 */

let nextNodeId = 1;
export function resetNodeIdCounter() {
  nextNodeId = 1;
}

export class LogicalPlanNode {
  constructor(type) {
    this.id = `node_${nextNodeId++}`;
    this.type = type;
    this.children = [];
    this.estimatedRows = 0;
    this.estimatedCost = 0;
    this.schema = []; // list of output column names / types
  }

  addChild(child) {
    if (child) {
      this.children.push(child);
    }
    return this;
  }

  // Deep clone helper for optimizer transforms
  clone() {
    throw new Error('clone() must be implemented by subclass');
  }

  toRelationalAlgebra() {
    return this.type;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      relationalAlgebra: this.toRelationalAlgebra(),
      details: this.getDetails(),
      estimatedRows: this.estimatedRows,
      estimatedCost: this.estimatedCost,
      schema: this.schema,
      children: this.children.map(c => c.toJSON())
    };
  }

  getDetails() {
    return {};
  }
}

export class LogicalScanNode extends LogicalPlanNode {
  constructor(tableName, alias = null, projectedColumns = ['*']) {
    super('LogicalScan');
    this.tableName = tableName;
    this.alias = alias || tableName;
    this.projectedColumns = [...projectedColumns];
    this.pushedPredicates = [];
  }

  clone() {
    const copy = new LogicalScanNode(this.tableName, this.alias, this.projectedColumns);
    copy.pushedPredicates = JSON.parse(JSON.stringify(this.pushedPredicates));
    copy.estimatedRows = this.estimatedRows;
    copy.estimatedCost = this.estimatedCost;
    copy.schema = [...this.schema];
    return copy;
  }

  toRelationalAlgebra() {
    let name = this.alias !== this.tableName ? `${this.tableName} AS ${this.alias}` : this.tableName;
    if (this.pushedPredicates.length > 0) {
      const preds = this.pushedPredicates.map(exprToString).join(' ∧ ');
      return `σ[${preds}](${name})`;
    }
    return `Scan(${name})`;
  }

  getDetails() {
    return {
      table: this.tableName,
      alias: this.alias,
      projectedColumns: this.projectedColumns,
      pushedPredicates: this.pushedPredicates.map(exprToString)
    };
  }
}

export class LogicalFilterNode extends LogicalPlanNode {
  constructor(condition, child = null) {
    super('LogicalFilter');
    this.condition = condition; // Expression AST
    if (child) this.addChild(child);
  }

  clone() {
    const copy = new LogicalFilterNode(JSON.parse(JSON.stringify(this.condition)));
    copy.children = this.children.map(c => c.clone());
    copy.estimatedRows = this.estimatedRows;
    copy.estimatedCost = this.estimatedCost;
    copy.schema = [...this.schema];
    return copy;
  }

  toRelationalAlgebra() {
    return `σ [${exprToString(this.condition)}]`;
  }

  getDetails() {
    return {
      predicate: exprToString(this.condition)
    };
  }
}

export class LogicalProjectNode extends LogicalPlanNode {
  constructor(projections = [], child = null) {
    super('LogicalProject');
    this.projections = projections; // [{ expr, alias }]
    if (child) this.addChild(child);
  }

  clone() {
    const copy = new LogicalProjectNode(JSON.parse(JSON.stringify(this.projections)));
    copy.children = this.children.map(c => c.clone());
    copy.estimatedRows = this.estimatedRows;
    copy.estimatedCost = this.estimatedCost;
    copy.schema = [...this.schema];
    return copy;
  }

  toRelationalAlgebra() {
    const projStrs = this.projections.map(p => {
      const exprStr = exprToString(p.expression || p.expr);
      return p.alias ? `${exprStr} AS ${p.alias}` : exprStr;
    });
    return `π [${projStrs.join(', ')}]`;
  }

  getDetails() {
    return {
      projections: this.projections.map(p => ({
        expr: exprToString(p.expression || p.expr),
        alias: p.alias
      }))
    };
  }
}

export class LogicalJoinNode extends LogicalPlanNode {
  constructor(joinType, condition = null, leftChild = null, rightChild = null) {
    super('LogicalJoin');
    this.joinType = joinType || 'INNER'; // INNER, LEFT, RIGHT, FULL, CROSS
    this.condition = condition;          // Expression AST
    if (leftChild) this.addChild(leftChild);
    if (rightChild) this.addChild(rightChild);
  }

  clone() {
    const copy = new LogicalJoinNode(
      this.joinType,
      this.condition ? JSON.parse(JSON.stringify(this.condition)) : null
    );
    copy.children = this.children.map(c => c.clone());
    copy.estimatedRows = this.estimatedRows;
    copy.estimatedCost = this.estimatedCost;
    copy.schema = [...this.schema];
    return copy;
  }

  toRelationalAlgebra() {
    const symbol = this.joinType === 'LEFT' ? '⟕' :
                   this.joinType === 'RIGHT' ? '⟖' :
                   this.joinType === 'FULL' ? '⟗' :
                   this.joinType === 'CROSS' ? '✕' : '⨝';
    const condStr = this.condition ? ` [${exprToString(this.condition)}]` : '';
    return `${symbol}${condStr}`;
  }

  getDetails() {
    return {
      joinType: this.joinType,
      condition: this.condition ? exprToString(this.condition) : 'TRUE'
    };
  }
}

export class LogicalAggregateNode extends LogicalPlanNode {
  constructor(groupBy = [], aggregates = [], child = null) {
    super('LogicalAggregate');
    this.groupBy = groupBy;         // Array of Expression ASTs
    this.aggregates = aggregates;   // Array of { fnName, arg, alias }
    if (child) this.addChild(child);
  }

  clone() {
    const copy = new LogicalAggregateNode(
      JSON.parse(JSON.stringify(this.groupBy)),
      JSON.parse(JSON.stringify(this.aggregates))
    );
    copy.children = this.children.map(c => c.clone());
    copy.estimatedRows = this.estimatedRows;
    copy.estimatedCost = this.estimatedCost;
    copy.schema = [...this.schema];
    return copy;
  }

  toRelationalAlgebra() {
    const gbStrs = this.groupBy.map(exprToString).join(', ');
    const aggStrs = this.aggregates.map(a => `${a.fnName}(${exprToString(a.arg)})`).join(', ');
    const parts = [];
    if (gbStrs) parts.push(`keys: ${gbStrs}`);
    if (aggStrs) parts.push(`aggs: ${aggStrs}`);
    return `γ [${parts.join('; ')}]`;
  }

  getDetails() {
    return {
      groupBy: this.groupBy.map(exprToString),
      aggregates: this.aggregates.map(a => ({
        fnName: a.fnName,
        arg: exprToString(a.arg),
        alias: a.alias
      }))
    };
  }
}

export class LogicalSortNode extends LogicalPlanNode {
  constructor(orderByItems = [], child = null) {
    super('LogicalSort');
    this.orderByItems = orderByItems; // Array of OrderByItemNode
    if (child) this.addChild(child);
  }

  clone() {
    const copy = new LogicalSortNode(JSON.parse(JSON.stringify(this.orderByItems)));
    copy.children = this.children.map(c => c.clone());
    copy.estimatedRows = this.estimatedRows;
    copy.estimatedCost = this.estimatedCost;
    copy.schema = [...this.schema];
    return copy;
  }

  toRelationalAlgebra() {
    const items = this.orderByItems.map(i => `${exprToString(i.expression)} ${i.direction}`);
    return `τ [${items.join(', ')}]`;
  }

  getDetails() {
    return {
      orderBy: this.orderByItems.map(i => ({
        expr: exprToString(i.expression),
        direction: i.direction
      }))
    };
  }
}

export class LogicalLimitNode extends LogicalPlanNode {
  constructor(limit = null, offset = null, child = null) {
    super('LogicalLimit');
    this.limit = limit;
    this.offset = offset;
    if (child) this.addChild(child);
  }

  clone() {
    const copy = new LogicalLimitNode(this.limit, this.offset);
    copy.children = this.children.map(c => c.clone());
    copy.estimatedRows = this.estimatedRows;
    copy.estimatedCost = this.estimatedCost;
    copy.schema = [...this.schema];
    return copy;
  }

  toRelationalAlgebra() {
    const parts = [];
    if (this.limit !== null) parts.push(`limit=${this.limit}`);
    if (this.offset !== null) parts.push(`offset=${this.offset}`);
    return `L [${parts.join(', ')}]`;
  }

  getDetails() {
    return {
      limit: this.limit,
      offset: this.offset
    };
  }
}

/**
 * Pretty-print an AST Expression to SQL / math representation string
 */
export function exprToString(expr) {
  if (!expr) return '';

  switch (expr.type) {
    case 'Literal':
      if (typeof expr.value === 'string') return `'${expr.value}'`;
      return String(expr.value);

    case 'ColumnRef':
      if (expr.column === '*') return expr.table ? `${expr.table}.*` : '*';
      return expr.table ? `${expr.table}.${expr.column}` : expr.column;

    case 'BinaryOp': {
      const left = exprToString(expr.left);
      const right = exprToString(expr.right);
      const op = expr.operator;
      // Add parentheses around sub-expressions if needed
      const isNested = expr.left.type === 'BinaryOp' || expr.right.type === 'BinaryOp';
      return `${left} ${op} ${right}`;
    }

    case 'UnaryOp':
      return `${expr.operator} ${exprToString(expr.operand)}`;

    case 'FunctionCall': {
      const distinct = expr.isDistinct ? 'DISTINCT ' : '';
      const args = expr.args.map(exprToString).join(', ');
      return `${expr.name}(${distinct}${args})`;
    }

    case 'BetweenOp': {
      const not = expr.isNot ? 'NOT ' : '';
      return `${exprToString(expr.expr)} ${not}BETWEEN ${exprToString(expr.low)} AND ${exprToString(expr.high)}`;
    }

    case 'InOp': {
      const not = expr.isNot ? 'NOT ' : '';
      const vals = expr.values.map(exprToString).join(', ');
      return `${exprToString(expr.expr)} ${not}IN (${vals})`;
    }

    case 'LikeOp': {
      const not = expr.isNot ? 'NOT ' : '';
      return `${exprToString(expr.expr)} ${not}LIKE ${exprToString(expr.pattern)}`;
    }

    case 'IsNullOp': {
      const not = expr.isNot ? 'IS NOT NULL' : 'IS NULL';
      return `${exprToString(expr.expr)} ${not}`;
    }

    default:
      return expr.toString ? expr.toString() : JSON.stringify(expr);
  }
}
