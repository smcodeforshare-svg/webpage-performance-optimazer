/**
 * Local Project Performance & API Auditor Pro — Advanced Version 3.0
 * Local-First Web Server
 * Strictly binds to 127.0.0.1 for local privacy and security.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const AuditRunner = require('./src/audit/audit-runner');
const RunComparator = require('./src/audit/run-comparator');
const PatchApplier = require('./src/patches/patch-applier');
const JsonReporter = require('./src/reports/json-reporter');
const CsvReporter = require('./src/reports/csv-reporter');
const HtmlReporter = require('./src/reports/html-reporter');
const PdfReporter = require('./src/reports/pdf-reporter');
const AIService = require('./src/security/ai-service');

const PORT = Number(process.env.PORT) || 4890;
const HOST = '127.0.0.1'; // Mandatory: never expose on 0.0.0.0 or remote interface

const runner = new AuditRunner();
const aiService = new AIService();

// MIME types for serving public files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Declarative Route Dispatch Table
const API_ROUTES = {
  'GET /api/status': (req, res, { sendJson }) => {
    let hasPlaywright = false;
    try {
      require('playwright');
      hasPlaywright = true;
    } catch {}

    return sendJson(200, {
      status: 'online',
      version: '3.0.0',
      host: HOST,
      port: PORT,
      capabilities: {
        playwright: hasPlaywright,
        aiConfigured: aiService.getStatus().hasKeyConfigured,
        aiEnabled: aiService.getStatus().enabled
      }
    });
  },

  'GET /api/runs': (req, res, { sendJson }) => {
    return sendJson(200, { runs: runner.listRuns() });
  },

  'POST /api/audit/website': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    if (!body.targetUrl) return sendJson(400, { error: 'Target URL is required' });
    const result = await runner.runFullAudit({
      targetUrl: body.targetUrl,
      isMobile: body.isMobile,
      warmCache: body.warmCache,
      repeatRuns: body.repeatRuns
    });
    return sendJson(200, result);
  },

  'POST /api/audit/source': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    if (!body.projectPath) return sendJson(400, { error: 'Project directory path is required' });
    const result = await runner.runFullAudit({ projectPath: body.projectPath });
    return sendJson(200, result);
  },

  'POST /api/audit/full': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    const result = await runner.runFullAudit({
      targetUrl: body.targetUrl,
      projectPath: body.projectPath,
      isMobile: body.isMobile,
      warmCache: body.warmCache,
      repeatRuns: body.repeatRuns
    });
    return sendJson(200, result);
  },

  'POST /api/compare': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    const runA = runner.getRun(body.runAId);
    const runB = runner.getRun(body.runBId);
    if (!runA || !runB) return sendJson(404, { error: 'One or both runs were not found.' });
    return sendJson(200, RunComparator.compare(runA, runB));
  },

  'POST /api/patch/preview': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    return sendJson(200, PatchApplier.preview(body.projectPath, body.finding));
  },

  'POST /api/patch/apply': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    const result = PatchApplier.apply(body.projectPath, body.finding);
    return sendJson(result.success ? 200 : 400, result);
  },

  'POST /api/patch/rollback': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    const result = PatchApplier.rollback(body.projectPath, body.backupId);
    return sendJson(result.success ? 200 : 400, result);
  },

  'GET /api/ai/status': (req, res, { sendJson }) => {
    return sendJson(200, aiService.getStatus());
  },

  'POST /api/ai/preview': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    return sendJson(200, aiService.previewPromptPayload(body.finding, body.snippet));
  },

  'POST /api/ai/analyze': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    const result = await aiService.analyzeFinding(body.finding, body.snippet);
    return sendJson(result.success ? 200 : 400, result);
  },

  // Open File in VS Code or Notepad
  'POST /api/open-file': async (req, res, { readBody, sendJson }) => {
    const body = await readBody();
    const filePath = body.filePath;
    const line = Number(body.line) || 1;
    const editor = (body.editor || 'auto').toLowerCase();

    if (!filePath || typeof filePath !== 'string') {
      return sendJson(400, { error: 'File path is required' });
    }

    const { exec } = require('child_process');
    const targetPath = path.resolve(filePath);

    if (!fs.existsSync(targetPath)) {
      return sendJson(404, { error: `File not found on disk: ${targetPath}` });
    }

    const runCmd = (cmd) => new Promise((resolve, reject) => {
      exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve({ stdout, stderr });
      });
    });

    try {
      if (editor === 'notepad') {
        runCmd(`notepad "${targetPath}"`).catch(() => {});
        return sendJson(200, { success: true, message: `Opened in Notepad: ${path.basename(targetPath)}` });
      }

      if (editor === 'vscode') {
        try {
          await runCmd(`code -g "${targetPath}:${line}"`);
          return sendJson(200, { success: true, message: `Opened in VS Code at line ${line}: ${path.basename(targetPath)}` });
        } catch (vscodeErr) {
          const isWin = process.platform === 'win32';
          const fallbackCmd = isWin ? `notepad "${targetPath}"` : `xdg-open "${targetPath}"`;
          runCmd(fallbackCmd).catch(() => {});
          return sendJson(200, {
            success: true,
            fallback: true,
            message: `VS Code CLI ('code') not found in PATH; opened in Notepad instead.`
          });
        }
      }

      // Default 'auto': try VS Code first; if it fails, open Notepad
      try {
        await runCmd(`code -g "${targetPath}:${line}"`);
        return sendJson(200, { success: true, message: `Opened in VS Code at line ${line}: ${path.basename(targetPath)}` });
      } catch (err) {
        const isWin = process.platform === 'win32';
        const fallbackCmd = isWin ? `notepad "${targetPath}"` : `xdg-open "${targetPath}"`;
        runCmd(fallbackCmd).catch(() => {});
        return sendJson(200, { success: true, message: `Opened in Notepad: ${path.basename(targetPath)}` });
      }
    } catch (finalErr) {
      return sendJson(500, { error: `Unable to launch editor: ${finalErr.message}` });
    }
  }
};

/**
 * Request handler supporting both built-in HTTP and API routes
 */
