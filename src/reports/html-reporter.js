/**
 * Standalone HTML Report Generator
 * Builds a fully self-contained, responsive, printable HTML audit report.
 * Includes complete source findings with absolute paths, and comprehensive API Architecture & Code Syntax Reports
 * indicating whether each API implementation is broken across multiple files.
 */

class HtmlReporter {
  static generate(auditRun) {
    const scores = auditRun.scores || {};
    const web = auditRun.webAudit || {};
    const metrics = web.metrics || {};
    const net = web.requestSummary || {};
    const source = auditRun.sourceAudit || {};
    const findings = source.findings || [];
    const requests = web.requests || [];
    const apiInventory = auditRun.analysis?.apiInventory || source.apiInventory || [];

    const escapeHtml = (str) => String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // 1. Findings Section
    const findingsHtml = findings.map(f => {
      const displayPath = f.absolutePath || f.filePath;
      return `
      <div class="finding-card ${f.severity}">
        <div class="finding-header">
          <span class="badge ${f.severity}">${escapeHtml(f.severity.toUpperCase())}</span>
          <span class="badge confidence-${f.confidence}">${escapeHtml(f.confidence)}</span>
          <span class="finding-title">${escapeHtml(f.title)}</span>
        </div>
        <div class="finding-meta" style="margin: 8px 0;">
          <strong>File:</strong> <code>${escapeHtml(displayPath)}</code> (Lines ${f.startLine}–${f.endLine}) &bull;
          <strong>Symbol:</strong> <code>${escapeHtml(f.symbol)}</code>
        </div>
        <p class="finding-evidence"><strong>Evidence:</strong> ${escapeHtml(f.evidence)}</p>

        <div class="code-comparison">
          <div class="code-box original">
            <div class="code-label">Existing Code (Lines ${f.startLine}–${f.endLine})</div>
            <pre><code>${escapeHtml(f.existingCode)}</code></pre>
          </div>
          <div class="code-box replacement">
            <div class="code-label">Corrected Replacement Code</div>
            <pre><code>${escapeHtml(f.replacementCode)}</code></pre>
          </div>
        </div>

        <div class="why-helps">
          <strong>Why this fix helps:</strong> ${escapeHtml(f.whyFixHelps?.cause || '')}
          <em>${escapeHtml(f.whyFixHelps?.expectedBenefit || '')}</em>
        </div>
      </div>
    `;
    }).join('\n');

    // 2. Multi-File API Architecture Section
    const apiMap = new Map();
    for (const a of apiInventory) {
      if (a && a.endpoint) apiMap.set(a.endpoint, a);
    }
    for (const r of requests) {
      if (r.isApi && r.apiArchitecture && !apiMap.has(r.apiArchitecture.endpoint)) {
        apiMap.set(r.apiArchitecture.endpoint, r.apiArchitecture);
      }
    }

    const allApis = Array.from(apiMap.values());
    const apiReportHtml = allApis.length > 0 ? allApis.map(a => `
      <div class="api-arch-card" style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:18px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div>
            <span class="badge" style="background:#065f46; color:#a7f3d0">API ENDPOINT</span>
            <strong style="font-size:16px; color:var(--primary); font-family:Consolas, monospace;">${escapeHtml(a.endpoint)}</strong>
          </div>
          <div>
            ${a.isMultiFile
              ? `<span class="badge" style="background:#4338ca; color:#e0e7ff; font-weight:700">MULTI-FILE ARCHITECTURE (${a.filesCount} Files)</span>`
              : `<span class="badge" style="background:#1e3a8a; color:#bfdbfe">SINGLE-FILE IMPLEMENTATION (${a.filesCount} File)</span>`
            }
          </div>
        </div>

        <div style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">
          <strong>Architecture Call Chain:</strong> ${escapeHtml(a.architectureSummary || 'Direct endpoint')}
        </div>

        <div class="api-files-grid" style="display:flex; flex-direction:column; gap:12px;">
          ${(a.apiFiles || []).map((file, idx) => `
            <div style="background:#090d16; border:1px solid var(--border); border-radius:6px; padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                <div>
                  <span class="badge" style="background:#334155; color:#f8fafc">File ${idx + 1}: ${escapeHtml(file.role)}</span>
                  <code style="color:var(--primary); font-size:13px; font-weight:600;">${escapeHtml(file.absolutePath || file.filePath)}</code>
                </div>
                <span style="font-size:12px; color:var(--text-muted)">Lines ${file.startLine}–${file.endLine} &bull; Symbol: <strong>${escapeHtml(file.symbol || 'Handler')}</strong> &bull; Language: <strong>${escapeHtml(file.language || 'text')}</strong></span>
              </div>
              <pre style="margin:0; background:#040711; padding:12px; border-radius:4px; font-size:12px; overflow-x:auto; font-family:Consolas, monospace; line-height:1.45;"><code>${escapeHtml(file.syntaxSnippet)}</code></pre>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('') : '<p style="color:var(--text-muted)">No API endpoints detected in project files.</p>';

    // 3. Network Requests Table
    const requestsHtml = requests.slice(0, 150).map(r => `
      <tr>
        <td><code>${escapeHtml(r.method)}</code></td>
        <td class="url-cell" title="${escapeHtml(r.url)}">${escapeHtml(r.url)}</td>
        <td><span class="status-badge ${r.status >= 400 ? 'error' : 'ok'}">${r.status || 'ERR'}</span></td>
        <td>${r.durationMs} ms</td>
        <td>${Math.round(r.transferSizeBytes / 1024)} KB</td>
        <td>
          ${r.isMultiFile
            ? `<span class="badge" style="background:#4338ca; color:#e0e7ff" title="${escapeHtml(r.apiArchitecture?.architectureSummary || '')}">Multi-File (${r.apiFilesCount})</span>`
            : (r.isApi ? `<span class="badge api">Single File (${r.apiFilesCount || 1})</span>` : escapeHtml(r.resourceType))
          }
        </td>
        <td>${r.correlatedSource ? `<code>${escapeHtml(r.correlatedSource.absolutePath || r.correlatedSource.filePath)}:${r.correlatedSource.line}</code>` : '-'}</td>
      </tr>
    `).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit Report — ${escapeHtml(auditRun.id)}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      margin: 0;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header { border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px; }
    h1 { margin: 0 0 8px 0; font-size: 26px; color: var(--primary); }
    .meta-bar { color: var(--text-muted); font-size: 14px; }
    .scorecard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .score-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .score-value { font-size: 32px; font-weight: bold; margin: 8px 0; color: var(--primary); }
    .score-label { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 32px;
    }
    .vital-item {
      background: #111827;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
    }
    .vital-item strong { display: block; font-size: 13px; color: var(--text-muted); }
    .vital-item span { font-size: 20px; font-weight: 600; color: #fff; }

    h2 { font-size: 20px; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 36px; }

    .finding-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-left: 4px solid var(--primary);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 20px;
    }
    .finding-card.critical { border-left-color: var(--danger); }
    .finding-card.high { border-left-color: var(--warning); }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      margin-right: 8px;
    }
    .badge.critical { background: #7f1d1d; color: #fca5a5; }
    .badge.high { background: #78350f; color: #fde68a; }
    .badge.medium { background: #1e3a8a; color: #bfdbfe; }
    .badge.low { background: #1f2937; color: #9ca3af; }
    .badge.api { background: #064e3b; color: #6ee7b7; }
    .code-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 14px 0;
    }
    .code-box {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    .code-label {
      background: #1e293b;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    pre {
      margin: 0;
      padding: 12px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .why-helps {
      background: #0d1e33;
      border: 1px solid #1e3a8a;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 12px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #111827; color: var(--text-muted); }
    .url-cell {
      max-width: 340px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-badge.ok { color: var(--success); font-weight: bold; }
    .status-badge.error { color: var(--danger); font-weight: bold; }

    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .finding-card, .score-card, .code-box, .api-arch-card { border-color: #ccc; background: #fff; color: #000; }
      .code-comparison { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Local Project Performance &amp; API Auditor Pro v3.0</h1>
      <div class="meta-bar">
        <strong>Audit ID:</strong> ${escapeHtml(auditRun.id)} &bull;
        <strong>Date:</strong> ${escapeHtml(auditRun.timestamp)} &bull;
        ${auditRun.targetUrl ? `<strong>Target URL:</strong> ${escapeHtml(auditRun.targetUrl)} &bull;` : ''}
        ${auditRun.projectPath ? `<strong>Project:</strong> ${escapeHtml(auditRun.projectPath)}` : ''}
      </div>
    </header>

    <div class="scorecard-grid">
      <div class="score-card">
        <div class="score-label">Overall Score</div>
        <div class="score-value">${scores.overall || 0}</div>
      </div>
      <div class="score-card">
        <div class="score-label">Page Perf</div>
        <div class="score-value">${scores.page || 0}</div>
      </div>
      <div class="score-card">
        <div class="score-label">Network &amp; API</div>
        <div class="score-value">${scores.network || 0}</div>
      </div>
      <div class="score-card">
        <div class="score-label">JS / TS / jQuery</div>
        <div class="score-value">${scores.reactJs || 0}</div>
      </div>
      <div class="score-card">
        <div class="score-label">Backend (PHP/Py)</div>
        <div class="score-value">${scores.python || 0}</div>
      </div>
      <div class="score-card">
        <div class="score-label">CSS &amp; Styling</div>
        <div class="score-value">${scores.css || 0}</div>
      </div>
      <div class="score-card">
        <div class="score-label">Dependencies</div>
        <div class="score-value">${scores.dependencies || 0}</div>
      </div>
    </div>

    ${web.metrics ? `
    <h2>Core Web Vitals &amp; Navigation Metrics</h2>
    <div class="vitals-grid">
      <div class="vital-item"><strong>Time to First Byte (TTFB)</strong><span>${metrics.ttfbMs || 0} ms</span></div>
      <div class="vital-item"><strong>First Contentful Paint (FCP)</strong><span>${metrics.fcpMs || 0} ms</span></div>
      <div class="vital-item"><strong>Largest Contentful Paint (LCP)</strong><span>${metrics.lcpMs || 0} ms</span></div>
      <div class="vital-item"><strong>Cumulative Layout Shift (CLS)</strong><span>${metrics.cls ?? 0}</span></div>
      <div class="vital-item"><strong>Navigation Duration</strong><span>${metrics.navigationDurationMs || 0} ms</span></div>
      <div class="vital-item"><strong>Total Requests</strong><span>${net.totalRequests || 0}</span></div>
      <div class="vital-item"><strong>Transferred Payload</strong><span>${net.totalTransferredKb || 0} KB</span></div>
      <div class="vital-item"><strong>API Requests</strong><span>${net.apiRequestsCount || 0}</span></div>
    </div>
    ` : ''}

    <h2>Exact Source Code Bottlenecks (${findings.length})</h2>
    ${findings.length > 0 ? findingsHtml : '<p style="color:var(--text-muted)">No source bottlenecks identified in scanned files.</p>'}

    <h2>API Implementation &amp; Multi-File Architecture Report (${allApis.length} Endpoints)</h2>
    <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
      Traces exact source code syntax and complete absolute file paths for every API endpoint, detailing whether the implementation is contained in a single file or split across multiple files (Client Caller, Route Handler, Controller, Service, Database Model).
    </p>
    ${apiReportHtml}

    ${requests.length > 0 ? `
    <h2>Network &amp; API Requests Inventory (${requests.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>URL</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Size</th>
          <th>Architecture Status</th>
          <th>Primary Correlated File &amp; Line</th>
        </tr>
      </thead>
      <tbody>
        ${requestsHtml}
      </tbody>
    </table>
    ` : ''}
  </div>
</body>
</html>`;
  }
}

module.exports = HtmlReporter;
