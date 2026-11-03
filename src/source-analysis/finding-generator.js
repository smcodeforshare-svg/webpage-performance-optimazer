/**
 * Finding Generator and Schema Canonicalizer
 * Creates strictly structured findings conforming to Advanced Version 3.0 requirements.
 */

let findingCounter = 0;

/**
 * Creates a normalized Finding object
 * @param {Object} params
 */
function createFinding({
  title,
  filePath,
  absolutePath,
  startLine,
  endLine,
  startColumn = 1,
  endColumn = 1,
  symbol = 'Anonymous',
  category = 'performance',
  severity = 'medium', // 'critical' | 'high' | 'medium' | 'low' | 'info'
  confidence = 'strongly_supported', // 'verified' | 'strongly_supported' | 'hypothesis'
  sourceType = 'static_ast', // 'runtime_observed' | 'source_inferred' | 'static_ast'
  evidence,
  existingCode,
  replacementCode,
  replacementInstructions = {},
  whyFixHelps = {},
  validation = {},
  fileHash = ''
}) {
  findingCounter++;
  const id = `finding-${Date.now()}-${findingCounter}`;

  return {
    id,
    title: title || 'Performance Bottleneck Detected',
    filePath: filePath || '',
    absolutePath: absolutePath || '',
    startLine: Number(startLine) || 1,
    endLine: Number(endLine) || Number(startLine) || 1,
    startColumn: Number(startColumn) || 1,
    endColumn: Number(endColumn) || 1,
    symbol: symbol || 'Component/Function',
    category,
    severity,
    confidence,
    sourceType,
    evidence: evidence || 'Identified via static and pattern analysis of project source code.',
    existingCode: existingCode || '',
    replacementCode: replacementCode || '',
    replacementInstructions: {
      file: filePath,
      replaceLines: `${startLine}–${endLine}`,
      action: replacementInstructions.action || 'Replace the highlighted code block with the proposed code.',
      requiredImports: replacementInstructions.requiredImports || [],
      additionalChanges: replacementInstructions.additionalChanges || []
    },
    whyFixHelps: {
      cause: whyFixHelps.cause || 'Unoptimized implementation pattern causes excessive resource usage or delays.',
      behaviorChange: whyFixHelps.behaviorChange || 'Streamlines execution flow without altering functional output.',
      expectedBenefit: whyFixHelps.expectedBenefit || 'Reduces latency, eliminates redundant renders or queries, and optimizes CPU/network usage.',
      tradeoffs: whyFixHelps.tradeoffs || 'Minimal; adheres to standard idiomatic patterns.',
      behaviorPreserved: whyFixHelps.behaviorPreserved !== false
    },
    validation: {
      testSteps: validation.testSteps || [
        'Apply the replacement code or patch.',
        'Run the project unit and integration test suite.',
        'Execute a repeat audit to measure reduction in timings or requests.'
      ],
      beforeAfterMetrics: validation.beforeAfterMetrics || [
        'Time to Interactive / Render Latency',
        'Request Count or Query Count'
      ]
    },
    fileHash,
    isStale: false
  };
}

module.exports = {
  createFinding
};
