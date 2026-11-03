/**
 * Next.js Architecture and SSR Rules Engine
 * Inspects Next.js client boundaries, dynamic imports, and asset optimization.
 */

const AstEngine = require('../source-analysis/ast-engine');
const LineMapper = require('../source-analysis/line-mapper');
const { createFinding } = require('../source-analysis/finding-generator');

class NextjsRules {
  /**
   * Runs Next.js specific analysis rules
   * @param {string} content 
   * @param {string} relativePath 
   * @param {string} absolutePath 
   * @returns {Array<Object>}
   */
  static analyze(content, relativePath, absolutePath) {
    const mapper = new LineMapper(content);
    const fileHash = mapper.getContentHash();
    const findings = [];

    findings.push(...this.checkUnnecessaryClientComponent(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkRawImgTag(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkHeavyStaticComponents(content, mapper, relativePath, absolutePath, fileHash));

    return findings;
  }

  /**
   * Rule: Unnecessary 'use client' directive on static components
   */
  static checkUnnecessaryClientComponent(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const clientDirectiveRegex = /^['"]use client['"];?/m;
    const match = clientDirectiveRegex.exec(content);

    if (match) {
      // Check if component actually uses hooks, state, effects, or browser APIs
      const usesHooksOrEvents = /\b(?:useState|useEffect|useContext|useReducer|useRef|useCallback|useMemo|onClick|onChange|onSubmit|window\.|document\.)\b/.test(content);

      if (!usesHooksOrEvents) {
        const startPos = mapper.indexToPosition(match.index);
        const endPos = mapper.indexToPosition(match.index + match[0].length);
        const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);

        findings.push(createFinding({
          title: "Unnecessary 'use client' Directive in Next.js",
          filePath: relativePath,
          absolutePath,
          startLine: startPos.line,
          endLine: endPos.line,
          startColumn: startPos.column,
          endColumn: endPos.column,
          symbol: "'use client'",
          category: 'nextjs-architecture',
          severity: 'medium',
          confidence: 'strongly_supported',
          sourceType: 'static_ast',
          evidence: "Component marks itself with 'use client' but contains no client hooks, event handlers, or browser APIs.",
          existingCode,
          replacementCode: '// Remove directive to keep component as a React Server Component (RSC):\n',
          replacementInstructions: {
            action: "Delete 'use client' from the top of the file to render as a Server Component."
          },
          whyFixHelps: {
            cause: "Client components ship JavaScript code and dependencies to the browser, increasing client bundle size and hydration overhead.",
            behaviorChange: "Converts the component to a Server Component, sending only static zero-bundle HTML to the browser.",
            expectedBenefit: 'Reduces client JavaScript bundle size and eliminates hydration work on initial load.'
          },
          fileHash
        }));
      }
    }

    return findings;
  }

  /**
   * Rule: Raw <img> tag instead of Next.js <Image />
   */
  static checkRawImgTag(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const imgRegex = /<img\s+([^>]+)>/g;
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
      const matchIndex = match.index;
      const startPos = mapper.indexToPosition(matchIndex);
      const endPos = mapper.indexToPosition(matchIndex + match[0].length);
      const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);
      const symbol = AstEngine.findEnclosingSymbol(content, matchIndex);

      const replacementCode = existingCode
        .replace(/^<img\s+/, '<Image ')
        .replace(/>$/, ' priority={false} />');

      findings.push(createFinding({
        title: 'Unoptimized Standard <img> Tag in Next.js',
        filePath: relativePath,
        absolutePath,
        startLine: startPos.line,
        endLine: endPos.line,
        startColumn: startPos.column,
        endColumn: endPos.column,
        symbol,
        category: 'nextjs-assets',
        severity: 'medium',
        confidence: 'strongly_supported',
        sourceType: 'static_ast',
        evidence: 'Standard HTML <img> tag bypasses automatic responsive image sizing, WebP/AVIF format conversion, and lazy loading.',
        existingCode,
        replacementCode,
        replacementInstructions: {
          action: "Replace standard <img> with Next.js 'next/image' component.",
          requiredImports: ["import Image from 'next/image';"]
        },
        whyFixHelps: {
          cause: 'Unoptimized images cause high Largest Contentful Paint (LCP) and layout shifts (CLS).',
          behaviorChange: 'Serves modern next-gen formats (AVIF/WebP) scaled dynamically to client viewport.',
          expectedBenefit: 'Cuts image payload by 50-70% and prevents Cumulative Layout Shift.'
        },
        fileHash
      }));
    }

    return findings;
  }

  /**
   * Rule: Heavy Third-Party Components without dynamic import
   */
  static checkHeavyStaticComponents(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const heavyLibs = ['chart.js', 'recharts', 'monaco-editor', 'leaflet', 'three'];
    const imports = AstEngine.extractImports(content);

    for (const imp of imports) {
      if (heavyLibs.some(lib => imp.moduleName.toLowerCase().includes(lib))) {
        // Check if dynamic() is used
        if (!/dynamic\s*\(\s*\(\)\s*=>/i.test(content)) {
          const startPos = mapper.indexToPosition(imp.start);
          const endPos = mapper.indexToPosition(imp.end);
          const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);

          findings.push(createFinding({
            title: `Heavy Library '${imp.moduleName}' Loaded Statically`,
            filePath: relativePath,
            absolutePath,
            startLine: startPos.line,
            endLine: endPos.line,
            startColumn: startPos.column,
            endColumn: endPos.column,
            symbol: 'import',
            category: 'nextjs-bundle',
            severity: 'high',
            confidence: 'strongly_supported',
            sourceType: 'static_ast',
            evidence: `Heavy library '${imp.moduleName}' is imported synchronously in the initial bundle rather than lazy loaded on demand.`,
            existingCode,
            replacementCode: `// Lazy-load with next/dynamic to avoid bundling on initial page load:\nimport dynamic from 'next/dynamic';\nconst DynamicComponent = dynamic(() => import('${imp.moduleName}'), { ssr: false, loading: () => <div>Loading...</div> });`,
            replacementInstructions: {
              action: "Convert static import to dynamic import using 'next/dynamic' with ssr: false."
            },
            whyFixHelps: {
              cause: 'Heavy visualization or editor libraries inflate the main JavaScript chunk, delaying First Contentful Paint.',
              behaviorChange: 'The library chunk is loaded asynchronously only when the component renders.',
              expectedBenefit: 'Reduces initial bundle by 100KB-500KB and improves First Input Delay / INP.'
            },
            fileHash
          }));
        }
      }
    }

    return findings;
  }
}

module.exports = NextjsRules;
