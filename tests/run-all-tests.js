/**
 * Master Test Suite Runner
 * Executes all unit and integration tests across the entire codebase.
 */

const testUrlSanitizer = require('./test-url-sanitizer');
const testPathValidator = require('./test-path-validator');
const testSourceAnalysis = require('./test-source-analysis');
const testPatchEngine = require('./test-patch-engine');
const testApiClassifier = require('./test-api-classifier');
const testReports = require('./test-reports');

console.log('====================================================');
console.log(' Auditor Pro v3.0 — Automated Test Verification');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

const suites = [
  { name: 'URL Sanitizer & Protocol Validator', fn: testUrlSanitizer },
  { name: 'Path Validator & Directory Traversal Security', fn: testPathValidator },
  { name: 'Source Analysis & Bottleneck Detection', fn: testSourceAnalysis },
  { name: 'Safe Patch Engine & Atomic Rollback', fn: testPatchEngine },
  { name: 'API Classifier & Waterfall Detection', fn: testApiClassifier },
  { name: 'Report Generators (JSON, CSV, HTML, PDF)', fn: testReports }
];

for (const suite of suites) {
  try {
    suite.fn();
    passed++;
  } catch (err) {
    console.error(`\n✖ Test Suite Failed: ${suite.name}`);
    console.error(err);
    failed++;
  }
}

console.log('\n----------------------------------------------------');
console.log(`Test Execution Summary: ${passed} Passed, ${failed} Failed`);
console.log('----------------------------------------------------');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All automated quality and security checks passed successfully.\n');
  process.exit(0);
}
