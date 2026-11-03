/**
 * Unified Diff Engine
 * Produces standard Git-compatible unified diffs and structured line diffs for visual rendering.
 */

class DiffEngine {
  /**
   * Generates a standard unified diff header and hunks
   * @param {string} originalText 
   * @param {string} modifiedText 
   * @param {string} filePath 
   * @returns {string} Unified diff string
   */
  static createUnifiedDiff(originalText, modifiedText, filePath = 'file') {
    const origLines = originalText.split(/\r?\n/);
    const modLines = modifiedText.split(/\r?\n/);

    const diffLines = [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      `@@ -1,${origLines.length} +1,${modLines.length} @@`
    ];

    // Simple line diff generator
    let i = 0, j = 0;
    while (i < origLines.length || j < modLines.length) {
      if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
        diffLines.push(` ${origLines[i]}`);
        i++;
        j++;
      } else {
        if (i < origLines.length) {
          diffLines.push(`-${origLines[i]}`);
          i++;
        }
        if (j < modLines.length) {
          diffLines.push(`+${modLines[j]}`);
          j++;
        }
      }
    }

    return diffLines.join('\n');
  }

  /**
   * Generates visual side-by-side or line-by-line diff items for frontend rendering
   * @param {string} originalCode 
   * @param {string} replacementCode 
   * @param {number} startLine 
   */
  static generateVisualDiff(originalCode, replacementCode, startLine = 1) {
    const origLines = (originalCode || '').split(/\r?\n/);
    const repLines = (replacementCode || '').split(/\r?\n/);

    const rows = [];
    const maxLen = Math.max(origLines.length, repLines.length);

    for (let idx = 0; idx < maxLen; idx++) {
      const orig = origLines[idx];
      const rep = repLines[idx];

      if (orig !== undefined && rep !== undefined) {
        if (orig === rep) {
          rows.push({ type: 'unchanged', lineNum: startLine + idx, orig, rep });
        } else {
          rows.push({ type: 'modified', lineNum: startLine + idx, orig, rep });
        }
      } else if (orig !== undefined) {
        rows.push({ type: 'deleted', lineNum: startLine + idx, orig, rep: '' });
      } else if (rep !== undefined) {
        rows.push({ type: 'added', lineNum: startLine + idx, orig: '', rep });
      }
    }

    return rows;
  }
}

module.exports = DiffEngine;
