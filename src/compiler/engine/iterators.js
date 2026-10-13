/**
 * Volcano Iterator Execution Model
 * Principles of Compiler Design - Phase 6: Code Generation & Execution Engine
 * Standard Volcano Model: open(), next(), close()
 */

export class VolcanoIterator {
  constructor(name) {
    this.name = name;
    this.metrics = {
      tuplesScanned: 0,
      tuplesProduced: 0,
      executionTimeMs: 0
    };
  }

  open() {
    this.metrics.tuplesScanned = 0;
    this.metrics.tuplesProduced = 0;
    this.startTime = performance.now();
  }

  next() {
    throw new Error('next() must be implemented by iterator subclass');
  }

  close() {
    if (this.startTime) {
      this.metrics.executionTimeMs = Number((performance.now() - this.startTime).toFixed(3));
    }
  }

  collectMetrics() {
    return {
      operator: this.name,
      ...this.metrics
    };
  }
}

// 1. Table Sequential Scan Iterator
export class SeqScanIterator extends VolcanoIterator {
  constructor(tableName, tableData, alias = null, projectedCols = ['*'], pushedPredicates = []) {
    super(`SeqScan(${tableName})`);
    this.tableName = tableName;
    this.tableData = tableData || [];
    this.alias = alias || tableName;
    this.projectedCols = projectedCols;
    this.pushedPredicates = pushedPredicates;
    this.cursor = 0;
  }

  open() {
    super.open();
    this.cursor = 0;
  }

  next() {
    while (this.cursor < this.tableData.length) {
      const rawRow = this.tableData[this.cursor++];
      this.metrics.tuplesScanned++;

      // Form tuple with table prefix and unqualified names
      const tuple = this.wrapTuple(rawRow);

      // Evaluate pushed predicates
      if (this.evaluatePredicates(tuple)) {
        this.metrics.tuplesProduced++;
        return tuple;
      }
    }
    return null;
  }

  wrapTuple(rawRow) {
    const tuple = {};
    const prefix = `${this.alias}.`;
    for (const [k, v] of Object.entries(rawRow)) {
      tuple[k] = v;
      tuple[`${prefix}${k}`] = v;
    }
    return tuple;
  }

  evaluatePredicates(tuple) {
    for (const pred of this.pushedPredicates) {
      if (!evalExpr(pred, tuple)) {
        return false;
      }
    }
    return true;
  }

  close() {
    super.close();
  }
}

// 2. Filter (Selection σ) Iterator
export class FilterIterator extends VolcanoIterator {
  constructor(childIterator, condition) {
    super('Filter(σ)');
    this.child = childIterator;
    this.condition = condition;
  }

  open() {
    super.open();
    this.child.open();
  }

  next() {
    let tuple;
    while ((tuple = this.child.next()) !== null) {
      this.metrics.tuplesScanned++;
      if (evalExpr(this.condition, tuple)) {
        this.metrics.tuplesProduced++;
        return tuple;
      }
    }
    return null;
  }

  close() {
    this.child.close();
    super.close();
  }
}

// 3. Project (π) Iterator
export class ProjectIterator extends VolcanoIterator {
  constructor(childIterator, projections) {
    super('Project(π)');
    this.child = childIterator;
    this.projections = projections; // [{ expr, alias }]
  }

  open() {
    super.open();
    this.child.open();
  }

  next() {
    const tuple = this.child.next();
    if (!tuple) return null;

    this.metrics.tuplesScanned++;
    const projectedTuple = {};

    for (const p of this.projections) {
      const expr = p.expression || p.expr;
      if (expr.type === 'ColumnRef' && expr.column === '*') {
        // wildcard: copy all original fields
        Object.assign(projectedTuple, tuple);
      } else {
        const val = evalExpr(expr, tuple);
        const name = p.alias || exprToColumnName(expr);
        projectedTuple[name] = val;
      }
    }

    this.metrics.tuplesProduced++;
    return projectedTuple;
  }

  close() {
    this.child.close();
    super.close();
  }
}

