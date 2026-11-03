/**
 * Line Mapper and Code Slice Engine
 * Computes exact 1-indexed line numbers and character offsets, and generates content hashes for staleness checks.
 */

const crypto = require('crypto');

class LineMapper {
  /**
   * @param {string} sourceText 
   */
  constructor(sourceText) {
    this.text = sourceText;
    this.lines = sourceText.split(/\r?\n/);
    this.lineOffsets = [];

    let currentOffset = 0;
    for (let i = 0; i < this.lines.length; i++) {
      this.lineOffsets.push(currentOffset);
      // Account for newline character (\n or \r\n)
      currentOffset += this.lines[i].length + 1;
    }
  }

  /**
   * Computes sha256 hash of file content for change tracking / staleness detection
   */
  getContentHash() {
    return crypto.createHash('sha256').update(this.text, 'utf8').digest('hex');
  }

  /**
   * Total number of lines
   */
  getLineCount() {
    return this.lines.length;
  }

  /**
   * Maps a 0-indexed character index in the string to { line, column } (1-indexed)
   * @param {number} charIndex 
   */
  indexToPosition(charIndex) {
    if (charIndex < 0) return { line: 1, column: 1 };
    if (charIndex >= this.text.length) {
      return { line: this.lines.length, column: (this.lines[this.lines.length - 1] || '').length + 1 };
    }

    // Binary search in lineOffsets
    let low = 0;
    let high = this.lineOffsets.length - 1;
    let lineIdx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.lineOffsets[mid] <= charIndex) {
        lineIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const column = charIndex - this.lineOffsets[lineIdx] + 1;
    return {
      line: lineIdx + 1,
      column: Math.max(1, column)
    };
  }

  /**
   * Extracts the exact source slice between 1-indexed line numbers (inclusive)
   * @param {number} startLine 
   * @param {number} endLine 
   * @returns {string}
   */
  getLinesSlice(startLine, endLine) {
    const s = Math.max(1, startLine) - 1;
    const e = Math.min(this.lines.length, endLine);
    return this.lines.slice(s, e).join('\n');
  }

  /**
   * Gets a single line of text (1-indexed)
   * @param {number} lineNumber 
   * @returns {string}
   */
  getLine(lineNumber) {
    if (lineNumber < 1 || lineNumber > this.lines.length) return '';
    return this.lines[lineNumber - 1];
  }
}

module.exports = LineMapper;
