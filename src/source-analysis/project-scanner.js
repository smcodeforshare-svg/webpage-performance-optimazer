/**
 * Full Project Source Scanner Orchestrator
 * Traverses local repository files, applies language-specific rules, and compiles findings.
 * Supports React, Next.js, Plain JavaScript, TypeScript / TSX, jQuery, PHP / WordPress, Python, and CSS.
 * Discovers and traces multi-file API architecture and exact code syntax across the codebase.
 */

const fs = require('fs');
const path = require('path');
const { validateProjectPath, isIgnoredDir, isAllowedSourceFile } = require('../security/path-validator');
const ReactRules = require('../react-analysis/react-rules');
const NextjsRules = require('../react-analysis/nextjs-rules');
const PythonRules = require('../python-analysis/python-rules');
const CssRules = require('../css-analysis/css-rules');
const DependencyRules = require('../dependency-analysis/dependency-rules');
const BundleInspector = require('../bundle-analysis/bundle-inspector');
const PhpRules = require('../php-analysis/php-rules');
const JsJqueryRules = require('../javascript-analysis/js-jquery-rules');
const CallSourceCorrelator = require('../network/call-source-correlator');

const MAX_FILES_TO_SCAN = 2000;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

class ProjectScanner {
  /**
   * Scans a target directory and returns structured findings and project metrics
   * @param {string} projectDir 
   * @param {Object} options 
   */
  static scan(projectDir, options = {}) {
    const valResult = validateProjectPath(projectDir);
    if (!valResult.valid) {
      throw new Error(valResult.error);
    }

    const root = valResult.resolvedPath;
    const isNextProject = this._detectNextProject(root);
    const findings = [];
    const scannedFiles = [];
    let fileCount = 0;

    const crawl = (currentDir, depth = 0) => {
      if (depth > 14 || fileCount >= MAX_FILES_TO_SCAN) return;

      let entries;
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (fileCount >= MAX_FILES_TO_SCAN) break;

        const fullPath = path.resolve(currentDir, entry.name);
        const relPath = path.relative(root, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!isIgnoredDir(entry.name)) {
            crawl(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          if (!isAllowedSourceFile(entry.name)) continue;

          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > MAX_FILE_SIZE_BYTES) continue; // Skip huge generated files
          } catch {
            continue;
          }

          fileCount++;
          scannedFiles.push(relPath);

          let content;
          try {
            content = fs.readFileSync(fullPath, 'utf8');
          } catch {
            continue;
          }

          const ext = path.extname(entry.name).toLowerCase();

          // JavaScript / TypeScript / TSX / React / Next.js / jQuery
          if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
            // 1. General JS / TS / TSX / jQuery rules
            findings.push(...JsJqueryRules.analyze(content, relPath, fullPath));
            // 2. React lifecycle / rendering / hook rules
            findings.push(...ReactRules.analyze(content, relPath, fullPath));
            // 3. Next.js SSR / client component rules
            if (isNextProject) {
              findings.push(...NextjsRules.analyze(content, relPath, fullPath));
            }
          }

          // PHP / WordPress (.php, .phtml, .inc)
          if (['.php', '.phtml', '.inc'].includes(ext)) {
            findings.push(...PhpRules.analyze(content, relPath, fullPath));
          }

          // Python (.py)
          if (ext === '.py') {
            findings.push(...PythonRules.analyze(content, relPath, fullPath));
          }

          // CSS / SCSS
          if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
            findings.push(...CssRules.analyze(content, relPath, fullPath));
          }

          // package.json
          if (entry.name === 'package.json') {
            findings.push(...DependencyRules.analyzePackageJson(content, relPath, fullPath));
          }
        }
      }
    };

    crawl(root);

    // Run bundle inspection
    const bundleSummary = BundleInspector.inspect(root);

    // Discover all APIs and trace multi-file architecture and syntax blocks across the codebase
    const apiInventory = CallSourceCorrelator.discoverProjectApis(root, scannedFiles);

    return {
      projectRoot: root,
      scannedAt: new Date().toISOString(),
      isNextProject,
      totalFilesScanned: scannedFiles.length,
      scannedFiles,
      findings,
      bundleSummary,
      apiInventory,
      summary: {
        totalFindings: findings.length,
        totalApisDiscovered: apiInventory.length,
        multiFileApisCount: apiInventory.filter(a => a.isMultiFile).length,
        critical: findings.filter(f => f.severity === 'critical').length,
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length,
        verified: findings.filter(f => f.confidence === 'verified').length,
        stronglySupported: findings.filter(f => f.confidence === 'strongly_supported').length,
        hypotheses: findings.filter(f => f.confidence === 'hypothesis').length
      }
    };
  }

  static _detectNextProject(rootDir) {
    if (fs.existsSync(path.join(rootDir, 'next.config.js')) ||
        fs.existsSync(path.join(rootDir, 'next.config.mjs')) ||
        fs.existsSync(path.join(rootDir, 'next.config.ts'))) {
      return true;
    }
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return Boolean(pkg.dependencies?.next || pkg.devDependencies?.next);
      } catch {}
    }
    return false;
  }
}

module.exports = ProjectScanner;
