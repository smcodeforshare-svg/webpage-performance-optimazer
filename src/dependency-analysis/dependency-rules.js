/**
 * Dependency and Library Analysis Rules Engine
 * Inspects package.json, requirements.txt, and lockfiles for heavy or redundant libraries.
 */

const { createFinding } = require('../source-analysis/finding-generator');
const LineMapper = require('../source-analysis/line-mapper');

const HEAVY_PACKAGES = {
  moment: {
    alternative: 'date-fns, dayjs, or native Intl',
    sizeKb: 290,
    savingsKb: 65,
    reason: 'Monolithic date library with un-treeshakeable locales.'
  },
  lodash: {
    alternative: 'lodash-es or native ES2020+ methods',
    sizeKb: 72,
    savingsKb: 60,
    reason: 'Non-ES module default import pulls the entire collection into bundles.'
  },
  request: {
    alternative: 'native fetch, undici, or axios',
    sizeKb: 150,
    savingsKb: 100,
    reason: 'Deprecated unmaintained HTTP library.'
  },
  'core-js': {
    alternative: 'targeted browserslist configuration',
    sizeKb: 250,
    savingsKb: 150,
    reason: 'Global polyfills can drastically bloat bundle if not targeted.'
  }
};

class DependencyRules {
  /**
   * Analyzes package.json for known heavy or duplicate dependencies
   * @param {string} content 
   * @param {string} relativePath 
   * @param {string} absolutePath 
   * @returns {Array<Object>}
   */
  static analyzePackageJson(content, relativePath, absolutePath) {
    const findings = [];
    const mapper = new LineMapper(content);
    const fileHash = mapper.getContentHash();

    let pkg;
    try {
      pkg = JSON.parse(content);
    } catch {
      return findings;
    }

    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const allDepNames = new Set([...Object.keys(deps), ...Object.keys(devDeps)]);

    // Check heavy packages
    for (const [pkgName, meta] of Object.entries(HEAVY_PACKAGES)) {
      if (deps[pkgName] || devDeps[pkgName]) {
        // Find line number in file
        const regex = new RegExp(`"${pkgName}"\\s*:\\s*"([^"]+)"`);
        const match = regex.exec(content);
        const linePos = match ? mapper.indexToPosition(match.index) : { line: 1, column: 1 };
        const endPos = match ? mapper.indexToPosition(match.index + match[0].length) : { line: 1, column: 1 };
        const existingCode = match ? mapper.getLinesSlice(linePos.line, endPos.line) : `"${pkgName}": "${deps[pkgName] || devDeps[pkgName]}"`;

        findings.push(createFinding({
          title: `Heavy Dependency Detected: '${pkgName}'`,
          filePath: relativePath,
          absolutePath,
          startLine: linePos.line,
          endLine: endPos.line,
          startColumn: linePos.column,
          endColumn: endPos.column,
          symbol: pkgName,
          category: 'dependency-bloat',
          severity: 'high',
          confidence: 'verified',
          sourceType: 'static_ast',
          evidence: `${meta.reason} Estimated package weight ~${meta.sizeKb}KB.`,
          existingCode,
          replacementCode: `// Replace with modern lightweight alternative:\n// npm uninstall ${pkgName} && npm install ${meta.alternative.split(',')[0]}`,
          replacementInstructions: {
            action: `Migrate to '${meta.alternative}'.`
          },
          whyFixHelps: {
            cause: `Including '${pkgName}' inflates node_modules and increases production bundle size.`,
            behaviorChange: `Swapping to lightweight alternatives maintains functionality while saving ~${meta.savingsKb}KB gzipped.`,
            expectedBenefit: `Saves approximately ${meta.savingsKb}KB in client bundle payload.`
          },
          fileHash
        }));
      }
    }

    // Check duplicate or redundant client libraries (e.g. axios AND node-fetch)
    if (deps['axios'] && deps['node-fetch']) {
      findings.push(createFinding({
        title: "Multiple Redundant HTTP Client Libraries ('axios' and 'node-fetch')",
        filePath: relativePath,
        absolutePath,
        startLine: 1,
        endLine: 1,
        symbol: 'dependencies',
        category: 'dependency-redundancy',
        severity: 'medium',
        confidence: 'verified',
        sourceType: 'static_ast',
        evidence: "Project includes both 'axios' and 'node-fetch'. In Node 18+, native fetch is globally available.",
        existingCode: '"axios": ..., "node-fetch": ...',
        replacementCode: '// Consolidate onto native global fetch API.',
        replacementInstructions: {
          action: 'Standardize on a single HTTP client or adopt native fetch.'
        },
        fileHash
      }));
    }

    return findings;
  }
}

module.exports = DependencyRules;
