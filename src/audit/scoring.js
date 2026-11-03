/**
 * Transparent Performance Scoring Engine
 * Computes deterministic, fully explainable scores (0-100) with detailed deduction breakdowns.
 * Accounts for React, Next.js, Plain JS, TypeScript/TSX, jQuery, PHP/WordPress, Python, CSS, and dependencies.
 */

class ScoringEngine {
  /**
   * Computes comprehensive performance and code quality scores
   * @param {Object} webMetrics 
   * @param {Object} requestSummary 
   * @param {Array<Object>} findings 
   * @param {Object} bundleSummary 
   */
  static calculateScores(webMetrics = {}, requestSummary = {}, findings = [], bundleSummary = {}) {
    const deductions = {
      page: [],
      network: [],
      reactJs: [],
      python: [],
      css: [],
      dependencies: []
    };

    // 1. Page Performance Score (Max 100)
    let pageScore = 100;
    const ttfb = webMetrics.ttfbMs || 0;
    const fcp = webMetrics.fcpMs || 0;
    const lcp = webMetrics.lcpMs || 0;
    const cls = webMetrics.cls || 0;

    if (ttfb > 800) {
      const penalty = Math.min(25, Math.round((ttfb - 800) / 50));
      pageScore -= penalty;
      deductions.page.push(`TTFB is ${ttfb}ms (>800ms threshold): -${penalty} pts`);
    }

    if (fcp > 1800) {
      const penalty = Math.min(20, Math.round((fcp - 1800) / 100));
      pageScore -= penalty;
      deductions.page.push(`First Contentful Paint is ${fcp}ms (>1800ms threshold): -${penalty} pts`);
    }

    if (lcp > 2500) {
      const penalty = Math.min(25, Math.round((lcp - 2500) / 100));
      pageScore -= penalty;
      deductions.page.push(`Largest Contentful Paint is ${lcp}ms (>2500ms threshold): -${penalty} pts`);
    }

    if (cls > 0.1) {
      const penalty = Math.min(20, Math.round(cls * 100));
      pageScore -= penalty;
      deductions.page.push(`Cumulative Layout Shift is ${cls.toFixed(3)} (>0.1 threshold): -${penalty} pts`);
    }

    // 2. Network & API Score (Max 100)
    let networkScore = 100;
    const failedReqs = requestSummary.failedRequestsCount || 0;
    const slowReqs = requestSummary.slowRequestsCount || 0;
    const totalTransferredKb = requestSummary.totalTransferredKb || 0;

    if (failedReqs > 0) {
      const penalty = Math.min(30, failedReqs * 10);
      networkScore -= penalty;
      deductions.network.push(`${failedReqs} failed HTTP requests: -${penalty} pts`);
    }

    if (slowReqs > 0) {
      const penalty = Math.min(25, slowReqs * 5);
      networkScore -= penalty;
      deductions.network.push(`${slowReqs} slow HTTP requests (>500ms): -${penalty} pts`);
    }

    if (totalTransferredKb > 3000) {
      const penalty = Math.min(20, Math.round((totalTransferredKb - 3000) / 200));
      networkScore -= penalty;
      deductions.network.push(`Total page payload is ${totalTransferredKb}KB (>3000KB budget): -${penalty} pts`);
    }

    // 3. JavaScript / React / TypeScript / TSX / jQuery Score
    let reactScore = 100;
    const jsFindings = findings.filter(f =>
      f.category.startsWith('react') ||
      f.category.startsWith('nextjs') ||
      f.category.startsWith('jquery') ||
      f.category.startsWith('javascript') ||
      f.category.startsWith('typescript') ||
      f.category === 'network-waterfall'
    );
    for (const f of jsFindings) {
      const penalty = f.severity === 'critical' ? 20 : f.severity === 'high' ? 12 : f.severity === 'medium' ? 6 : 2;
      reactScore -= penalty;
      deductions.reactJs.push(`${f.title} (${f.severity}): -${penalty} pts`);
    }

    // 4. Backend Score (PHP / WordPress & Python)
    let pythonScore = 100;
    const backendFindings = findings.filter(f => f.category.startsWith('python') || f.category.startsWith('php'));
    for (const f of backendFindings) {
      const penalty = f.severity === 'critical' ? 25 : f.severity === 'high' ? 15 : 5;
      pythonScore -= penalty;
      deductions.python.push(`${f.title} (${f.severity}): -${penalty} pts`);
    }

    // 5. CSS Score
    let cssScore = 100;
    const cssFindings = findings.filter(f => f.category.startsWith('css'));
    for (const f of cssFindings) {
      const penalty = f.severity === 'high' ? 15 : f.severity === 'medium' ? 8 : 4;
      cssScore -= penalty;
      deductions.css.push(`${f.title} (${f.severity}): -${penalty} pts`);
    }

    // 6. Dependencies & Bundles Score
    let depScore = 100;
    const depFindings = findings.filter(f => f.category.startsWith('dependency'));
    for (const f of depFindings) {
      const penalty = f.severity === 'high' ? 15 : 8;
      depScore -= penalty;
      deductions.dependencies.push(`${f.title}: -${penalty} pts`);
    }

    const chunkWarnings = bundleSummary.warnings || [];
    if (chunkWarnings.length > 0) {
      const penalty = Math.min(20, chunkWarnings.length * 7);
      depScore -= penalty;
      deductions.dependencies.push(`${chunkWarnings.length} oversized JS chunks (>250KB): -${penalty} pts`);
    }

    // Normalize bounds 0-100
    pageScore = Math.max(0, Math.min(100, pageScore));
    networkScore = Math.max(0, Math.min(100, networkScore));
    reactScore = Math.max(0, Math.min(100, reactScore));
    pythonScore = Math.max(0, Math.min(100, pythonScore));
    cssScore = Math.max(0, Math.min(100, cssScore));
    depScore = Math.max(0, Math.min(100, depScore));

    // Weighted Overall Score
    const overallScore = Math.round(
      pageScore * 0.25 +
      networkScore * 0.20 +
      reactScore * 0.20 +
      pythonScore * 0.15 +
      cssScore * 0.10 +
      depScore * 0.10
    );

    return {
      overall: overallScore,
      page: pageScore,
      network: networkScore,
      reactJs: reactScore,
      python: pythonScore,
      css: cssScore,
      dependencies: depScore,
      deductions
    };
  }
}

module.exports = ScoringEngine;
