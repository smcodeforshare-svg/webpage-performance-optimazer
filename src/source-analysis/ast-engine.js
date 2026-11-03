/**
 * AST and Code Structure Parser Engine
 * Accurately detects balanced scopes, function boundaries, imports, and hook invocations.
 */

const LineMapper = require('./line-mapper');

class AstEngine {
  /**
   * Finds the matching closing bracket/parenthesis/brace starting from an opening position
   * @param {string} text 
   * @param {number} openIndex 
   * @param {string} openChar 
   * @param {string} closeChar 
   * @returns {number} Index of matching close char or -1
   */
  static findMatchingDelimiter(text, openIndex, openChar = '{', closeChar = '}') {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = openIndex; i < text.length; i++) {
      const char = text[i];
      const prev = i > 0 ? text[i - 1] : '';
      const next = i + 1 < text.length ? text[i + 1] : '';

      // Handle comment toggles
      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      // Check comment starts if not inside strings
      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        if (char === '/' && next === '/') {
          inLineComment = true;
          i++;
          continue;
        }
        if (char === '/' && next === '*') {
          inBlockComment = true;
          i++;
          continue;
        }
      }

      // String toggles
      if (char === "'" && prev !== '\\' && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (char === '"' && prev !== '\\' && !inSingleQuote && !inBacktick) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (char === '`' && prev !== '\\' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
        continue;
      }

      // If inside strings, skip delimiter checks
      if (inSingleQuote || inDoubleQuote || inBacktick) {
        continue;
      }

      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Detects the enclosing function or component name for a given position
   * @param {string} text 
   * @param {number} position 
   * @returns {string}
   */
  static findEnclosingSymbol(text, position) {
    const prefix = text.slice(0, position);

    // Look backwards for function, const/let/var component = , class, or def (Python)
    const functionPatterns = [
      /(?:export\s+(?:default\s+)?)?(?:function|class)\s+([A-Za-z0-9_]+)/g,
      /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:(?:\([^\)]*\)|[A-Za-z0-9_]+)\s*=>|function)/g,
      /def\s+([A-Za-z0-9_]+)\s*\(/g
    ];

    let lastSymbol = 'Anonymous';
    let lastIndex = -1;

    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(prefix)) !== null) {
        if (match.index > lastIndex) {
          lastIndex = match.index;
          lastSymbol = match[1];
        }
      }
    }

    return lastSymbol;
  }

  /**
   * Scans text for all imports
   * @param {string} text 
   * @returns {Array<{ raw: string, moduleName: string, importedSymbols: string[], start: number, end: number }>}
   */
  static extractImports(text) {
    const imports = [];
    const importRegex = /import\s+(?:([\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(text)) !== null) {
      const raw = match[0];
      const specifiers = match[1] ? match[1].trim() : '';
      const moduleName = match[2];
      const importedSymbols = specifiers
        .replace(/[{}]/g, '')
        .split(',')
        .map(s => s.trim().split(/\s+as\s+/)[0])
        .filter(Boolean);

      imports.push({
        raw,
        moduleName,
        importedSymbols,
        start: match.index,
        end: match.index + raw.length
      });
    }

    return imports;
  }
}

module.exports = AstEngine;
