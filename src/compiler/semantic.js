/**
 * Semantic Analyzer & Symbol Table Resolution
 * Principles of Compiler Design - Phase 3: Semantic Analysis & Type Checking
 */

import { DATABASE_CATALOG } from './catalog.js';

export class SemanticError extends Error {
  constructor(message, details = {}) {
    super(`Semantic Error: ${message}`);
    this.name = 'SemanticError';
    this.details = details;
  }
}

export class SymbolTable {
  constructor() {
    this.tables = new Map();   // aliasOrName -> { originalName, schema }
    this.columns = new Map();  // column -> Array of { tableAlias, originalTable, type }
  }

  addTable(aliasOrName, originalName, schema) {
    this.tables.set(aliasOrName.toLowerCase(), {
      name: aliasOrName,
      originalName,
      schema
    });

    for (const [colName, colMeta] of Object.entries(schema.columns)) {
      const lowerCol = colName.toLowerCase();
      if (!this.columns.has(lowerCol)) {
        this.columns.set(lowerCol, []);
      }
      this.columns.get(lowerCol).push({
        tableAlias: aliasOrName,
        originalTable: originalName,
        type: colMeta.type,
        nullable: colMeta.nullable,
        isPrimary: !!colMeta.isPrimary
      });
    }
  }

  hasTable(aliasOrName) {
    return this.tables.has(aliasOrName.toLowerCase());
  }

  getTable(aliasOrName) {
    return this.tables.get(aliasOrName.toLowerCase());
  }

  resolveColumn(tableAlias, columnName) {
    const lowerCol = columnName.toLowerCase();

    if (tableAlias) {
      const tableInfo = this.getTable(tableAlias);
      if (!tableInfo) {
        throw new SemanticError(`Unknown table or table alias '${tableAlias}'`);
      }
      const colMeta = tableInfo.schema.columns[lowerCol] ||
        Object.entries(tableInfo.schema.columns).find(([k]) => k.toLowerCase() === lowerCol)?.[1];

      if (!colMeta) {
        throw new SemanticError(`Column '${columnName}' does not exist in table '${tableInfo.originalName}' (alias '${tableAlias}')`);
      }

      return {
        tableAlias: tableInfo.name,
        originalTable: tableInfo.originalName,
        columnName: lowerCol,
        type: colMeta.type
      };
    }

    // Unqualified column
    const matches = this.columns.get(lowerCol);
    if (!matches || matches.length === 0) {
      throw new SemanticError(`Column '${columnName}' does not exist in any referenced table in scope`);
    }

    if (matches.length > 1) {
      const candidates = matches.map(m => `${m.tableAlias}.${columnName}`).join(', ');
      throw new SemanticError(`Column reference '${columnName}' is ambiguous. Matching candidates: ${candidates}`);
    }

    return {
      tableAlias: matches[0].tableAlias,
      originalTable: matches[0].originalTable,
      columnName: lowerCol,
      type: matches[0].type
    };
  }
}

export class SemanticAnalyzer {
  constructor(catalog = DATABASE_CATALOG) {
    this.catalog = catalog;
    this.symbolTable = new SymbolTable();
    this.annotatedAST = null;
    this.errors = [];
    this.warnings = [];
    this.typeAnnotations = new Map();
  }

