/**
 * Python Analysis Integration Module
 * Invokes python-ast-scanner.py or uses lightweight regex AST parser fallback.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const LineMapper = require('../source-analysis/line-mapper');
const { createFinding } = require('../source-analysis/finding-generator');

class PythonRules {
  /**
   * Scans a Python file for performance bottlenecks
   * @param {string} content 
   * @param {string} relativePath 
   * @param {string} absolutePath 
   * @returns {Array<Object>}
   */
  static analyze(content, relativePath, absolutePath) {
    const mapper = new LineMapper(content);
    const fileHash = mapper.getContentHash();
    const scriptPath = path.join(__dirname, 'python-ast-scanner.py');

    // Try executing python3 / python
    try {
      const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
      const result = spawnSync(pythonBin, [scriptPath, absolutePath], {
        encoding: 'utf8',
        timeout: 5000
      });

      if (result.status === 0 && result.stdout) {
        const rawFindings = JSON.parse(result.stdout.trim() || '[]');
        return rawFindings.map(f => createFinding({
          title: f.title,
          filePath: relativePath,
          absolutePath,
          startLine: f.startLine,
          endLine: f.endLine,
          startColumn: f.startColumn,
          endColumn: f.endColumn,
          symbol: f.symbol,
          category: f.category,
          severity: f.severity,
          confidence: f.confidence,
          sourceType: f.sourceType,
          evidence: f.evidence,
          existingCode: f.existingCode,
          replacementCode: f.replacementCode,
          replacementInstructions: f.replacementInstructions,
          whyFixHelps: f.whyFixHelps,
          fileHash
        }));
      }
    } catch {
      // Fallback to JS pattern scanner below if python execution fails
    }

    return this.fallbackJsScan(content, mapper, relativePath, absolutePath, fileHash);
  }

  /**
   * Fallback scanner when python binary is unavailable
   */
  static fallbackJsScan(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const lines = content.split(/\r?\n/);

    let inAsyncDef = false;
    let asyncFuncName = '';

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      const asyncMatch = line.match(/^\s*async\s+def\s+([A-Za-z0-9_]+)\s*\(/);
      if (asyncMatch) {
        inAsyncDef = true;
        asyncFuncName = asyncMatch[1];
      } else if (/^\s*def\s+/.test(line)) {
        inAsyncDef = false;
      }

      // Check synchronous requests in async def
      if (inAsyncDef && /requests\.(get|post|put|delete)\s*\(/.test(line)) {
        findings.push(createFinding({
          title: `Blocking Synchronous Call in Async Endpoint '${asyncFuncName}'`,
          filePath: relativePath,
          absolutePath,
          startLine: lineNum,
          endLine: lineNum,
          symbol: asyncFuncName,
          category: 'python-async-blocking',
          severity: 'critical',
          confidence: 'strongly_supported',
          sourceType: 'static_ast',
          evidence: `Synchronous requests call inside async def ${asyncFuncName} blocks the Python event loop.`,
          existingCode: line,
          replacementCode: line.replace(/requests\.(get|post)/, 'await client.$1'),
          replacementInstructions: {
            action: 'Replace requests call with an asynchronous client like httpx or aiohttp.'
          },
          fileHash
        }));
      }

      // Check missing timeout
      if (/requests\.(get|post|put|delete)\s*\([^\)]+\)/.test(line) && !line.includes('timeout=')) {
        findings.push(createFinding({
          title: "Missing Timeout in 'requests' Call",
          filePath: relativePath,
          absolutePath,
          startLine: lineNum,
          endLine: lineNum,
          symbol: 'requests',
          category: 'python-missing-timeout',
          severity: 'high',
          confidence: 'strongly_supported',
          sourceType: 'static_ast',
          evidence: "HTTP call without 'timeout=' hangs indefinitely if remote server fails.",
          existingCode: line,
          replacementCode: line.replace(/\)\s*$/, ', timeout=10.0)'),
          replacementInstructions: {
            action: 'Add timeout parameter (e.g. timeout=10.0).'
          },
          fileHash
        }));
      }
    }

    return findings;
  }
}

module.exports = PythonRules;
