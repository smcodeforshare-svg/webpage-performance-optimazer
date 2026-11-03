/**
 * Request Inventory Collector
 * Tracks, categorizes, and aggregates all HTTP/HTTPS network traffic during page auditing.
 * Optimized with real-time O(1) running accumulators for high-volume network tracing.
 */

const { sanitizeUrl } = require('../security/url-sanitizer');
const { redactHeaders } = require('../security/redaction');
const ApiClassifier = require('./api-classifier');
const { URL } = require('url');

class RequestInventory {
  constructor(initialUrl = '') {
    this.initialUrl = initialUrl;
    let initialHost = '';
    try {
      initialHost = new URL(initialUrl).hostname.toLowerCase();
    } catch {}
    this.initialHost = initialHost;

    this.requests = [];
    this.summary = {
      totalRequests: 0,
      totalTransferredBytes: 0,
      totalTransferredKb: 0,
      apiRequestsCount: 0,
      failedRequestsCount: 0,
      slowRequestsCount: 0,
      thirdPartyRequestsCount: 0,
      thirdPartyTransferredKb: 0,
      byType: {}
    };
  }

  /**
   * Adds a completed request event to the inventory
   * Increments running counters in O(1) time
   * @param {Object} rawReq 
   */
  addRequest(rawReq) {
    const cleanUrl = sanitizeUrl(rawReq.url || '');
    const cleanHeaders = redactHeaders(rawReq.headers || {});
    const cleanResponseHeaders = redactHeaders(rawReq.responseHeaders || {});

    const classification = ApiClassifier.classify({
      url: cleanUrl,
      resourceType: rawReq.resourceType,
      method: rawReq.method,
      responseHeaders: cleanResponseHeaders,
      headers: cleanHeaders
    });

    let host = '';
    try {
      host = new URL(cleanUrl).hostname.toLowerCase();
    } catch {}

    const isThirdParty = Boolean(this.initialHost && host && !host.endsWith(this.initialHost) && !this.initialHost.endsWith(host));
    const duration = Number(rawReq.duration || rawReq.timing?.duration || 0);
    const status = Number(rawReq.status || 0);
    const isFailed = status >= 400 || rawReq.failed === true || Boolean(rawReq.errorText);
    const isSlow = duration > 500; // Flag requests taking longer than 500ms
    const transferSizeBytes = Number(rawReq.transferSize || rawReq.size || 0);

    const record = {
      id: `req-${this.requests.length + 1}`,
      url: cleanUrl,
      method: (rawReq.method || 'GET').toUpperCase(),
      status,
      statusText: rawReq.statusText || '',
      resourceType: rawReq.resourceType || 'other',
      durationMs: Math.round(duration),
      transferSizeBytes,
      decodedBodySizeBytes: Number(rawReq.decodedBodySize || 0),
      isApi: classification.isApi,
      apiClassificationReason: classification.reason,
      isThirdParty,
      isFailed,
      isSlow,
      errorText: rawReq.errorText || null,
      initiator: rawReq.initiator || 'unknown',
      timing: {
        dns: Math.round(rawReq.timing?.dns || 0),
        connect: Math.round(rawReq.timing?.connect || 0),
        ssl: Math.round(rawReq.timing?.ssl || 0),
        ttfb: Math.round(rawReq.timing?.ttfb || rawReq.timing?.wait || 0),
        download: Math.round(rawReq.timing?.download || rawReq.timing?.receive || 0)
      },
      headers: cleanHeaders,
      responseHeaders: cleanResponseHeaders,
      timestamp: rawReq.timestamp || Date.now()
    };

    this.requests.push(record);

    // O(1) Real-time running summary aggregation
    this.summary.totalRequests++;
    this.summary.totalTransferredBytes += transferSizeBytes;
    this.summary.totalTransferredKb = Math.round(this.summary.totalTransferredBytes / 1024);

    const type = record.resourceType || 'other';
    if (!this.summary.byType[type]) {
      this.summary.byType[type] = { count: 0, sizeBytes: 0, sizeKb: 0 };
    }
    this.summary.byType[type].count++;
    this.summary.byType[type].sizeBytes += transferSizeBytes;
    this.summary.byType[type].sizeKb = Math.round(this.summary.byType[type].sizeBytes / 1024);

    if (record.isApi) this.summary.apiRequestsCount++;
    if (record.isFailed) this.summary.failedRequestsCount++;
    if (record.isSlow) this.summary.slowRequestsCount++;
    if (record.isThirdParty) {
      this.summary.thirdPartyRequestsCount++;
      const thirdPartyBytes = (this.summary.thirdPartyTransferredKb * 1024) + transferSizeBytes;
      this.summary.thirdPartyTransferredKb = Math.round(thirdPartyBytes / 1024);
    }

    return record;
  }

  /**
   * Produces an aggregated summary breakdown in O(1) time
   */
  getSummary() {
    return this.summary;
  }

  getAll() {
    return this.requests;
  }
}

module.exports = RequestInventory;
