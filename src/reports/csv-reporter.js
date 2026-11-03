/**
 * CSV Report Generator for Network Requests, Source Findings, and API Multi-File Architecture
 */

class CsvReporter {
  /**
   * Generates CSV for network request inventory including API multi-file architecture
   * @param {Array<Object>} requests 
   */
  static generateRequestsCsv(requests = []) {
    const headers = [
      'ID',
      'Method',
      'URL',
      'Status',
      'Duration (ms)',
      'Transfer Size (bytes)',
      'Resource Type',
      'Is API',
      'Is Multi-File API',
      'API Files Count',
      'API Architecture Chain',
      'API Implementation Files',
      'Is Third Party',
      'Is Failed',
      'Is Slow',
      'Primary Correlated File',
      'Primary Line'
    ];

    const escapeCsv = (str) => {
      const s = String(str ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = [headers.join(',')];

    for (const req of requests) {
      const arch = req.apiArchitecture;
      const apiFilesStr = arch && arch.apiFiles
        ? arch.apiFiles.map(f => `[${f.role}] ${f.absolutePath || f.filePath}:${f.startLine}-${f.endLine}`).join(' | ')
        : '';

      const row = [
        escapeCsv(req.id),
        escapeCsv(req.method),
        escapeCsv(req.url),
        escapeCsv(req.status),
        escapeCsv(req.durationMs),
        escapeCsv(req.transferSizeBytes),
        escapeCsv(req.resourceType),
        escapeCsv(req.isApi ? 'YES' : 'NO'),
        escapeCsv(req.isMultiFile ? 'YES (Multi-File)' : (req.isApi ? 'NO (Single-File)' : 'N/A')),
        escapeCsv(req.apiFilesCount || (req.isApi ? 1 : 0)),
        escapeCsv(arch?.architectureSummary || ''),
        escapeCsv(apiFilesStr),
        escapeCsv(req.isThirdParty ? 'YES' : 'NO'),
        escapeCsv(req.isFailed ? 'YES' : 'NO'),
        escapeCsv(req.isSlow ? 'YES' : 'NO'),
        escapeCsv(req.correlatedSource?.absolutePath || req.correlatedSource?.filePath || ''),
        escapeCsv(req.correlatedSource?.line || '')
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Generates CSV for source findings
   * @param {Array<Object>} findings 
   */
  static generateFindingsCsv(findings = []) {
    const headers = [
      'ID',
      'Title',
      'File Path',
      'Lines',
      'Symbol',
      'Category',
      'Severity',
      'Confidence',
      'Evidence'
    ];

    const escapeCsv = (str) => {
      const s = String(str ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = [headers.join(',')];

    for (const f of findings) {
      const displayPath = f.absolutePath || f.filePath;
      const row = [
        escapeCsv(f.id),
        escapeCsv(f.title),
        escapeCsv(displayPath),
        escapeCsv(`${f.startLine}-${f.endLine}`),
        escapeCsv(f.symbol),
        escapeCsv(f.category),
        escapeCsv(f.severity),
        escapeCsv(f.confidence),
        escapeCsv(f.evidence)
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

module.exports = CsvReporter;