  analyze(ast) {
    this.symbolTable = new SymbolTable();
    this.errors = [];
    this.warnings = [];
    this.typeAnnotations = new Map();

    if (!ast || ast.type !== 'SelectStatement') {
      this.errors.push(new SemanticError('Invalid AST: Expected SelectStatement'));
      return this.getResult();
    }

    try {
      // 1. Build Scope from FROM and JOINs
      this.buildScope(ast);

      // 2. Analyze WHERE clause
      if (ast.where) {
        const whereType = this.analyzeExpression(ast.where);
        if (whereType !== 'BOOLEAN') {
          this.warnings.push(`WHERE clause expression evaluated to type '${whereType}', expected 'BOOLEAN'.`);
        }
      }

      // 3. Analyze JOIN ON conditions
      for (const join of ast.joins) {
        if (join.condition) {
          const condType = this.analyzeExpression(join.condition);
          if (condType !== 'BOOLEAN') {
            this.warnings.push(`JOIN ON condition for '${join.table.name}' evaluated to '${condType}', expected 'BOOLEAN'.`);
          }
        }
      }

      // 4. Analyze GROUP BY
      if (ast.groupBy) {
        for (const gbExpr of ast.groupBy) {
          this.analyzeExpression(gbExpr);
        }
      }

      // 5. Analyze HAVING
      if (ast.having) {
        const havingType = this.analyzeExpression(ast.having);
        if (havingType !== 'BOOLEAN') {
          this.warnings.push(`HAVING clause expression evaluated to '${havingType}', expected 'BOOLEAN'.`);
        }
      }

      // 6. Analyze SELECT column list
      for (const item of ast.columns) {
        this.analyzeSelectItem(item);
      }

      // 7. Analyze ORDER BY
      if (ast.orderBy) {
        for (const ob of ast.orderBy) {
          this.analyzeExpression(ob.expression);
        }
      }

      this.annotatedAST = ast;
    } catch (err) {
      if (err instanceof SemanticError) {
        this.errors.push(err);
      } else {
        this.errors.push(new SemanticError(err.message));
      }
    }

    return this.getResult();
  }

  buildScope(ast) {
    if (!ast.from) {
      // Allowed in some SQL dialects, e.g. SELECT 1 + 1;
      return;
    }

    // Main FROM table
    const fromTableName = ast.from.name.toLowerCase();
    const fromTableSchema = this.catalog.tables[fromTableName];
    if (!fromTableSchema) {
      throw new SemanticError(`Table '${ast.from.name}' does not exist in catalog database`);
    }

    const fromAlias = ast.from.alias || ast.from.name;
    this.symbolTable.addTable(fromAlias, fromTableName, fromTableSchema);

    // JOIN tables
    for (const join of ast.joins) {
      const joinTableName = join.table.name.toLowerCase();
      const joinTableSchema = this.catalog.tables[joinTableName];
      if (!joinTableSchema) {
        throw new SemanticError(`Joined table '${join.table.name}' does not exist in catalog database`);
      }

      const joinAlias = join.table.alias || join.table.name;
      if (this.symbolTable.hasTable(joinAlias)) {
        throw new SemanticError(`Duplicate table alias or name '${joinAlias}' in query scope`);
      }

      this.symbolTable.addTable(joinAlias, joinTableName, joinTableSchema);
    }
  }

  analyzeSelectItem(item) {
    if (item.expression.type === 'ColumnRef' && item.expression.column === '*') {
      // wildcard
      return 'RECORD';
    }
    return this.analyzeExpression(item.expression);
  }

