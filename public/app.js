/**
 * Local Project Performance & API Auditor Pro v3.0
 * Frontend Application Controller
 * Optimized with DocumentFragment batch DOM mounting, single-pass HTML escaping,
 * complete absolute file path display, one-click editor opening (VS Code / Notepad),
 * multi-file API architecture tracing with exact code syntax blocks,
 * and comprehensive rule filters for JS, TSX, PHP, jQuery, React, Next.js, Python, CSS, and Dependencies.
 */

// Application State
const state = {
  currentRun: null,
  activePatchFinding: null,
  activeFilter: 'all',
  requestFilter: 'all',
  runsList: []
};

// DOM References
const auditForm = document.getElementById('auditForm');
const targetUrlInput = document.getElementById('targetUrl');
const projectPathInput = document.getElementById('projectPath');
const isMobileCheckbox = document.getElementById('isMobile');
const warmCacheCheckbox = document.getElementById('warmCache');
const screenshotCheckbox = document.getElementById('screenshot');
const repeatRunsSelect = document.getElementById('repeatRuns');
const runAuditBtn = document.getElementById('runAuditBtn');
const progressBanner = document.getElementById('progressBanner');
const progressText = document.getElementById('progressText');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// Scorecard elements
const ringOverall = document.getElementById('ringOverall');
const scorePage = document.getElementById('scorePage');
const scoreNetwork = document.getElementById('scoreNetwork');
const scoreReact = document.getElementById('scoreReact');
const scorePython = document.getElementById('scorePython');
const scoreCss = document.getElementById('scoreCss');
const scoreDeps = document.getElementById('scoreDeps');

// Vitals
const vitalTtfb = document.getElementById('vitalTtfb');
const vitalFcp = document.getElementById('vitalFcp');
const vitalLcp = document.getElementById('vitalLcp');
const vitalCls = document.getElementById('vitalCls');
const navTimingBar = document.getElementById('navTimingBar');
const navTimingLegend = document.getElementById('navTimingLegend');

// Stats
const statTotalReqs = document.getElementById('statTotalReqs');
const statTotalSize = document.getElementById('statTotalSize');
const statApiReqs = document.getElementById('statApiReqs');
const statFailedReqs = document.getElementById('statFailedReqs');
const statSlowReqs = document.getElementById('statSlowReqs');
const statThirdParty = document.getElementById('statThirdParty');
const deductionsList = document.getElementById('deductionsList');

// Findings
const countFindings = document.getElementById('countFindings');
const findingsContainer = document.getElementById('findingsContainer');
const unusedCodeSummary = document.getElementById('unusedCodeSummary');
const unusedCodeReportContainer = document.getElementById('unusedCodeReportContainer');
const findingsSearch = document.getElementById('findingsSearch');
const severityFilter = document.getElementById('severityFilter');
const confidenceFilter = document.getElementById('confidenceFilter');
const categoryFilter = document.getElementById('categoryFilter');

// Requests
const countRequests = document.getElementById('countRequests');
const requestsTableBody = document.getElementById('requestsTableBody');
const requestsSearch = document.getElementById('requestsSearch');
const reqFilterChips = document.querySelectorAll('.chip');
const apiArchitectureInventory = document.getElementById('apiArchitectureInventory');
const apiArchSummaryBadge = document.getElementById('apiArchSummaryBadge');

// Patching
const patchDiffViewer = document.getElementById('patchDiffViewer');
const patchFileMeta = document.getElementById('patchFileMeta');
const applyPatchBtn = document.getElementById('applyPatchBtn');
const downloadPatchBtn = document.getElementById('downloadPatchBtn');
const backupsList = document.getElementById('backupsList');

// Specialized Tabs
const jsFindingsList = document.getElementById('jsFindingsList');
const phpFindingsList = document.getElementById('phpFindingsList');
const reactFindingsList = document.getElementById('reactFindingsList');
const pythonFindingsList = document.getElementById('pythonFindingsList');
const cssFindingsList = document.getElementById('cssFindingsList');
const depFindingsList = document.getElementById('depFindingsList');
const bundleChunksSection = document.getElementById('bundleChunksSection');

// Comparison
const compareRunA = document.getElementById('compareRunA');
const compareRunB = document.getElementById('compareRunB');
const compareBtn = document.getElementById('compareBtn');
const comparisonResults = document.getElementById('comparisonResults');

// Modal
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalFooter = document.getElementById('modalFooter');
const modalCloseBtn = document.getElementById('modalCloseBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupFilters();
  setupExports();
  setupEditorClickDelegation();
  setupModalDismissal();
  loadSavedRuns();
});

// Tab Switcher
function setupTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');
    });
  });
}

function switchTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

function setupModalDismissal() {
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => modalBackdrop.classList.add('hidden'));
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.add('hidden');
      }
    });
  }
}