// 4. Nested Loop Join (⨝) Iterator
export class NestedLoopJoinIterator extends VolcanoIterator {
  constructor(outerIterator, innerIterator, joinType = 'INNER', condition = null) {
    super(`NestedLoopJoin(${joinType})`);
    this.outer = outerIterator;
    this.inner = innerIterator;
    this.joinType = joinType;
    this.condition = condition;
    this.currentOuterTuple = null;
    this.matchedOuter = false;
    this.innerBuffer = [];
    this.innerIndex = 0;
  }

  open() {
    super.open();
    this.outer.open();
    this.inner.open();

    // Materialize inner relation into buffer to avoid repeated child scans
    this.innerBuffer = [];
    let innerTuple;
    while ((innerTuple = this.inner.next()) !== null) {
      this.innerBuffer.push(innerTuple);
    }
    this.inner.close();

    this.currentOuterTuple = this.outer.next();
    this.matchedOuter = false;
    this.innerIndex = 0;
  }

  next() {
    while (this.currentOuterTuple !== null) {
      while (this.innerIndex < this.innerBuffer.length) {
        const innerTuple = this.innerBuffer[this.innerIndex++];
        this.metrics.tuplesScanned++;
        const combined = { ...this.currentOuterTuple, ...innerTuple };

        if (!this.condition || evalExpr(this.condition, combined)) {
          this.matchedOuter = true;
          this.metrics.tuplesProduced++;
          return combined;
        }
      }

      // Handle LEFT JOIN when no inner match was found
      if (this.joinType === 'LEFT' && !this.matchedOuter) {
        this.matchedOuter = true;
        this.metrics.tuplesProduced++;
        const combined = { ...this.currentOuterTuple };
        // Advance outer tuple for next call
        this.currentOuterTuple = this.outer.next();
        this.matchedOuter = false;
        this.innerIndex = 0;
        return combined;
      }

      // Advance outer and rewind inner buffer index
      this.currentOuterTuple = this.outer.next();
      this.matchedOuter = false;
      this.innerIndex = 0;
    }
    return null;
  }

  close() {
    this.outer.close();
    super.close();
  }
}

// 5. In-Memory Hash Join (⨝) Iterator
export class HashJoinIterator extends VolcanoIterator {
  constructor(buildIterator, probeIterator, joinType = 'INNER', condition = null) {
    super(`HashJoin(${joinType})`);
    this.buildChild = buildIterator;
    this.probeChild = probeIterator;
    this.joinType = joinType;
    this.condition = condition;
    this.hashTable = new Map();
    this.probeTuple = null;
    this.matchedBucket = [];
    this.bucketIndex = 0;
  }

  open() {
    super.open();
    this.hashTable.clear();
    this.buildChild.open();

    // 1. Build Phase: Consume build child and populate hash table
    let buildTuple;
    while ((buildTuple = this.buildChild.next()) !== null) {
      const key = this.extractJoinKey(buildTuple);
      if (!this.hashTable.has(key)) {
        this.hashTable.set(key, []);
      }
      this.hashTable.get(key).push(buildTuple);
    }
    this.buildChild.close();

    // 2. Probe Phase: Open probe child
    this.probeChild.open();
    this.probeTuple = null;
    this.matchedBucket = [];
    this.bucketIndex = 0;
  }

  extractJoinKey(tuple) {
    // If condition is equi-join: e.dept_id = d.id
    if (this.condition && this.condition.type === 'BinaryOp' && this.condition.operator === '=') {
      const leftVal = evalExpr(this.condition.left, tuple);
      if (leftVal !== null && leftVal !== undefined) return String(leftVal);
      const rightVal = evalExpr(this.condition.right, tuple);
      if (rightVal !== null && rightVal !== undefined) return String(rightVal);
    }
    return '1';
  }

  next() {
    while (true) {
      if (this.bucketIndex < this.matchedBucket.length) {
        const buildTuple = this.matchedBucket[this.bucketIndex++];
        const combined = { ...this.probeTuple, ...buildTuple };
        if (!this.condition || evalExpr(this.condition, combined)) {
          this.metrics.tuplesProduced++;
          return combined;
        }
      }

      this.probeTuple = this.probeChild.next();
      if (!this.probeTuple) return null;

      this.metrics.tuplesScanned++;
      const key = this.extractJoinKey(this.probeTuple);
      this.matchedBucket = this.hashTable.get(key) || [];
      this.bucketIndex = 0;
    }
  }

