# SQL Query Compiler & Optimizer
### Principles of Compiler Design (PCD) — Innovative Course Project

An end-to-end, visual, and interactive **SQL Query Compiler & Cost-Based Optimizer** built from scratch following classical Compiler Design principles (Dragon Book architecture).

---

## 🌟 Key Features

1. **Full 6-Phase Compiler Pipeline**:
   - **Phase 1: Lexical Analysis (Scanner)**: Tokenizes SQL queries into categorized tokens (Keywords, Identifiers, Literals, Operators, Punctuation) with line and column tracking.
   - **Phase 2: Syntax Analysis (Recursive Descent Parser)**: Builds a hierarchical Abstract Syntax Tree (AST) supporting `SELECT`, `FROM`, `JOIN` (INNER, LEFT, RIGHT), `WHERE` (AND, OR, NOT, comparisons, arithmetic), `GROUP BY`, `HAVING`, `ORDER BY`, and `LIMIT`.
   - **Phase 3: Semantic Analysis & Symbol Table**: Validates schemas against the Database Catalog, resolves scope and unqualified column references, and performs type-checking.
   - **Phase 4: Intermediate Code Generation (Relational Algebra IR)**: Translates AST into a canonical Relational Algebra Operator DAG ($\pi, \sigma, \bowtie, \gamma, \tau, L, R$).
   - **Phase 5: Machine-Independent & Cost-Based Optimization (RBO & CBO)**:
     - **Constant Folding & Algebraic Simplification**: Evaluates arithmetic constants and simplifies boolean tautologies (`1=1` $\rightarrow$ `TRUE`, `x AND TRUE` $\rightarrow$ `x`).
     - **Predicate Pushdown ($\sigma$ Pushdown)**: Pushes filter predicates down below joins directly to base storage scans ($\sigma_c(R \bowtie S) \equiv \sigma_{c1}(R) \bowtie \sigma_{c2}(S)$).
     - **Projection Pushdown ($\pi$ Pushdown / Column Pruning)**: Prunes unused columns from scans to minimize memory and I/O footprint.
     - **Cost-Based Optimizer (CBO)**: Selectivity estimation ($S = 1/V(A)$, range formulas) and cost models ($Cost = I/O + CPU$) deciding between **Hash Join** and **Nested Loop Join**.
   - **Phase 6: Code Generation & Volcano Iterator Execution**:
     - Generates streaming Volcano iterators (`open()`, `next()`, `close()`).
     - Executes compiled queries on an in-memory relational database.
     - Profiles real execution metrics: **tuples scanned (unoptimized vs optimized)**, latency, and rows returned.

2. **Interactive Visual Dashboard**:
   - Live SQL code editor with curated preset scenarios.
   - Interactive SVG hierarchical tree visualizations for AST and Relational Algebra.
   - Side-by-side **Before vs After Tree Diff Viewer** for each optimization pass.
   - Real-time Performance Benchmark Dashboard showing up to **99.5% reduction in tuples scanned**.
   - Built-in **PCD Theory & Viva Guide** with Dragon Book mappings and common viva questions.

---

## 🚀 How to Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)

### Quick Start
```bash
# 1. Clone or navigate to project directory
cd "c:\Nirma\7the sem\PCD\innovative"

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```

Open your browser and navigate to:
```
http://localhost:3000
```

To run the automated compiler verification test suite in terminal:
```bash
npm test
```

---

## 📚 Dragon Book / PCD Phase Mapping

| Compiler Phase | PCD Concept (Dragon Book) | SQL Query Compiler Implementation |
|---|---|---|
| **1. Lexer** | Regular Expressions & DFA | `src/compiler/lexer.js`: Token stream with keywords, identifiers, literals, operators. |
| **2. Parser** | Context-Free Grammar (CFG) | `src/compiler/parser.js`: Recursive Descent parser with precedence climbing generating AST. |
| **3. Semantic** | Symbol Table & Type Checking | `src/compiler/semantic.js`: Catalog lookup, scope resolution, type compatibility. |
| **4. IR Gen** | Intermediate Representation | `src/compiler/logical_planner.js`: Canonical Relational Algebra Operator Tree ($\pi, \sigma, \bowtie, \gamma, \tau$). |
| **5. Optimizer** | Tree Rewriting & Cost DAG | `src/compiler/optimizer/`: RBO (Predicate/Projection pushdown, constant folding) + CBO cost model. |
| **6. Code Gen** | Target Interpretation | `src/compiler/engine/iterators.js`: Volcano iterator pipeline execution (`open/next/close`). |

---

## 🎯 Preset Demonstration Scenarios for Viva / Presentation

1. **Multi-Table Join + Predicate Pushdown**:
   - `SELECT e.name, d.dept_name FROM employees e JOIN departments d ON e.dept_id = d.id WHERE d.budget > 500000 AND e.salary > 70000`
   - *Demonstration*: Shows filter conditions pushed from the root to table scans, eliminating 82.9% of unnecessary join comparisons.

2. **Constant Folding & Algebraic Simplification**:
   - `SELECT name, salary FROM employees WHERE salary > (10000 * 5) + 15000 AND 1 = 1 AND status = 'active'`
   - *Demonstration*: Evaluates `(10000 * 5) + 15000` to `65000` at compile time and simplifies `1 = 1` away.

3. **Three-Table Join + Hash Aggregation**:
   - `SELECT d.dept_name, AVG(s.amount) FROM employees e JOIN departments d ON e.dept_id = d.id JOIN salaries s ON e.id = s.emp_id WHERE e.status = 'active' GROUP BY d.dept_name`
   - *Demonstration*: Shows massive reduction in rows scanned (from ~759,000 to ~3,500; **99.5% reduction!**).

---

## 👨‍🏫 Viva Q&A Cheat-Sheet

- **Q1: Why is Predicate Pushdown so effective?**  
  *Answer:* An unoptimized join performs a Cartesian or nested loop join on the entire relations ($O(|R| \times |S|)$), only filtering at the end. Predicate Pushdown applies $\sigma$ before the join, reducing intermediate cardinality and memory usage by orders of magnitude.

- **Q2: How does the Volcano Iterator Model manage memory?**  
  *Answer:* Rather than materializing all intermediate tables in memory, Volcano iterators stream data on-demand tuple-by-tuple via `next()`. The parent operator requests tuples only as needed.

- **Q3: What role do catalog statistics play in Cost-Based Optimization?**  
  *Answer:* Cardinality $Card(R)$, page count $B(R)$, and distinct column values $V(A, R)$ allow the compiler to compute selectivity factors $S = 1/V(A)$ and estimate I/O + CPU costs to choose between Hash Join vs Nested Loop Join and Index Scan vs Sequential Scan.
