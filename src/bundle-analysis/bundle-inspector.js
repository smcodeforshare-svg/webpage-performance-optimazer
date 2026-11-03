/**
 * Build & Bundle Inspector
 * Examines existing build outputs and bundler configs to detect oversized chunks and lazy loading opportunities.
 */

const fs = require('fs');
const path = require('path');

class BundleInspector {
  /**
   * Inspects a project directory for build artifacts and bundle statistics
   * @param {string} projectRoot 
   * @returns {Object}
   */
  static inspect(projectRoot) {
    const summary = {
      hasBuildArtifacts: false,
      buildType: 'unknown',
      totalBundleSizeKb: 0,
      chunks: [],
      warnings: []
    };

    const buildCandidates = [
      { dir: '.next', type: 'nextjs' },
      { dir: 'dist', type: 'vite/rollup/webpack' },
      { dir: 'build', type: 'create-react-app/webpack' },
      { dir: 'out', type: 'static-export' }
    ];

    for (const candidate of buildCandidates) {
      const fullPath = path.join(projectRoot, candidate.dir);
      if (fs.existsSync(fullPath)) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            summary.hasBuildArtifacts = true;
            summary.buildType = candidate.type;
            summary.buildDir = candidate.dir;
            this._scanChunks(fullPath, summary, 0);
            break;
          }
        } catch {}
      }
    }

    // Sort chunks by size descending
    summary.chunks.sort((a, b) => b.sizeBytes - a.sizeBytes);

    // Flag chunks > 250KB
    for (const chunk of summary.chunks) {
      if (chunk.sizeBytes > 250 * 1024 && (chunk.name.endsWith('.js') || chunk.name.endsWith('.mjs'))) {
        summary.warnings.push({
          chunk: chunk.name,
          sizeKb: Math.round(chunk.sizeBytes / 1024),
          recommendation: 'JavaScript chunk exceeds recommended 250KB limit. Consider dynamic import() or route-level code splitting.'
        });
      }
    }

    return summary;
  }

  static _scanChunks(dirPath, summary, depth) {
    if (depth > 4) return;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          this._scanChunks(full, summary, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.js', '.mjs', '.css', '.wasm'].includes(ext)) {
            const stat = fs.statSync(full);
            summary.totalBundleSizeKb += Math.round(stat.size / 1024);
            summary.chunks.push({
              name: entry.name,
              relativePath: path.relative(dirPath, full),
              sizeBytes: stat.size,
              sizeKb: Math.round(stat.size / 1024)
            });
          }
        }
      }
    } catch {}
  }
}

module.exports = BundleInspector;
