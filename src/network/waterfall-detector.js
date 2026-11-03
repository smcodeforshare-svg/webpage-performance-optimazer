/**
 * Waterfall and Duplicate Request Detector
 * Discovers sequential blocking request chains and redundant identical network calls.
 */

class WaterfallDetector {
  /**
   * Detects duplicate request candidates
   * @param {Array<Object>} requests 
   * @returns {Array<{ method: string, url: string, count: number, totalDurationMs: number, requestIds: string[] }>}
   */
  static findDuplicates(requests) {
    const urlMap = new Map();

    for (const req of requests) {
      // Exclude websocket, data URLs
      if (!req.url || req.url.startsWith('data:') || req.url.startsWith('ws:')) continue;

      const key = `${req.method}::${req.url}`;
      if (!urlMap.has(key)) {
        urlMap.set(key, {
          method: req.method,
          url: req.url,
          count: 0,
          totalDurationMs: 0,
          requestIds: []
        });
      }

      const item = urlMap.get(key);
      item.count++;
      item.totalDurationMs += req.durationMs;
      item.requestIds.push(req.id);
    }

    const duplicates = [];
    for (const item of urlMap.values()) {
      if (item.count > 1) {
        duplicates.push(item);
      }
    }

    return duplicates.sort((a, b) => b.count - a.count);
  }

  /**
   * Detects sequential waterfalls among API requests
   * @param {Array<Object>} requests 
   */
  static findWaterfalls(requests) {
    const apiReqs = requests
      .filter(r => r.isApi && r.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);

    const waterfalls = [];

    for (let i = 0; i < apiReqs.length - 1; i++) {
      const current = apiReqs[i];
      const next = apiReqs[i + 1];

      const currentEnd = current.timestamp + current.durationMs;
      // If next request started around or after current completed (within 100ms window)
      if (next.timestamp >= currentEnd - 50 && next.timestamp <= currentEnd + 200) {
        waterfalls.push({
          parentReq: current.url,
          childReq: next.url,
          delayMs: Math.max(0, next.timestamp - current.timestamp),
          totalCumulativeDurationMs: current.durationMs + next.durationMs,
          recommendation: 'Sequential dispatch detected. If independent, parallelize with Promise.all() or HTTP/2 multiplexing.'
        });
      }
    }

    return waterfalls;
  }
}

module.exports = WaterfallDetector;
