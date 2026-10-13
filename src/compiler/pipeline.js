/**
 * Full SQL Compiler & Optimizer Pipeline Orchestrator
 * Principles of Compiler Design (PCD) - Full Compilation Workflow
 */

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { SemanticAnalyzer } from './semantic.js';
import { LogicalPlanner } from './logical_planner.js';
import { RuleBasedOptimizer } from './optimizer/rule_based_optimizer.js';
import { CostBasedOptimizer } from './optimizer/cost_based_optimizer.js';
import { QueryExecutor } from './engine/executor.js';
import { DATABASE_CATALOG } from './catalog.js';
import { SQLGenerator } from './sql_generator.js';

export class SQLCompilerPipeline {
  constructor() {
    this.catalog = DATABASE_CATALOG;
    this.semanticAnalyzer = new SemanticAnalyzer(this.catalog);
    this.logicalPlanner = new LogicalPlanner(this.catalog);
    this.rbo = new RuleBasedOptimizer();
    this.cbo = new CostBasedOptimizer(this.catalog);
    this.executor = new QueryExecutor();
  }

  compile(sqlQuery) {
    const startTime = performance.now();

    // ----------------------------------------------------
    // Phase 1: Lexical Analysis (Scanner / Tokenizer)
    // ----------------------------------------------------
    const lexer = new Lexer(sqlQuery);
    const { tokens, errors: lexErrors } = lexer.tokenize();

    if (lexErrors.length > 0) {
      return {
        success: false,
        phase: 'Lexical Analysis',
        errors: lexErrors.map(e => e.message),
        tokens: tokens.map(t => ({
          type: t.type,
          value: t.value,
          line: t.line,
          column: t.column
        }))
      };
    }

    // ----------------------------------------------------
    // Phase 2: Syntax Analysis (Parser -> AST)
    // ----------------------------------------------------
    const parser = new Parser(tokens);
    const { ast, errors: parseErrors } = parser.parse();

    if (parseErrors.length > 0 || !ast) {
      return {
        success: false,
        phase: 'Syntax Analysis (Parser)',
        errors: parseErrors.map(e => e.message),
        tokens: tokens.map(t => ({
          type: t.type,
          value: t.value,
          line: t.line,
          column: t.column
        }))
      };
    }

    // ----------------------------------------------------
    // Phase 3: Semantic Analysis & Symbol Table Binding
    // ----------------------------------------------------
    const semanticResult = this.semanticAnalyzer.analyze(ast);

    if (!semanticResult.isValid) {
      return {
        success: false,
        phase: 'Semantic Analysis',
        errors: semanticResult.errors,
        warnings: semanticResult.warnings,
        tokens: tokens.map(t => ({
          type: t.type,
          value: t.value,
          line: t.line,
          column: t.column
        })),
        ast
      };
    }

    // ----------------------------------------------------
    // Phase 4: Intermediate Code Gen (Canonical Logical Plan / Relational Algebra IR)
    // ----------------------------------------------------
    const unoptimizedLogicalPlan = this.logicalPlanner.generatePlan(ast, semanticResult);

    // ----------------------------------------------------
    // Phase 5: Machine-Independent Optimization (RBO Passes)
    // ----------------------------------------------------
    const rboResult = this.rbo.optimize(unoptimizedLogicalPlan);

    // ----------------------------------------------------
    // Phase 5b: Cost-Based Optimization (CBO Plan Evaluation & Selectivity)
    // ----------------------------------------------------
    const cboComparison = this.cbo.comparePlans(unoptimizedLogicalPlan, rboResult.optimizedPlan);

    // ----------------------------------------------------
    // Phase 6: Code Generation & Execution Engine (Volcano Iterator Execution)
    // ----------------------------------------------------
    let executionResult = null;
    try {
      executionResult = this.executor.executeComparative(unoptimizedLogicalPlan, rboResult.optimizedPlan);
    } catch (execErr) {
      executionResult = {
        error: `Runtime execution error: ${execErr.message}`,
        results: [],
        rowCount: 0,
        columns: [],
        unoptimized: { metrics: {}, operatorTraces: [] },
        optimized: { metrics: {}, operatorTraces: [] },
        comparison: { speedupMultiplier: 1, rowsScannedReductionPercent: 0, timeSavedMs: 0 }
      };
    }

    const totalCompileTimeMs = Number((performance.now() - startTime).toFixed(3));

    return {
      success: true,
      query: sqlQuery,
      totalCompileTimeMs,
      phases: {
        lexer: {
          phaseNumber: 1,
          phaseName: 'Lexical Analysis (Scanner)',
          tokenCount: tokens.length - 1, // exclude EOF
          tokens: tokens.map(t => ({
            type: t.type,
            value: t.value,
            line: t.line,
            column: t.column
          }))
        },
        parser: {
          phaseNumber: 2,
          phaseName: 'Syntax Analysis (Recursive Descent Parser)',
          ast: ast
        },
        semantic: {
          phaseNumber: 3,
          phaseName: 'Semantic Analysis & Symbol Table Resolution',
          tableScope: semanticResult.tableScope,
          warnings: semanticResult.warnings,
          annotatedAST: semanticResult.annotatedAST
        },
        intermediateCode: {
          phaseNumber: 4,
          phaseName: 'Intermediate Code Generation (Relational Algebra IR)',
          canonicalPlan: unoptimizedLogicalPlan.toJSON(),
          canonicalSQL: SQLGenerator.generate(unoptimizedLogicalPlan, { style: 'flat' })
        },
        optimizer: {
          phaseNumber: 5,
          phaseName: 'Query Optimization (RBO & CBO)',
          steps: rboResult.steps,
          unoptimizedPlan: unoptimizedLogicalPlan.toJSON(),
          optimizedPlan: rboResult.optimizedPlan.toJSON(),
          optimizedSQL: {
            cleanSQL: SQLGenerator.generate(rboResult.optimizedPlan, { style: 'flat' }),
            subqueryPushdownSQL: SQLGenerator.generate(rboResult.optimizedPlan, { style: 'subquery' }),
            initialSQL: sqlQuery
          },
          cboComparison
        },
        codeGenAndExecution: {
          phaseNumber: 6,
          phaseName: 'Physical Code Generation & Volcano Iterator Execution',
          execution: executionResult
        }
      }
    };
  }
}
