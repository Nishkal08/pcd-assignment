/**
 * Recursive Descent Parser
 * Principles of Compiler Design - Phase 2: Syntax Analysis
 */

import { TokenType } from './tokens.js';
import {
  SelectStatementNode,
  SelectItemNode,
  TableRefNode,
  JoinNode,
  BinaryOpNode,
  UnaryOpNode,
  ColumnRefNode,
  LiteralNode,
  FunctionCallNode,
  BetweenOpNode,
  InOpNode,
  LikeOpNode,
  IsNullOpNode,
  OrderByItemNode
} from './ast.js';

export class ParserError extends Error {
  constructor(message, token) {
    const loc = token ? ` at line ${token.line}, col ${token.column} ('${token.value || token.type}')` : '';
    super(`Syntax Error${loc}: ${message}`);
    this.name = 'ParserError';
    this.token = token;
    this.line = token?.line || 1;
    this.column = token?.column || 1;
  }
}

export class Parser {
  constructor(tokens) {
    this.tokens = tokens || [];
    this.current = 0;
    this.errors = [];
  }

  parse() {
    this.current = 0;
    this.errors = [];

    try {
      const ast = this.query();
      if (!this.isAtEnd() && this.peek().type !== TokenType.SEMICOLON) {
        throw this.error(this.peek(), `Unexpected token '${this.peek().value || this.peek().type}' after query completion.`);
      }
      return {
        ast,
        errors: this.errors
      };
    } catch (err) {
      if (err instanceof ParserError) {
        this.errors.push(err);
      } else {
        this.errors.push(new ParserError(err.message, this.peek()));
      }
      return {
        ast: null,
        errors: this.errors
      };
    }
  }

  // --- Helper parsing utilities ---

  isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }

  peek() {
    return this.tokens[this.current] || { type: TokenType.EOF, value: '', line: 0, column: 0 };
  }

  previous() {
    return this.tokens[this.current - 1];
  }

  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  checkKeyword(value) {
    if (this.isAtEnd()) return false;
    return this.peek().value?.toUpperCase() === value.toUpperCase();
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  error(token, message) {
    const err = new ParserError(message, token);
    return err;
  }

  // --- Grammar Rules ---

  // Query -> SELECT ...
  query() {
    this.consume(TokenType.SELECT, "Expected 'SELECT' at the beginning of the SQL query");

    let distinct = false;
    if (this.match(TokenType.DISTINCT)) {
      distinct = true;
    } else if (this.match(TokenType.ALL)) {
      distinct = false;
    }

    const columns = this.selectList();

    let from = null;
    let joins = [];
    if (this.match(TokenType.FROM)) {
      from = this.tableRef();

      // Parse optional zero or more JOIN clauses
      while (this.check(TokenType.JOIN) || this.check(TokenType.INNER) || this.check(TokenType.LEFT) || this.check(TokenType.RIGHT) || this.check(TokenType.FULL)) {
        joins.push(this.joinClause());
      }
    }

    let where = null;
    if (this.match(TokenType.WHERE)) {
      where = this.expression();
    }

    let groupBy = null;
    if (this.match(TokenType.GROUP)) {
      this.consume(TokenType.BY, "Expected 'BY' after 'GROUP'");
      groupBy = this.expressionList();
    }

    let having = null;
    if (this.match(TokenType.HAVING)) {
      having = this.expression();
    }

    let orderBy = null;
    if (this.match(TokenType.ORDER)) {
      this.consume(TokenType.BY, "Expected 'BY' after 'ORDER'");
      orderBy = this.orderByList();
    }

    let limit = null;
    let offset = null;
    if (this.match(TokenType.LIMIT)) {
      limit = this.consume(TokenType.NUMBER, "Expected number after 'LIMIT'").value;
      if (this.match(TokenType.OFFSET)) {
        offset = this.consume(TokenType.NUMBER, "Expected number after 'OFFSET'").value;
      }
    } else if (this.match(TokenType.OFFSET)) {
      offset = this.consume(TokenType.NUMBER, "Expected number after 'OFFSET'").value;
    }

    // Optional trailing semicolon
    if (this.match(TokenType.SEMICOLON)) {
      // consumed
    }

    return new SelectStatementNode({
      distinct,
      columns,
      from,
      joins,
      where,
      groupBy,
      having,
      orderBy,
      limit,
      offset
    });
  }

  selectList() {
    const items = [];
    do {
      items.push(this.selectItem());
    } while (this.match(TokenType.COMMA));
    return items;
  }

  selectItem() {
    if (this.match(TokenType.ASTERISK)) {
      return new SelectItemNode(new ColumnRefNode(null, '*'));
    }

    // Check for table.* pattern
    if (this.peek().type === TokenType.IDENTIFIER && this.tokens[this.current + 1]?.type === TokenType.DOT && this.tokens[this.current + 2]?.type === TokenType.ASTERISK) {
      const tableName = this.advance().value;
      this.advance(); // consume DOT
      this.advance(); // consume ASTERISK
      return new SelectItemNode(new ColumnRefNode(tableName, '*'));
    }

    const expr = this.expression();
    let alias = null;

    if (this.match(TokenType.AS)) {
      const aliasToken = this.consume(TokenType.IDENTIFIER, "Expected alias identifier after 'AS'");
      alias = aliasToken.value;
    } else if (this.check(TokenType.IDENTIFIER) && !this.isReservedClauseStart()) {
      alias = this.advance().value;
    }

    return new SelectItemNode(expr, alias);
  }

  isReservedClauseStart() {
    const t = this.peek().type;
    return t === TokenType.FROM || t === TokenType.WHERE || t === TokenType.JOIN ||
           t === TokenType.GROUP || t === TokenType.ORDER || t === TokenType.HAVING ||
           t === TokenType.LIMIT || t === TokenType.INNER || t === TokenType.LEFT ||
           t === TokenType.RIGHT || t === TokenType.FULL || t === TokenType.EOF || t === TokenType.SEMICOLON;
  }

  tableRef() {
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected table name in FROM clause");
    let alias = null;

    if (this.match(TokenType.AS)) {
      const aliasToken = this.consume(TokenType.IDENTIFIER, "Expected alias identifier after 'AS'");
      alias = aliasToken.value;
    } else if (this.check(TokenType.IDENTIFIER) && !this.isReservedClauseStart()) {
      alias = this.advance().value;
    }

    return new TableRefNode(nameToken.value, alias);
  }

  joinClause() {
    let joinType = 'INNER';

    if (this.match(TokenType.INNER)) {
      this.consume(TokenType.JOIN, "Expected 'JOIN' after 'INNER'");
      joinType = 'INNER';
    } else if (this.match(TokenType.LEFT)) {
      if (this.match(TokenType.OUTER)) { /* optional OUTER */ }
      this.consume(TokenType.JOIN, "Expected 'JOIN' after 'LEFT'");
      joinType = 'LEFT';
    } else if (this.match(TokenType.RIGHT)) {
      if (this.match(TokenType.OUTER)) { /* optional OUTER */ }
      this.consume(TokenType.JOIN, "Expected 'JOIN' after 'RIGHT'");
      joinType = 'RIGHT';
    } else if (this.match(TokenType.FULL)) {
      if (this.match(TokenType.OUTER)) { /* optional OUTER */ }
      this.consume(TokenType.JOIN, "Expected 'JOIN' after 'FULL'");
      joinType = 'FULL';
    } else if (this.match(TokenType.JOIN)) {
      joinType = 'INNER';
    }

    const table = this.tableRef();
    this.consume(TokenType.ON, `Expected 'ON' condition for ${joinType} JOIN`);
    const condition = this.expression();

    return new JoinNode(joinType, table, condition);
  }

  expressionList() {
    const list = [];
    do {
      list.push(this.expression());
    } while (this.match(TokenType.COMMA));
    return list;
  }

  orderByList() {
    const list = [];
    do {
      const expr = this.expression();
      let direction = 'ASC';
      if (this.match(TokenType.DESC)) {
        direction = 'DESC';
      } else if (this.match(TokenType.ASC)) {
        direction = 'ASC';
      }
      list.push(new OrderByItemNode(expr, direction));
    } while (this.match(TokenType.COMMA));
    return list;
  }

  // --- Expression Hierarchy (Precedence Climbing) ---

  expression() {
    return this.orExpression();
  }

  orExpression() {
    let expr = this.andExpression();

    while (this.match(TokenType.OR)) {
      const operator = 'OR';
      const right = this.andExpression();
      expr = new BinaryOpNode(operator, expr, right);
    }

    return expr;
  }

  andExpression() {
    let expr = this.notExpression();

    while (this.match(TokenType.AND)) {
      const operator = 'AND';
      const right = this.notExpression();
      expr = new BinaryOpNode(operator, expr, right);
    }

    return expr;
  }

  notExpression() {
    if (this.match(TokenType.NOT)) {
      const operand = this.notExpression();
      return new UnaryOpNode('NOT', operand);
    }
    return this.comparisonExpression();
  }

  comparisonExpression() {
    let expr = this.arithmeticAddition();

    while (true) {
      if (this.match(TokenType.EQUALS, TokenType.NOT_EQUALS, TokenType.LESS_THAN, TokenType.LESS_EQUALS, TokenType.GREATER_THAN, TokenType.GREATER_EQUALS)) {
        const op = this.previous().value;
        const right = this.arithmeticAddition();
        expr = new BinaryOpNode(op, expr, right);
      } else if (this.match(TokenType.LIKE)) {
        const pattern = this.arithmeticAddition();
        expr = new LikeOpNode(expr, pattern, false);
      } else if (this.match(TokenType.BETWEEN)) {
        const low = this.arithmeticAddition();
        this.consume(TokenType.AND, "Expected 'AND' in BETWEEN expression");
        const high = this.arithmeticAddition();
        expr = new BetweenOpNode(expr, low, high, false);
      } else if (this.match(TokenType.IN)) {
        this.consume(TokenType.LPAREN, "Expected '(' after 'IN'");
        const values = [];
        do {
          values.push(this.expression());
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.RPAREN, "Expected ')' after IN list");
        expr = new InOpNode(expr, values, false);
      } else if (this.match(TokenType.IS)) {
        let isNot = false;
        if (this.match(TokenType.NOT)) {
          isNot = true;
        }
        this.consume(TokenType.NULL, "Expected 'NULL' after 'IS' or 'IS NOT'");
        expr = new IsNullOpNode(expr, isNot);
      } else if (this.match(TokenType.NOT)) {
        if (this.match(TokenType.LIKE)) {
          const pattern = this.arithmeticAddition();
          expr = new LikeOpNode(expr, pattern, true);
        } else if (this.match(TokenType.BETWEEN)) {
          const low = this.arithmeticAddition();
          this.consume(TokenType.AND, "Expected 'AND' in NOT BETWEEN expression");
          const high = this.arithmeticAddition();
          expr = new BetweenOpNode(expr, low, high, true);
        } else if (this.match(TokenType.IN)) {
          this.consume(TokenType.LPAREN, "Expected '(' after 'NOT IN'");
          const values = [];
          do {
            values.push(this.expression());
          } while (this.match(TokenType.COMMA));
          this.consume(TokenType.RPAREN, "Expected ')' after IN list");
          expr = new InOpNode(expr, values, true);
        } else {
          throw this.error(this.previous(), "Unexpected 'NOT' keyword");
        }
      } else {
        break;
      }
    }

    return expr;
  }

  arithmeticAddition() {
    let expr = this.arithmeticMultiplication();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.previous().value;
      const right = this.arithmeticMultiplication();
      expr = new BinaryOpNode(op, expr, right);
    }

    return expr;
  }

  arithmeticMultiplication() {
    let expr = this.unaryExpression();

    while (this.match(TokenType.ASTERISK, TokenType.SLASH, TokenType.MODULO)) {
      const op = this.previous().value;
      const right = this.unaryExpression();
      expr = new BinaryOpNode(op, expr, right);
    }

    return expr;
  }

  unaryExpression() {
    if (this.match(TokenType.MINUS, TokenType.PLUS)) {
      const op = this.previous().value;
      const right = this.unaryExpression();
      return new UnaryOpNode(op, right);
    }
    return this.primaryExpression();
  }

  primaryExpression() {
    // Literals
    if (this.match(TokenType.NUMBER)) {
      return new LiteralNode(this.previous().value, 'NUMBER');
    }
    if (this.match(TokenType.STRING)) {
      return new LiteralNode(this.previous().value, 'STRING');
    }
    if (this.match(TokenType.TRUE)) {
      return new LiteralNode(true, 'BOOLEAN');
    }
    if (this.match(TokenType.FALSE)) {
      return new LiteralNode(false, 'BOOLEAN');
    }
    if (this.match(TokenType.NULL)) {
      return new LiteralNode(null, 'NULL');
    }

    // Aggregate functions: COUNT, SUM, AVG, MIN, MAX
    if (this.match(TokenType.COUNT, TokenType.SUM, TokenType.AVG, TokenType.MIN, TokenType.MAX)) {
      const fnName = this.previous().value.toUpperCase();
      this.consume(TokenType.LPAREN, `Expected '(' after function '${fnName}'`);
      
      let isDistinct = false;
      if (this.match(TokenType.DISTINCT)) {
        isDistinct = true;
      }

      const args = [];
      if (this.match(TokenType.ASTERISK)) {
        args.push(new ColumnRefNode(null, '*'));
      } else if (!this.check(TokenType.RPAREN)) {
        args.push(this.expression());
      }

      this.consume(TokenType.RPAREN, `Expected ')' to close function '${fnName}'`);
      return new FunctionCallNode(fnName, args, isDistinct);
    }

    // Parenthesized expression: ( expr )
    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')' after parenthesized expression");
      return expr;
    }

    // Identifiers & Column references: table.col or col
    if (this.match(TokenType.IDENTIFIER)) {
      const firstId = this.previous().value;

      // Check if it's a function call like `ROUND(...)` or `LENGTH(...)`
      if (this.match(TokenType.LPAREN)) {
        const args = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, `Expected ')' after function '${firstId}'`);
        return new FunctionCallNode(firstId, args);
      }

      // Check for table.column
      if (this.match(TokenType.DOT)) {
        if (this.match(TokenType.ASTERISK)) {
          return new ColumnRefNode(firstId, '*');
        }
        const colToken = this.consume(TokenType.IDENTIFIER, `Expected column name after '${firstId}.'`);
        return new ColumnRefNode(firstId, colToken.value);
      }

      return new ColumnRefNode(null, firstId);
    }

    throw this.error(this.peek(), `Unexpected expression token '${this.peek().value || this.peek().type}'`);
  }
}
