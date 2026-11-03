/**
 * Unused Code Detection and Auto-Fix Utilities
 * Performs static analysis for CSS selectors and project-wide code references.
 */

const fs = require('fs');
const path = require('path');
const { validateProjectPath, isIgnoredDir, isAllowedSourceFile } = require('../security/path-validator');

class UnusedCodeAnalyzer {
  static analyzeProject(projectDir) {
    const result = validateProjectPath(projectDir);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const root = result.resolvedPath;
    const entries = [];
    const fileList = [];

    const walk = (currentDir) => {
      let dirEntries = [];
      try {
        dirEntries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of dirEntries) {
        if (entry.isDirectory()) {
          if (!isIgnoredDir(entry.name)) walk(path.join(currentDir, entry.name));
          continue;
        }

        if (!entry.isFile()) continue;
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(root, fullPath).replace(/\\/g, '/');
        if (!isAllowedSourceFile(entry.name)) continue;
        if (!relPath || relPath.startsWith('..')) continue;
        fileList.push({ fullPath, relPath });
      }
    };

    walk(root);

    const usageText = fileList.map(({ fullPath }) => {
      try {
        return fs.readFileSync(fullPath, 'utf8');
      } catch {
        return '';
      }
    });

    const cssEntries = [];
    for (let i = 0; i < fileList.length; i++) {
      const { fullPath, relPath } = fileList[i];
      const ext = path.extname(relPath).toLowerCase();
      if (!['.css', '.scss', '.sass', '.less'].includes(ext)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const resultEntries = this.analyzeCssUsage(content, relPath, usageText);
        cssEntries.push(...resultEntries);
      } catch {}
    }

    const generalEntries = [];
    for (let i = 0; i < fileList.length; i++) {
      const { fullPath, relPath } = fileList[i];
      const ext = path.extname(relPath).toLowerCase();
      if (!['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.php', '.html', '.htm'].includes(ext)) continue;
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const resultEntries = this.analyzeFileIdentifiers(content, relPath, fullPath);
        generalEntries.push(...resultEntries);
      } catch {}
    }

    const allEntries = [...cssEntries, ...generalEntries];
    const usedCount = allEntries.filter(item => item.status === 'used').length;
    const unusedCount = allEntries.filter(item => item.status === 'unused').length;
    const potentialCount = allEntries.filter(item => item.status === 'potentially_unused').length;

