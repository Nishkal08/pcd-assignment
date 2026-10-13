/**
 * SQL Lexer Token Definitions
 * Principles of Compiler Design - SQL Query Compiler & Optimizer
 */

export const TokenType = {
  // Keywords
  SELECT: 'SELECT',
  FROM: 'FROM',
  WHERE: 'WHERE',
  JOIN: 'JOIN',
  INNER: 'INNER',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  FULL: 'FULL',
  ON: 'ON',
  AS: 'AS',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  GROUP: 'GROUP',
  BY: 'BY',
  HAVING: 'HAVING',
  ORDER: 'ORDER',
  ASC: 'ASC',
  DESC: 'DESC',
  LIMIT: 'LIMIT',
  OFFSET: 'OFFSET',
  IN: 'IN',
  BETWEEN: 'BETWEEN',
  LIKE: 'LIKE',
  IS: 'IS',
  NULL: 'NULL',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  DISTINCT: 'DISTINCT',
  ALL: 'ALL',

  // Aggregate & Scalar Functions
  COUNT: 'COUNT',
  SUM: 'SUM',
  AVG: 'AVG',
  MIN: 'MIN',
  MAX: 'MAX',

  // Identifiers & Literals
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  STRING: 'STRING',

  // Operators
  EQUALS: 'EQUALS',               // =
  NOT_EQUALS: 'NOT_EQUALS',       // != or <>
  LESS_THAN: 'LESS_THAN',         // <
  LESS_EQUALS: 'LESS_EQUALS',     // <=
  GREATER_THAN: 'GREATER_THAN',   // >
  GREATER_EQUALS: 'GREATER_EQUALS',// >=
  PLUS: 'PLUS',                   // +
  MINUS: 'MINUS',                 // -
  ASTERISK: 'ASTERISK',           // *
  SLASH: 'SLASH',                 // /
  MODULO: 'MODULO',               // %

  // Punctuation
  COMMA: 'COMMA',                 // ,
  DOT: 'DOT',                     // .
  LPAREN: 'LPAREN',               // (
  RPAREN: 'RPAREN',               // )
  SEMICOLON: 'SEMICOLON',         // ;

  // End of File
  EOF: 'EOF'
};

export const KEYWORDS = {
  'SELECT': TokenType.SELECT,
  'FROM': TokenType.FROM,
  'WHERE': TokenType.WHERE,
  'JOIN': TokenType.JOIN,
  'INNER': TokenType.INNER,
  'LEFT': TokenType.LEFT,
  'RIGHT': TokenType.RIGHT,
  'FULL': TokenType.FULL,
  'ON': TokenType.ON,
  'AS': TokenType.AS,
  'AND': TokenType.AND,
  'OR': TokenType.OR,
  'NOT': TokenType.NOT,
  'GROUP': TokenType.GROUP,
  'BY': TokenType.BY,
  'HAVING': TokenType.HAVING,
  'ORDER': TokenType.ORDER,
  'ASC': TokenType.ASC,
  'DESC': TokenType.DESC,
  'LIMIT': TokenType.LIMIT,
  'OFFSET': TokenType.OFFSET,
  'IN': TokenType.IN,
  'BETWEEN': TokenType.BETWEEN,
  'LIKE': TokenType.LIKE,
  'IS': TokenType.IS,
  'NULL': TokenType.NULL,
  'TRUE': TokenType.TRUE,
  'FALSE': TokenType.FALSE,
  'DISTINCT': TokenType.DISTINCT,
  'ALL': TokenType.ALL,
  'COUNT': TokenType.COUNT,
  'SUM': TokenType.SUM,
  'AVG': TokenType.AVG,
  'MIN': TokenType.MIN,
  'MAX': TokenType.MAX
};

export class Token {
  constructor(type, value, line, column, start, end) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
    this.start = start;
    this.end = end;
  }

  toString() {
    return `Token(${this.type}, "${this.value}", L${this.line}:C${this.column})`;
  }
}
