/**
 * Run Comparator Engine
 * Calculates deltas, percentage changes, and improvement indicators between two audit runs.
 */

class RunComparator {
  /**
   * Compares baseline run (A) with optimized run (B)
   * @param {Object} runA Baseline
   * @param {Object} runB Current/Optimized
   */
  static compare(runA, runB) {
    if (!runA || !runB) {
      throw new Error('Both run A and run B are required for comparison.');
    }

    const metricsA = runA.webAudit?.metrics || {};
    const metricsB = runB.webAudit?.metrics || {};

    const netA = runA.webAudit?.requestSummary || {};
    const netB = runB.webAudit?.requestSummary || {};

    const scoresA = runA.scores || {};
    const scoresB = runB.scores || {};

    const findingsA = runA.sourceAudit?.findings || [];
    const findingsB = runB.sourceAudit?.findings || [];

    const diff = (valA, valB, lowerIsBetter = true) => {
      const a = Number(valA || 0);
      const b = Number(valB || 0);
      const delta = Number((b - a).toFixed(2));
      const pct = a !== 0 ? Number(((delta / a) * 100).toFixed(1)) : 0;

      let status = 'neutral';
      if (delta !== 0) {
        if (lowerIsBetter) {
          status = delta < 0 ? 'better' : 'worse';
        } else {
          status = delta > 0 ? 'better' : 'worse';
        }
      }

      return { valA: a, valB: b, delta, pct, status };
    };

    return {
      runAId: runA.id,
      runBId: runB.id,
      comparedAt: new Date().toISOString(),
      scores: {
        overall: diff(scoresA.overall, scoresB.overall, false),
        page: diff(scoresA.page, scoresB.page, false),
        network: diff(scoresA.network, scoresB.network, false),
        reactJs: diff(scoresA.reactJs, scoresB.reactJs, false),
        python: diff(scoresA.python, scoresB.python, false),
        css: diff(scoresA.css, scoresB.css, false),
        dependencies: diff(scoresA.dependencies, scoresB.dependencies, false)
      },
      webMetrics: {
        ttfbMs: diff(metricsA.ttfbMs, metricsB.ttfbMs, true),
        fcpMs: diff(metricsA.fcpMs, metricsB.fcpMs, true),
        lcpMs: diff(metricsA.lcpMs, metricsB.lcpMs, true),
        cls: diff(metricsA.cls, metricsB.cls, true),
        navigationDurationMs: diff(metricsA.navigationDurationMs, metricsB.navigationDurationMs, true)
      },
      network: {
        totalRequests: diff(netA.totalRequests, netB.totalRequests, true),
        apiRequestsCount: diff(netA.apiRequestsCount, netB.apiRequestsCount, true),
        failedRequestsCount: diff(netA.failedRequestsCount, netB.failedRequestsCount, true),
        slowRequestsCount: diff(netA.slowRequestsCount, netB.slowRequestsCount, true),
        totalTransferredKb: diff(netA.totalTransferredKb, netB.totalTransferredKb, true)
      },
      findings: {
        totalFindings: diff(findingsA.length, findingsB.length, true),
        critical: diff(
          findingsA.filter(f => f.severity === 'critical').length,
          findingsB.filter(f => f.severity === 'critical').length,
          true
        ),
        high: diff(
          findingsA.filter(f => f.severity === 'high').length,
          findingsB.filter(f => f.severity === 'high').length,
          true
        )
      }
    };
  }
}

module.exports = RunComparator;
