/**
 * Master Audit Runner Orchestrator
 * Coordinates browser auditing, source scanning, API correlation, scoring, and storage.
 * Aggregates multi-file API architecture and code syntax blocks across runs.
 */

const fs = require('fs');
const path = require('path');
const PlaywrightAuditor = require('../browser/playwright-auditor');
const ProjectScanner = require('../source-analysis/project-scanner');
const CallSourceCorrelator = require('../network/call-source-correlator');
const WaterfallDetector = require('../network/waterfall-detector');
const ScoringEngine = require('./scoring');
const { validateUrl } = require('../security/url-sanitizer');

class AuditRunner {
  constructor(storageDir) {
    this.storageDir = storageDir || path.join(__dirname, '..', '..', 'data', 'audits');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Runs a complete combined audit: Website + Local Source Project
   * @param {Object} options 
   */
  async runFullAudit(options = {}) {
    const runId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const targetUrl = options.targetUrl ? options.targetUrl.trim() : null;
    const projectPath = options.projectPath ? options.projectPath.trim() : null;
    const repeatRuns = Math.min(5, Math.max(1, Number(options.repeatRuns) || 1));

    let webAudit = null;
    let sourceAudit = null;

    // 1. Run Website Performance Audit if URL provided
    if (targetUrl) {
      const val = validateUrl(targetUrl);
      if (!val.valid) {
        throw new Error(val.error);
      }

      // If repeat runs requested, execute multiple and compute median
      if (repeatRuns > 1) {
        const runResults = [];
        for (let r = 0; r < repeatRuns; r++) {
          const res = await PlaywrightAuditor.auditUrl(targetUrl, options);
          runResults.push(res);
        }
        webAudit = this._aggregateRepeatedRuns(runResults);
      } else {
        webAudit = await PlaywrightAuditor.auditUrl(targetUrl, options);
      }
    }

    // 2. Run Local Source Code Project Scan if path provided
    if (projectPath) {
      sourceAudit = ProjectScanner.scan(projectPath);
    }

    // 3. Correlate runtime network requests with source files & trace multi-file architecture
    if (webAudit && sourceAudit) {
      webAudit.requests = CallSourceCorrelator.correlate(
        webAudit.requests,
        sourceAudit.projectRoot,
        sourceAudit.scannedFiles
      );
    }

    // 4. Waterfall & Duplicate Detection
    let duplicates = [];
    let waterfalls = [];
    if (webAudit && webAudit.requests) {
      duplicates = WaterfallDetector.findDuplicates(webAudit.requests);
      waterfalls = WaterfallDetector.findWaterfalls(webAudit.requests);
    }

    // 5. Compute transparent explainable scores
    const scores = ScoringEngine.calculateScores(
      webAudit?.metrics,
      webAudit?.requestSummary,
      sourceAudit?.findings || [],
      sourceAudit?.bundleSummary || {}
    );

    const completeRun = {
      id: runId,
      timestamp: new Date().toISOString(),
      targetUrl,
      projectPath,
      options: {
        isMobile: Boolean(options.isMobile),
        warmCache: Boolean(options.warmCache),
        repeatRuns
      },
      scores,
      webAudit,
      sourceAudit,
      analysis: {
        duplicateRequests: duplicates,
        sequentialWaterfalls: waterfalls,
        apiInventory: sourceAudit?.apiInventory || []
      }
    };

    // Save run to local disk
    try {
      const filePath = path.join(this.storageDir, `${runId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(completeRun, null, 2), 'utf8');
    } catch {}

    return completeRun;
  }

  /**
   * Computes median metrics from repeated runs
   */
  _aggregateRepeatedRuns(runs) {
    const base = runs[0];
    const metricsKeys = ['dnsDurationMs', 'connectDurationMs', 'tlsDurationMs', 'ttfbMs', 'downloadDurationMs', 'navigationDurationMs', 'fcpMs', 'lcpMs', 'cls'];
    const aggregatedMetrics = { ...base.metrics };

    for (const key of metricsKeys) {
      const values = runs.map(r => r.metrics[key] || 0).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      aggregatedMetrics[key] = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    }

    return {
      ...base,
      repeatedRunsCount: runs.length,
      metrics: aggregatedMetrics
    };
  }

  /**
   * Retrieves an audit run by ID
   * @param {string} id 
   */
  getRun(id) {
    const cleanId = path.basename(id);
    const filePath = path.join(this.storageDir, `${cleanId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
  }

  /**
   * Lists all saved runs
   */
  listRuns() {
    if (!fs.existsSync(this.storageDir)) return [];
    const files = fs.readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
    const runs = [];

    for (const f of files) {
      try {
        const full = path.join(this.storageDir, f);
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        runs.push({
          id: data.id,
          timestamp: data.timestamp,
          targetUrl: data.targetUrl,
          projectPath: data.projectPath,
          overallScore: data.scores?.overall || 0,
          totalFindings: data.sourceAudit?.findings?.length || 0,
          requestsCount: data.webAudit?.requests?.length || 0
        });
      } catch {}
    }

    // Sort newest first
    return runs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

module.exports = AuditRunner;
