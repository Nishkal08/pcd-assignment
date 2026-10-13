/**
 * Express Web Server & API for SQL Query Compiler & Optimizer
 * Principles of Compiler Design (PCD)
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { SQLCompilerPipeline } from './compiler/pipeline.js';
import { DATABASE_CATALOG } from './compiler/catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const pipeline = new SQLCompilerPipeline();

// Preset queries designed specifically to demonstrate PCD concepts
const PRESET_QUERIES = [
  {
    id: 'preset_1',
    title: '1. Multi-Table Join + Predicate Pushdown (σ Pushdown)',
    category: 'Relational Algebra Optimization',
    pcdConcept: 'Machine-Independent Optimization: σ_c(R ⨝ S) -> σ_c1(R) ⨝ σ_c2(S)',
    description: 'Demonstrates pushing selection predicates down below joins directly to base scans, drastically shrinking intermediate join cardinalities.',
    sql: `SELECT e.name, d.dept_name, e.salary
FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE d.budget > 500000 
  AND e.salary > 70000`
  },
  {
    id: 'preset_2',
    title: '2. Constant Folding & Tautology Elimination',
    category: 'Algebraic Simplification',
    pcdConcept: 'Constant Folding & Dead Code Elimination (1=1 -> TRUE, 5 * 10000 -> 50000)',
    description: 'Demonstrates compile-time evaluation of constant arithmetic and simplification of boolean tautologies in WHERE filters.',
    sql: `SELECT name, salary, age
FROM employees
WHERE salary > (10000 * 5) + 15000
  AND 1 = 1
  AND status = 'active'`
  },
  {
    id: 'preset_3',
    title: '3. Three-Table Join + Hash Aggregation (γ)',
    category: 'Complex Query & Aggregation',
    pcdConcept: 'AST -> Multi-way Join Logical Plan -> Hash Join & Hash Aggregate Code Gen',
    description: 'Demonstrates 3-way join with predicate pushdown, constant folding, and hash-based group-by aggregation yielding over 99% I/O reduction.',
    sql: `SELECT d.dept_name, AVG(s.amount) AS avg_salary, COUNT(*) AS emp_count
FROM employees e
JOIN departments d ON e.dept_id = d.id
JOIN salaries s ON e.id = s.emp_id
WHERE e.status = 'active'
  AND s.amount > 30000 * 2
GROUP BY d.dept_name`
  },
  {
    id: 'preset_4',
    title: '4. Column Pruning & Projection Pushdown (π Pushdown)',
    category: 'Storage & Memory Optimization',
    pcdConcept: 'Liveness Analysis & Projection Pushdown: π_L(R ⨝ S) -> π_L(π_L1(R) ⨝ π_L2(S))',
    description: 'Demonstrates pruning unused columns at the storage scan layer so only required fields are loaded into memory buffers.',
    sql: `SELECT e.name, e.salary
FROM employees e
WHERE e.age BETWEEN 25 AND 35
ORDER BY e.salary DESC
LIMIT 15`
  },
  {
    id: 'preset_5',
    title: '5. Cost-Based Optimization (Hash Join vs Nested Loop)',
    category: 'Cost-Based Optimization (CBO)',
    pcdConcept: 'Cost Model: I/O + CPU Cost formula evaluation & algorithm selection',
    description: 'Demonstrates catalog statistics lookup, selectivity calculation, and automatic selection of Hash Join over O(N*M) Nested Loop Join.',
    sql: `SELECT c.name, c.city, o.total, o.status
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE c.rating >= 4
  AND o.total > 1500`
  }
];

// PCD Theory and Viva Guide content
const PCD_THEORY_GUIDE = {
  dragonBookPhases: [
    {
      phase: '1. Lexical Analysis (Scanner)',
      pcdConcept: 'Regular Expressions & Deterministic Finite Automata (DFA)',
      sqlMapping: 'Transforms raw SQL string into stream of categorized Tokens (Keywords: SELECT, FROM, JOIN; Identifiers; Literals; Operators). Removes comments and whitespace.',
      dragonBookRef: 'Dragon Book Chapter 3: Lexical Analysis'
    },
    {
      phase: '2. Syntax Analysis (Parser)',
      pcdConcept: 'Context-Free Grammar (CFG) & Recursive Descent Parsing',
      sqlMapping: 'Parses tokens according to SQL grammar rules, builds hierarchical Abstract Syntax Tree (AST), handles operator precedence climbing.',
      dragonBookRef: 'Dragon Book Chapter 4: Syntax Analysis'
    },
    {
      phase: '3. Semantic Analysis',
      pcdConcept: 'Symbol Table, Type Checking & Scope Resolution',
      sqlMapping: 'Verifies table and column existence against Database Catalog, resolves unqualified identifiers (e.g. `salary` -> `employees.salary`), ensures type compatibility in expressions.',
      dragonBookRef: 'Dragon Book Chapter 6: Type Systems & Semantic Analysis'
    },
    {
      phase: '4. Intermediate Code Generation',
      pcdConcept: 'Intermediate Representation (IR) / Relational Algebra Tree',
      sqlMapping: 'Translates AST into canonical Relational Algebra operators: Project (π), Filter/Select (σ), Theta Join (⨝), Aggregate (γ), Sort (τ), Table Scan (R).',
      dragonBookRef: 'Dragon Book Chapter 6: Intermediate Code Generation'
    },
    {
      phase: '5. Machine-Independent Optimization (RBO & CBO)',
      pcdConcept: 'Tree Rewriting, Algebraic Simplification, Cost Estimation DAG',
      sqlMapping: 'RBO passes: Constant Folding, Predicate Pushdown (pushes σ below ⨝), Projection Pushdown (Column Pruning). CBO: Calculates Selectivity S = 1/V(A), estimates I/O + CPU cost for Hash Join vs Nested Loop.',
      dragonBookRef: 'Dragon Book Chapter 8 & 9: Code Optimization'
    },
    {
      phase: '6. Code Generation & Execution Engine',
      pcdConcept: 'Target Execution / Volcano Iterator Model (Interpreter)',
      sqlMapping: 'Emits Volcano physical iterators (SeqScan, HashJoin, Filter, Project) with open(), next(), close() streaming protocol, executes query on in-memory relations, profiles row scan metrics.',
      dragonBookRef: 'Dragon Book Chapter 8: Code Generation'
    }
  ],
  relationalAlgebraEquivalences: [
    {
      rule: 'Commutativity of Joins',
      formula: 'R ⨝ S ≡ S ⨝ R',
      explanation: 'Allows the optimizer to pick the smaller relation as the build table in Hash Joins.'
    },
    {
      rule: 'Associativity of Joins',
      formula: '(R ⨝ S) ⨝ T ≡ R ⨝ (S ⨝ T)',
      explanation: 'Enables join tree reordering to minimize intermediate tuple generation.'
    },
    {
      rule: 'Predicate Pushdown (Selection over Join)',
      formula: 'σ_c(R ⨝ S) ≡ σ_c1(R) ⨝ σ_c2(S)  (where c = c1 ∧ c2)',
      explanation: 'Pushes filtering predicates directly to base scans, drastically reducing join input cardinality.'
    },
    {
      rule: 'Projection Pushdown (Column Pruning)',
      formula: 'π_L(R ⨝ S) ≡ π_L(π_L1(R) ⨝ π_L2(S))',
      explanation: 'Reads only attributes required by upstream operators, saving I/O bandwidth and cache memory.'
    },
    {
      rule: 'Cascade of Selection',
      formula: 'σ_{c1 ∧ c2}(R) ≡ σ_c1(σ_c2(R))',
      explanation: 'Allows composite WHERE filters to be split into individual conjuncts for selective pushdown.'
    }
  ],
  vivaQuestions: [
    {
      q: 'What is the role of the Lexer in this SQL Compiler?',
      a: 'The Lexer (Scanner) takes raw SQL character input and breaks it down into structured Tokens (Token Type, Value, Line, Column) while ignoring whitespace and comments. It identifies SQL keywords (SELECT, FROM, JOIN), identifiers (table and column names), operators (=, >, AND), and literals (numbers, strings).'
    },
    {
      q: 'How does the Parser construct the Abstract Syntax Tree (AST)?',
      a: 'The Parser uses a top-down Recursive Descent parsing technique with Precedence Climbing to enforce operator precedence (e.g. arithmetic * and / before + and -, AND before OR, comparisons). It produces an AST node hierarchy representing clauses: SelectStatement, TableRef, Join, BinaryOp, and FunctionCall.'
    },
    {
      q: 'What does the Semantic Analyzer check?',
      a: 'The Semantic Analyzer creates a Symbol Table from the FROM and JOIN clauses, validates that referenced tables and columns exist in the catalog schema, resolves unqualified column references, and performs type checking (e.g., verifying arithmetic expressions use numeric columns and boolean filters return booleans).'
    },
    {
      q: 'What is the Intermediate Representation (IR) used here?',
      a: 'The IR is a canonical Relational Algebra Operator Tree composed of mathematical operators: Project (π), Filter/Selection (σ), Join (⨝), Aggregate (γ), Sort (τ), Limit (L), and Scan (R). This machine-independent IR allows algebraic optimizations to be applied directly.'
    },
    {
      q: 'Explain Predicate Pushdown and why it is the most critical SQL optimization.',
      a: 'Predicate Pushdown transforms σ_c(R ⨝ S) into σ_c1(R) ⨝ σ_c2(S). In an unoptimized query, all rows of R and S are read and joined (Cartesian product / join cost O(|R| × |S|)), and the filter is applied last. By pushing σ down to the Scan operator, filtering happens before the join, reducing join inputs by 80% to 99%.'
    },
    {
      q: 'How does the Cost-Based Optimizer (CBO) estimate plan cost?',
      a: 'The CBO uses catalog statistics (Table cardinality Card(R), Page count B(R), Distinct column values V(A, R)). It calculates selectivity (e.g., equality selectivity = 1/V(A)) and estimates total cost = (I/O Cost × Page_Weight) + (CPU Cost × Tuple_Weight) to choose between Sequential Scan vs Index Scan and Nested Loop Join vs Hash Join.'
    },
    {
      q: 'How does the Volcano Iterator Model work in the Code Generation / Execution phase?',
      a: 'The Volcano model defines an iterator interface with open(), next(), and close(). Operators are chained hierarchically. The consumer calls next() on the root (e.g. Project), which pulls tuples on-demand from its children (Join -> Filter -> Scan) in a pipelined, memory-efficient streaming manner.'
    }
  ]
};

// API Routes
app.post('/api/compile', (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ success: false, error: 'SQL query string is required.' });
  }

  try {
    const result = pipeline.compile(sql);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      phase: 'Internal Compiler Error',
      errors: [err.message]
    });
  }
});

app.get('/api/presets', (req, res) => {
  res.json({ presets: PRESET_QUERIES });
});

app.get('/api/catalog', (req, res) => {
  res.json({ catalog: DATABASE_CATALOG });
});

app.get('/api/theory', (req, res) => {
  res.json(PCD_THEORY_GUIDE);
});

// Start Server
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 SQL Query Compiler & Optimizer Server is running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📚 Principles of Compiler Design (PCD) Innovative Assignment`);
  console.log(`================================================================`);
});
