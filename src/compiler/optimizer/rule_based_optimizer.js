/**
 * Rule-Based Optimizer (RBO) Orchestrator
 * Principles of Compiler Design - Phase 5: Machine-Independent Optimization
 */

import { ConstantFoldingRule } from './rules/constant_folding.js';
import { PredicatePushdownRule } from './rules/predicate_pushdown.js';
import { DeadPredicateRemovalRule } from './rules/dead_predicate_removal.js';
import { ProjectionPushdownRule } from './rules/projection_pushdown.js';
import { SQLGenerator } from '../sql_generator.js';

export class RuleBasedOptimizer {
  constructor() {
    this.rules = [
      new ConstantFoldingRule(),
      new DeadPredicateRemovalRule(),
      new PredicatePushdownRule(),
      new ProjectionPushdownRule()
    ];
  }

  optimize(initialPlan) {
    if (!initialPlan) return { optimizedPlan: null, steps: [] };

    let currentPlan = initialPlan.clone();
    const steps = [];

    // Helper to get rule SQL explanation
    const getSqlExplanation = (ruleName, changed) => {
      if (!changed) return 'SQL query is already optimal for this rule; no rewrites needed.';
      if (ruleName.includes('Constant Folding')) {
        return 'SQL Rewrite: Evaluated constant expressions (e.g., 40000 + 30000 → 70000, 1 = 1 → TRUE) at compile time.';
      }
      if (ruleName.includes('Dead Predicate')) {
        return 'SQL Rewrite: Removed redundant tautologies like "AND TRUE" / "1 = 1" from the WHERE clause.';
      }
      if (ruleName.includes('Predicate Pushdown')) {
        return 'SQL Rewrite: Pushed WHERE filters into individual table pre-filters / JOIN ON clauses before join execution.';
      }
      if (ruleName.includes('Projection Pushdown')) {
        return 'SQL Rewrite: Pruned unused columns so each table source only selects columns strictly needed downstream.';
      }
      return 'SQL query transformed by optimization rule.';
    };

    // Record Initial State
    steps.push({
      stepNumber: 0,
      ruleName: 'Canonical Initial Plan',
      description: 'Canonical Relational Algebra tree generated directly from the AST before optimization.',
      modified: false,
      diffSummary: 'Initial baseline plan',
      sqlEquivalent: SQLGenerator.generate(currentPlan, { style: 'subquery' }),
      standardSQL: SQLGenerator.generate(currentPlan, { style: 'flat' }),
      sqlExplanation: 'Unoptimized initial SQL query representation.',
      planSnapshot: currentPlan.toJSON()
    });

    let stepCounter = 1;

    for (const rule of this.rules) {
      const beforeSnapshot = currentPlan.toJSON();
      const result = rule.apply(currentPlan);
      currentPlan = result.plan;

      const afterSnapshot = currentPlan.toJSON();
      const planChanged = JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot);

      steps.push({
        stepNumber: stepCounter++,
        ruleName: rule.name,
        description: rule.description,
        modified: planChanged,
        diffSummary: planChanged
          ? `Rule applied: ${rule.name}`
          : `No changes required (already in normal form)`,
        sqlEquivalent: SQLGenerator.generate(currentPlan, { style: 'subquery' }),
        standardSQL: SQLGenerator.generate(currentPlan, { style: 'flat' }),
        sqlExplanation: getSqlExplanation(rule.name, planChanged),
        planSnapshot: afterSnapshot
      });
    }

    return {
      initialPlan,
      optimizedPlan: currentPlan,
      steps
    };
  }
}

