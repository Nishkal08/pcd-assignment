/**
 * Lexical Analyzer (Scanner / Tokenizer)
 * Principles of Compiler Design - Phase 1: Lexical Analysis
 */

import { TokenType, KEYWORDS, Token } from './tokens.js';

export class LexerError extends Error {
  constructor(message, line, column, index) {
    super(`Lexical Error at line ${line}, col ${column}: ${message}`);
    this.name = 'LexerError';
    this.line = line;
    this.column = column;
    this.index = index;
  }
}

export class Lexer {
  constructor(source) {
    this.source = source || '';
    this.tokens = [];
    this.errors = [];
    this.start = 0;
    this.current = 0;
    this.line = 1;
    this.column = 1;
    this.tokenStartColumn = 1;
  }

  tokenize() {
    this.tokens = [];
    this.errors = [];
    this.start = 0;
    this.current = 0;
    this.line = 1;
    this.column = 1;

    while (!this.isAtEnd()) {
      this.start = this.current;
      this.tokenStartColumn = this.column;
      this.scanToken();
    }

    this.tokens.push(new Token(TokenType.EOF, '', this.line, this.column, this.current, this.current));
    return {
      tokens: this.tokens,
      errors: this.errors
    };
  }

  isAtEnd() {
    return this.current >= this.source.length;
  }

  peek() {
    if (this.isAtEnd()) return '\0';
    return this.source[this.current];
  }

  peekNext() {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source[this.current + 1];
  }

  advance() {
    const char = this.source[this.current];
    this.current++;
    this.column++;
    return char;
  }

  match(expected) {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  scanToken() {
    const c = this.advance();

    switch (c) {
      // Whitespace
      case ' ':
      case '\r':
      case '\t':
        // ignore whitespace
        break;

      case '\n':
        this.line++;
        this.column = 1;
        break;

      // Single character tokens
      case '(':
        this.addToken(TokenType.LPAREN, '(');
        break;
      case ')':
        this.addToken(TokenType.RPAREN, ')');
        break;
      case ',':
        this.addToken(TokenType.COMMA, ',');
        break;
      case '.':
        this.addToken(TokenType.DOT, '.');
        break;
      case ';':
        this.addToken(TokenType.SEMICOLON, ';');
        break;
      case '+':
        this.addToken(TokenType.PLUS, '+');
        break;
      case '-':
        if (this.match('-')) {
          // Line comment: -- comment text
          while (this.peek() !== '\n' && !this.isAtEnd()) {
            this.advance();
          }
        } else {
          this.addToken(TokenType.MINUS, '-');
        }
        break;
      case '*':
        this.addToken(TokenType.ASTERISK, '*');
        break;
      case '/':
        if (this.match('*')) {
          // Block comment /* ... */
          this.blockComment();
        } else {
          this.addToken(TokenType.SLASH, '/');
        }
        break;
      case '%':
        this.addToken(TokenType.MODULO, '%');
        break;

      // Comparison operators
      case '=':
        this.addToken(TokenType.EQUALS, '=');
        break;
      case '!':
        if (this.match('=')) {
          this.addToken(TokenType.NOT_EQUALS, '!=');
        } else {
          this.error(`Unexpected character '!' (did you mean '!=')`);
        }
        break;
      case '<':
        if (this.match('=')) {
          this.addToken(TokenType.LESS_EQUALS, '<=');
        } else if (this.match('>')) {
          this.addToken(TokenType.NOT_EQUALS, '<>');
        } else {
          this.addToken(TokenType.LESS_THAN, '<');
        }
        break;
      case '>':
        if (this.match('=')) {
          this.addToken(TokenType.GREATER_EQUALS, '>=');
        } else {
          this.addToken(TokenType.GREATER_THAN, '>');
        }
        break;

      // String literals
      case "'":
      case '"':
        this.stringLiteral(c);
        break;

      default:
        if (this.isDigit(c)) {
          this.numberLiteral();
        } else if (this.isAlpha(c)) {
          this.identifierOrKeyword();
        } else {
          this.error(`Unrecognized character: '${c}'`);
        }
        break;
    }
  }

  blockComment() {
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance(); // consume *
        this.advance(); // consume /
        return;
      }
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }
    this.error('Unterminated block comment');
  }

  stringLiteral(quoteChar) {
    let value = '';
    while (this.peek() !== quoteChar && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      if (this.peek() === '\\' && this.peekNext() === quoteChar) {
        this.advance(); // consume escape backslash
      }
      value += this.advance();
    }

    if (this.isAtEnd()) {
      this.error('Unterminated string literal');
      return;
    }

    this.advance(); // closing quote
    this.addToken(TokenType.STRING, value);
  }

  numberLiteral() {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Look for decimal fraction
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume '.'
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const valueStr = this.source.substring(this.start, this.current);
    const numValue = Number(valueStr);
    this.addToken(TokenType.NUMBER, numValue);
  }

  identifierOrKeyword() {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.substring(this.start, this.current);
    const upperText = text.toUpperCase();

    if (Object.prototype.hasOwnProperty.call(KEYWORDS, upperText)) {
      this.addToken(KEYWORDS[upperText], upperText);
    } else {
      this.addToken(TokenType.IDENTIFIER, text);
    }
  }

  isDigit(c) {
    return c >= '0' && c <= '9';
  }

  isAlpha(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  isAlphaNumeric(c) {
    return this.isAlpha(c) || this.isDigit(c);
  }

  addToken(type, value) {
    this.tokens.push(new Token(
      type,
      value,
      this.line,
      this.tokenStartColumn,
      this.start,
      this.current
    ));
  }

  error(message) {
    const err = new LexerError(message, this.line, this.tokenStartColumn, this.start);
    this.errors.push(err);
  }
}
