const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ReactRules = require('../src/react-analysis/react-rules');
const PythonRules = require('../src/python-analysis/python-rules');
const CssRules = require('../src/css-analysis/css-rules');
const DependencyRules = require('../src/dependency-analysis/dependency-rules');
const PhpRules = require('../src/php-analysis/php-rules');
const JsJqueryRules = require('../src/javascript-analysis/js-jquery-rules');
const ProjectScanner = require('../src/source-analysis/project-scanner');

function testSourceAnalysis() {
  console.log('Running test: Source Code Bottleneck Analysis across React, Python, CSS, PHP, JS, TSX, and jQuery...');

  const examplesDir = path.resolve(__dirname, '..', 'examples');

  // 1. React Rules Test
  const reactFile = path.join(examplesDir, 'sample-react-app', 'src', 'components', 'ProductList.jsx');
  const reactContent = fs.readFileSync(reactFile, 'utf8');
  const reactFindings = ReactRules.analyze(reactContent, 'src/components/ProductList.jsx', reactFile);

  assert.ok(reactFindings.length >= 3, `Expected at least 3 React findings, got ${reactFindings.length}`);
  
  const hasAbort = reactFindings.some(f => f.category === 'react-lifecycle' && f.title.includes('Request Cancellation'));
  assert.ok(hasAbort, 'Should detect missing AbortController in useEffect');

  const hasIndexKey = reactFindings.some(f => f.category === 'react-reconciliation');
  assert.ok(hasIndexKey, 'Should detect array index as React key');

  const hasMoment = reactFindings.some(f => f.title.includes('Moment.js'));
  assert.ok(hasMoment, 'Should detect heavy Moment.js import');

  // 2. Python Rules Test
  const pyFile = path.join(examplesDir, 'sample-python-api', 'app', 'api.py');
  const pyContent = fs.readFileSync(pyFile, 'utf8');
  const pyFindings = PythonRules.analyze(pyContent, 'app/api.py', pyFile);

  assert.ok(pyFindings.length >= 1, `Expected at least 1 Python finding, got ${pyFindings.length}`);
  const hasBlocking = pyFindings.some(f => f.category === 'python-async-blocking' || f.category === 'python-missing-timeout');
  assert.ok(hasBlocking, 'Should detect blocking or timeout issues in Python endpoint');

  // 3. CSS Rules Test
  const cssFile = path.join(examplesDir, 'sample-css-project', 'styles', 'animations.css');
  const cssContent = fs.readFileSync(cssFile, 'utf8');
  const cssFindings = CssRules.analyze(cssContent, 'styles/animations.css', cssFile);

  assert.ok(cssFindings.length >= 1, `Expected layout animation finding in CSS, got ${cssFindings.length}`);
  assert.strictEqual(cssFindings[0].category, 'css-paint-layout');

  // 4. Dependency Rules Test
  const pkgFile = path.join(examplesDir, 'sample-react-app', 'package.json');
  const pkgContent = fs.readFileSync(pkgFile, 'utf8');
  const depFindings = DependencyRules.analyzePackageJson(pkgContent, 'package.json', pkgFile);
  assert.ok(depFindings.length >= 2, `Expected at least 2 dependency findings (moment, lodash), got ${depFindings.length}`);

  // 5. PHP & WordPress Rules Test (.php)
  const phpFile = path.join(examplesDir, 'sample-php-project', 'functions.php');
  const phpContent = fs.readFileSync(phpFile, 'utf8');
  const phpFindings = PhpRules.analyze(phpContent, 'functions.php', phpFile);

  assert.ok(phpFindings.length >= 3, `Expected at least 3 PHP findings, got ${phpFindings.length}`);
  const hasPhpNPlusOne = phpFindings.some(f => f.category === 'php-n-plus-one');
  assert.ok(hasPhpNPlusOne, 'Should detect N+1 query loop in PHP / WordPress');

  const hasPhpBlocking = phpFindings.some(f => f.category === 'php-blocking-io');
  assert.ok(hasPhpBlocking, 'Should detect blocking file_get_contents in PHP');

  const hasPhpLoopCount = phpFindings.some(f => f.category === 'php-loop-optimization');
  assert.ok(hasPhpLoopCount, 'Should detect count() in for loop condition in PHP');

  // 6. JavaScript & jQuery Rules Test (.js)
  const jqueryFile = path.join(examplesDir, 'sample-jquery-project', 'app.js');
  const jqueryContent = fs.readFileSync(jqueryFile, 'utf8');
  const jqueryFindings = JsJqueryRules.analyze(jqueryContent, 'app.js', jqueryFile);

  assert.ok(jqueryFindings.length >= 4, `Expected at least 4 jQuery/JS findings, got ${jqueryFindings.length}`);
  const hasJqueryLoop = jqueryFindings.some(f => f.category === 'jquery-performance');
  assert.ok(hasJqueryLoop, 'Should detect repeated jQuery selector in loop');

  const hasJqueryDelegation = jqueryFindings.some(f => f.category === 'jquery-event-delegation');
  assert.ok(hasJqueryDelegation, 'Should detect missing event delegation in jQuery');

  const hasJqueryAjax = jqueryFindings.some(f => f.category === 'jquery-blocking');
  assert.ok(hasJqueryAjax, 'Should detect synchronous $.ajax (async: false)');

  const hasUnthrottledScroll = jqueryFindings.some(f => f.category === 'javascript-unthrottled-listener');
  assert.ok(hasUnthrottledScroll, 'Should detect unthrottled window scroll listener');

  // 7. TypeScript / TSX Rules Test (.tsx)
  const tsxFile = path.join(examplesDir, 'sample-tsx-project', 'Dashboard.tsx');
  const tsxContent = fs.readFileSync(tsxFile, 'utf8');
  const tsxFindings = JsJqueryRules.analyze(tsxContent, 'Dashboard.tsx', tsxFile);

  assert.ok(tsxFindings.length >= 2, `Expected at least 2 TSX findings, got ${tsxFindings.length}`);
  const hasSpreadReduce = tsxFindings.some(f => f.category === 'typescript-memory-bottleneck');
  assert.ok(hasSpreadReduce, 'Should detect quadratic object spread in .reduce() in TSX');

  // 8. Full ProjectScanner on PHP project
  const phpScanResult = ProjectScanner.scan(path.join(examplesDir, 'sample-php-project'));
  assert.ok(phpScanResult.totalFilesScanned >= 1, 'Should scan PHP project files');
  assert.ok(phpScanResult.findings.length >= 3, 'Should discover PHP findings through ProjectScanner');

  // 9. Full ProjectScanner on jQuery project
  const jqScanResult = ProjectScanner.scan(path.join(examplesDir, 'sample-jquery-project'));
  assert.ok(jqScanResult.totalFilesScanned >= 1, 'Should scan jQuery project files');
  assert.ok(jqScanResult.findings.length >= 4, 'Should discover jQuery findings through ProjectScanner');

  console.log('✓ Source Code Analysis tests passed across all languages (React, Python, CSS, PHP, JS, TSX, jQuery).');
}

module.exports = testSourceAnalysis;
if (require.main === module) testSourceAnalysis();