async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': `http://127.0.0.1:${PORT}`,
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(data));
  };

  const sendText = (statusCode, text, contentType = 'text/plain; charset=utf-8') => {
    res.writeHead(statusCode, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });
    res.end(text);
  };

  const readBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });

  try {
    // 1. Static Endpoint Dispatch via O(1) Route Table
    const routeKey = `${method} ${pathname}`;
    const staticHandler = API_ROUTES[routeKey];
    if (staticHandler) {
      return await staticHandler(req, res, { readBody, sendJson, sendText });
    }

    // 2. Dynamic Route: Get single run
    const runMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)$/);
    if (runMatch && method === 'GET') {
      const data = runner.getRun(runMatch[1]);
      if (!data) return sendJson(404, { error: 'Audit run not found' });
      return sendJson(200, data);
    }

    // 3. Dynamic Route: Exports
    const exportMatch = pathname.match(/^\/api\/export\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
    if (exportMatch && method === 'GET') {
      const runId = exportMatch[1];
      const format = exportMatch[2].toLowerCase();
      const run = runner.getRun(runId);

      if (!run) return sendJson(404, { error: 'Audit run not found' });

      if (format === 'json') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${runId}.json"`
        });
        return res.end(JsonReporter.generate(run));
      }

      if (format === 'csv-requests') {
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${runId}-requests.csv"`
        });
        return res.end(CsvReporter.generateRequestsCsv(run.webAudit?.requests || []));
      }

      if (format === 'csv-findings') {
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${runId}-findings.csv"`
        });
        return res.end(CsvReporter.generateFindingsCsv(run.sourceAudit?.findings || []));
      }

      if (format === 'html') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${runId}-report.html"`
        });
        return res.end(HtmlReporter.generate(run));
      }

      if (format === 'pdf') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${runId}-printable.html"`
        });
        return res.end(PdfReporter.generatePrintableHtml(run));
      }

      return sendJson(400, { error: `Unsupported export format: ${format}` });
    }

    // 4. Static File Serving from /public
    let relativeFilePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const safeFilePath = path.normalize(relativeFilePath).replace(/^(\.\.[\/\\])+/, '');
    const fullStaticPath = path.join(__dirname, 'public', safeFilePath);

    if (!fullStaticPath.startsWith(path.join(__dirname, 'public'))) {
      return sendText(403, 'Forbidden');
    }

    if (fs.existsSync(fullStaticPath) && fs.statSync(fullStaticPath).isFile()) {
      const ext = path.extname(fullStaticPath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const fileStream = fs.createReadStream(fullStaticPath);
      res.writeHead(200, { 'Content-Type': mime });
      return fileStream.pipe(res);
    }

    return sendJson(404, { error: 'Not Found' });
  } catch (err) {
    console.error('Server error:', err);
    return sendJson(500, { error: err.message || 'Internal Server Error' });
  }
}

// Start Server
const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log('================================================================');
  console.log(' Local Project Performance & API Auditor Pro — Advanced v3.0');
  console.log(` Running locally on: http://${HOST}:${PORT}`);
  console.log(' Bound strictly to 127.0.0.1 for maximum privacy and safety.');
  console.log('================================================================');
});

process.on('SIGINT', () => {
  console.log('\nShutting down Auditor Pro server cleanly...');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

module.exports = { server, handleRequest };
