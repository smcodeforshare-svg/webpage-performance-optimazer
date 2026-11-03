/**
 * Patch Generator
 * Generates unified patch strings and downloadable .patch files for Git integration.
 */

const DiffEngine = require('./diff-engine');

class PatchGenerator {
  /**
   * Generates a unified diff for a finding
   * @param {Object} finding 
   * @param {string} fullOriginalFileContent 
   */
  static generateFindingPatch(finding, fullOriginalFileContent) {
    const origLines = fullOriginalFileContent.split(/\r?\n/);
    const startIdx = Math.max(0, finding.startLine - 1);
    const endIdx = Math.min(origLines.length, finding.endLine);

    const replacementLines = finding.replacementCode.split(/\r?\n/);
    const newLines = [
      ...origLines.slice(0, startIdx),
      ...replacementLines,
      ...origLines.slice(endIdx)
    ];

    const modifiedContent = newLines.join('\n');
    const unifiedDiff = DiffEngine.createUnifiedDiff(
      fullOriginalFileContent,
      modifiedContent,
      finding.filePath
    );

    return {
      unifiedDiff,
      modifiedContent
    };
  }
}

module.exports = PatchGenerator;