// Form Submission
auditForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const targetUrl = targetUrlInput.value.trim();
  const projectPath = projectPathInput.value.trim();

  if (!targetUrl && !projectPath) {
    alert('Please provide either a Target URL or a Local Project Directory path (or both).');
    return;
  }

  setLoading(true, 'Running performance tests, capturing requests, and tracing multi-file API architecture...');

  try {
    const res = await fetch('/api/audit/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: targetUrl || undefined,
        projectPath: projectPath || undefined,
        isMobile: isMobileCheckbox.checked,
        warmCache: warmCacheCheckbox.checked,
        screenshot: screenshotCheckbox.checked,
        repeatRuns: repeatRunsSelect.value
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Audit failed');

    state.currentRun = data;
    renderAudit(data);
    loadSavedRuns();
  } catch (err) {
    alert(`Audit Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading, text = '') {
  if (isLoading) {
    progressBanner.classList.remove('hidden');
    progressText.textContent = text;
    runAuditBtn.disabled = true;
  } else {
    progressBanner.classList.add('hidden');
    runAuditBtn.disabled = false;
  }
}

// Helper: Resolves exact complete file path for any finding
function getFindingFullPath(f) {
  if (f.absolutePath && f.absolutePath.trim().length > 0) {
    return f.absolutePath;
  }
  const projectPath = state.currentRun?.projectPath || projectPathInput.value.trim();
  if (projectPath && f.filePath) {
    const isWin = projectPath.includes('\\');
    const sep = isWin ? '\\' : '/';
    const cleanProj = projectPath.replace(/[/\\]+$/, '');
    const cleanRel = f.filePath.replace(/^[/\\]+/, '').replace(/[/\\]/g, sep);
    return `${cleanProj}${sep}${cleanRel}`;
  }
  return f.filePath;
}

// Render Master Audit Data
function renderAudit(data) {
  const scores = data.scores || {};
  const web = data.webAudit || {};
  const metrics = web.metrics || {};
  const net = web.requestSummary || {};
  const source = data.sourceAudit || {};
  const findings = source.findings || [];
  const requests = web.requests || [];

  // 1. Scorecards
  ringOverall.textContent = scores.overall ?? '--';
  scorePage.textContent = scores.page ?? '--';
  scoreNetwork.textContent = scores.network ?? '--';
  scoreReact.textContent = scores.reactJs ?? '--';
  scorePython.textContent = scores.python ?? '--';
  scoreCss.textContent = scores.css ?? '--';
  scoreDeps.textContent = scores.dependencies ?? '--';

  colorScore(ringOverall, scores.overall);
  colorScore(scorePage, scores.page);
  colorScore(scoreNetwork, scores.network);
  colorScore(scoreReact, scores.reactJs);
  colorScore(scorePython, scores.python);
  colorScore(scoreCss, scores.css);
  colorScore(scoreDeps, scores.dependencies);

  // 2. Vitals
  vitalTtfb.textContent = metrics.ttfbMs ? `${metrics.ttfbMs} ms` : '--';
  vitalFcp.textContent = metrics.fcpMs ? `${metrics.fcpMs} ms` : '--';
  vitalLcp.textContent = metrics.lcpMs ? `${metrics.lcpMs} ms` : '--';
  vitalCls.textContent = metrics.cls !== undefined && metrics.cls !== null ? metrics.cls : '--';

  // 3. Navigation Timing Bar
  renderNavigationTimeline(metrics);

  // 4. Request Summary Stats
  statTotalReqs.textContent = net.totalRequests ?? 0;
  statTotalSize.textContent = `${net.totalTransferredKb ?? 0} KB`;
  statApiReqs.textContent = net.apiRequestsCount ?? 0;
  statFailedReqs.textContent = net.failedRequestsCount ?? 0;
  statSlowReqs.textContent = net.slowRequestsCount ?? 0;
  statThirdParty.textContent = net.thirdPartyRequestsCount ?? 0;

  // 5. Deductions
  renderDeductions(scores.deductions || {});

  // 6. Counts
  countFindings.textContent = findings.length;
  countRequests.textContent = requests.length;

  // 7. Findings & Lists
  renderFindings(findings);
  renderUnusedCodeReport(source.unusedCodeReport || null);
  renderSpecializedFindings(findings, source.bundleSummary);
  renderRequests(requests);
  renderApiArchitectureInventory(data);

  // 8. Auto-populate project path in settings / backups if available
  if (data.projectPath) {
    loadBackups(data.projectPath);
  }
}

function colorScore(elem, score) {
  if (score === undefined || score === null) return;
  elem.style.color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
}

function renderNavigationTimeline(metrics) {
  navTimingBar.innerHTML = '';
  navTimingLegend.innerHTML = '';

  const total = metrics.navigationDurationMs || 1000;
  const segments = [
    { label: 'DNS', duration: metrics.dnsDurationMs || 0, color: '#38bdf8' },
    { label: 'TCP/TLS', duration: (metrics.connectDurationMs || 0) + (metrics.tlsDurationMs || 0), color: '#818cf8' },
    { label: 'TTFB (Wait)', duration: metrics.ttfbMs || 0, color: '#f59e0b' },
    { label: 'Download', duration: metrics.downloadDurationMs || 0, color: '#10b981' }
  ];

  segments.forEach(seg => {
    const widthPct = Math.max(1, Math.min(100, (seg.duration / total) * 100));
    const div = document.createElement('div');
    div.className = 'timing-segment';
    div.style.width = `${widthPct}%`;
    div.style.backgroundColor = seg.color;
    div.title = `${seg.label}: ${seg.duration}ms`;
    navTimingBar.appendChild(div);

    const legend = document.createElement('div');
    legend.className = 'legend-item';
    legend.innerHTML = `<span class="legend-dot" style="background:${seg.color}"></span>${seg.label}: ${seg.duration}ms`;
    navTimingLegend.appendChild(legend);
  });
}

function renderDeductions(deductions) {
  deductionsList.innerHTML = '';
  let hasDeductions = false;

  for (const [category, items] of Object.entries(deductions)) {
    if (items && items.length > 0) {
      hasDeductions = true;
      const catDiv = document.createElement('div');
      catDiv.style.marginBottom = '10px';
      catDiv.innerHTML = `<strong>${category.toUpperCase()}:</strong>`;
      const ul = document.createElement('ul');
      ul.style.paddingLeft = '20px';
      ul.style.fontSize = '13px';
      ul.style.color = 'var(--text-muted)';
      items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      });
      catDiv.appendChild(ul);
      deductionsList.appendChild(catDiv);
    }
  }

  if (!hasDeductions) {
    deductionsList.innerHTML = '<p class="empty-text" style="color:var(--success)">No score deductions! Outstanding performance and clean code patterns.</p>';
  }
}

// Optimized Findings Rendering showing Exact Complete File Path and One-Click Editor Launcher
function renderFindings(findings) {
  findingsContainer.innerHTML = '';

  const filtered = filterFindings(findings);
  if (filtered.length === 0) {
    findingsContainer.innerHTML = '<p class="empty-text">No findings match the selected filters.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(f => {
    const fullPath = getFindingFullPath(f);
    const card = document.createElement('div');
    card.className = `finding-card ${f.severity}`;
    card.innerHTML = `
      <div class="finding-top">
        <div>
          <span class="badge ${f.severity}">${f.severity.toUpperCase()}</span>
          <span class="badge ${f.confidence}">${f.confidence.replace('_', ' ')}</span>
          <span class="badge" style="background:#1e293b">${f.category}</span>
          <span class="finding-title">${escapeHtml(f.title)}</span>
        </div>
        <button class="btn btn-secondary btn-sm preview-patch-btn" data-id="${f.id}">View Proposed Fix</button>
      </div>

      <div class="finding-file">
        <strong>File:</strong>
        <span class="file-path-container">
          <code class="file-path-link" title="Click to open in editor (VS Code / Notepad)" data-path="${escapeHtml(fullPath)}" data-line="${f.startLine}">${escapeHtml(fullPath)}</code>
          <span class="editor-actions">
            <button type="button" class="btn-editor btn-vscode" title="Open in VS Code at line ${f.startLine}" data-path="${escapeHtml(fullPath)}" data-line="${f.startLine}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px; margin-right:3px"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .32 8.748l3.69 3.253-3.69 3.253a1 1 0 0 0 .007 1.487l1.322 1.202a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>VS Code
            </button>
            <button type="button" class="btn-editor btn-notepad" title="Open in Notepad" data-path="${escapeHtml(fullPath)}" data-line="${f.startLine}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-right:3px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Notepad
            </button>
            <button type="button" class="btn-editor btn-copy-path" title="Copy exact path to clipboard" data-path="${escapeHtml(fullPath)}">
              Copy
            </button>
          </span>
        </span>
        &bull; Lines: <strong>${f.startLine}–${f.endLine}</strong> &bull; Symbol: <code>${escapeHtml(f.symbol)}</code>
      </div>

      <div class="finding-evidence">
        <strong>Detected:</strong> ${escapeHtml(f.evidence)}
      </div>

      <div class="code-diff-container">
        <div class="code-panel">
          <div class="panel-header">Existing Code Block (Lines ${f.startLine}–${f.endLine})</div>
          <pre><code>${escapeHtml(f.existingCode)}</code></pre>
        </div>
        <div class="code-panel">
          <div class="panel-header" style="color:var(--success)">Corrected Replacement Code</div>
          <pre><code>${escapeHtml(f.replacementCode)}</code></pre>
        </div>
      </div>

      <div class="finding-footer">
        <div style="font-size:12px; color:var(--text-muted)">
          <strong>Expected Benefit:</strong> ${escapeHtml(f.whyFixHelps?.expectedBenefit || 'Performance optimization')}
        </div>
        <div>
          <button class="btn btn-primary btn-sm apply-now-btn" data-id="${f.id}">Apply Safe Patch</button>
        </div>
      </div>
    `;

    card.querySelector('.preview-patch-btn').addEventListener('click', () => openPatchPreview(f));
    card.querySelector('.apply-now-btn').addEventListener('click', () => triggerApplyPatch(f));

    fragment.appendChild(card);
  });

  findingsContainer.appendChild(fragment);
}

function renderUnusedCodeReport(report) {
  if (!report || !report.entries || report.entries.length === 0) {
    unusedCodeSummary.innerHTML = '<p class="empty-text">Unused-code analysis is not available for this project yet.</p>';
    unusedCodeReportContainer.innerHTML = '';
    return;
  }

  const summary = report.summary || {};
  const rows = report.entries.slice(0, 12).map(item => {
    const statusClass = item.status === 'unused' ? 'critical' : item.status === 'potentially_unused' ? 'warning' : 'verified';
    return `
      <div class="finding-card ${statusClass}">
        <div class="finding-top">
          <div>
            <span class="badge ${statusClass}">${(item.status || 'used').toUpperCase()}</span>
            <span class="finding-title">${escapeHtml(item.selector || item.name || 'Code block')}</span>
          </div>
          <button class="btn btn-secondary btn-sm unused-fix-btn" data-file="${escapeHtml(item.filePath || '')}" data-status="${escapeHtml(item.status || '')}">Apply Fix</button>
        </div>
        <div class="finding-file"><code>${escapeHtml(item.filePath || 'unknown')}</code></div>
        <div style="font-size:12px; color:var(--text-muted)">Used In: ${escapeHtml((Array.isArray(item.usedIn) ? item.usedIn.join(', ') : item.usedIn) || 'None')} &bull; Occurrences: ${item.occurrences || 0}</div>
        <pre style="margin-top:10px; white-space:pre-wrap; background:var(--bg-soft); padding:12px; border-radius:8px; color:var(--text-main)"><code>${escapeHtml(item.exactCode || '')}</code></pre>
      </div>
    `;
  }).join('');

  unusedCodeSummary.innerHTML = `
    <div class="grid-card full-width" style="margin-bottom:16px;">
      <h3>Unused Code Detection Summary</h3>
      <div class="stat-summary-grid">
        <div class="stat-box"><span class="s-title">Scanned Files</span><span class="s-num">${summary.totalScannedFiles || 0}</span></div>
        <div class="stat-box"><span class="s-title">Used</span><span class="s-num">${summary.totalUsedCodeBlocks || 0}</span></div>
        <div class="stat-box warning"><span class="s-title">Unused</span><span class="s-num">${summary.totalUnusedCodeBlocks || 0}</span></div>
        <div class="stat-box"><span class="s-title">Potential</span><span class="s-num">${summary.totalPotentiallyUnusedCodeBlocks || 0}</span></div>
      </div>
    </div>
  `;

  unusedCodeReportContainer.innerHTML = rows || '<p class="empty-text">No unused code candidates detected for the current project.</p>';

  unusedCodeReportContainer.querySelectorAll('.unused-fix-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const filePath = btn.dataset.file;
      const status = btn.dataset.status;
      if (!filePath || status !== 'unused') {
        alert('Only confirmed unused rules can be auto-removed. Potentially unused entries are not changed automatically.');
        return;
      }
      const projectPath = state.currentRun?.projectPath || projectPathInput.value.trim();
      if (!projectPath) {
        alert('Project path is required to apply the cleanup fix.');
        return;
      }
      const confirmed = confirm(`This will remove only the confirmed unused rules from '${filePath}'. A backup will be created first.`);
      if (!confirmed) return;

      try {
        const selectedEntries = (report.entries || []).filter(item => item.filePath === filePath && item.status === 'unused');
        const res = await fetch('/api/unused-code/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath, filePath, entries: selectedEntries })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Cleanup failed');
        alert(`Cleanup successful. Backup saved at ${data.backupId}.`);
        renderAudit(state.currentRun);
      } catch (err) {
        alert(`Cleanup failed: ${err.message}`);
      }
    });
  });
}

function filterFindings(findings) {
  const query = findingsSearch.value.toLowerCase().trim();
  const sev = severityFilter.value;
  const conf = confidenceFilter.value;
  const cat = categoryFilter.value;

  return findings.filter(f => {
    if (sev !== 'all' && f.severity !== sev) return false;
    if (conf !== 'all' && f.confidence !== conf) return false;
    if (cat !== 'all') {
      const c = f.category.toLowerCase();
      const p = (f.filePath || '').toLowerCase();
      if (cat === 'javascript' && !(c.includes('javascript') || p.endsWith('.js') || p.endsWith('.cjs') || p.endsWith('.mjs'))) return false;
      if (cat === 'jquery' && !c.includes('jquery')) return false;
      if (cat === 'typescript' && !(c.includes('typescript') || p.endsWith('.ts') || p.endsWith('.tsx'))) return false;
      if (cat === 'php' && !(c.includes('php') || p.endsWith('.php') || p.endsWith('.phtml'))) return false;
      if (cat === 'react' && !c.includes('react')) return false;
      if (cat === 'nextjs' && !c.includes('nextjs')) return false;
      if (cat === 'python' && !c.includes('python')) return false;
      if (cat === 'css' && !c.includes('css')) return false;
      if (cat === 'dependency' && !c.includes('dependency')) return false;
    }
    if (query) {
      const fullPath = getFindingFullPath(f);
      const hay = `${f.title} ${f.filePath} ${fullPath} ${f.symbol} ${f.evidence}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

function setupFilters() {
  findingsSearch.addEventListener('input', () => renderFindings(state.currentRun?.sourceAudit?.findings || []));
  severityFilter.addEventListener('change', () => renderFindings(state.currentRun?.sourceAudit?.findings || []));
  confidenceFilter.addEventListener('change', () => renderFindings(state.currentRun?.sourceAudit?.findings || []));
  categoryFilter.addEventListener('change', () => renderFindings(state.currentRun?.sourceAudit?.findings || []));

  requestsSearch.addEventListener('input', () => renderRequests(state.currentRun?.webAudit?.requests || []));
  reqFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      reqFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.requestFilter = chip.dataset.reqFilter;
      renderRequests(state.currentRun?.webAudit?.requests || []);
    });
  });
}