  close() {
    this.probeChild.close();
    super.close();
  }
}

// 6. Hash Aggregate (γ) Iterator
export class HashAggregateIterator extends VolcanoIterator {
  constructor(childIterator, groupBy = [], aggregates = []) {
    super('HashAggregate(γ)');
    this.child = childIterator;
    this.groupBy = groupBy;
    this.aggregates = aggregates;
    this.groups = new Map();
    this.resultTuples = [];
    this.resultIndex = 0;
  }

  open() {
    super.open();
    this.child.open();
    this.groups.clear();
    this.resultTuples = [];
    this.resultIndex = 0;

    let tuple;
    while ((tuple = this.child.next()) !== null) {
      this.metrics.tuplesScanned++;
      const groupKey = this.groupBy.map(g => String(evalExpr(g, tuple))).join(':::');

      if (!this.groups.has(groupKey)) {
        this.groups.set(groupKey, {
          sampleTuple: tuple,
          groupValues: this.groupBy.map(g => evalExpr(g, tuple)),
          aggStates: this.aggregates.map(() => ({ count: 0, sum: 0, min: Infinity, max: -Infinity, values: [] }))
        });
      }

      const groupEntry = this.groups.get(groupKey);
      this.aggregates.forEach((agg, idx) => {
        const state = groupEntry.aggStates[idx];
        const val = agg.arg ? evalExpr(agg.arg, tuple) : 1;

        state.count++;
        if (typeof val === 'number') {
          state.sum += val;
          state.min = Math.min(state.min, val);
          state.max = Math.max(state.max, val);
        }
      });
    }

    // Materialize final aggregate rows
    for (const [, group] of this.groups.entries()) {
      const outTuple = {};

      this.groupBy.forEach((g, idx) => {
        const colName = exprToColumnName(g);
        outTuple[colName] = group.groupValues[idx];
      });

      this.aggregates.forEach((agg, idx) => {
        const state = group.aggStates[idx];
        let aggVal = 0;
        switch (agg.fnName) {
          case 'COUNT': aggVal = state.count; break;
          case 'SUM': aggVal = Number(state.sum.toFixed(2)); break;
          case 'AVG': aggVal = state.count > 0 ? Number((state.sum / state.count).toFixed(2)) : 0; break;
          case 'MIN': aggVal = state.min === Infinity ? null : state.min; break;
          case 'MAX': aggVal = state.max === -Infinity ? null : state.max; break;
        }
        outTuple[agg.alias] = aggVal;
      });

      this.resultTuples.push(outTuple);
    }

    this.child.close();
  }

  next() {
    if (this.resultIndex < this.resultTuples.length) {
      this.metrics.tuplesProduced++;
      return this.resultTuples[this.resultIndex++];
    }
    return null;
  }

  close() {
    super.close();
  }
}

// 7. Sort (τ) Iterator
export class SortIterator extends VolcanoIterator {
  constructor(childIterator, orderByItems = []) {
    super('Sort(τ)');
    this.child = childIterator;
    this.orderByItems = orderByItems;
    this.tuples = [];
    this.index = 0;
  }

  open() {
    super.open();
    this.child.open();
    this.tuples = [];
    this.index = 0;

    let tuple;
    while ((tuple = this.child.next()) !== null) {
      this.metrics.tuplesScanned++;
      this.tuples.push(tuple);
    }
    this.child.close();

    // In-memory sort
    this.tuples.sort((a, b) => {
      for (const item of this.orderByItems) {
        const va = evalExpr(item.expression, a);
        const vb = evalExpr(item.expression, b);
        if (va < vb) return item.direction === 'DESC' ? 1 : -1;
        if (va > vb) return item.direction === 'DESC' ? -1 : 1;
      }
      return 0;
    });
  }

  next() {
    if (this.index < this.tuples.length) {
      this.metrics.tuplesProduced++;
      return this.tuples[this.index++];
    }
    return null;
  }

  close() {
    super.close();
  }
}

// 8. Limit (L) Iterator
export class LimitIterator extends VolcanoIterator {
  constructor(childIterator, limit = null, offset = null) {
    super('Limit(L)');
    this.child = childIterator;
    this.limit = limit;
    this.offset = offset || 0;
    this.yielded = 0;
    this.skipped = 0;
  }

