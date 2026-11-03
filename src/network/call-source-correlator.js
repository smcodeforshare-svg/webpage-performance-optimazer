/**
 * API Call-to-Source Correlator & Multi-File Architecture Tracer
 * Traces exact code syntax, complete absolute file paths, and identifies whether an API's
 * implementation is broken across multiple files (Client Caller, Route Handler, Controller, Service, Model).
 * Also correlates all local project assets, scripts, stylesheets, and WordPress AJAX / REST endpoints.
 */

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

class CallSourceCorrelator {
  /**
   * Correlates runtime requests with local project source files and traces multi-file architecture
   * @param {Array<Object>} requests 
   * @param {string} projectRoot 
   * @param {Array<string>} sourceFiles List of relative file paths in project
   */
  static correlate(requests, projectRoot, sourceFiles = []) {
    const fileCache = new Map();

    const getFileLines = (relPath) => {
      if (fileCache.has(relPath)) return fileCache.get(relPath);
      try {
        const full = path.resolve(projectRoot, relPath);
        const text = fs.readFileSync(full, 'utf8');
        const lines = text.split(/\r?\n/);
        const entry = { text, lines, fullPath: full };
        fileCache.set(relPath, entry);
        return entry;
      } catch {
        return null;
      }
    };

    const correlatedRequests = [];

    for (const req of requests) {
      const copy = { ...req, correlatedSource: null, apiArchitecture: null, isMultiFile: false, apiFilesCount: 0, apiFiles: [] };

      if (!projectRoot || !req.url) {
        correlatedRequests.push(copy);
        continue;
      }

      let parsed = null;
      try {
        parsed = new URL(req.url);
      } catch {
        try {
          parsed = new URL(req.url, 'http://localhost');
        } catch {}
      }

      const pathname = parsed ? parsed.pathname : req.url;
      const cleanPath = pathname.replace(/^\//, '');
      const fileName = path.basename(pathname);

      // 1. Check for WordPress AJAX: admin-ajax.php?action=...
      const isWpAjax = /admin-ajax\.php/i.test(pathname);
      const ajaxAction = parsed?.searchParams?.get('action');

      if (isWpAjax && ajaxAction) {
        const arch = this.traceWpAjaxArchitecture(ajaxAction, projectRoot, sourceFiles, getFileLines);
        copy.isApi = true;
        copy.apiArchitecture = arch;
        copy.isMultiFile = arch.isMultiFile;
        copy.apiFilesCount = arch.filesCount;
        copy.apiFiles = arch.apiFiles;
        copy.correlatedSource = arch.primaryFile;
        correlatedRequests.push(copy);
        continue;
      }

      // 2. Check for API Endpoint Architecture (e.g. /api/..., /wp-json/..., /v1/...)
      const isApiEndpoint = req.isApi || /\/(?:api|wp-json|v[0-9]+|graphql|rest|data)\//i.test(pathname);
      if (isApiEndpoint && pathname.length > 2) {
        const arch = this.traceEndpointArchitecture(pathname, projectRoot, sourceFiles, getFileLines);
        if (arch.filesCount > 0) {
          copy.apiArchitecture = arch;
          copy.isMultiFile = arch.isMultiFile;
          copy.apiFilesCount = arch.filesCount;
          copy.apiFiles = arch.apiFiles;
          copy.correlatedSource = arch.primaryFile;
          correlatedRequests.push(copy);
          continue;
        }
      }

      // 3. Match Direct Local Project Resource File (e.g. style.css, script.js, template.php)
      const matchedLocalFile = sourceFiles.find(f => {
        const normF = f.replace(/\\/g, '/');
        return cleanPath.endsWith(normF) || cleanPath.endsWith('/' + normF) || normF === cleanPath || path.basename(normF) === fileName;
      });

      if (matchedLocalFile) {
        const cached = getFileLines(matchedLocalFile);
        if (cached) {
          const maxPreview = Math.min(cached.lines.length, 14);
          const syntaxSnippet = cached.lines.slice(0, maxPreview).join('\n');
          const ext = path.extname(matchedLocalFile).toLowerCase();
          const role = ['.css', '.scss'].includes(ext) ? 'Theme Stylesheet' : (['.js', '.ts'].includes(ext) ? 'Client Script' : 'Project Template / Asset');

          const primaryFile = {
            filePath: matchedLocalFile,
            absolutePath: cached.fullPath,
            line: 1,
            startLine: 1,
            endLine: maxPreview,
            snippet: syntaxSnippet,
            syntaxSnippet,
            role,
            language: this._detectLanguage(matchedLocalFile),
            symbol: fileName,
            confidence: 'verified',
            isMultiFile: false,
            filesCount: 1,
            evidence: `URL path '${pathname}' directly maps to local project file '${cached.fullPath}'.`
          };

          const singleArch = {
            endpoint: pathname,
            isMultiFile: false,
            filesCount: 1,
            architectureSummary: `Direct Local File (${role})`,
            apiFiles: [primaryFile],
            primaryFile
          };

          copy.correlatedSource = primaryFile;
          copy.apiArchitecture = singleArch;
          copy.isMultiFile = false;
          copy.apiFilesCount = 1;
          copy.apiFiles = [primaryFile];
          correlatedRequests.push(copy);
          continue;
        }
      }

      // 4. Fallback search for references to path in source code
      if (pathname.length > 3) {
        const arch = this.traceEndpointArchitecture(pathname, projectRoot, sourceFiles, getFileLines);
        if (arch.filesCount > 0) {
          copy.apiArchitecture = arch;
          copy.isMultiFile = arch.isMultiFile;
          copy.apiFilesCount = arch.filesCount;
          copy.apiFiles = arch.apiFiles;
          copy.correlatedSource = arch.primaryFile;
        }
      }

      correlatedRequests.push(copy);
    }

    return correlatedRequests;
  }

  /**
   * Traces WordPress AJAX action architecture across PHP and JS files
   * e.g. admin-ajax.php?action=my_action
   */
  static traceWpAjaxArchitecture(actionName, projectRoot, sourceFiles = [], getFileLines = null) {
    const matchedFiles = [];
    const cleanAction = actionName.trim();

    for (const relPath of sourceFiles) {
      const cached = getFileLines(relPath);
      if (!cached) continue;

      if (cached.text.includes(cleanAction)) {
        for (let i = 0; i < cached.lines.length; i++) {
          const line = cached.lines[i];
          if (line.includes(cleanAction)) {
            let role = 'AJAX Handler (PHP)';
            if (line.includes('wp_ajax_') || line.includes('add_action')) {
              role = 'Server Route Handler (WordPress AJAX)';
            } else if (/\b(?:action|data|params)\b/.test(line)) {
              role = 'Client-Side AJAX Caller';
            }

            const startLineIdx = Math.max(0, i - 2);
            const endLineIdx = Math.min(cached.lines.length - 1, i + 8);
            const syntaxSnippet = cached.lines.slice(startLineIdx, endLineIdx + 1).join('\n');

            matchedFiles.push({
              role,
              filePath: relPath,
              absolutePath: cached.fullPath,
              line: i + 1,
              startLine: startLineIdx + 1,
              endLine: endLineIdx + 1,
              symbol: cleanAction,
              language: this._detectLanguage(relPath),
              syntaxSnippet,
              evidence: `File declares or calls WordPress AJAX action '${cleanAction}'.`
            });
            break;
          }
        }
      }
    }

    const filesCount = matchedFiles.length;
    const isMultiFile = filesCount > 1;

    return {
      endpoint: `admin-ajax.php?action=${cleanAction}`,
      isMultiFile,
      filesCount,
      architectureSummary: isMultiFile
        ? `Multi-File Architecture (Split across ${filesCount} files: ${matchedFiles.map(f => f.role).join(' → ')})`
        : (filesCount === 1 ? `Single-File (${matchedFiles[0].role})` : 'Uncorrelated AJAX Action'),
      apiFiles: matchedFiles,
      primaryFile: matchedFiles.length > 0 ? matchedFiles[0] : null
    };
  }

  /**
   * Traces all files implementing or calling an endpoint, extracting exact syntax and multi-file dependencies
   * @param {string} endpoint 
   * @param {string} projectRoot 
   * @param {Array<string>} sourceFiles 
   * @param {Function} getFileLines 
   */
  static traceEndpointArchitecture(endpoint, projectRoot, sourceFiles = [], getFileLines = null) {
    if (!getFileLines) {
      getFileLines = (relPath) => {
        try {
          const full = path.resolve(projectRoot, relPath);
          const text = fs.readFileSync(full, 'utf8');
          const lines = text.split(/\r?\n/);
          return { text, lines, fullPath: full };
        } catch {
          return null;
        }
      };
    }

    const matchedFiles = [];
    const seenFiles = new Set();

    // Clean endpoint for matching (e.g., '/api/products' or 'api/products')
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const endpointNoSlash = cleanEndpoint.replace(/^\//, '');

    for (const relPath of sourceFiles) {
      const cached = getFileLines(relPath);
      if (!cached) continue;

      if (cached.text.includes(cleanEndpoint) || cached.text.includes(endpointNoSlash)) {
        for (let i = 0; i < cached.lines.length; i++) {
          const line = cached.lines[i];
          if (line.includes(cleanEndpoint) || line.includes(endpointNoSlash)) {
            const role = this._determineRole(line, relPath, cached.text);
            const language = this._detectLanguage(relPath);

            const startLineIdx = Math.max(0, i - 2);
            const endLineIdx = Math.min(cached.lines.length - 1, i + 8);
            const syntaxSnippet = cached.lines.slice(startLineIdx, endLineIdx + 1).join('\n');

            const fileEntry = {
              role,
              filePath: relPath,
              absolutePath: cached.fullPath,
              line: i + 1,
              startLine: startLineIdx + 1,
              endLine: endLineIdx + 1,
              symbol: this._extractSymbol(cached.lines, i),
              language,
              syntaxSnippet,
              evidence: `File contains direct ${role.toLowerCase()} definition for '${cleanEndpoint}'.`
            };

            matchedFiles.push(fileEntry);
            seenFiles.add(relPath);

            // Trace imported downstream service/model files
            const downstream = this._traceDownstreamDependencies(cached.lines, i, relPath, projectRoot, sourceFiles, getFileLines);
            for (const down of downstream) {
              if (!seenFiles.has(down.filePath)) {
                matchedFiles.push(down);
                seenFiles.add(down.filePath);
              }
            }

            break;
          }
        }
      }
    }

    const filesCount = matchedFiles.length;
    const isMultiFile = filesCount > 1;

    let architectureSummary = 'External / Third-Party Endpoint';
    if (filesCount > 1) {
      const roleSequence = matchedFiles.map(f => f.role).filter((v, idx, arr) => arr.indexOf(v) === idx);
      architectureSummary = `Multi-File Architecture (Split across ${filesCount} files: ${roleSequence.join(' → ')})`;
    } else if (filesCount === 1) {
      architectureSummary = `Single-File Implementation (${matchedFiles[0].role})`;
    }

    return {
      endpoint: cleanEndpoint,
      isMultiFile,
      filesCount,
      architectureSummary,
      apiFiles: matchedFiles,
      primaryFile: matchedFiles.length > 0 ? {
        filePath: matchedFiles[0].filePath,
        absolutePath: matchedFiles[0].absolutePath,
        line: matchedFiles[0].line,
        snippet: matchedFiles[0].syntaxSnippet,
        syntaxSnippet: matchedFiles[0].syntaxSnippet,
        role: matchedFiles[0].role,
        confidence: 'verified',
        isMultiFile,
        filesCount
      } : null
    };
  }

  /**
   * Automatically discovers all API endpoints declared or called in project source files
   * @param {string} projectRoot 
   * @param {Array<string>} sourceFiles 
   */
  static discoverProjectApis(projectRoot, sourceFiles = []) {
    const discoveredEndpoints = new Set();
    const endpointRegexes = [
      /\b(?:fetch|axios(?:\.get|\.post)?|\$.ajax|requests\.(?:get|post)|file_get_contents|wp_remote_get)\s*\(\s*['"]([^'"]+)['"]/g,
      /@app\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g,
      /\b(?:app|router)\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g,
      /\bregister_rest_route\s*\(\s*[^,]+,\s*['"]([^'"]+)['"]/g,
      /\bRoute::(?:get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/g
    ];

    const getFileLines = (relPath) => {
      try {
        const full = path.resolve(projectRoot, relPath);
        const text = fs.readFileSync(full, 'utf8');
        const lines = text.split(/\r?\n/);
        return { text, lines, fullPath: full };
      } catch {
        return null;
      }
    };

    for (const relPath of sourceFiles) {
      const cached = getFileLines(relPath);
      if (!cached) continue;

      for (const regex of endpointRegexes) {
        let match;
        while ((match = regex.exec(cached.text)) !== null) {
          const endpointCandidate = match[1];
          if (endpointCandidate.includes('/api') || endpointCandidate.startsWith('/v') || endpointCandidate.includes('/data') || endpointCandidate.includes('/graphql') || endpointCandidate.includes('/wp-json')) {
            discoveredEndpoints.add(endpointCandidate.split('?')[0]);
          }
        }
      }
    }

    const inventory = [];
    for (const ep of discoveredEndpoints) {
      inventory.push(this.traceEndpointArchitecture(ep, projectRoot, sourceFiles, getFileLines));
    }

    return inventory.sort((a, b) => b.filesCount - a.filesCount);
  }

  static _determineRole(line, relPath, fullContent) {
    const p = relPath.toLowerCase();

    // Client-side caller patterns
    if (/\b(?:fetch|axios|\$.ajax|xmlhttprequest|requests\.|file_get_contents|wp_remote_get)\b/.test(line)) {
      return 'Client-Side Caller';
    }

    // Server-side route handler patterns
    if (/@app\.(?:get|post|put|delete)|app\.(?:get|post|put|delete)|router\.(?:get|post)|register_rest_route|route::/i.test(line)) {
      return 'Server Route Handler';
    }

    // Path indicators
    if (p.includes('routes') || p.includes('api') && !p.includes('component')) {
      return 'API Route Definition';
    }
    if (p.includes('controller')) {
      return 'Controller';
    }
    if (p.includes('service') || p.includes('logic')) {
      return 'Service / Business Logic';
    }
    if (p.includes('model') || p.includes('database') || p.includes('repo')) {
      return 'Database / Model Query';
    }
    if (p.includes('component') || p.includes('page') || p.includes('view') || p.includes('public')) {
      return 'Client Component';
    }

    return 'API Implementation File';
  }

  static _extractSymbol(lines, lineIdx) {
    for (let i = lineIdx; i >= Math.max(0, lineIdx - 6); i--) {
      const match = lines[i].match(/(?:function|def|class|const|let|var)\s+([a-zA-Z0-9_]+)/);
      if (match) return match[1];
      const methodMatch = lines[i].match(/(?:app|router)\.(?:get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/);
      if (methodMatch) return methodMatch[0];
    }
    return 'API Handler';
  }

  static _detectLanguage(relPath) {
    const ext = path.extname(relPath).toLowerCase();
    switch (ext) {
      case '.js': return 'javascript';
      case '.jsx': return 'react-jsx';
      case '.ts': return 'typescript';
      case '.tsx': return 'typescript-tsx';
      case '.py': return 'python';
      case '.php': return 'php';
      case '.css': return 'css';
      default: return 'text';
    }
  }

  static _traceDownstreamDependencies(lines, lineIdx, currentRelPath, projectRoot, sourceFiles, getFileLines) {
    const downstream = [];
    const windowStart = Math.max(0, lineIdx - 4);
    const windowEnd = Math.min(lines.length - 1, lineIdx + 12);
    const contextText = lines.slice(windowStart, windowEnd + 1).join('\n');

    const callMatch = contextText.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\(/);
    if (!callMatch) return downstream;

    const objectName = callMatch[1];
    const methodName = callMatch[2];

    const fileHeader = lines.slice(0, 35).join('\n');
    const importRegex = new RegExp(`(?:import\\s+.*?${objectName}.*?from|require\\s*\\()\\s*['"]([^'"]+)['"]`, 'i');
    const importMatch = fileHeader.match(importRegex);

    if (importMatch) {
      let importedPath = importMatch[1];
      const currentDir = path.dirname(currentRelPath);
      let targetCandidate = path.join(currentDir, importedPath).replace(/\\/g, '/');

      for (const rel of sourceFiles) {
        if (rel.replace(/\.[^.]+$/, '') === targetCandidate || rel.includes(path.basename(importedPath))) {
          const cached = getFileLines(rel);
          if (cached && cached.text.includes(methodName)) {
            for (let k = 0; k < cached.lines.length; k++) {
              if (cached.lines[k].includes(methodName)) {
                const s = Math.max(0, k - 1);
                const e = Math.min(cached.lines.length - 1, k + 7);
                downstream.push({
                  role: rel.includes('model') || rel.includes('db') ? 'Database / Model Query' : 'Service / Business Logic',
                  filePath: rel,
                  absolutePath: cached.fullPath,
                  line: k + 1,
                  startLine: s + 1,
                  endLine: e + 1,
                  symbol: methodName,
                  language: this._detectLanguage(rel),
                  syntaxSnippet: cached.lines.slice(s, e + 1).join('\n'),
                  evidence: `Imported downstream service executing business/database logic for '${methodName}()'.`
                });
                break;
              }
            }
          }
          break;
        }
      }
    }

    return downstream;
  }
}

module.exports = CallSourceCorrelator;
