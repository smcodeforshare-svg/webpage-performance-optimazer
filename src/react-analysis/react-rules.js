/**
 * React Performance and Lifecycle Rules Engine
 * Inspects React JSX/TSX patterns, hooks, memoization, cancellation, and render loops.
 */

const AstEngine = require('../source-analysis/ast-engine');
const LineMapper = require('../source-analysis/line-mapper');
const { createFinding } = require('../source-analysis/finding-generator');

class ReactRules {
  /**
   * Runs all React analysis rules on a file
   * @param {string} content 
   * @param {string} relativePath 
   * @param {string} absolutePath 
   * @returns {Array<Object>}
   */
  static analyze(content, relativePath, absolutePath) {
    const mapper = new LineMapper(content);
    const fileHash = mapper.getContentHash();
    const findings = [];

    findings.push(...this.checkMissingAbortController(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkWaterfallInEffect(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkUnmemoizedCalculations(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkUncleanedTimers(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkIndexAsListKey(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkHeavyImports(content, mapper, relativePath, absolutePath, fileHash));

    return findings;
  }

  /**
   * Rule: Missing AbortController / Request Cancellation in useEffect
   */
  static checkMissingAbortController(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const effectRegex = /useEffect\s*\(\s*(?:\(\)\s*=>|\bfunction\s*\(\))\s*\{/g;
    let match;

    while ((match = effectRegex.exec(content)) !== null) {
      const effectStart = match.index;
      const openBraceIndex = content.indexOf('{', effectStart);
      const closeBraceIndex = AstEngine.findMatchingDelimiter(content, openBraceIndex, '{', '}');

      if (closeBraceIndex === -1) continue;

      const effectBody = content.slice(openBraceIndex, closeBraceIndex + 1);

      // Check if effect triggers fetch or axios
      const hasFetchOrAxios = /\b(?:fetch|axios(?:\.get|\.post)?)\s*\(/.test(effectBody);
      const hasAbortController = /AbortController|signal\s*:/i.test(effectBody);

      if (hasFetchOrAxios && !hasAbortController) {
        let fullEffectEnd = closeBraceIndex;
        const parenClose = content.indexOf(')', closeBraceIndex);
        if (parenClose !== -1) {
          fullEffectEnd = parenClose + (content[parenClose + 1] === ';' ? 2 : 1);
        }

        const startPos = mapper.indexToPosition(effectStart);
        const endPos = mapper.indexToPosition(fullEffectEnd);
        const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);
        const symbol = AstEngine.findEnclosingSymbol(content, effectStart);

        const indentMatch = existingCode.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '  ';

        const depMatch = existingCode.match(/,\s*(\[[^\]]*\])\s*\)?;?\s*$/);
        const deps = depMatch ? depMatch[1] : '[]';

        const endpointMatch = existingCode.match(/fetch\s*\(\s*(['"`][^'"`]+['"`])/);
        const endpoint = endpointMatch ? endpointMatch[1] : "'/api/data'";

        const setterMatch = existingCode.match(/set([A-Za-z0-9_]+)\s*\(/);
        const setterCall = setterMatch ? `set${setterMatch[1]}(data)` : 'setData(data)';

        const replacementCode = `${indent}useEffect(() => {
${indent}  const controller = new AbortController();
${indent}  let isMounted = true;

${indent}  async function fetchData() {
${indent}    try {
${indent}      const response = await fetch(${endpoint}, { signal: controller.signal });
${indent}      if (!response.ok) throw new Error(\`HTTP error \${response.status}\`);
${indent}      const data = await response.json();
${indent}      if (isMounted) {
${indent}        ${setterCall};
${indent}      }
${indent}    } catch (err) {
${indent}      if (err.name !== 'AbortError') {
${indent}        console.error('Fetch error:', err);
${indent}      }
${indent}    }
${indent}  }

${indent}  fetchData();

${indent}  return () => {
${indent}    isMounted = false;
${indent}    controller.abort();
${indent}  };
${indent}}, ${deps});`;

        findings.push(createFinding({
          title: 'Missing Request Cancellation in useEffect',
          filePath: relativePath,
          absolutePath,
          startLine: startPos.line,
          endLine: endPos.line,
          startColumn: startPos.column,
          endColumn: endPos.column,
          symbol,
          category: 'react-lifecycle',
          severity: 'high',
          confidence: 'verified',
          sourceType: 'static_ast',
          evidence: 'Asynchronous fetch/axios call inside useEffect without AbortController or unmount cleanup causes race conditions, memory leaks, and redundant network bandwidth consumption.',
          existingCode,
          replacementCode,
          replacementInstructions: {
            action: 'Wrap the asynchronous request in an AbortController instance and return a cleanup function that aborts in-flight requests on component unmount or dependency re-runs.',
            requiredImports: ['useEffect']
          },
          whyFixHelps: {
            cause: 'Component unmounting or rapid prop/state changes trigger new requests while previous requests continue executing, leading to state updates on unmounted components and race conditions.',
            behaviorChange: 'In-flight requests are cleanly terminated as soon as dependencies change or the component unmounts.',
            expectedBenefit: 'Eliminates memory leaks, redundant bandwidth usage, and out-of-order UI updates.',
            tradeoffs: 'Catches AbortError safely without alerting user to deliberate cancellation.'
          },
          validation: {
            testSteps: [
              'Verify that navigating away from the component cancels active network requests in browser DevTools Network tab.',
              'Rapidly trigger state changes and confirm that stale responses never overwrite newer state.'
            ],
            beforeAfterMetrics: ['Uncancelled HTTP requests on unmount', 'Component unmount warning errors']
          },
          fileHash
        }));
      }
    }

    return findings;
  }

  /**
   * Rule: Sequential Waterfall Requests inside useEffect / handler
   */
  static checkWaterfallInEffect(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const asyncBlockRegex = /(?:async\s+(?:function\s+[A-Za-z0-9_]*\s*|\([^\)]*\)\s*=>)\s*\{)([\s\S]*?)\}/g;
    let match;

    while ((match = asyncBlockRegex.exec(content)) !== null) {
      const blockText = match[1];
      const awaitFetches = [...blockText.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*await\s+(?:fetch|axios(?:\.get)?)\s*\(\s*(['"`][^'"`]+['"`])/g)];

      if (awaitFetches.length >= 2) {
        const firstVar = awaitFetches[0][1];
        const secondCall = awaitFetches[1][0];

        if (!secondCall.includes(firstVar)) {
          const matchIndex = match.index;
          const startPos = mapper.indexToPosition(matchIndex);
          const endPos = mapper.indexToPosition(matchIndex + match[0].length);
          const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);
          const symbol = AstEngine.findEnclosingSymbol(content, matchIndex);

          const indentMatch = existingCode.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '  ';

          const url1 = awaitFetches[0][2];
          const url2 = awaitFetches[1][2];

          const replacementCode = `${indent}const [res1, res2] = await Promise.all([
${indent}  fetch(${url1}),
${indent}  fetch(${url2})
${indent}]);
${indent}const [data1, data2] = await Promise.all([res1.json(), res2.json()]);`;

          findings.push(createFinding({
            title: 'Sequential Network Waterfall Detected',
            filePath: relativePath,
            absolutePath,
            startLine: startPos.line,
            endLine: endPos.line,
            startColumn: startPos.column,
            endColumn: endPos.column,
            symbol,
            category: 'network-waterfall',
            severity: 'high',
            confidence: 'strongly_supported',
            sourceType: 'static_ast',
            evidence: `Found ${awaitFetches.length} sequential 'await fetch()' calls that do not depend on each other's return values.`,
            existingCode,
            replacementCode,
            replacementInstructions: {
              action: 'Parallelize independent HTTP requests using Promise.all to fetch concurrent resources simultaneously.'
            },
            whyFixHelps: {
              cause: 'Waiting for each HTTP response before initiating the next doubles or triples total network wait time.',
              behaviorChange: 'Both requests are dispatched simultaneously over HTTP/2 multiplexing.',
              expectedBenefit: 'Reduces cumulative latency from (T1 + T2) to max(T1, T2), cutting wait time by up to 50%.'
            },
            validation: {
              testSteps: [
                'Inspect the browser Network waterfall tab to confirm concurrent initiation of endpoints.',
                'Measure total page load time or component readiness time before and after.'
              ],
              beforeAfterMetrics: ['Cumulative network duration', 'Time to First Data Render']
            },
            fileHash
          }));
        }
      }
    }

    return findings;
  }

  /**
   * Rule: Unmemoized Expensive Calculations in Component Body
   */
  static checkUnmemoizedCalculations(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const heavyChainRegex = /(?:const|let)\s+([A-Za-z0-9_]+)\s*=\s*([A-Za-z0-9_]+)\s*\.(?:filter|map)\([^\)]+\)\s*\.(?:sort|filter|map)\([^\)]+\);?/g;
    let match;

    while ((match = heavyChainRegex.exec(content)) !== null) {
      const matchIndex = match.index;
      const surrounding = content.slice(Math.max(0, matchIndex - 60), matchIndex);
      if (/useMemo\s*\(\s*\(\)\s*=>/i.test(surrounding)) continue;

      const varName = match[1];
      const sourceVar = match[2];
      const startPos = mapper.indexToPosition(matchIndex);
      const endPos = mapper.indexToPosition(matchIndex + match[0].length);
      const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);
      const symbol = AstEngine.findEnclosingSymbol(content, matchIndex);

      const indentMatch = existingCode.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '  ';

      const computation = match[0].replace(new RegExp(`^(?:const|let)\\s+${varName}\\s*=\\s*`), '').replace(/;$/, '');
      const replacementCode = `${indent}const ${varName} = useMemo(() => {
${indent}  return ${computation};
${indent}}, [${sourceVar}]);`;

      findings.push(createFinding({
        title: 'Unmemoized Expensive Array Transformation in Render Body',
        filePath: relativePath,
        absolutePath,
        startLine: startPos.line,
        endLine: endPos.line,
        startColumn: startPos.column,
        endColumn: endPos.column,
        symbol,
        category: 'react-rendering',
        severity: 'medium',
        confidence: 'strongly_supported',
        sourceType: 'static_ast',
        evidence: `Chained array operations on '${sourceVar}' re-evaluate on every single component re-render even when data has not changed.`,
        existingCode,
        replacementCode,
        replacementInstructions: {
          action: 'Wrap the expensive calculation in React.useMemo with the input collection as dependency.',
          requiredImports: ['useMemo']
        },
        whyFixHelps: {
          cause: 'Array allocations and sorting on every render cause main-thread jank and trigger re-renders in downstream children.',
          behaviorChange: 'Results are cached in memory and recalculated only when source data changes.',
          expectedBenefit: 'Avoids redundant O(N log N) sorting and object allocations during unrelated re-renders.'
        },
        fileHash
      }));
    }

    return findings;
  }

  /**
   * Rule: Uncleaned Timers or Event Listeners in useEffect
   */
  static checkUncleanedTimers(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const effectRegex = /useEffect\s*\(\s*(?:\(\)\s*=>|\bfunction\s*\(\))\s*\{([\s\S]*?)\}(?:\s*,\s*(\[[^\]]*\]))?\s*\);?/g;
    let match;

    while ((match = effectRegex.exec(content)) !== null) {
      const effectBody = match[1];
      const deps = match[2] || '[]';
      const hasTimer = /\b(?:setInterval|setTimeout)\s*\(/.test(effectBody);
      const hasListener = /\baddEventListener\s*\(/.test(effectBody);
      const hasCleanup = /\breturn\s+(?:\(\)\s*=>|function\b|()=>)/.test(effectBody);

      if ((hasTimer || hasListener) && !hasCleanup) {
        const matchIndex = match.index;
        const startPos = mapper.indexToPosition(matchIndex);
        const endPos = mapper.indexToPosition(matchIndex + match[0].length);
        const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);
        const symbol = AstEngine.findEnclosingSymbol(content, matchIndex);

        const indentMatch = existingCode.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '  ';

        let replacementCode;
        if (hasTimer) {
          replacementCode = `${indent}useEffect(() => {
${indent}  const timerId = setInterval(() => {
${indent}    // periodic task
${indent}  }, 1000);

${indent}  return () => clearInterval(timerId);
${indent}}, ${deps});`;
        } else {
          replacementCode = `${indent}useEffect(() => {
${indent}  const handleEvent = (event) => {
${indent}    // event handler
${indent}  };

${indent}  window.addEventListener('resize', handleEvent);
${indent}  return () => window.removeEventListener('resize', handleEvent);
${indent}}, ${deps});`;
        }

        findings.push(createFinding({
          title: 'Memory Leak: Missing Cleanup for Timer or Event Listener in useEffect',
          filePath: relativePath,
          absolutePath,
          startLine: startPos.line,
          endLine: endPos.line,
          startColumn: startPos.column,
          endColumn: endPos.column,
          symbol,
          category: 'react-memory',
          severity: 'high',
          confidence: 'verified',
          sourceType: 'static_ast',
          evidence: 'Interval or event listener registered inside useEffect without a returned cleanup function.',
          existingCode,
          replacementCode,
          replacementInstructions: {
            action: 'Return a cleanup function from useEffect to clear timers or detach event listeners upon unmount.'
          },
          whyFixHelps: {
            cause: 'Without a cleanup handler, orphaned intervals and event listeners persist indefinitely in browser memory after unmount.',
            behaviorChange: 'Cleanly tears down background timers and listeners when component lifecycle completes.',
            expectedBenefit: 'Prevents memory leaks, CPU degradation, and ghost state invocations.'
          },
          fileHash
        }));
      }
    }

    return findings;
  }

  /**
   * Rule: Array Index as List Key in JSX
   */
  static checkIndexAsListKey(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    // Matches .map((item, index) => ... key={index})
    const mapRegex = /\.map\s*\(\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)\s*=>/g;
    let match;

    while ((match = mapRegex.exec(content)) !== null) {
      const matchIndex = match.index;
      const itemVar = match[1];
      const indexVar = match[2];

      // Look ahead up to 300 characters for key={indexVar}
      const lookahead = content.slice(matchIndex, matchIndex + 300);
      const keyPattern = new RegExp(`key=\\{${indexVar}\\}`, 'i');

      if (keyPattern.test(lookahead)) {
        const keyMatch = keyPattern.exec(lookahead);
        const keyAbsoluteIndex = matchIndex + keyMatch.index;

        const startPos = mapper.indexToPosition(matchIndex);
        const endPos = mapper.indexToPosition(keyAbsoluteIndex + keyMatch[0].length);
        const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);
        const symbol = AstEngine.findEnclosingSymbol(content, matchIndex);

        const replacementCode = existingCode.replace(keyPattern, `key={${itemVar}.id || ${itemVar}.key || ${indexVar}}`);

        findings.push(createFinding({
          title: 'Unstable Array Index Used as React Key',
          filePath: relativePath,
          absolutePath,
          startLine: startPos.line,
          endLine: endPos.line,
          startColumn: startPos.column,
          endColumn: endPos.column,
          symbol,
          category: 'react-reconciliation',
          severity: 'medium',
          confidence: 'strongly_supported',
          sourceType: 'static_ast',
          evidence: `Array map iteration uses index parameter '${indexVar}' as the React element key.`,
          existingCode,
          replacementCode,
          replacementInstructions: {
            action: `Assign a stable unique identifier (e.g. ${itemVar}.id) rather than the array index as the key property.`
          },
          whyFixHelps: {
            cause: 'When items are sorted, filtered, inserted, or removed, index keys cause React to reuse wrong DOM nodes and re-render entire lists.',
            behaviorChange: 'React reconciler matches existing DOM nodes with their exact items.',
            expectedBenefit: 'Avoids visual input bugs and significantly reduces DOM node re-creations.'
          },
          fileHash
        }));
      }
    }

    return findings;
  }

  /**
   * Rule: Heavy Library Monolithic Imports (Lodash, Moment)
   */
  static checkHeavyImports(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const imports = AstEngine.extractImports(content);

    for (const imp of imports) {
      if (imp.moduleName === 'lodash' && imp.importedSymbols.length === 0) {
        const startPos = mapper.indexToPosition(imp.start);
        const endPos = mapper.indexToPosition(imp.end);
        const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);

        findings.push(createFinding({
          title: 'Monolithic Lodash Import Bloats Bundle',
          filePath: relativePath,
          absolutePath,
          startLine: startPos.line,
          endLine: endPos.line,
          startColumn: startPos.column,
          endColumn: endPos.column,
          symbol: 'import',
          category: 'dependency-bloat',
          severity: 'medium',
          confidence: 'verified',
          sourceType: 'static_ast',
          evidence: "Importing entire 'lodash' library pulls ~70KB+ into the client bundle.",
          existingCode,
          replacementCode: "// Use method-specific import or native ES features:\nimport cloneDeep from 'lodash/cloneDeep';",
          replacementInstructions: {
            action: "Import only the specific function from 'lodash/<method>' or use native JavaScript equivalents."
          },
          whyFixHelps: {
            cause: "Default import of 'lodash' bypasses bundler tree-shaking and bundles hundreds of unused utility functions.",
            behaviorChange: 'Only imports the single requested helper.',
            expectedBenefit: 'Reduces JavaScript bundle transfer size by up to 60KB.'
          },
          fileHash
        }));
      }

      if (imp.moduleName === 'moment') {
        const startPos = mapper.indexToPosition(imp.start);
        const endPos = mapper.indexToPosition(imp.end);
        const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);

        findings.push(createFinding({
          title: 'Legacy Moment.js Library Detected',
          filePath: relativePath,
          absolutePath,
          startLine: startPos.line,
          endLine: endPos.line,
          startColumn: startPos.column,
          endColumn: endPos.column,
          symbol: 'import',
          category: 'dependency-bloat',
          severity: 'medium',
          confidence: 'verified',
          sourceType: 'static_ast',
          evidence: "'moment' is in maintenance mode and includes ~300KB of locale data that cannot be tree-shaken.",
          existingCode,
          replacementCode: "// Migrate to modern lightweight alternatives such as date-fns or native Intl:\nimport { format } from 'date-fns';",
          replacementInstructions: {
            action: "Replace 'moment' with 'date-fns' or standard browser Intl APIs."
          },
          whyFixHelps: {
            cause: 'Moment is mutable and packs large timezone/locale tables into the initial JS payload.',
            behaviorChange: 'Uses modular, tree-shakeable date utility functions.',
            expectedBenefit: 'Reduces bundle size by ~70KB gzipped and improves parse/compile times.'
          },
          fileHash
        }));
      }
    }

    return findings;
  }
}

module.exports = ReactRules;
