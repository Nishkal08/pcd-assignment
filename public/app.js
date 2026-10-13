/**
 * Frontend Interactive Controller for SQL Query Compiler & Optimizer
 * Principles of Compiler Design (PCD)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    presets: [],
    catalog: null,
    theory: null,
    currentCompilation: null,
    activeTab: 'lexer',
    activeFilter: 'ALL',
    activeRboStep: 0,
    resultsFilter: '',
    irMode: 'sql',           // 'sql' vs 'ra'
    labelMode: 'sql',        // 'sql' vs 'symbols'
    finalSqlStyle: 'clean'   // 'clean' vs 'pushdown'
  };

  // DOM Elements
  const presetSelect = document.getElementById('presetSelect');
  const scenarioBadge = document.getElementById('scenarioBadge');
  const sqlInput = document.getElementById('sqlInput');
  const btnCompile = document.getElementById('btnCompile');
  const btnResetQuery = document.getElementById('btnResetQuery');
  const compileTimeTag = document.getElementById('compileTimeTag');
  const errorBanner = document.getElementById('errorBanner');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');

  // Stepper Tabs
  const stepperBar = document.getElementById('stepperBar');
  const stepButtons = document.querySelectorAll('.step-btn');
  const phasePanels = document.querySelectorAll('.phase-panel');

  // Modals
  const theoryModal = document.getElementById('theoryModal');
  const catalogModal = document.getElementById('catalogModal');
  const btnOpenTheory = document.getElementById('btnOpenTheory');
  const btnCloseTheory = document.getElementById('btnCloseTheory');
  const btnOpenCatalog = document.getElementById('btnOpenCatalog');
  const btnCloseCatalog = document.getElementById('btnCloseCatalog');

  // --- Initialize App ---
  async function init() {
    setupEventListeners();
    await Promise.all([
      fetchPresets(),
      fetchCatalog(),
      fetchTheory()
    ]);

    // Load first preset by default and compile
    if (state.presets.length > 0) {
      loadPreset(state.presets[0]);
      await compileQuery();
    }
  }

  // --- API Fetch Functions ---
  async function fetchPresets() {
    try {
      const res = await fetch('/api/presets');
      const data = await res.json();
      state.presets = data.presets || [];
      populatePresetDropdown();
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  }

  async function fetchCatalog() {
    try {
      const res = await fetch('/api/catalog');
      const data = await res.json();
      state.catalog = data.catalog || {};
      renderCatalogModal();
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
    }
  }

  async function fetchTheory() {
    try {
      const res = await fetch('/api/theory');
      const data = await res.json();
      state.theory = data || {};
      renderTheoryModal();
    } catch (err) {
      console.error('Failed to fetch theory guide:', err);
    }
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Compile on button click
    btnCompile.addEventListener('click', () => compileQuery());

    // Preset selection change
    presetSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const preset = state.presets.find(p => p.id === selectedId);
      if (preset) {
        loadPreset(preset);
        compileQuery();
      }
    });

    // Reset button
    btnResetQuery.addEventListener('click', () => {
      if (state.presets.length > 0) {
        loadPreset(state.presets[0]);
      } else {
        sqlInput.value = 'SELECT name, salary FROM employees WHERE salary > 50000;';
      }
    });

    // Pipeline Stepper click
    stepButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // Token category filter buttons
    document.querySelectorAll('.token-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.token-filter').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.activeFilter = e.target.getAttribute('data-filter');
        renderLexerTab();
      });
    });

    // AST JSON toggle
    const btnToggleAstJson = document.getElementById('btnToggleAstJson');
    const astSvgContainer = document.getElementById('astTreeSvgContainer');
    const astJsonView = document.getElementById('astJsonView');
    let showingJson = false;

    btnToggleAstJson.addEventListener('click', () => {
      showingJson = !showingJson;
      if (showingJson) {
        astSvgContainer.classList.add('hidden');
        astJsonView.classList.remove('hidden');
        btnToggleAstJson.textContent = 'View Visual AST Tree';
      } else {
        astSvgContainer.classList.remove('hidden');
        astJsonView.classList.add('hidden');
        btnToggleAstJson.textContent = 'View AST JSON';
      }
    });

    // Results search input
    const resultsFilterInput = document.getElementById('resultsFilterInput');
    resultsFilterInput.addEventListener('input', (e) => {
      state.resultsFilter = e.target.value.toLowerCase();
      renderExecutionTab();
    });

    // Modal Triggers
    btnOpenTheory.addEventListener('click', () => theoryModal.classList.remove('hidden'));
    btnCloseTheory.addEventListener('click', () => theoryModal.classList.add('hidden'));

    btnOpenCatalog.addEventListener('click', () => catalogModal.classList.remove('hidden'));
    btnCloseCatalog.addEventListener('click', () => catalogModal.classList.add('hidden'));

    // Close modals on clicking overlay backdrop
    window.addEventListener('click', (e) => {
      if (e.target === theoryModal) theoryModal.classList.add('hidden');
      if (e.target === catalogModal) catalogModal.classList.add('hidden');
    });

    // Modal sub-tabs
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-modaltab');
        document.getElementById(`modalTab-${targetTab}`).classList.add('active');
      });
    });

    // Keyboard shortcut (Ctrl+Enter to compile)
    sqlInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compileQuery();
      }
    });

    // Phase 4 IR Mode Toggles (SQL Structure vs Relational Algebra)
    const btnIrToggleSql = document.getElementById('btnIrToggleSql');
    const btnIrToggleRa = document.getElementById('btnIrToggleRa');
    const btnIrToggleLabels = document.getElementById('btnIrToggleLabels');
    const btnDiffToggleLabels = document.getElementById('btnDiffToggleLabels');

    if (btnIrToggleSql && btnIrToggleRa) {
      btnIrToggleSql.addEventListener('click', () => {
        state.irMode = 'sql';
        btnIrToggleSql.classList.add('active');
        btnIrToggleRa.classList.remove('active');
        renderLogicalTab();
      });
      btnIrToggleRa.addEventListener('click', () => {
        state.irMode = 'ra';
        btnIrToggleRa.classList.add('active');
        btnIrToggleSql.classList.remove('active');
        renderLogicalTab();
      });
    }

    const toggleLabels = () => {
      state.labelMode = state.labelMode === 'sql' ? 'symbols' : 'sql';
      const labelText = state.labelMode === 'sql' ? 'Labels: SQL Terms' : 'Labels: Symbols (π, σ)';
      if (btnIrToggleLabels) btnIrToggleLabels.textContent = labelText;
      if (btnDiffToggleLabels) btnDiffToggleLabels.textContent = labelText;
      renderLogicalTab();
      renderOptimizerTab();
    };

    if (btnIrToggleLabels) btnIrToggleLabels.addEventListener('click', toggleLabels);
    if (btnDiffToggleLabels) btnDiffToggleLabels.addEventListener('click', toggleLabels);

    // Phase 5 Final Optimized SQL Toggles & Actions
    const btnSqlStyleClean = document.getElementById('btnSqlStyleClean');
    const btnSqlStylePushdown = document.getElementById('btnSqlStylePushdown');
    const btnCopyOptimizedSql = document.getElementById('btnCopyOptimizedSql');
    const btnLoadOptimizedSql = document.getElementById('btnLoadOptimizedSql');
    const copySqlBtnText = document.getElementById('copySqlBtnText');

    if (btnSqlStyleClean && btnSqlStylePushdown) {
      btnSqlStyleClean.addEventListener('click', () => {
        state.finalSqlStyle = 'clean';
        btnSqlStyleClean.classList.add('active');
        btnSqlStylePushdown.classList.remove('active');
        updateFinalSqlDisplay();
      });
      btnSqlStylePushdown.addEventListener('click', () => {
        state.finalSqlStyle = 'pushdown';
        btnSqlStylePushdown.classList.add('active');
        btnSqlStyleClean.classList.remove('active');
        updateFinalSqlDisplay();
      });
    }

    if (btnCopyOptimizedSql) {
      btnCopyOptimizedSql.addEventListener('click', async () => {
        const sql = getCurrentOptimizedSql();
        if (!sql) return;
        try {
          await navigator.clipboard.writeText(sql);
          if (copySqlBtnText) copySqlBtnText.textContent = '✓ Copied!';
          setTimeout(() => { if (copySqlBtnText) copySqlBtnText.textContent = '📋 Copy SQL'; }, 2000);
        } catch (err) {
          if (copySqlBtnText) copySqlBtnText.textContent = 'Failed';
        }
      });
    }

    if (btnLoadOptimizedSql) {
      btnLoadOptimizedSql.addEventListener('click', () => {
        const sql = getCurrentOptimizedSql();
        if (!sql) return;
        sqlInput.value = sql;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        compileQuery();
      });
    }
  }

  // --- Preset Loader ---
  function populatePresetDropdown() {
    presetSelect.innerHTML = '';
    state.presets.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.title;
      presetSelect.appendChild(opt);
    });
  }

  function loadPreset(preset) {
    presetSelect.value = preset.id;
    sqlInput.value = preset.sql;
    scenarioBadge.textContent = preset.pcdConcept;
  }

  // --- Tab Switcher ---
  function switchTab(tabId) {
    state.activeTab = tabId;

    stepButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    phasePanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });

    // Trigger re-render of SVG graphs when switching to visible tabs
    if (state.currentCompilation && state.currentCompilation.success) {
      if (tabId === 'parser') renderParserTab();
      if (tabId === 'logical') renderLogicalTab();
      if (tabId === 'optimizer') renderOptimizerTab();
    }
  }

  // --- Core Compile Function ---
  async function compileQuery() {
    const sql = sqlInput.value.trim();
    if (!sql) return;

    compileTimeTag.textContent = 'Compiling...';
    errorBanner.classList.add('hidden');

    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });

      const data = await res.json();
      state.currentCompilation = data;

      if (!data.success) {
        showError(data.phase, data.errors.join('\n'));
        compileTimeTag.textContent = 'Failed';
        return;
      }

      compileTimeTag.textContent = `Compiled in ${data.totalCompileTimeMs}ms`;
      renderAllPhases();
    } catch (err) {
      showError('Network / Server Error', err.message);
      compileTimeTag.textContent = 'Error';
    }
  }

  function showError(phase, msg) {
    errorTitle.textContent = `Compilation Failed during ${phase}`;
    errorMessage.textContent = msg;
    errorBanner.classList.remove('hidden');
  }

  // --- Master Phase Renderer ---
  function renderAllPhases() {
    if (!state.currentCompilation || !state.currentCompilation.success) return;

    renderLexerTab();
    renderParserTab();
    renderSemanticTab();
    renderLogicalTab();
    renderOptimizerTab();
    renderExecutionTab();
  }

  // ==========================================
  // Tab 1: Lexical Analysis Renderer
  // ==========================================
  function renderLexerTab() {
    const lexerData = state.currentCompilation.phases.lexer;
    document.getElementById('tokenCount').textContent = lexerData.tokenCount;

    const tbody = document.getElementById('tokensTableBody');
    tbody.innerHTML = '';

    const tokens = lexerData.tokens.filter(t => t.type !== 'EOF');

    tokens.forEach((t, idx) => {
      const category = categorizeToken(t.type);

      if (state.activeFilter !== 'ALL' && state.activeFilter !== category) {
        return;
      }

      const badgeClass = getBadgeClass(category);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><span class="token-badge ${badgeClass}">${t.type}</span></td>
        <td><code>${escapeHtml(String(t.value))}</code></td>
        <td>${t.line}</td>
        <td>${t.column}</td>
        <td><small>${category}</small></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function categorizeToken(type) {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'ON', 'AS', 'AND', 'OR', 'NOT', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'DISTINCT', 'ALL'];
    const operators = ['EQUALS', 'NOT_EQUALS', 'LESS_THAN', 'LESS_EQUALS', 'GREATER_THAN', 'GREATER_EQUALS', 'PLUS', 'MINUS', 'ASTERISK', 'SLASH', 'MODULO'];
    const literals = ['NUMBER', 'STRING'];

    if (keywords.includes(type)) return 'KEYWORD';
    if (type === 'IDENTIFIER') return 'IDENTIFIER';
    if (literals.includes(type)) return 'LITERAL';
    if (operators.includes(type)) return 'OPERATOR';
    return 'PUNCTUATION';
  }

  function getBadgeClass(cat) {
    switch (cat) {
      case 'KEYWORD': return 'badge-keyword';
      case 'IDENTIFIER': return 'badge-identifier';
      case 'LITERAL': return 'badge-literal';
      case 'OPERATOR': return 'badge-operator';
      default: return 'badge-punct';
    }
  }

  // ==========================================
  // Tab 2: Syntax Analysis (AST) Renderer
  // ==========================================
  function renderParserTab() {
    const ast = state.currentCompilation.phases.parser.ast;
    document.getElementById('astJsonView').textContent = JSON.stringify(ast, null, 2);

    const hierarchyData = convertASTToHierarchy(ast);
    renderD3Tree('#astTreeSvgContainer', hierarchyData, { treeType: 'ast' });
  }

  function convertASTToHierarchy(astNode, parentName = 'SelectQuery') {
    if (!astNode) return { name: 'Empty' };

    if (astNode.type === 'SelectStatement') {
      const children = [];

      // Columns
      if (astNode.columns) {
        children.push({
          name: 'SELECT (Columns)',
          detail: `${astNode.columns.length} items`,
          children: astNode.columns.map(c => convertASTToHierarchy(c.expression, c.alias ? `AS ${c.alias}` : ''))
        });
      }

      // FROM
      if (astNode.from) {
        children.push({
          name: `FROM: ${astNode.from.name}`,
          detail: astNode.from.alias ? `alias '${astNode.from.alias}'` : ''
        });
      }

      // Joins
      if (astNode.joins && astNode.joins.length > 0) {
        children.push({
          name: `JOINs (${astNode.joins.length})`,
          children: astNode.joins.map(j => ({
            name: `${j.joinType} JOIN ${j.table.name}`,
            detail: j.table.alias ? `alias '${j.table.alias}'` : '',
            children: j.condition ? [convertASTToHierarchy(j.condition, 'ON Condition')] : []
          }))
        });
      }

      // WHERE
      if (astNode.where) {
        children.push({
          name: 'WHERE (Filter)',
          children: [convertASTToHierarchy(astNode.where)]
        });
      }

      // GROUP BY
      if (astNode.groupBy) {
        children.push({
          name: 'GROUP BY',
          children: astNode.groupBy.map(g => convertASTToHierarchy(g))
        });
      }

      // ORDER BY
      if (astNode.orderBy) {
        children.push({
          name: 'ORDER BY',
          children: astNode.orderBy.map(o => ({
            name: `${o.direction}`,
            children: [convertASTToHierarchy(o.expression)]
          }))
        });
      }

      // LIMIT
      if (astNode.limit !== null) {
        children.push({
          name: `LIMIT: ${astNode.limit}`,
          detail: astNode.offset ? `offset: ${astNode.offset}` : ''
        });
      }

      return {
        name: 'SelectStatement',
        detail: astNode.distinct ? 'DISTINCT' : '',
        children
      };
    }

    if (astNode.type === 'BinaryOp') {
      return {
        name: `BinaryOp: '${astNode.operator}'`,
        children: [
          convertASTToHierarchy(astNode.left),
          convertASTToHierarchy(astNode.right)
        ]
      };
    }

    if (astNode.type === 'ColumnRef') {
      return {
        name: astNode.table ? `${astNode.table}.${astNode.column}` : astNode.column,
        detail: 'ColumnRef'
      };
    }

    if (astNode.type === 'Literal') {
      return {
        name: typeof astNode.value === 'string' ? `'${astNode.value}'` : String(astNode.value),
        detail: `Literal (${astNode.literalType})`
      };
    }

    if (astNode.type === 'FunctionCall') {
      return {
        name: `${astNode.name}()`,
        detail: 'Function',
        children: astNode.args.map(a => convertASTToHierarchy(a))
      };
    }

    if (astNode.type === 'BetweenOp') {
      return {
        name: astNode.isNot ? 'NOT BETWEEN' : 'BETWEEN',
        children: [
          convertASTToHierarchy(astNode.expr),
          convertASTToHierarchy(astNode.low),
          convertASTToHierarchy(astNode.high)
        ]
      };
    }

    return {
      name: astNode.type || 'Node',
      detail: astNode.value || ''
    };
  }

  // ==========================================
  // Tab 3: Semantic Analysis Renderer
  // ==========================================
  function renderSemanticTab() {
    const semData = state.currentCompilation.phases.semantic;
    const container = document.getElementById('symbolTableContainer');
    container.innerHTML = '';

    (semData.tableScope || []).forEach(tbl => {
      const card = document.createElement('div');
      card.className = 'scope-table-card';

      const pillsHtml = tbl.columns.map(c => {
        let cls = 'col-pill';
        if (c.isPrimary) cls += ' pk';
        if (c.foreignKey) cls += ' fk';
        const keyTag = c.isPrimary ? ' [PK]' : c.foreignKey ? ' [FK]' : '';
        return `<span class="${cls}">${c.name}: ${c.type}${keyTag}</span>`;
      }).join('');

      card.innerHTML = `
        <div class="scope-table-header">
          <span>Table Scope: <strong>${tbl.originalTable}</strong> (Alias: <code>${tbl.alias}</code>)</span>
          <span>${tbl.columnCount} columns</span>
        </div>
        <div class="scope-columns-pills">
          ${pillsHtml}
        </div>
      `;
      container.appendChild(card);
    });

    const diagContainer = document.getElementById('semanticDiagnostics');
    diagContainer.innerHTML = `
      <div class="diag-item success">
        <span>✓</span>
        <div><strong>Catalog Schema Binding:</strong> All referenced tables and column identifiers resolved successfully.</div>
      </div>
      <div class="diag-item success">
        <span>✓</span>
        <div><strong>Type Consistency:</strong> Filter predicates and arithmetic operands verified with data types in Catalog.</div>
      </div>
    `;

    if (semData.warnings && semData.warnings.length > 0) {
      semData.warnings.forEach(w => {
        const item = document.createElement('div');
        item.className = 'diag-item warning';
        item.innerHTML = `<span>⚠️</span><div>${w}</div>`;
        diagContainer.appendChild(item);
      });
    }
  }

  // ==========================================
  // Tab 4: Intermediate IR (Logical Plan & Relational Algebra)
  // ==========================================
  function renderLogicalTab() {
    const irData = state.currentCompilation.phases.intermediateCode;
    const plan = irData.canonicalPlan;

    const bannerLabel = document.getElementById('canonicalBannerLabel');
    const formulaCode = document.getElementById('canonicalFormulaCode');

    if (state.irMode === 'sql') {
      if (bannerLabel) bannerLabel.textContent = 'SQL Structure:';
      formulaCode.textContent = irData.canonicalSQL || planToRelationalAlgebraString(plan);
    } else {
      if (bannerLabel) bannerLabel.textContent = 'RA Expression:';
      formulaCode.textContent = planToRelationalAlgebraString(plan);
    }

    const hierarchyData = convertPlanToHierarchy(plan);
    renderD3Tree('#logicalTreeSvgContainer', hierarchyData, { treeType: 'plan' });
  }

  function planToRelationalAlgebraString(node) {
    if (!node) return '';
    return node.relationalAlgebra || node.type;
  }

  function convertPlanToHierarchy(node) {
    if (!node) return { name: 'Empty' };

    const useSql = state.labelMode === 'sql';
    let name = node.relationalAlgebra || node.type;
    let detail = '';

    if (node.type === 'LogicalScan') {
      const tbl = node.details?.table || node.type;
      const alias = node.details?.alias && node.details.alias !== tbl ? ` AS ${node.details.alias}` : '';
      name = useSql ? `SCAN: ${tbl}${alias}` : `Scan(${tbl}${alias})`;

      const parts = [];
      if (node.details?.pushedPredicates && node.details.pushedPredicates.length > 0) {
        parts.push(useSql ? `Filter: ${node.details.pushedPredicates.join(' AND ')}` : `σ[${node.details.pushedPredicates.join(' ∧ ')}]`);
      }
      if (node.details?.projectedColumns && node.details.projectedColumns.length > 0 && !node.details.projectedColumns.includes('*')) {
        parts.push(`Cols: ${node.details.projectedColumns.join(', ')}`);
      }
      detail = parts.join(' | ');
    } else if (node.type === 'LogicalFilter') {
      name = useSql ? `WHERE FILTER` : `Filter (σ)`;
      detail = node.details?.predicate || '';
    } else if (node.type === 'LogicalProject') {
      name = useSql ? `SELECT (Projection)` : `Project (π)`;
      detail = (node.details?.projections || []).map(p => p.alias ? `${p.expr} AS ${p.alias}` : p.expr).join(', ');
    } else if (node.type === 'LogicalJoin') {
      const jType = node.details?.joinType || 'INNER';
      name = useSql ? `${jType} JOIN` : `Join (${jType} ⨝)`;
      detail = node.details?.condition ? `ON ${node.details.condition}` : 'ON TRUE';
    } else if (node.type === 'LogicalAggregate') {
      name = useSql ? `GROUP BY & AGG` : `Aggregate (γ)`;
      detail = `Keys: ${(node.details?.groupBy || []).join(', ') || 'None'}`;
    } else if (node.type === 'LogicalSort') {
      name = useSql ? `ORDER BY` : `Sort (τ)`;
      detail = (node.details?.orderBy || []).map(o => `${o.expr} ${o.direction}`).join(', ');
    } else if (node.type === 'LogicalLimit') {
      name = useSql ? `LIMIT & OFFSET` : `Limit (L)`;
      detail = `Limit: ${node.details?.limit ?? 'All'}${node.details?.offset ? `, Offset: ${node.details.offset}` : ''}`;
    }

    return {
      name,
      detail,
      children: (node.children || []).map(convertPlanToHierarchy)
    };
  }

  // ==========================================
  // Tab 5: Optimization Engine (RBO & CBO)
  // ==========================================
  function renderOptimizerTab() {
    const optData = state.currentCompilation.phases.optimizer;
    const steps = optData.steps;

    // Header metrics
    document.getElementById('cboSpeedupTag').textContent = `Speedup: ${optData.cboComparison.speedupMultiplier}x`;
    document.getElementById('cboScanReductionTag').textContent = `Cost Reduction: ${optData.cboComparison.costReductionPercent}%`;

    // Render Final Optimized SQL Showcase
    updateFinalSqlDisplay();

    // Render RBO Step Buttons
    const btnContainer = document.getElementById('rboStepButtons');
    btnContainer.innerHTML = '';

    steps.forEach((step, idx) => {
      const btn = document.createElement('button');
      btn.className = `rbo-step-btn ${idx === state.activeRboStep ? 'active' : ''}`;
      btn.textContent = `Step ${step.stepNumber}: ${step.ruleName.split(' ')[0]}`;
      btn.addEventListener('click', () => {
        state.activeRboStep = idx;
        renderRboStep(steps[idx], steps[0]);
      });
      btnContainer.appendChild(btn);
    });

    renderRboStep(steps[state.activeRboStep] || steps[0], steps[0]);
    renderCboBreakdown(optData.cboComparison);
  }

  function updateFinalSqlDisplay() {
    if (!state.currentCompilation || !state.currentCompilation.phases.optimizer) return;
    const optSQL = state.currentCompilation.phases.optimizer.optimizedSQL;
    if (!optSQL) return;

    const codeEl = document.getElementById('finalOptimizedSqlCode');
    if (codeEl) {
      codeEl.textContent = state.finalSqlStyle === 'pushdown'
        ? optSQL.subqueryPushdownSQL
        : optSQL.cleanSQL;
    }
  }

  function getCurrentOptimizedSql() {
    if (!state.currentCompilation || !state.currentCompilation.phases.optimizer) return '';
    const optSQL = state.currentCompilation.phases.optimizer.optimizedSQL;
    if (!optSQL) return '';
    return state.finalSqlStyle === 'pushdown' ? optSQL.subqueryPushdownSQL : optSQL.cleanSQL;
  }

  function renderRboStep(currentStep, initialStep) {
    document.querySelectorAll('.rbo-step-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === state.activeRboStep);
    });

    document.getElementById('rboRuleTitle').textContent = `Step ${currentStep.stepNumber}: ${currentStep.ruleName}`;
    document.getElementById('rboRuleDesc').textContent = currentStep.description;
    document.getElementById('rboRuleDiffSummary').textContent = currentStep.diffSummary;

    // Render Step Rewritten SQL
    const stepSqlCode = document.getElementById('rboStepSqlCode');
    const stepSqlExplanation = document.getElementById('rboSqlStepExplanation');
    if (stepSqlCode) {
      stepSqlCode.textContent = currentStep.standardSQL || currentStep.sqlEquivalent || '-- No changes';
    }
    if (stepSqlExplanation) {
      stepSqlExplanation.textContent = currentStep.sqlExplanation || currentStep.diffSummary;
    }

    // Render Initial Baseline on Left
    const beforeData = convertPlanToHierarchy(initialStep.planSnapshot);
    renderD3Tree('#rboBeforeTreeSvgContainer', beforeData, { treeType: 'plan', diffSide: 'before' });

    // Render Transformed Tree on Right
    const afterData = convertPlanToHierarchy(currentStep.planSnapshot);
    renderD3Tree('#rboAfterTreeSvgContainer', afterData, { treeType: 'plan', diffSide: 'after' });
  }

  function renderCboBreakdown(cbo) {
    document.getElementById('cboUnoptCost').textContent = cbo.unoptimized.totalCost.toFixed(2);
    document.getElementById('cboUnoptRows').textContent = cbo.unoptimized.estimatedRows;

    document.getElementById('cboOptCost').textContent = cbo.optimized.totalCost.toFixed(2);
    document.getElementById('cboOptRows').textContent = cbo.optimized.estimatedRows;

    document.getElementById('cboEfficiencyTag').textContent = `${cbo.costReductionPercent}% Cheaper`;

    const tbody = document.getElementById('cboTableBody');
    tbody.innerHTML = '';

    cbo.optimized.breakdown.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${b.nodeId}</code></td>
        <td><strong>${b.operator}</strong></td>
        <td>${b.selectivity !== undefined ? (b.selectivity * 100).toFixed(1) + '%' : '-'}</td>
        <td>${b.ioCost !== undefined ? b.ioCost.toFixed(2) : '0'}</td>
        <td>${b.cpuCost !== undefined ? b.cpuCost.toFixed(2) : '0'}</td>
        <td><strong>${b.totalCost.toFixed(2)}</strong></td>
        <td>${b.estimatedRows}</td>
        <td><small>${b.explanation}</small></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ==========================================
  // Tab 6: Code Gen & Volcano Execution
  // ==========================================
  function renderExecutionTab() {
    const execData = state.currentCompilation.phases.codeGenAndExecution.execution;
    if (!execData) return;

    const unopt = execData.unoptimized.metrics;
    const opt = execData.optimized.metrics;
    const comp = execData.comparison;

    document.getElementById('metricUnoptScanned').textContent = (unopt.totalRowsScanned || 0).toLocaleString();
    document.getElementById('metricOptScanned').textContent = (opt.totalRowsScanned || 0).toLocaleString();
    document.getElementById('metricScanSavings').textContent = `${comp.rowsScannedReductionPercent}% reduction in rows scanned`;

    const scanRatio = unopt.totalRowsScanned > 0 ? Math.max(5, (opt.totalRowsScanned / unopt.totalRowsScanned) * 100) : 100;
    document.getElementById('metricScanBar').style.width = `${scanRatio}%`;

    document.getElementById('metricUnoptTime').textContent = `${unopt.executionTimeMs || 0} ms`;
    document.getElementById('metricOptTime').textContent = `${opt.executionTimeMs || 0} ms`;
    document.getElementById('metricTimeSavings').textContent = `Speedup factor: ${comp.speedupMultiplier}x faster`;

    document.getElementById('metricRowsReturned').textContent = execData.rowCount || 0;

    // Render Data Results Grid
    const thead = document.getElementById('resultsTableHead');
    const tbody = document.getElementById('resultsTableBody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (execData.columns && execData.columns.length > 0) {
      const headRow = document.createElement('tr');
      headRow.innerHTML = '<th>#</th>' + execData.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('');
      thead.appendChild(headRow);

      let filteredRows = execData.results || [];
      if (state.resultsFilter) {
        filteredRows = filteredRows.filter(r => {
          return Object.values(r).some(v => String(v).toLowerCase().includes(state.resultsFilter));
        });
      }

      // Display up to 50 rows
      const displayRows = filteredRows.slice(0, 50);
      displayRows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        const cells = execData.columns.map(c => {
          const val = row[c];
          return `<td>${val !== null && val !== undefined ? escapeHtml(String(val)) : '<span style="color:var(--text-dim)">NULL</span>'}</td>`;
        }).join('');
        tr.innerHTML = `<td>${idx + 1}</td>${cells}`;
        tbody.appendChild(tr);
      });

      if (filteredRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${execData.columns.length + 1}" style="text-align:center; padding:2rem; color:var(--text-dim);">No matching rows found</td></tr>`;
      }
    } else {
      tbody.innerHTML = `<tr><td style="text-align:center; padding:2rem; color:var(--text-dim);">Query returned 0 rows</td></tr>`;
    }
  }

  // ==========================================
  // D3 Hierarchical Tree Visualizer — Improved
  // ==========================================

  // Operator type → visual style mapping
  const NODE_STYLES = {
    // Plan nodes
    scan:       { fill: '#0d1f2d', stroke: '#3b82f6', label: '#93c5fd', detail: '#5b8dd9', icon: 'R' },
    filter:     { fill: '#1f1a0d', stroke: '#d97706', label: '#fbbf24', detail: '#b45309', icon: 'σ' },
    project:    { fill: '#0d1f17', stroke: '#16a34a', label: '#4ade80', detail: '#15803d', icon: 'π' },
    join:       { fill: '#1a0d2e', stroke: '#9333ea', label: '#c084fc', detail: '#7e22ce', icon: '⨝' },
    aggregate:  { fill: '#1f0d1a', stroke: '#db2777', label: '#f472b6', detail: '#9d174d', icon: 'γ' },
    sort:       { fill: '#0d1f1f', stroke: '#0891b2', label: '#67e8f9', detail: '#0e7490', icon: 'τ' },
    limit:      { fill: '#1a1a1a', stroke: '#6b7280', label: '#d1d5db', detail: '#6b7280', icon: 'L' },
    // AST nodes
    statement:  { fill: '#0d1520', stroke: '#4f46e5', label: '#a5b4fc', detail: '#6366f1', icon: '⊢' },
    clause:     { fill: '#111827', stroke: '#374151', label: '#d1d5db', detail: '#6b7280', icon: '·' },
    expr:       { fill: '#111111', stroke: '#4b5563', label: '#9ca3af', detail: '#6b7280', icon: '⟨⟩' },
    default:    { fill: '#161616', stroke: '#3f3f3f', label: '#d1d5db', detail: '#6b7280', icon: '○' }
  };

  function getNodeStyle(nodeName, treeType, diffSide) {
    if (diffSide === 'before') return { fill: '#1a0a0a', stroke: '#b91c1c', label: '#fca5a5', detail: '#991b1b', icon: '✕' };
    if (diffSide === 'after') return { fill: '#091a0f', stroke: '#166534', label: '#86efac', detail: '#15803d', icon: '✓' };

    if (treeType === 'ast') {
      const n = (nodeName || '').toLowerCase();
      if (n.includes('select')) return NODE_STYLES.statement;
      if (n.includes('join') || n.includes('from') || n.includes('where') || n.includes('group') || n.includes('order') || n.includes('limit')) return NODE_STYLES.clause;
      return NODE_STYLES.expr;
    }
    // plan nodes
    const n = (nodeName || '').toLowerCase();
    if (n.includes('scan') || n.includes('table')) return NODE_STYLES.scan;
    if (n.includes('filter') || n.includes('σ') || n.includes('where')) return NODE_STYLES.filter;
    if (n.includes('project') || n.includes('π') || n.includes('select')) return NODE_STYLES.project;
    if (n.includes('join') || n.includes('⨝')) return NODE_STYLES.join;
    if (n.includes('aggregate') || n.includes('γ') || n.includes('group')) return NODE_STYLES.aggregate;
    if (n.includes('sort') || n.includes('τ') || n.includes('order')) return NODE_STYLES.sort;
    if (n.includes('limit')) return NODE_STYLES.limit;
    return NODE_STYLES.default;
  }

  function renderD3Tree(containerSelector, data, config = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    container.innerHTML = '';

    const W = container.clientWidth  || 900;
    const H = container.clientHeight || 500;

    const NODE_W  = 178;
    const NODE_H  = 62;
    const H_GAP   = 210;  // horizontal spacing between siblings
    const V_GAP   = 110;  // vertical spacing between levels
    const RADIUS  = 8;
    const { treeType = 'plan', diffSide = null } = config;

    // Build hierarchy and layout
    const root = d3.hierarchy(data);
    const treeLayout = d3.tree().nodeSize([H_GAP, V_GAP]);
    treeLayout(root);

    // Compute bounding box to center the tree
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    root.each(d => {
      minX = Math.min(minX, d.x - NODE_W / 2);
      maxX = Math.max(maxX, d.x + NODE_W / 2);
      minY = Math.min(minY, d.y);
      maxY = Math.max(maxY, d.y + NODE_H);
    });
    const treeW = maxX - minX;
    const treeH = maxY - minY;
    const scale = Math.min(1, Math.min((W - 40) / treeW, (H - 40) / treeH));
    const tx = (W - treeW * scale) / 2 - minX * scale;
    const ty = 20;

    const svg = d3.select(containerSelector)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${W} ${H}`);

    // Arrowhead marker
    const defs = svg.append('defs');
    const markerId = `arrow-${containerSelector.replace(/[^a-z0-9]/gi, '')}`;
    defs.append('marker')
      .attr('id', markerId)
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 7)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', '#444');

    const g = svg.append('g')
      .attr('transform', `translate(${tx},${ty}) scale(${scale})`);

    // Zoom / pan
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

    // ── Links ─────────────────────────────────────────────
    g.selectAll('.edge')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'edge')
      .attr('fill', 'none')
      .attr('stroke', '#2d2d2d')
      .attr('stroke-width', 1.5)
      .attr('marker-end', `url(#${markerId})`)
      .attr('d', d => {
        const sx = d.source.x,
              sy = d.source.y + NODE_H;
        const tx = d.target.x,
              ty = d.target.y;
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      });

    // ── Nodes ──────────────────────────────────────────────
    const nodeG = g.selectAll('.tnode')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'tnode')
      .attr('transform', d => `translate(${d.x - NODE_W / 2},${d.y})`);

    nodeG.each(function(d) {
      const el   = d3.select(this);
      const name = d.data.name || '';
      const det  = d.data.detail || '';
      const style = getNodeStyle(name, treeType, diffSide);
      const isLeaf = !d.children || d.children.length === 0;

      // Background rect
      el.append('rect')
        .attr('width', NODE_W)
        .attr('height', NODE_H)
        .attr('rx', RADIUS)
        .attr('fill', style.fill)
        .attr('stroke', style.stroke)
        .attr('stroke-width', isLeaf ? 1 : 1.5);

      // Left accent strip
      el.append('rect')
        .attr('width', 4)
        .attr('height', NODE_H - RADIUS * 2)
        .attr('x', 0)
        .attr('y', RADIUS)
        .attr('rx', 2)
        .attr('fill', style.stroke)
        .attr('opacity', 0.9);

      // Operator icon badge
      el.append('text')
        .attr('x', 20)
        .attr('y', 22)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', '700')
        .attr('fill', style.stroke)
        .text(style.icon);

      // Main label — truncated
      const labelText = truncate(name, treeType === 'ast' ? 20 : 17);
      el.append('text')
        .attr('x', 36)
        .attr('y', 21)
        .attr('font-size', '11.5px')
        .attr('font-weight', '700')
        .attr('fill', style.label)
        .attr('font-family', "'JetBrains Mono', monospace")
        .text(labelText);

      // Detail line — truncated
      if (det) {
        el.append('text')
          .attr('x', 36)
          .attr('y', 39)
          .attr('font-size', '9px')
          .attr('fill', style.detail)
          .attr('font-family', "'JetBrains Mono', monospace")
          .text(truncate(det, 28));
      }

      // Tooltip on hover
      el.append('title').text(`${name}${det ? '\n' + det : ''}`);
    });
  }

  // ==========================================
  // Modals Content Renderers
  // ==========================================
  function renderTheoryModal() {
    if (!state.theory) return;

    // Dragon Book Phases
    const phasesContainer = document.getElementById('dragonPhasesList');
    phasesContainer.innerHTML = '';
    (state.theory.dragonBookPhases || []).forEach(p => {
      const card = document.createElement('div');
      card.className = 'theory-phase-card';
      card.innerHTML = `
        <div class="theory-phase-title">${p.phase}</div>
        <div class="theory-phase-concept">Compiler Concept: ${p.pcdConcept}</div>
        <div class="theory-phase-mapping"><strong>SQL Query Implementation:</strong> ${p.sqlMapping}</div>
        <div class="theory-phase-ref">${p.dragonBookRef}</div>
      `;
      phasesContainer.appendChild(card);
    });

    // Algebraic Equivalences
    const algebraContainer = document.getElementById('algebraRulesList');
    algebraContainer.innerHTML = '';
    (state.theory.relationalAlgebraEquivalences || []).forEach(r => {
      const item = document.createElement('div');
      item.className = 'algebra-rule-item';
      item.innerHTML = `
        <div class="algebra-rule-name">${r.rule}</div>
        <div class="algebra-rule-formula">${r.formula}</div>
        <p style="font-size:0.85rem; color:#d1d5db; margin-top:0.3rem;">${r.explanation}</p>
      `;
      algebraContainer.appendChild(item);
    });

    // Viva Questions
    const vivaContainer = document.getElementById('vivaQaList');
    vivaContainer.innerHTML = '';
    (state.theory.vivaQuestions || []).forEach((qa, idx) => {
      const item = document.createElement('div');
      item.className = 'viva-item';
      item.innerHTML = `
        <div class="viva-q">Q${idx + 1}: ${qa.q}</div>
        <div class="viva-a"><strong>Answer:</strong> ${qa.a}</div>
      `;
      vivaContainer.appendChild(item);
    });
  }

  function renderCatalogModal() {
    if (!state.catalog || !state.catalog.tables) return;
    const container = document.getElementById('catalogTablesContainer');
    container.innerHTML = '';

    Object.entries(state.catalog.tables).forEach(([tableName, tbl]) => {
      const stats = tbl.statistics || {};
      const indexes = (tbl.indexes || []).map(i => `${i.name} (${i.columns.join(', ')})`).join('  ·  ') || '—';

      const colPills = Object.entries(tbl.columns).map(([col, meta]) => {
        let cls = 'col-pill';
        let suffix = '';
        if (meta.isPrimary) { cls += ' pk'; suffix = ' PK'; }
        else if (meta.foreignKey) { cls += ' fk'; suffix = ' FK'; }
        return `<span class="${cls}" title="${meta.foreignKey ? 'FK → ' + meta.foreignKey : ''}">${col}: ${meta.type}${suffix}</span>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'catalog-table-card';
      card.innerHTML = `
        <div class="catalog-table-header">
          <span class="catalog-table-name">${tableName}</span>
          <span class="catalog-table-meta">${stats.rowCount || 0} rows · ${stats.pageCount || 0} pages</span>
        </div>
        <div style="font-size:0.72rem; color:var(--txt-dim); font-family:var(--font-code); margin-bottom:8px;">
          idx: ${indexes}
        </div>
        <div class="scope-columns-pills">${colPills}</div>
      `;
      container.appendChild(card);
    });
  }

  // --- Utility Helpers ---
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function truncate(str, maxLen = 16) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 1) + '…';
  }

  // Run initial launch
  init();
});
