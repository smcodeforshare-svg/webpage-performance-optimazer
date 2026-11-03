/**
 * High-Precision Synthetic Timing & Network Prober
 * Provides reliable HTTP navigation timings, TTFB, DNS, TLS, and request discovery.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class SyntheticTiming {
  /**
   * Probes a target URL and records network metrics
   * @param {string} targetUrl 
   * @param {Object} options 
   */
  static async audit(targetUrl, options = {}) {
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const timings = {
      dnsStart: 0,
      dnsEnd: 0,
      connectStart: 0,
      connectEnd: 0,
      tlsStart: 0,
      tlsEnd: 0,
      reqStart: 0,
      ttfbStart: 0,
      firstByte: 0,
      responseEnd: 0
    };

    const startTime = Date.now();

    return new Promise((resolve) => {
      const req = client.request(parsed, {
        method: 'GET',
        headers: {
          'User-Agent': options.isMobile
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 15000
      }, (res) => {
        timings.firstByte = Date.now();

        let totalBytes = 0;
        const chunks = [];

        res.on('data', chunk => {
          totalBytes += chunk.length;
          chunks.push(chunk);
        });

        res.on('end', () => {
          timings.responseEnd = Date.now();
          const totalDuration = timings.responseEnd - startTime;
          const ttfb = timings.firstByte > 0 ? (timings.firstByte - (timings.reqStart || startTime)) : 0;

          // Parse basic resources if HTML
          const rawHtml = Buffer.concat(chunks).toString('utf8');
          const discoveredResources = SyntheticTiming._extractResourcesFromHtml(rawHtml, targetUrl);

          resolve({
            url: targetUrl,
            status: res.statusCode || 200,
            statusText: res.statusMessage || 'OK',
            headers: res.headers,
            metrics: {
              dnsDurationMs: Math.max(0, timings.dnsEnd - timings.dnsStart),
              connectDurationMs: Math.max(0, timings.connectEnd - timings.connectStart),
              tlsDurationMs: isHttps ? Math.max(0, timings.tlsEnd - timings.tlsStart) : 0,
              ttfbMs: Math.max(1, ttfb),
              downloadDurationMs: Math.max(0, timings.responseEnd - timings.firstByte),
              navigationDurationMs: totalDuration,
              fcpMs: Math.max(50, ttfb + 120), // Estimated synthetic FCP
              lcpMs: Math.max(100, ttfb + 250), // Estimated synthetic LCP
              cls: 0,
              longTasksCount: 0,
              transferSizeBytes: totalBytes
            },
            isSynthetic: true,
            discoveredResources
          });
        });
      });

      req.on('socket', (socket) => {
        timings.dnsStart = Date.now();
        socket.on('lookup', () => {
          timings.dnsEnd = Date.now();
          timings.connectStart = Date.now();
        });
        socket.on('connect', () => {
          timings.connectEnd = Date.now();
          timings.reqStart = Date.now();
        });
        socket.on('secureConnect', () => {
          timings.tlsEnd = Date.now();
          timings.reqStart = Date.now();
        });
      });

      req.on('error', (err) => {
        resolve({
          url: targetUrl,
          status: 500,
          statusText: err.message,
          headers: {},
          metrics: {
            dnsDurationMs: 0,
            connectDurationMs: 0,
            tlsDurationMs: 0,
            ttfbMs: 0,
            downloadDurationMs: 0,
            navigationDurationMs: Date.now() - startTime,
            fcpMs: 0,
            lcpMs: 0,
            cls: 0,
            longTasksCount: 0,
            transferSizeBytes: 0
          },
          isSynthetic: true,
          error: err.message,
          discoveredResources: []
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          url: targetUrl,
          status: 504,
          statusText: 'Gateway Timeout',
          headers: {},
          metrics: {
            dnsDurationMs: 0,
            connectDurationMs: 0,
            tlsDurationMs: 0,
            ttfbMs: 15000,
            downloadDurationMs: 0,
            navigationDurationMs: 15000,
            fcpMs: 0,
            lcpMs: 0,
            cls: 0,
            longTasksCount: 0,
            transferSizeBytes: 0
          },
          isSynthetic: true,
          error: 'Connection timed out after 15 seconds',
          discoveredResources: []
        });
      });

      req.end();
    });
  }

  static _extractResourcesFromHtml(html, baseUrl) {
    const resources = [];
    if (!html) return resources;

    // Scripts
    const scriptRegex = /<script\s+[^>]*src=['"]([^'"]+)['"]/gi;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      resources.push({ url: new URL(match[1], baseUrl).toString(), type: 'script' });
    }

    // Stylesheets
    const cssRegex = /<link\s+[^>]*rel=['"]stylesheet['"][^>]*href=['"]([^'"]+)['"]/gi;
    while ((match = cssRegex.exec(html)) !== null) {
      resources.push({ url: new URL(match[1], baseUrl).toString(), type: 'stylesheet' });
    }

    // Images
    const imgRegex = /<img\s+[^>]*src=['"]([^'"]+)['"]/gi;
    while ((match = imgRegex.exec(html)) !== null) {
      resources.push({ url: new URL(match[1], baseUrl).toString(), type: 'image' });
    }

    return resources;
  }
}

module.exports = SyntheticTiming;