  analyzeExpression(expr) {
    if (!expr) return 'NULL';

    switch (expr.type) {
      case 'Literal': {
        expr.resolvedType = expr.literalType;
        return expr.literalType;
      }

      case 'ColumnRef': {
        if (expr.column === '*') {
          expr.resolvedType = 'RECORD';
          return 'RECORD';
        }

        const resolved = this.symbolTable.resolveColumn(expr.table, expr.column);
        expr.resolvedTable = resolved.originalTable;
        expr.resolvedAlias = resolved.tableAlias;
        expr.resolvedColumn = resolved.columnName;
        expr.resolvedType = resolved.type;
        return resolved.type;
      }

      case 'BinaryOp': {
        const leftType = this.analyzeExpression(expr.left);
        const rightType = this.analyzeExpression(expr.right);
        const op = expr.operator.toUpperCase();

        // Logical Operators
        if (op === 'AND' || op === 'OR') {
          expr.resolvedType = 'BOOLEAN';
          return 'BOOLEAN';
        }

        // Comparison Operators
        if (['=', '!=', '<>', '<', '<=', '>', '>='].includes(op)) {
          this.checkTypeCompatibility(op, leftType, rightType);
          expr.resolvedType = 'BOOLEAN';
          return 'BOOLEAN';
        }

        // Arithmetic Operators
        if (['+', '-', '*', '/', '%'].includes(op)) {
          if (!this.isNumericType(leftType) || !this.isNumericType(rightType)) {
            this.warnings.push(`Arithmetic operator '${op}' applied to non-numeric types (${leftType}, ${rightType})`);
          }
          const resultType = (leftType === 'FLOAT' || rightType === 'FLOAT' || op === '/') ? 'FLOAT' : 'INTEGER';
          expr.resolvedType = resultType;
          return resultType;
        }

        expr.resolvedType = 'UNKNOWN';
        return 'UNKNOWN';
      }

      case 'UnaryOp': {
        const operandType = this.analyzeExpression(expr.operand);
        if (expr.operator === 'NOT') {
          expr.resolvedType = 'BOOLEAN';
          return 'BOOLEAN';
        }
        if (expr.operator === '-' || expr.operator === '+') {
          expr.resolvedType = operandType;
          return operandType;
        }
        return operandType;
      }

      case 'FunctionCall': {
        const fnName = expr.name.toUpperCase();
        for (const arg of expr.args) {
          this.analyzeExpression(arg);
        }

        if (fnName === 'COUNT') {
          expr.resolvedType = 'INTEGER';
          return 'INTEGER';
        }
        if (['SUM', 'AVG', 'MIN', 'MAX'].includes(fnName)) {
          const argType = expr.args[0]?.resolvedType || 'FLOAT';
          expr.resolvedType = (fnName === 'AVG') ? 'FLOAT' : argType;
          return expr.resolvedType;
        }

        expr.resolvedType = 'UNKNOWN';
        return 'UNKNOWN';
      }

      case 'BetweenOp': {
        this.analyzeExpression(expr.expr);
        this.analyzeExpression(expr.low);
        this.analyzeExpression(expr.high);
        expr.resolvedType = 'BOOLEAN';
        return 'BOOLEAN';
      }

      case 'InOp': {
        this.analyzeExpression(expr.expr);
        for (const v of expr.values) {
          this.analyzeExpression(v);
        }
        expr.resolvedType = 'BOOLEAN';
        return 'BOOLEAN';
      }

      case 'LikeOp': {
        this.analyzeExpression(expr.expr);
        this.analyzeExpression(expr.pattern);
        expr.resolvedType = 'BOOLEAN';
        return 'BOOLEAN';
      }

      case 'IsNullOp': {
        this.analyzeExpression(expr.expr);
        expr.resolvedType = 'BOOLEAN';
        return 'BOOLEAN';
      }

      default:
        return 'UNKNOWN';
    }
  }

  isNumericType(t) {
    return t === 'INTEGER' || t === 'FLOAT' || t === 'NUMBER';
  }

  checkTypeCompatibility(op, leftType, rightType) {
    if (leftType === 'NULL' || rightType === 'NULL') return true;
    if (this.isNumericType(leftType) && this.isNumericType(rightType)) return true;
    if (leftType === rightType) return true;

    this.warnings.push(`Comparison '${op}' between differing types (${leftType} and ${rightType})`);
    return false;
  }

  getResult() {
    const tableScope = Array.from(this.symbolTable.tables.entries()).map(([alias, info]) => ({
      alias: info.name,
      originalTable: info.originalName,
      columnCount: Object.keys(info.schema.columns).length,
      columns: Object.entries(info.schema.columns).map(([col, meta]) => ({
        name: col,
        type: meta.type,
        isPrimary: !!meta.isPrimary,
        foreignKey: meta.foreignKey || null
      }))
    }));

    return {
      isValid: this.errors.length === 0,
      errors: this.errors.map(e => e.message),
      warnings: this.warnings,
      tableScope,
      annotatedAST: this.annotatedAST
    };
  }
}