    return {
      projectRoot: root,
      scannedFiles: fileList.length,
      entries: allEntries,
      summary: {
        totalScannedFiles: fileList.length,
        totalUsedCodeBlocks: usedCount,
        totalUnusedCodeBlocks: unusedCount,
        totalPotentiallyUnusedCodeBlocks: potentialCount,
        totalCodeBlocks: allEntries.length
      }
    };
  }

  static analyzeCssUsage(content, filePath, projectTexts = []) {
    const usageMap = new Map();
    const projectList = Array.isArray(projectTexts) ? projectTexts : [projectTexts];

    for (const snippet of projectList) {
      if (!snippet || typeof snippet !== 'string') continue;
      const classMatches = snippet.matchAll(/(?:class|className)\s*=\s*["'`]+([^"'`]+)["'`]+/g);
      for (const match of classMatches) {
        const tokens = match[1].split(/[\s\t\n]+/).filter(Boolean);
        for (const token of tokens) {
          const clean = token.replace(/["'`<>]/g, '').trim();
          if (!clean) continue;
          usageMap.set(clean, (usageMap.get(clean) || 0) + 1);
        }
      }

      const dynamicClassMatches = snippet.matchAll(/classList\.(?:add|remove|toggle)\s*\(\s*\[?\s*([\s\S]*?)\]\s*\)/g);
      for (const match of dynamicClassMatches) {
        const values = (match[1] || '').match(/['"`]([^'"`]+)['"`]/g) || [];
        for (const item of values) {
          const clean = item.replace(/['"`]/g, '');
          if (clean) usageMap.set(clean, (usageMap.get(clean) || 0) + 1);
        }
      }
    }

    const blocks = [];
    const ruleRegex = /([^{]+)\s*\{\s*([^{}]+)\s*\}/g;
    let match;
    while ((match = ruleRegex.exec(content)) !== null) {
      const selectorText = match[1].trim();
      if (!selectorText || selectorText.startsWith('@')) continue;
      const bodyText = match[2];
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;
      const startLine = content.slice(0, startIndex).split(/\r?\n/).length;
      const endLine = content.slice(0, endIndex).split(/\r?\n/).length;
      blocks.push({ selectorText, bodyText, startIndex, endIndex, startLine, endLine, exactCode: content.slice(startIndex, endIndex) });
    }

    return blocks.map(block => {
      const selectorList = block.selectorText.split(',').map(s => s.trim()).filter(Boolean);
      const usedFiles = [];
      let occurrences = 0;
      let status = 'unused';

      for (const selector of selectorList) {
        const classNames = [...new Set((selector.match(/\.[A-Za-z0-9_-]+/g) || []).map(name => name.slice(1)))]
          .concat([...new Set((selector.match(/#[A-Za-z0-9_-]+/g) || []).map(name => name.slice(1)))])
          .filter(Boolean);

        if (classNames.length === 0) {
          const cleaned = selector.replace(/[\s>+~:]/g, '');
          if (cleaned) {
            const simpleName = cleaned.replace(/\.[A-Za-z0-9_-]+/g, '').trim();
            if (simpleName) classNames.push(simpleName);
          }
        }

        for (const name of classNames) {
          const freq = usageMap.get(name) || 0;
          if (freq > 0) {
            usedFiles.push(filePath);
            occurrences += freq;
          }
        }
      }

      if (usedFiles.length > 0 && occurrences > 0) status = 'used';
      if (status === 'unused' && /(?:classList|data-|\[[A-Za-z0-9_-]+\])/.test(block.selectorText)) status = 'potentially_unused';

      return {
        filePath,
        selector: selectorList.join(', '),
        status,
        usedIn: usedFiles.length > 0 ? usedFiles : ['None'],
        occurrences,
        startLine: block.startLine,
        endLine: block.endLine,
        exactCode: block.exactCode,
        startIndex: block.startIndex,
        endIndex: block.endIndex
      };
    });
  }

  static analyzeFileIdentifiers(content, filePath, absolutePath) {
    const ext = path.extname(filePath).toLowerCase();
    const lines = content.split(/\r?\n/);
    const declarations = [];
    const usageCounts = new Map();

    const addMatch = (match, kind) => {
      if (!match || !match[1]) return;
      const name = match[1].trim();
      if (!name || ['if', 'for', 'while', 'return', 'class', 'const', 'let', 'var', 'async', 'await'].includes(name)) return;
      declarations.push({ name, kind, line: lines.findIndex(line => line.includes(name)) + 1 || 1 });
    };

    const patternMap = {
      '.js': [/(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g, /(import\s+(?:\*\s+as\s+)?|import\s+\{[^}]*\}|import\s+)([A-Za-z_$][\w$]*)/g],
      '.jsx': [/(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g, /(import\s+(?:\*\s+as\s+)?|import\s+\{[^}]*\}|import\s+)([A-Za-z_$][\w$]*)/g],
      '.ts': [/(?:export\s+)?(?:const|let|var|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/g, /(import\s+(?:\*\s+as\s+)?|import\s+\{[^}]*\}|import\s+)([A-Za-z_$][\w$]*)/g],
      '.tsx': [/(?:export\s+)?(?:const|let|var|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/g, /(import\s+(?:\*\s+as\s+)?|import\s+\{[^}]*\}|import\s+)([A-Za-z_$][\w$]*)/g],
      '.py': [/(?:^|\s)(?:def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/gm, /(?:^|\s)(?:import|from)\s+([A-Za-z_][A-Za-z0-9_]*)/gm],
      '.php': [/(?:function|class)\s+([A-Za-z_][A-Za-z0-9_]*)/g, /(include|require|include_once|require_once)\s+["']([^"']+)["']/g],
      '.html': [/\b(?:id|class)\s*=\s*["'`]+([^"'`]+)["'`]+/g]
    };

    for (const patterns of patternMap[ext] || []) {
      let match;
      while ((match = patterns.exec(content)) !== null) {
        addMatch(match, ext);
      }
    }

    const finalEntries = [];
    for (const decl of declarations) {
      if (!decl.name) continue;
      const regex = new RegExp(`\\b${decl.name}\\b`, 'g');
      let count = 0;
      for (const line of lines) {
        const matches = line.match(regex);
        if (matches) count += matches.length;
      }
      const usage = count > 1 ? 'used' : (count === 1 ? 'used' : 'unused');
      finalEntries.push({
        filePath,
        absolutePath,
        selector: decl.name,
        status: usage,
        usedIn: usage === 'unused' ? ['None'] : [filePath],
        occurrences: count,
        startLine: decl.line,
        endLine: decl.line,
        exactCode: lines[decl.line - 1] || decl.name,
        category: ext.replace('.', '')
      });
    }

    return finalEntries;
  }

  static applyCssFix(cssText, reportEntries) {
    if (!cssText || !Array.isArray(reportEntries)) return cssText;

    const removals = reportEntries
      .filter(item => item && item.status === 'unused')
      .filter(item => typeof item.startIndex === 'number' && typeof item.endIndex === 'number')
      .sort((a, b) => b.startIndex - a.startIndex);

    let cleaned = cssText;
    for (const item of removals) {
      cleaned = cleaned.slice(0, item.startIndex) + cleaned.slice(item.endIndex);
    }
    return cleaned;
  }

  static applyFixToProject(projectDir, filePath, entries = []) {
    const validation = validateProjectPath(projectDir);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const targetPath = path.resolve(projectDir, filePath || '');
    if (!targetPath.startsWith(path.resolve(projectDir))) {
      return { success: false, error: 'Target file is outside the project root.' };
    }

    if (!fs.existsSync(targetPath)) {
      return { success: false, error: `File not found: ${targetPath}` };
    }

    const backupDir = path.join(projectDir, '.auditor-backups', 'unused-code');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `${Date.now()}-${path.basename(targetPath)}.bak`);
    fs.copyFileSync(targetPath, backupPath);

    const original = fs.readFileSync(targetPath, 'utf8');
    const cleaned = this.applyCssFix(original, entries);
    fs.writeFileSync(targetPath, cleaned, 'utf8');

    return {
      success: true,
      backupId: backupPath,
      filePath: path.relative(projectDir, targetPath).replace(/\\/g, '/'),
      changed: original !== cleaned
    };
  }
}

module.exports = UnusedCodeAnalyzer;