function renderSpecializedFindings(findings, bundleSummary) {
  // 1. JavaScript & jQuery & TypeScript
  const jsList = findings.filter(f => f.category.includes('javascript') || f.category.includes('jquery') || f.category.includes('typescript') || f.filePath.endsWith('.js') || f.filePath.endsWith('.tsx') || f.filePath.endsWith('.ts'));
  if (jsFindingsList) {
    jsFindingsList.innerHTML = jsList.length > 0 ? '' : '<p class="empty-text">No JavaScript, TypeScript, or jQuery bottlenecks identified.</p>';
    jsList.forEach(f => jsFindingsList.appendChild(createSummaryCard(f)));
  }

  // 2. PHP & WordPress
  const phpList = findings.filter(f => f.category.includes('php') || f.filePath.endsWith('.php'));
  if (phpFindingsList) {
    phpFindingsList.innerHTML = phpList.length > 0 ? '' : '<p class="empty-text">No PHP or WordPress bottlenecks identified.</p>';
    phpList.forEach(f => phpFindingsList.appendChild(createSummaryCard(f)));
  }

  // 3. React
  const reactList = findings.filter(f => f.category.startsWith('react') || f.category.startsWith('nextjs'));
  if (reactFindingsList) {
    reactFindingsList.innerHTML = reactList.length > 0 ? '' : '<p class="empty-text">No React or Next.js findings.</p>';
    reactList.forEach(f => reactFindingsList.appendChild(createSummaryCard(f)));
  }

  // 4. Python
  const pythonList = findings.filter(f => f.category.startsWith('python'));
  if (pythonFindingsList) {
    pythonFindingsList.innerHTML = pythonList.length > 0 ? '' : '<p class="empty-text">No Python findings.</p>';
    pythonList.forEach(f => pythonFindingsList.appendChild(createSummaryCard(f)));
  }

  // 5. CSS
  const cssList = findings.filter(f => f.category.startsWith('css'));
  if (cssFindingsList) {
    cssFindingsList.innerHTML = cssList.length > 0 ? '' : '<p class="empty-text">No CSS findings.</p>';
    cssList.forEach(f => cssFindingsList.appendChild(createSummaryCard(f)));
  }

  // 6. Dependencies
  const depList = findings.filter(f => f.category.startsWith('dependency'));
  if (depFindingsList) {
    depFindingsList.innerHTML = depList.length > 0 ? '' : '<p class="empty-text">No dependency findings.</p>';
    depList.forEach(f => depFindingsList.appendChild(createSummaryCard(f)));
  }

  // 7. Bundle Chunks
  if (bundleChunksSection) {
    bundleChunksSection.innerHTML = '';
    if (bundleSummary && bundleSummary.hasBuildArtifacts) {
      bundleChunksSection.innerHTML = `
        <div style="margin-bottom:20px; padding:16px; background:var(--bg-main); border:1px solid var(--border); border-radius:8px">
          <h4>Build Chunks Inspected (${bundleSummary.buildType} - ${bundleSummary.buildDir})</h4>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:10px">Total bundle size: <strong>${bundleSummary.totalBundleSizeKb} KB</strong></p>
          <div style="max-height:200px; overflow-y:auto">
            <table class="data-table">
              <thead><tr><th>Chunk Name</th><th>Size (KB)</th></tr></thead>
              <tbody>
                ${bundleSummary.chunks.slice(0, 20).map(c => `<tr><td><code>${c.name}</code></td><td>${c.sizeKb} KB</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }
}

function createSummaryCard(f) {
  const fullPath = getFindingFullPath(f);
  const div = document.createElement('div');
  div.className = `finding-card ${f.severity}`;
  div.innerHTML = `
    <div class="finding-top">
      <div>
        <span class="badge ${f.severity}">${f.severity.toUpperCase()}</span>
        <span class="finding-title">${escapeHtml(f.title)}</span>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="openPatchPreviewById('${f.id}')">View Fix</button>
    </div>
    <div class="finding-file">
      <span class="file-path-link" title="Click to open in editor" data-path="${escapeHtml(fullPath)}" data-line="${f.startLine}"><code>${escapeHtml(fullPath)}:${f.startLine}</code></span>
      <span class="editor-actions">
        <button type="button" class="btn-editor btn-vscode" title="Open in VS Code" data-path="${escapeHtml(fullPath)}" data-line="${f.startLine}">VS Code</button>
        <button type="button" class="btn-editor btn-notepad" title="Open in Notepad" data-path="${escapeHtml(fullPath)}" data-line="${f.startLine}">Notepad</button>
      </span>
    </div>
    <div style="font-size:13px; color:var(--text-muted)">${escapeHtml(f.evidence)}</div>
  `;
  return div;
}

window.openPatchPreviewById = function(id) {
  const f = state.currentRun?.sourceAudit?.findings?.find(item => item.id === id);
  if (f) openPatchPreview(f);
};

// Render API Architecture Inventory Cards
function renderApiArchitectureInventory(data) {
  if (!apiArchitectureInventory) return;

  const webRequests = data.webAudit?.requests || [];
  const sourceApis = data.analysis?.apiInventory || data.sourceAudit?.apiInventory || [];

  const apiMap = new Map();
  sourceApis.forEach(a => { if (a && a.endpoint) apiMap.set(a.endpoint, a); });
  webRequests.forEach(r => {
    if (r.isApi && r.apiArchitecture && !apiMap.has(r.apiArchitecture.endpoint)) {
      apiMap.set(r.apiArchitecture.endpoint, r.apiArchitecture);
    }
  });

  const allApis = Array.from(apiMap.values());
  if (apiArchSummaryBadge) {
    const multiCount = allApis.filter(a => a.isMultiFile).length;
    apiArchSummaryBadge.textContent = `${allApis.length} APIs (${multiCount} Multi-File)`;
  }

  if (allApis.length === 0) {
    apiArchitectureInventory.innerHTML = '<p class="empty-text">No API endpoints detected in scanned project files.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  allApis.forEach(a => {
    const card = document.createElement('div');
    card.className = `api-arch-card ${a.isMultiFile ? 'multi-file' : 'single-file'}`;

    let filesHtml = '';
    (a.apiFiles || []).forEach((file, idx) => {
      const fullPath = file.absolutePath || file.filePath;
      filesHtml += `
        <div class="api-file-box">
          <div class="api-file-header">
            <div>
              <span class="badge" style="background:#334155; color:#f8fafc">File ${idx + 1}: ${escapeHtml(file.role)}</span>
              <span class="file-path-container">
                <code class="file-path-link" title="Click to open in editor" data-path="${escapeHtml(fullPath)}" data-line="${file.startLine}">${escapeHtml(fullPath)}</code>
                <span class="editor-actions">
                  <button type="button" class="btn-editor btn-vscode" title="Open in VS Code" data-path="${escapeHtml(fullPath)}" data-line="${file.startLine}">VS Code</button>
                  <button type="button" class="btn-editor btn-notepad" title="Open in Notepad" data-path="${escapeHtml(fullPath)}" data-line="${file.startLine}">Notepad</button>
                  <button type="button" class="btn-editor btn-copy-path" title="Copy full path" data-path="${escapeHtml(fullPath)}">Copy</button>
                </span>
              </span>
            </div>
            <span style="font-size:12px; color:var(--text-muted)">Lines <strong>${file.startLine}–${file.endLine}</strong> &bull; Symbol: <code>${escapeHtml(file.symbol || 'API Handler')}</code> &bull; Lang: <strong>${escapeHtml(file.language || 'text')}</strong></span>
          </div>
          <pre class="api-syntax-box"><code>${escapeHtml(file.syntaxSnippet)}</code></pre>
        </div>
      `;
    });

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
        <div>
          <span class="badge" style="background:#065f46; color:#a7f3d0">API ENDPOINT</span>
          <strong style="font-size:16px; color:var(--primary); font-family:var(--font-mono);">${escapeHtml(a.endpoint)}</strong>
        </div>
        <div>
          ${a.isMultiFile
            ? `<span class="badge" style="background:#4338ca; color:#e0e7ff; font-weight:700">MULTI-FILE ARCHITECTURE (${a.filesCount} Files)</span>`
            : `<span class="badge" style="background:#1e3a8a; color:#bfdbfe">SINGLE-FILE IMPLEMENTATION (${a.filesCount} File)</span>`
          }
        </div>
      </div>
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">
        <strong>Architecture Call Chain:</strong> ${escapeHtml(a.architectureSummary || 'Direct endpoint')}
      </div>
      <div class="api-files-list">
        ${filesHtml}
      </div>
    `;

    fragment.appendChild(card);
  });

  apiArchitectureInventory.innerHTML = '';
  apiArchitectureInventory.appendChild(fragment);
}

// Optimized Network Requests Rendering with DocumentFragment & Multi-File Architecture Indicators
function renderRequests(requests) {
  requestsTableBody.innerHTML = '';

  const filtered = filterRequests(requests);
  if (filtered.length === 0) {
    requestsTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No requests match the selected filters.</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(r => {
    let corrPath = '';
    const src = r.correlatedSource || r.apiArchitecture?.primaryFile;
    if (src && (src.absolutePath || src.filePath)) {
      corrPath = src.absolutePath || src.filePath;
      if (state.currentRun?.projectPath && !corrPath.includes(':') && !corrPath.startsWith('/')) {
        const isWin = state.currentRun.projectPath.includes('\\');
        const sep = isWin ? '\\' : '/';
        corrPath = `${state.currentRun.projectPath.replace(/[/\\]+$/, '')}${sep}${corrPath.replace(/[/\\]/g, sep)}`;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(r.method)}</strong></td>
      <td><span class="badge ${r.status >= 400 || r.isFailed ? 'critical' : 'verified'}">${r.status || 'ERR'}</span></td>
      <td class="url-cell" title="${escapeHtml(r.url)}">${escapeHtml(r.url)}</td>
      <td>
        ${corrPath
          ? `<span class="file-path-container">
               <code class="file-path-link" title="Click to open in editor (VS Code / Notepad)" data-path="${escapeHtml(corrPath)}" data-line="${r.correlatedSource?.line || 1}">${escapeHtml(corrPath)}</code>
               <span class="editor-actions">
                 <button type="button" class="btn-editor btn-vscode" title="Open in VS Code" data-path="${escapeHtml(corrPath)}" data-line="${r.correlatedSource?.line || 1}">VS Code</button>
                 <button type="button" class="btn-editor btn-notepad" title="Open in Notepad" data-path="${escapeHtml(corrPath)}" data-line="${r.correlatedSource?.line || 1}">Notepad</button>
                 <button type="button" class="btn-editor btn-copy-path" title="Copy path" data-path="${escapeHtml(corrPath)}">Copy</button>
               </span>
             </span>`
          : '<span style="color:var(--text-dim)">External / Remote Source</span>'
        }
      </td>
      <td>
        ${r.isMultiFile
          ? `<button type="button" class="btn-editor" style="background:#4338ca; color:#e0e7ff; border-color:#6366f1; cursor:pointer;" onclick="openApiArchitectureModal('${escapeHtml(r.url)}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px; margin-right:3px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>Multi-File (${r.apiFilesCount})</button>`
          : (r.isApi
              ? `<button type="button" class="btn-editor" style="background:#065f46; color:#a7f3d0; border-color:#10b981; cursor:pointer;" onclick="openApiArchitectureModal('${escapeHtml(r.url)}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px; margin-right:3px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>Single File (${r.apiFilesCount || 1})</button>`
              : `<span class="badge" style="background:#1e293b; color:#94a3b8">${escapeHtml(r.resourceType)}</span>`)
        }
      </td>
      <td>${r.durationMs} ms</td>
      <td>${Math.round(r.transferSizeBytes / 1024)} KB</td>
    `;
    fragment.appendChild(tr);
  });

  requestsTableBody.appendChild(fragment);
}

function filterRequests(requests) {
  const query = requestsSearch.value.toLowerCase().trim();
  const type = state.requestFilter;

  return requests.filter(r => {
    if (type === 'api' && !r.isApi) return false;
    if (type === 'slow' && !r.isSlow) return false;
    if (type === 'failed' && !r.isFailed) return false;
    if (type === 'third-party' && !r.isThirdParty) return false;

    if (query && !r.url.toLowerCase().includes(query)) return false;
    return true;
  });
}

// Modal view for specific API architecture and syntax blocks
window.openApiArchitectureModal = function(urlOrEndpoint) {
  let targetEndpoint = urlOrEndpoint;
  try {
    targetEndpoint = new URL(urlOrEndpoint).pathname;
  } catch {}

  const sourceApis = state.currentRun?.analysis?.apiInventory || state.currentRun?.sourceAudit?.apiInventory || [];
  const webRequests = state.currentRun?.webAudit?.requests || [];

  let match = sourceApis.find(a => a.endpoint === targetEndpoint || targetEndpoint.includes(a.endpoint));
  if (!match) {
    const reqMatch = webRequests.find(r => r.url === urlOrEndpoint || r.url.includes(targetEndpoint));
    match = reqMatch?.apiArchitecture;
  }

  if (!match) {
    showToast(`No local source code found for endpoint: ${targetEndpoint}`, 4000);
    return;
  }

  modalTitle.textContent = `API Architecture & Code Syntax: ${match.endpoint}`;

  let filesHtml = '';
  (match.apiFiles || []).forEach((file, idx) => {
    const fullPath = file.absolutePath || file.filePath;
    filesHtml += `
      <div class="api-file-box" style="margin-bottom:14px;">
        <div class="api-file-header">
          <div>
            <span class="badge" style="background:#334155; color:#f8fafc">File ${idx + 1}: ${escapeHtml(file.role)}</span>
            <span class="file-path-container">
              <code class="file-path-link" title="Click to open in editor" data-path="${escapeHtml(fullPath)}" data-line="${file.startLine}">${escapeHtml(fullPath)}</code>
              <span class="editor-actions">
                <button type="button" class="btn-editor btn-vscode" data-path="${escapeHtml(fullPath)}" data-line="${file.startLine}">VS Code</button>
                <button type="button" class="btn-editor btn-notepad" data-path="${escapeHtml(fullPath)}" data-line="${file.startLine}">Notepad</button>
              </span>
            </span>
          </div>
          <span style="font-size:12px; color:var(--text-muted)">Lines <strong>${file.startLine}–${file.endLine}</strong></span>
        </div>
        <pre class="api-syntax-box"><code>${escapeHtml(file.syntaxSnippet)}</code></pre>
      </div>
    `;
  });

  modalBody.innerHTML = `
    <div style="margin-bottom:14px; padding:12px; background:var(--bg-main); border:1px solid var(--border); border-radius:6px;">
      <div style="font-weight:700; color:var(--primary); margin-bottom:4px;">
        ${match.isMultiFile ? 'Multi-File Architecture (Split across ' + match.filesCount + ' files)' : 'Single-File Endpoint Implementation'}
      </div>
      <div style="font-size:13px; color:var(--text-muted);">
        <strong>Call Chain:</strong> ${escapeHtml(match.architectureSummary || 'Direct endpoint')}
      </div>
    </div>
    <div style="max-height:60vh; overflow-y:auto;">
      ${filesHtml}
    </div>
  `;

  modalFooter.innerHTML = `
    <button type="button" class="btn btn-secondary" onclick="document.getElementById('modalBackdrop').classList.add('hidden')">Close</button>
  `;

  modalBackdrop.classList.remove('hidden');
};

// Editor Click Delegation & Opener
function setupEditorClickDelegation() {
  document.addEventListener('click', (e) => {
    // Click on file path link
    const pathLink = e.target.closest('.file-path-link');
    if (pathLink) {
      const filePath = pathLink.dataset.path;
      const line = pathLink.dataset.line || 1;
      openInEditor(filePath, line, 'auto');
      return;
    }

    // Click on VS Code button
    const vsBtn = e.target.closest('.btn-vscode');
    if (vsBtn) {
      const filePath = vsBtn.dataset.path;
      const line = vsBtn.dataset.line || 1;
      openInEditor(filePath, line, 'vscode');
      return;
    }

    // Click on Notepad button
    const npBtn = e.target.closest('.btn-notepad');
    if (npBtn) {
      const filePath = npBtn.dataset.path;
      const line = npBtn.dataset.line || 1;
      openInEditor(filePath, line, 'notepad');
      return;
    }

    // Click on Copy Path button
    const copyBtn = e.target.closest('.btn-copy-path');
    if (copyBtn) {
      const filePath = copyBtn.dataset.path;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(filePath).then(() => {
          showToast('Copied full path to clipboard!');
        }).catch(() => {
          prompt('Copy complete file path:', filePath);
        });
      } else {
        prompt('Copy complete file path:', filePath);
      }
      return;
    }
  });
}

async function openInEditor(filePath, line, editor = 'auto') {
  if (!filePath) return;
  const editorName = editor === 'notepad' ? 'Notepad' : (editor === 'vscode' ? 'VS Code' : 'editor');
  showToast(`Opening in ${editorName}...`);

  try {
    const res = await fetch('/api/open-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, line, editor })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'File opened successfully!');
    } else {
      showToast(`Notice: ${data.error}`, 4000);
      // Secondary fallback to browser protocol for VS Code
      if (editor === 'vscode' || editor === 'auto') {
        const cleanForUrl = filePath.replace(/\\/g, '/');
        window.location.href = `vscode://file/${cleanForUrl}:${line}`;
      }
    }
  } catch (err) {
    if (editor === 'vscode' || editor === 'auto') {
      const cleanForUrl = filePath.replace(/\\/g, '/');
      window.location.href = `vscode://file/${cleanForUrl}:${line}`;
    } else {
      showToast(`Failed to open: ${err.message}`, 4000);
    }
  }
}

