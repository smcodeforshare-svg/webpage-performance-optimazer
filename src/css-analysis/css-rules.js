/**
 * CSS Performance and Layout Shift Rules Engine
 * Detects layout-triggering animations, render-blocking @import, and excessive selector complexity.
 */

const LineMapper = require('../source-analysis/line-mapper');
const { createFinding } = require('../source-analysis/finding-generator');

class CssRules {
  /**
   * Analyzes CSS content for performance bottlenecks
   * @param {string} content 
   * @param {string} relativePath 
   * @param {string} absolutePath 
   * @returns {Array<Object>}
   */
  static analyze(content, relativePath, absolutePath) {
    const mapper = new LineMapper(content);
    const fileHash = mapper.getContentHash();
    const findings = [];

    findings.push(...this.checkLayoutAnimations(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkRenderBlockingImports(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkSelectorComplexity(content, mapper, relativePath, absolutePath, fileHash));

    return findings;
  }

  /**
   * Rule: Animations on layout properties (top, left, width, height, margin)
   */
  static checkLayoutAnimations(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const keyframeRegex = /@keyframes\s+([A-Za-z0-9_-]+)\s*\{([\s\S]*?)\n\}/g;
    let match;

    while ((match = keyframeRegex.exec(content)) !== null) {
      const animName = match[1];
      const animBody = match[2];
      const layoutProps = ['top', 'left', 'right', 'bottom', 'width', 'height', 'margin', 'padding'];

      for (const prop of layoutProps) {
        const propRegex = new RegExp(`\\b${prop}\\s*:\\s*[^;]+;`, 'g');
        let propMatch;
        while ((propMatch = propRegex.exec(animBody)) !== null) {
          const matchIndex = match.index + animBody.indexOf(propMatch[0]);
          const startPos = mapper.indexToPosition(matchIndex);
          const endPos = mapper.indexToPosition(matchIndex + propMatch[0].length);
          const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);

          findings.push(createFinding({
            title: `Layout-Triggering Animation on '${prop}' in @keyframes ${animName}`,
            filePath: relativePath,
            absolutePath,
            startLine: startPos.line,
            endLine: endPos.line,
            startColumn: startPos.column,
            endColumn: endPos.column,
            symbol: `@keyframes ${animName}`,
            category: 'css-paint-layout',
            severity: 'high',
            confidence: 'verified',
            sourceType: 'static_ast',
            evidence: `Animating '${prop}' forces the browser to recalculate layout and repaint on every animation frame, degrading Cumulative Layout Shift (CLS) and causing 60fps frame drops.`,
            existingCode,
            replacementCode: '  transform: translate3d(0, 10px, 0); /* Use hardware-accelerated transform instead of layout properties */',
            replacementInstructions: {
              action: `Replace '${prop}' with CSS transform (translate3d, scale) or opacity.`
            },
            whyFixHelps: {
              cause: 'Properties like top/left/width/height force CPU reflow and GPU repaint on every tick.',
              behaviorChange: 'Transform animations are offloaded to the GPU compositor thread without triggering layout.',
              expectedBenefit: 'Maintains silky 60fps animations and completely eliminates animation-induced CLS.'
            },
            fileHash
          }));
        }
      }
    }

    return findings;
  }

  /**
   * Rule: Render-blocking @import in CSS
   */
  static checkRenderBlockingImports(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const importRegex = /@import\s+(?:url\(['"]?([^'")]+)['"]?\)|['"]([^'"]+)['"])\s*;/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importUrl = match[1] || match[2];
      const startPos = mapper.indexToPosition(match.index);
      const endPos = mapper.indexToPosition(match.index + match[0].length);
      const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);

      findings.push(createFinding({
        title: "Render-Blocking '@import' in Stylesheet",
        filePath: relativePath,
        absolutePath,
        startLine: startPos.line,
        endLine: endPos.line,
        startColumn: startPos.column,
        endColumn: endPos.column,
        symbol: '@import',
        category: 'css-network-blocking',
        severity: 'high',
        confidence: 'verified',
        sourceType: 'static_ast',
        evidence: `@import url('${importUrl}') creates a sequential network dependency waterfall, delaying initial page render.`,
        existingCode,
        replacementCode: `/* Remove @import from CSS and load concurrently in HTML <head>: */\n/* <link rel="stylesheet" href="${importUrl}" /> */`,
        replacementInstructions: {
          action: "Remove @import from stylesheet and link the external resource concurrently in the HTML document <head>."
        },
        whyFixHelps: {
          cause: 'Browser cannot parse or discover the nested imported stylesheet until the parent stylesheet has finished downloading.',
          behaviorChange: 'Allows browser preloader to download all stylesheets concurrently.',
          expectedBenefit: 'Decreases First Contentful Paint (FCP) by one entire round-trip network latency.'
        },
        fileHash
      }));
    }

    return findings;
  }

  /**
   * Rule: Excessive Selector Complexity
   */
  static checkSelectorComplexity(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    // Matches rules like: a b c d e { ... }
    const ruleRegex = /([^{}]+)\{/g;
    let match;

    while ((match = ruleRegex.exec(content)) !== null) {
      const selector = match[1].trim();
      // Skip media queries, keyframes, font-face
      if (selector.startsWith('@')) continue;

      const combinators = selector.split(/[\s>+~]+/).filter(Boolean);
      if (combinators.length >= 5) {
        const startPos = mapper.indexToPosition(match.index);
        const endPos = mapper.indexToPosition(match.index + selector.length);
        const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);

        findings.push(createFinding({
          title: 'Excessive CSS Selector Specificity & Complexity',
          filePath: relativePath,
          absolutePath,
          startLine: startPos.line,
          endLine: endPos.line,
          startColumn: startPos.column,
          endColumn: endPos.column,
          symbol: selector.slice(0, 40),
          category: 'css-selector-complexity',
          severity: 'low',
          confidence: 'strongly_supported',
          sourceType: 'static_ast',
          evidence: `Selector has ${combinators.length} levels of nesting ('${selector.slice(0, 50)}...'), increasing style recalculation time.`,
          existingCode,
          replacementCode: `/* Adopt BEM or flat class naming: */\n.${combinators[combinators.length - 1].replace(/[^a-zA-Z0-9_-]/g, '')}`,
          replacementInstructions: {
            action: 'Flatten selector nesting to a single direct class name.'
          },
          whyFixHelps: {
            cause: 'Complex descendant selectors require the browser engine to evaluate the entire DOM ancestor tree right-to-left.',
            behaviorChange: 'Direct class lookup runs in O(1) time.',
            expectedBenefit: 'Reduces style calculation time during DOM mutations and scrolling.'
          },
          fileHash
        }));
      }
    }

    return findings;
  }
}

module.exports = CssRules;
