/**
 * Abstract Syntax Tree (AST) Node Definitions
 * Principles of Compiler Design - Phase 2: Syntax Analysis (AST representation)
 */

export class ASTNode {
  constructor(type) {
    this.type = type;
  }
}

export class SelectStatementNode extends ASTNode {
  constructor({
    distinct = false,
    columns = [],
    from = null,
    joins = [],
    where = null,
    groupBy = null,
    having = null,
    orderBy = null,
    limit = null,
    offset = null
  } = {}) {
    super('SelectStatement');
    this.distinct = distinct;
    this.columns = columns;     // Array of SelectItemNode
    this.from = from;           // TableRefNode
    this.joins = joins;         // Array of JoinNode
    this.where = where;         // Expression Node
    this.groupBy = groupBy;     // Array of Expression Nodes
    this.having = having;       // Expression Node
    this.orderBy = orderBy;     // Array of OrderByItemNode
    this.limit = limit;         // LiteralNode or number
    this.offset = offset;       // LiteralNode or number
  }
}

export class SelectItemNode extends ASTNode {
  constructor(expression, alias = null) {
    super('SelectItem');
    this.expression = expression; // Expression Node (ColumnRef, Literal, FunctionCall, etc.)
    this.alias = alias;           // string | null
  }
}

export class TableRefNode extends ASTNode {
  constructor(name, alias = null) {
    super('TableRef');
    this.name = name;
    this.alias = alias;
  }
}

export class JoinNode extends ASTNode {
  constructor(joinType, table, condition) {
    super('Join');
    this.joinType = joinType; // 'INNER', 'LEFT', 'RIGHT', 'FULL'
    this.table = table;       // TableRefNode
    this.condition = condition; // BinaryOpNode (ON condition)
  }
}

export class BinaryOpNode extends ASTNode {
  constructor(operator, left, right) {
    super('BinaryOp');
    this.operator = operator; // '=', '!=', '<', '<=', '>', '>=', 'AND', 'OR', '+', '-', '*', '/', etc.
    this.left = left;
    this.right = right;
  }
}

export class UnaryOpNode extends ASTNode {
  constructor(operator, operand) {
    super('UnaryOp');
    this.operator = operator; // 'NOT', '-', '+'
    this.operand = operand;
  }
}

export class ColumnRefNode extends ASTNode {
  constructor(table = null, column) {
    super('ColumnRef');
    this.table = table;       // string | null
    this.column = column;     // string or '*'
  }
}

export class LiteralNode extends ASTNode {
  constructor(value, literalType) {
    super('Literal');
    this.value = value;
    this.literalType = literalType; // 'NUMBER', 'STRING', 'BOOLEAN', 'NULL'
  }
}

export class FunctionCallNode extends ASTNode {
  constructor(name, args = [], isDistinct = false) {
    super('FunctionCall');
    this.name = name.toUpperCase(); // e.g. 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'
    this.args = args;
    this.isDistinct = isDistinct;
  }
}

export class BetweenOpNode extends ASTNode {
  constructor(expr, low, high, isNot = false) {
    super('BetweenOp');
    this.expr = expr;
    this.low = low;
    this.high = high;
    this.isNot = isNot;
  }
}

export class InOpNode extends ASTNode {
  constructor(expr, values = [], isNot = false) {
    super('InOp');
    this.expr = expr;
    this.values = values; // Array of LiteralNode or expressions
    this.isNot = isNot;
  }
}

export class LikeOpNode extends ASTNode {
  constructor(expr, pattern, isNot = false) {
    super('LikeOp');
    this.expr = expr;
    this.pattern = pattern;
    this.isNot = isNot;
  }
}

export class IsNullOpNode extends ASTNode {
  constructor(expr, isNot = false) {
    super('IsNullOp');
    this.expr = expr;
    this.isNot = isNot;
  }
}

export class OrderByItemNode extends ASTNode {
  constructor(expression, direction = 'ASC') {
    super('OrderByItem');
    this.expression = expression;
    this.direction = direction.toUpperCase(); // 'ASC' or 'DESC'
  }
}