// Toast notification helper
function showToast(message, duration = 3000) {
  let toast = document.getElementById('auditorToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'auditorToast';
    toast.className = 'auditor-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Patch Preview & Application
async function openPatchPreview(finding) {
  state.activePatchFinding = finding;
  switchTab('tabPatching');

  const fullPath = getFindingFullPath(finding);

  patchFileMeta.innerHTML = `Preparing unified diff for <code>${escapeHtml(fullPath)}</code> (Lines ${finding.startLine}–${finding.endLine})...`;
  patchDiffViewer.textContent = 'Generating unified diff...';
  applyPatchBtn.disabled = true;
  downloadPatchBtn.disabled = true;

  const projectPath = state.currentRun?.projectPath || projectPathInput.value.trim();

  try {
    const res = await fetch('/api/patch/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, finding })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    patchFileMeta.innerHTML = `
      <strong>File:</strong>
      <span class="file-path-container">
        <code class="file-path-link" title="Click to open in editor" data-path="${escapeHtml(fullPath)}" data-line="${finding.startLine}">${escapeHtml(fullPath)}</code>
        <span class="editor-actions">
          <button type="button" class="btn-editor btn-vscode" title="Open in VS Code" data-path="${escapeHtml(fullPath)}" data-line="${finding.startLine}">VS Code</button>
          <button type="button" class="btn-editor btn-notepad" title="Open in Notepad" data-path="${escapeHtml(fullPath)}" data-line="${finding.startLine}">Notepad</button>
        </span>
      </span>
      &bull; Replace lines <strong>${finding.startLine}–${finding.endLine}</strong>
      &bull; Status: ${data.isStale ? '<span class="badge critical">STALE ON DISK</span>' : '<span class="badge verified">READY TO APPLY</span>'}
    `;

    patchDiffViewer.textContent = data.unifiedDiff;
    applyPatchBtn.disabled = data.isStale;
    downloadPatchBtn.disabled = false;

    downloadPatchBtn.onclick = () => {
      downloadFile(`${finding.symbol || 'patch'}.patch`, data.unifiedDiff, 'text/x-diff');
    };
  } catch (err) {
    patchFileMeta.textContent = `Error: ${err.message}`;
    patchDiffViewer.textContent = err.message;
  }
}

applyPatchBtn.addEventListener('click', () => {
  if (state.activePatchFinding) {
    triggerApplyPatch(state.activePatchFinding);
  }
});

async function triggerApplyPatch(finding) {
  const projectPath = state.currentRun?.projectPath || projectPathInput.value.trim();
  if (!projectPath) {
    alert('Project path is required to apply patches.');
    return;
  }

  const fullPath = getFindingFullPath(finding);
  const confirmed = confirm(`Are you sure you want to apply the proposed patch to '${fullPath}'? A backup will automatically be saved in .auditor-backups/ first.`);
  if (!confirmed) return;

  try {
    const res = await fetch('/api/patch/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, finding })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert(`Patch applied successfully! Backup preserved at '${data.backupId}'.`);
    loadBackups(projectPath);
  } catch (err) {
    alert(`Failed to apply patch: ${err.message}`);
  }
}

async function loadBackups(projectPath) {
  backupsList.innerHTML = '<p class="empty-text">Backups available in <code>' + escapeHtml(projectPath) + '/.auditor-backups/</code></p>';
}

// Comparison
async function loadSavedRuns() {
  try {
    const res = await fetch('/api/runs');
    const data = await res.json();
    state.runsList = data.runs || [];

    compareRunA.innerHTML = '';
    compareRunB.innerHTML = '';

    state.runsList.forEach(run => {
      const optA = document.createElement('option');
      optA.value = run.id;
      optA.textContent = `${run.id} (${run.timestamp.slice(0, 16)}) - Score: ${run.overallScore}`;
      compareRunA.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = run.id;
      optB.textContent = `${run.id} (${run.timestamp.slice(0, 16)}) - Score: ${run.overallScore}`;
      compareRunB.appendChild(optB);
    });

    if (state.runsList.length >= 2) {
      compareRunB.selectedIndex = 1;
    }
  } catch {}
}

compareBtn.addEventListener('click', async () => {
  const runAId = compareRunA.value;
  const runBId = compareRunB.value;

  if (!runAId || !runBId) {
    alert('Please select two runs to compare.');
    return;
  }

  try {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runAId, runBId })
    });

    const diff = await res.json();
    if (!res.ok) throw new Error(diff.error);

    renderComparison(diff);
  } catch (err) {
    alert(`Comparison failed: ${err.message}`);
  }
});

function renderComparison(diff) {
  const row = (name, item, suffix = '') => {
    const color = item.status === 'better' ? 'var(--success)' : item.status === 'worse' ? 'var(--danger)' : 'var(--text-muted)';
    return `
      <tr>
        <td><strong>${name}</strong></td>
        <td>${item.valA}${suffix}</td>
        <td>${item.valB}${suffix}</td>
        <td style="color:${color}; font-weight:bold">${item.delta > 0 ? '+' : ''}${item.delta}${suffix} (${item.pct}%)</td>
      </tr>
    `;
  };

  comparisonResults.innerHTML = `
    <div class="grid-card full-width" style="margin-top:20px">
      <h3>Run Delta Comparison: ${escapeHtml(diff.runAId)} vs ${escapeHtml(diff.runBId)}</h3>
      <table class="data-table">
        <thead><tr><th>Metric</th><th>Baseline (A)</th><th>Current (B)</th><th>Delta</th></tr></thead>
        <tbody>
          ${row('Overall Score', diff.scores.overall, ' pts')}
          ${row('Page Perf Score', diff.scores.page, ' pts')}
          ${row('Network Score', diff.scores.network, ' pts')}
          ${row('Time to First Byte (TTFB)', diff.webMetrics.ttfbMs, ' ms')}
          ${row('First Contentful Paint (FCP)', diff.webMetrics.fcpMs, ' ms')}
          ${row('Largest Contentful Paint (LCP)', diff.webMetrics.lcpMs, ' ms')}
          ${row('Cumulative Layout Shift (CLS)', diff.webMetrics.cls)}
          ${row('Total HTTP Requests', diff.network.totalRequests)}
          ${row('API Requests Count', diff.network.apiRequestsCount)}
          ${row('Payload Transferred', diff.network.totalTransferredKb, ' KB')}
          ${row('Total Code Bottlenecks', diff.findings.totalFindings)}
        </tbody>
      </table>
    </div>
  `;
}

// Exports
function setupExports() {
  const getRunId = () => state.currentRun?.id;

  document.getElementById('btnExportHtml').addEventListener('click', () => {
    const id = getRunId();
    if (!id) return alert('Run an audit first.');
    window.open(`/api/export/${id}/html`, '_blank');
  });

  document.getElementById('btnExportJson').addEventListener('click', () => {
    const id = getRunId();
    if (!id) return alert('Run an audit first.');
    window.open(`/api/export/${id}/json`, '_blank');
  });

  document.getElementById('btnExportCsvReqs').addEventListener('click', () => {
    const id = getRunId();
    if (!id) return alert('Run an audit first.');
    window.open(`/api/export/${id}/csv-requests`, '_blank');
  });

  document.getElementById('btnExportCsvFindings').addEventListener('click', () => {
    const id = getRunId();
    if (!id) return alert('Run an audit first.');
    window.open(`/api/export/${id}/csv-findings`, '_blank');
  });

  document.getElementById('btnExportPdf').addEventListener('click', () => {
    const id = getRunId();
    if (!id) return alert('Run an audit first.');
    window.open(`/api/export/${id}/pdf`, '_blank');
  });
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Single-pass high performance HTML escape
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const HTML_ESCAPE_REGEX = /[&<>"']/g;

function escapeHtml(str) {
  return str == null ? '' : String(str).replace(HTML_ESCAPE_REGEX, char => HTML_ESCAPES[char]);
}
