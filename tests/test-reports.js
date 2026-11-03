const assert = require('assert');
const JsonReporter = require('../src/reports/json-reporter');
const CsvReporter = require('../src/reports/csv-reporter');
const HtmlReporter = require('../src/reports/html-reporter');
const PdfReporter = require('../src/reports/pdf-reporter');

function testReports() {
  console.log('Running test: Report Generators (JSON, CSV, HTML, PDF)...');

  const mockRun = {
    id: 'test-audit-123',
    timestamp: '2026-10-29T10:00:00.000Z',
    targetUrl: 'http://localhost:3000',
    projectPath: '/path/to/project',
    scores: {
      overall: 88,
      page: 90,
      network: 85,
      reactJs: 80,
      python: 95,
      css: 90,
      dependencies: 85
    },
    webAudit: {
      metrics: { ttfbMs: 120, fcpMs: 400, lcpMs: 800, cls: 0.02, navigationDurationMs: 950 },
      requestSummary: { totalRequests: 12, totalTransferredKb: 450, apiRequestsCount: 3 },
      requests: [
        {
          id: 'req-1',
          method: 'GET',
          url: 'http://localhost:3000/api/items',
          status: 200,
          durationMs: 140,
          transferSizeBytes: 1024,
          resourceType: 'fetch',
          isApi: true
        }
      ]
    },
    sourceAudit: {
      findings: [
        {
          id: 'finding-1',
          title: 'Missing Request Cancellation in useEffect',
          filePath: 'src/components/List.jsx',
          startLine: 10,
          endLine: 15,
          symbol: 'List',
          category: 'react-lifecycle',
          severity: 'high',
          confidence: 'verified',
          evidence: 'Fetch inside effect without AbortController',
          existingCode: 'useEffect(() => { fetch(...) }, [])',
          replacementCode: 'useEffect(() => { const c = new AbortController(); ... }, [])'
        }
      ]
    }
  };

  // 1. JSON
  const jsonStr = JsonReporter.generate(mockRun);
  const parsedJson = JSON.parse(jsonStr);
  assert.strictEqual(parsedJson.id, 'test-audit-123');

  // 2. CSV
  const csvReqs = CsvReporter.generateRequestsCsv(mockRun.webAudit.requests);
  assert.ok(csvReqs.includes('http://localhost:3000/api/items'));

  const csvFindings = CsvReporter.generateFindingsCsv(mockRun.sourceAudit.findings);
  assert.ok(csvFindings.includes('src/components/List.jsx'));

  // 3. HTML
  const html = HtmlReporter.generate(mockRun);
  assert.ok(html.includes('Local Project Performance &amp; API Auditor Pro'));
  assert.ok(html.includes('Missing Request Cancellation'));
  assert.ok(html.includes('<!DOCTYPE html>'));

  // 4. PDF / Printable
  const printableHtml = PdfReporter.generatePrintableHtml(mockRun);
  assert.ok(printableHtml.includes('<!DOCTYPE html>'));

  console.log('✓ Report Generators tests passed.');
}

module.exports = testReports;
if (require.main === module) testReports();
