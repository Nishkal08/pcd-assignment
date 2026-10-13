/**
 * Automated Compiler & Optimizer Test Suite
 */

import { SQLCompilerPipeline } from '../src/compiler/pipeline.js';

const testQueries = [
  {
    name: '1. Basic Filter and Constant Folding',
    sql: 'SELECT name, salary FROM employees WHERE salary > 50000 AND 1=1'
  },
  {
    name: '2. Multi-Table Join with Predicate Pushdown',
    sql: 'SELECT e.name, d.dept_name FROM employees e JOIN departments d ON e.dept_id = d.id WHERE d.budget > 500000 AND e.salary > 70000'
  },
  {
    name: '3. Three-Table Join + Aggregation + Math Folding',
    sql: 'SELECT d.dept_name, AVG(s.amount) AS avg_sal FROM employees e JOIN departments d ON e.dept_id = d.id JOIN salaries s ON e.id = s.emp_id WHERE e.status = \'active\' AND s.amount > 20000 * 3 GROUP BY d.dept_name'
  },
  {
    name: '4. Column Pruning and Range Filter',
    sql: 'SELECT e.name FROM employees e WHERE e.age BETWEEN 25 AND 35 ORDER BY e.name LIMIT 10'
  }
];

const pipeline = new SQLCompilerPipeline();

console.log('==================================================');
console.log('   SQL COMPILER & OPTIMIZER - TEST SUITE RUNNER   ');
console.log('==================================================\n');

let passedCount = 0;

for (const t of testQueries) {
  console.log(`Testing: ${t.name}`);
  console.log(`Query: ${t.sql}`);

  const res = pipeline.compile(t.sql);

  if (!res.success) {
    console.error(`❌ FAILED at ${res.phase}:`, res.errors);
  } else {
    console.log(`✅ Compilation Succeeded in ${res.totalCompileTimeMs}ms`);
    console.log(`   - Tokens: ${res.phases.lexer.tokenCount}`);
    console.log(`   - Optimization Steps: ${res.phases.optimizer.steps.length}`);
    console.log(`   - CBO Speedup Factor: ${res.phases.optimizer.cboComparison.speedupMultiplier}x`);
    console.log(`   - Rows Returned: ${res.phases.codeGenAndExecution.execution.rowCount}`);
    console.log(`   - Unoptimized Tuples Scanned: ${res.phases.codeGenAndExecution.execution.unoptimized.metrics.totalRowsScanned}`);
    console.log(`   - Optimized Tuples Scanned: ${res.phases.codeGenAndExecution.execution.optimized.metrics.totalRowsScanned}`);
    console.log(`   - Row Scan Reduction: ${res.phases.codeGenAndExecution.execution.comparison.rowsScannedReductionPercent}%\n`);
    passedCount++;
  }
}

console.log(`--------------------------------------------------`);
console.log(`Result: ${passedCount}/${testQueries.length} test queries passed successfully!`);
console.log(`==================================================`);
