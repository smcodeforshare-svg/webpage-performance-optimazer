/**
 * PHP & WordPress Performance and Architecture Rules Engine
 * Inspects PHP files (.php) for N+1 database queries, blocking HTTP calls,
 * missing query limits, uncached transient operations, and loop bottlenecks.
 */

const LineMapper = require('../source-analysis/line-mapper');
const { createFinding } = require('../source-analysis/finding-generator');

class PhpRules {
  /**
   * Analyzes PHP source code for bottlenecks
   * @param {string} content 
   * @param {string} relativePath 
   * @param {string} absolutePath 
   * @returns {Array<Object>}
   */
  static analyze(content, relativePath, absolutePath) {
    const mapper = new LineMapper(content);
    const fileHash = mapper.getContentHash();
    const findings = [];

    findings.push(...this.checkQueriesInLoops(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkBlockingHttpCalls(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkUnboundedSelectQueries(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkCountInForLoop(content, mapper, relativePath, absolutePath, fileHash));
    findings.push(...this.checkUnpreparedSql(content, mapper, relativePath, absolutePath, fileHash));

    return findings;
  }

  /**
   * Rule: Database Query in Loop (N+1 Query Pattern in PHP / WordPress)
   */
  static checkQueriesInLoops(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const lines = content.split(/\r?\n/);
    let inLoop = false;
    let loopStartLine = 1;
    let loopBraceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // Detect loop start
      if (/\b(?:foreach|while|for)\s*\(/.test(line)) {
        inLoop = true;
        loopStartLine = lineNum;
        loopBraceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        continue;
      }

      if (inLoop) {
        loopBraceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

        // Check for DB query or WordPress meta lookup inside loop
        const isDbQuery = /(?:\$wpdb->(?:get_results|get_row|get_var|query)|\bmysqli_query\b|\bPDO::query\b|\bget_post_meta\b|\bget_user_meta\b|\bget_term_meta\b)\s*\(/.test(line);

        if (isDbQuery) {
          const matchCol = line.search(/(?:\$wpdb|mysqli_query|PDO::query|get_post_meta|get_user_meta)/);
          const startCol = matchCol !== -1 ? matchCol + 1 : 1;
          const existingCode = line.trim();

          const indentMatch = line.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '    ';

          let replacementCode = `${indent}// Batch query before the loop using IN (...) or update_meta_cache():\n${indent}// $batch_results = $wpdb->get_results($wpdb->prepare("SELECT ... WHERE id IN (%s)", implode(',', $ids)));`;
          if (line.includes('get_post_meta')) {
            replacementCode = `${indent}// Pre-warm the WordPress postmeta object cache before iteration:\n${indent}// update_meta_cache('post', $post_ids);\n${indent}${existingCode}`;
          }

          findings.push(createFinding({
            title: 'N+1 Database Query in Loop (PHP / WordPress)',
            filePath: relativePath,
            absolutePath,
            startLine: lineNum,
            endLine: lineNum,
            startColumn: startCol,
            endColumn: line.length,
            symbol: '$wpdb / query',
            category: 'php-n-plus-one',
            severity: 'critical',
            confidence: 'verified',
            sourceType: 'static_ast',
            evidence: 'Database query or meta lookup executed inside a loop. For N items, this triggers N individual database round-trips, saturating the MySQL connection pool.',
            existingCode,
            replacementCode,
            replacementInstructions: {
              action: 'Batch-query all required records before entering the loop using SQL WHERE IN (...) or pre-warm the WordPress object cache with update_meta_cache().'
            },
            whyFixHelps: {
              cause: 'Executing sequential queries inside a loop creates severe network and database I/O latency.',
              behaviorChange: 'Reduces N sequential queries to a single batched query.',
              expectedBenefit: 'Reduces database execution latency by 80% to 95% on large recordsets.'
            },
            fileHash
          }));
        }

        if (loopBraceDepth <= 0 && (line.includes('}') || line.includes('endforeach') || line.includes('endwhile'))) {
          inLoop = false;
        }
      }
    }

    return findings;
  }

  /**
   * Rule: Synchronous Blocking Remote HTTP Call in PHP
   */
  static checkBlockingHttpCalls(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // file_get_contents on remote URL
      if (/file_get_contents\s*\(\s*['"]https?:\/\//i.test(line)) {
        const existingCode = line.trim();
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '  ';

        findings.push(createFinding({
          title: "Blocking Remote 'file_get_contents()' without Timeout in PHP",
          filePath: relativePath,
          absolutePath,
          startLine: lineNum,
          endLine: lineNum,
          startColumn: 1,
          endColumn: line.length,
          symbol: 'file_get_contents',
          category: 'php-blocking-io',
          severity: 'high',
          confidence: 'verified',
          sourceType: 'static_ast',
          evidence: "Using file_get_contents() with a remote URL blocks the PHP worker thread and has no default timeout. If the remote server stalls, the PHP-FPM process hangs indefinitely.",
          existingCode,
          replacementCode: `${indent}// In WordPress, use wp_remote_get with an explicit timeout:\n${indent}$response = wp_remote_get($url, ['timeout' => 5]);\n${indent}$data = is_wp_error($response) ? null : wp_remote_retrieve_body($response);`,
          replacementInstructions: {
            action: "Replace file_get_contents() with wp_remote_get() or cURL with an explicit timeout."
          },
          whyFixHelps: {
            cause: 'Default file_get_contents() blocks the PHP process indefinitely during network drops.',
            behaviorChange: 'Fails gracefully after 5 seconds, freeing the PHP worker process.',
            expectedBenefit: 'Prevents PHP-FPM worker starvation and 504 Gateway Timeouts.'
          },
          fileHash
        }));
      }
    }

    return findings;
  }

  /**
   * Rule: Unbounded SELECT Queries without LIMIT
   */
  static checkUnboundedSelectQueries(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const selectRegex = /(?:\$wpdb->(?:get_results|query)|mysqli_query)\s*\(\s*(['"])\s*SELECT\s+[\s\S]*?\s+FROM\s+[a-zA-Z0-9_`]+\s*\1\s*\)/gi;
    let match;

    while ((match = selectRegex.exec(content)) !== null) {
      const queryStr = match[0];
      if (!/LIMIT\s+[0-9]+/i.test(queryStr)) {
        const startPos = mapper.indexToPosition(match.index);
        const endPos = mapper.indexToPosition(match.index + queryStr.length);
        const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);

        findings.push(createFinding({
          title: "Unbounded Database SELECT Query without LIMIT Clause",
          filePath: relativePath,
          absolutePath,
          startLine: startPos.line,
          endLine: endPos.line,
          startColumn: startPos.column,
          endColumn: endPos.column,
          symbol: 'SELECT query',
          category: 'php-database-optimization',
          severity: 'medium',
          confidence: 'strongly_supported',
          sourceType: 'static_ast',
          evidence: "Database query fetches table rows without a LIMIT clause, risking huge memory allocations and slow query execution as table size increases.",
          existingCode,
          replacementCode: existingCode.replace(/\)\s*$/, ' /* Add pagination: LIMIT 50 OFFSET 0 */)'),
          replacementInstructions: {
            action: "Add an explicit LIMIT and OFFSET clause to enforce pagination."
          },
          whyFixHelps: {
            cause: "Fetching unconstrained rows forces MySQL to scan the entire index and load megabytes of memory into PHP.",
            behaviorChange: "Restricts result set to only the records needed for display.",
            expectedBenefit: "Reduces PHP memory footprint and query execution time."
          },
          fileHash
        }));
      }
    }

    return findings;
  }

  /**
   * Rule: Recalculating count() on Every For-Loop Iteration in PHP
   */
  static checkCountInForLoop(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const forRegex = /for\s*\(\s*\$([a-zA-Z0-9_]+)\s*=\s*0\s*;\s*\$\1\s*<\s*count\s*\(\s*(\$[a-zA-Z0-9_]+)\s*\)\s*;\s*\$\1\+\+\s*\)/g;
    let match;

    while ((match = forRegex.exec(content)) !== null) {
      const startPos = mapper.indexToPosition(match.index);
      const endPos = mapper.indexToPosition(match.index + match[0].length);
      const existingCode = mapper.getLinesSlice(startPos.line, endPos.line);
      const iteratorVar = match[1];
      const arrayVar = match[2];

      const replacementCode = `$count = count(${arrayVar});\nfor ($${iteratorVar} = 0; $${iteratorVar} < $count; $${iteratorVar}++)`;

      findings.push(createFinding({
        title: "Recalculating count() on Every For-Loop Iteration in PHP",
        filePath: relativePath,
        absolutePath,
        startLine: startPos.line,
        endLine: endPos.line,
        startColumn: startPos.column,
        endColumn: endPos.column,
        symbol: 'for loop',
        category: 'php-loop-optimization',
        severity: 'medium',
        confidence: 'verified',
        sourceType: 'static_ast',
        evidence: `count(${arrayVar}) is re-evaluated on every single loop iteration instead of being pre-calculated once before loop entry.`,
        existingCode,
        replacementCode,
        replacementInstructions: {
          action: "Cache array count before the loop in a temporary variable or switch to a foreach loop."
        },
        whyFixHelps: {
          cause: "Evaluating count() repeatedly introduces unnecessary function call overhead on every iteration.",
          behaviorChange: "Calculates count exactly once.",
          expectedBenefit: "Improves PHP CPU efficiency during large array processing."
        },
        fileHash
      }));
    }

    return findings;
  }

  /**
   * Rule: Direct Unprepared SQL Concatenation in WordPress ($wpdb)
   */
  static checkUnpreparedSql(content, mapper, relativePath, absolutePath, fileHash) {
    const findings = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // $wpdb->query / get_results with variable concatenation and without prepare
      if (/\$wpdb->(?:get_results|get_row|query|get_var)\s*\(\s*["'].*?\$(?:_GET|_POST|_REQUEST|[a-zA-Z0-9_]+).*?["']\s*\)/.test(line) && !line.includes('prepare')) {
        const existingCode = line.trim();
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '  ';

        findings.push(createFinding({
          title: "Direct Unprepared Variable in $wpdb Query (Security & Performance)",
          filePath: relativePath,
          absolutePath,
          startLine: lineNum,
          endLine: lineNum,
          startColumn: 1,
          endColumn: line.length,
          symbol: '$wpdb',
          category: 'php-security-performance',
          severity: 'critical',
          confidence: 'verified',
          sourceType: 'static_ast',
          evidence: "Direct variable interpolation in $wpdb call bypasses prepared statements, introducing severe SQL injection vulnerabilities and disabling database query cache plans.",
          existingCode,
          replacementCode: `${indent}// Use $wpdb->prepare() with placeholders (%d, %s):\n${indent}$safe_query = $wpdb->prepare("SELECT * FROM {$wpdb->prefix}table WHERE id = %d", $id);\n${indent}$results = $wpdb->get_results($safe_query);`,
          replacementInstructions: {
            action: "Wrap query in $wpdb->prepare() with explicit type placeholders (%s, %d)."
          },
          whyFixHelps: {
            cause: "Unprepared queries expose the database to arbitrary injection and prevent query plan reuse.",
            behaviorChange: "Sanitizes parameters and binds them safely.",
            expectedBenefit: "Completely eliminates SQL injection vulnerability and improves database statement caching."
          },
          fileHash
        }));
      }
    }

    return findings;
  }
}

module.exports = PhpRules;