  open() {
    super.open();
    this.child.open();
    this.yielded = 0;
    this.skipped = 0;
  }

  next() {
    while (this.skipped < this.offset) {
      const t = this.child.next();
      if (!t) return null;
      this.skipped++;
      this.metrics.tuplesScanned++;
    }

    if (this.limit !== null && this.yielded >= this.limit) {
      return null;
    }

    const tuple = this.child.next();
    if (!tuple) return null;

    this.metrics.tuplesScanned++;
    this.yielded++;
    this.metrics.tuplesProduced++;
    return tuple;
  }

  close() {
    this.child.close();
    super.close();
  }
}

// --- Expression Evaluator for In-Memory Execution ---

export function evalExpr(expr, tuple) {
  if (!expr || !tuple) return null;

  switch (expr.type) {
    case 'Literal':
      return expr.value;

    case 'ColumnRef': {
      const col = (expr.resolvedColumn || expr.column || '').toLowerCase();
      const tbl = (expr.resolvedAlias || expr.resolvedTable || expr.table || '').toLowerCase();

      if (tbl) {
        const qualified = `${tbl}.${col}`;
        for (const [k, v] of Object.entries(tuple)) {
          if (k.toLowerCase() === qualified) return v;
        }
      }

      for (const [k, v] of Object.entries(tuple)) {
        if (k.toLowerCase() === col) return v;
      }

      for (const [k, v] of Object.entries(tuple)) {
        if (k.toLowerCase().endsWith(`.${col}`)) return v;
      }

      return null;
    }

    case 'BinaryOp': {
      const leftVal = evalExpr(expr.left, tuple);
      const rightVal = evalExpr(expr.right, tuple);
      const op = expr.operator.toUpperCase();

      switch (op) {
        case '+': return Number(leftVal) + Number(rightVal);
        case '-': return Number(leftVal) - Number(rightVal);
        case '*': return Number(leftVal) * Number(rightVal);
        case '/': return Number(rightVal) !== 0 ? Number(leftVal) / Number(rightVal) : null;
        case '%': return Number(leftVal) % Number(rightVal);
        case '=': return leftVal == rightVal;
        case '!=':
        case '<>': return leftVal != rightVal;
        case '<': return leftVal < rightVal;
        case '<=': return leftVal <= rightVal;
        case '>': return leftVal > rightVal;
        case '>=': return leftVal >= rightVal;
        case 'AND': return Boolean(leftVal && rightVal);
        case 'OR': return Boolean(leftVal || rightVal);
        default: return null;
      }
    }

    case 'UnaryOp': {
      const val = evalExpr(expr.operand, tuple);
      if (expr.operator === 'NOT') return !val;
      if (expr.operator === '-') return -val;
      return val;
    }

    case 'BetweenOp': {
      const val = evalExpr(expr.expr, tuple);
      const low = evalExpr(expr.low, tuple);
      const high = evalExpr(expr.high, tuple);
      const res = val >= low && val <= high;
      return expr.isNot ? !res : res;
    }

    case 'InOp': {
      const val = evalExpr(expr.expr, tuple);
      const list = expr.values.map(v => evalExpr(v, tuple));
      const res = list.includes(val);
      return expr.isNot ? !res : res;
    }

    case 'LikeOp': {
      const val = String(evalExpr(expr.expr, tuple) || '');
      const pattern = String(evalExpr(expr.pattern, tuple) || '');
      // Simple SQL LIKE pattern (% -> .*, _ -> .)
      const regexStr = '^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$';
      const re = new RegExp(regexStr, 'i');
      const res = re.test(val);
      return expr.isNot ? !res : res;
    }

    case 'IsNullOp': {
      const val = evalExpr(expr.expr, tuple);
      const isNull = val === null || val === undefined;
      return expr.isNot ? !isNull : isNull;
    }

    default:
      return null;
  }
}

function exprToColumnName(expr) {
  if (!expr) return 'val';
  if (expr.type === 'ColumnRef') return expr.column;
  if (expr.type === 'FunctionCall') return `${expr.name.toLowerCase()}_result`;
  return 'expr';
}
