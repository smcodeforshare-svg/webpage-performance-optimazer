const assert = require('assert');
const path = require('path');
const ApiClassifier = require('../src/network/api-classifier');
const RequestInventory = require('../src/network/request-inventory');
const WaterfallDetector = require('../src/network/waterfall-detector');
const CallSourceCorrelator = require('../src/network/call-source-correlator');
const ProjectScanner = require('../src/source-analysis/project-scanner');

function testApiClassifier() {
  console.log('Running test: API Classifier, Multi-File Architecture & Waterfall Detector...');

  // 1. API Classification
  const c1 = ApiClassifier.classify({
    url: 'https://example.com/api/products',
    resourceType: 'fetch',
    method: 'GET'
  });
  assert.strictEqual(c1.isApi, true);

  const c2 = ApiClassifier.classify({
    url: 'https://example.com/assets/bundle.js',
    resourceType: 'script',
    method: 'GET'
  });
  assert.strictEqual(c2.isApi, false);

  const c3 = ApiClassifier.classify({
    url: 'https://example.com/graphql',
    resourceType: 'other',
    method: 'POST'
  });
  assert.strictEqual(c3.isApi, true);

  // 2. Request Inventory Collection
  const inv = new RequestInventory('https://example.com');
  inv.addRequest({
    url: 'https://example.com/api/products',
    method: 'GET',
    status: 200,
    duration: 120,
    resourceType: 'fetch',
    size: 2048
  });
  inv.addRequest({
    url: 'https://example.com/api/products',
    method: 'GET',
    status: 200,
    duration: 110,
    resourceType: 'fetch',
    size: 2048
  });

  const summary = inv.getSummary();
  assert.strictEqual(summary.totalRequests, 2);
  assert.strictEqual(summary.apiRequestsCount, 2);

  // 3. Duplicate Detection
  const duplicates = WaterfallDetector.findDuplicates(inv.getAll());
  assert.strictEqual(duplicates.length, 1);
  assert.strictEqual(duplicates[0].count, 2);
  assert.strictEqual(duplicates[0].url, 'https://example.com/api/products');

  // 4. Multi-File API Architecture & Syntax Block Tracing
  const projectRoot = path.resolve(__dirname, '..', 'examples', 'sample-react-app');
  const scan = ProjectScanner.scan(projectRoot);
  assert.ok(scan.apiInventory.length >= 1, 'Should discover APIs in sample-react-app');

  const productsApi = scan.apiInventory.find(a => a.endpoint === '/api/products');
  assert.ok(productsApi, 'Should find /api/products API');
  assert.strictEqual(productsApi.isMultiFile, true, '/api/products should be identified as multi-file');
  assert.strictEqual(productsApi.filesCount, 2, 'Should trace 2 files for /api/products');
  assert.ok(productsApi.apiFiles[0].syntaxSnippet.length > 10, 'Should contain exact code syntax snippet');
  assert.ok(productsApi.apiFiles[0].absolutePath.includes('products.js'), 'Should contain complete absolute path');
  assert.ok(productsApi.apiFiles[1].syntaxSnippet.includes('fetch'), 'Should contain client fetch syntax');

  // 5. Correlate runtime requests with multi-file architecture
  const rawReqs = [
    {
      url: 'http://localhost:3000/api/products',
      method: 'GET',
      isApi: true
    }
  ];
  const correlated = CallSourceCorrelator.correlate(rawReqs, projectRoot, scan.scannedFiles);
  assert.strictEqual(correlated[0].isMultiFile, true);
  assert.strictEqual(correlated[0].apiFilesCount, 2);
  assert.ok(correlated[0].apiFiles[0].syntaxSnippet.length > 0);

  console.log('✓ API Classifier, Multi-File Architecture & Waterfall Detector tests passed.');
}

module.exports = testApiClassifier;
if (require.main === module) testApiClassifier();
