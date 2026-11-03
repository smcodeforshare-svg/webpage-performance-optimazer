/**
 * Playwright Chromium Browser Auditor
 * Conducts automated browser audits, collects Core Web Vitals, network requests, console errors, and long tasks.
 */

const RequestInventory = require('../network/request-inventory');
const SyntheticTiming = require('./synthetic-timing');

class PlaywrightAuditor {
  /**
   * Runs browser performance audit on a target URL
   * @param {string} targetUrl 
   * @param {Object} options 
   */
  static async auditUrl(targetUrl, options = {}) {
    const isMobile = Boolean(options.isMobile);
    const isWarmCache = Boolean(options.warmCache);
    const captureScreenshot = Boolean(options.screenshot);

    let playwright;
    try {
      playwright = require('playwright');
    } catch {
      try {
        playwright = require('playwright-chromium');
      } catch {
        playwright = null;
      }
    }

    // If Playwright is not installed, fallback to synthetic timing engine
    if (!playwright) {
      return this._runSyntheticFallback(targetUrl, options, 'Playwright is not installed in local environment.');
    }

    const inventory = new RequestInventory(targetUrl);
    const consoleLogs = [];
    const pageErrors = [];
    let browser = null;
    let context = null;

    try {
      browser = await playwright.chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--js-flags=--expose-gc'
        ]
      });

      const contextOptions = isMobile
        ? {
            viewport: { width: 390, height: 844 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true
          }
        : {
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            deviceScaleFactor: 1
          };

      context = await browser.newContext(contextOptions);
      const page = await context.newPage();

      // Listen to console events
      page.on('console', msg => {
        const type = msg.type();
        if (['error', 'warning'].includes(type)) {
          consoleLogs.push({
            type,
            text: msg.text(),
            location: msg.location()
          });
        }
      });

      // Listen to uncaught page errors
      page.on('pageerror', err => {
        pageErrors.push({
          message: err.message,
          stack: err.stack
        });
      });

      // Track network requests
      const requestStartTimes = new Map();

      page.on('request', req => {
        requestStartTimes.set(req, Date.now());
      });

      page.on('requestfinished', async req => {
        const start = requestStartTimes.get(req) || Date.now();
        const duration = Date.now() - start;
        const res = await req.response().catch(() => null);

        let size = 0;
        let status = 0;
        let responseHeaders = {};

        if (res) {
          status = res.status();
          responseHeaders = res.headers();
          const buffer = await res.body().catch(() => null);
          if (buffer) size = buffer.length;
        }

        inventory.addRequest({
          url: req.url(),
          method: req.method(),
          status,
          duration,
          resourceType: req.resourceType(),
          size,
          headers: req.headers(),
          responseHeaders,
          initiator: req.url() === targetUrl ? 'navigation' : 'script',
          timestamp: start
        });
      });

      page.on('requestfailed', req => {
        const start = requestStartTimes.get(req) || Date.now();
        const duration = Date.now() - start;
        const failure = req.failure();

        inventory.addRequest({
          url: req.url(),
          method: req.method(),
          status: 0,
          duration,
          resourceType: req.resourceType(),
          size: 0,
          failed: true,
          errorText: failure ? failure.errorText : 'Request aborted or failed',
          headers: req.headers(),
          initiator: 'script',
          timestamp: start
        });
      });

      // Inject Core Web Vitals observation script
      await page.addInitScript(() => {
        window.__auditorMetrics = {
          fcp: 0,
          lcp: 0,
          cls: 0,
          longTasks: [],
          navigation: null
        };

        try {
          // FCP
          const paintObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (entry.name === 'first-contentful-paint') {
                window.__auditorMetrics.fcp = entry.startTime;
              }
            }
          });
          paintObserver.observe({ type: 'paint', buffered: true });

          // LCP
          const lcpObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            if (entries.length > 0) {
              window.__auditorMetrics.lcp = entries[entries.length - 1].startTime;
            }
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

          // CLS
          const clsObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (!entry.hadRecentInput) {
                window.__auditorMetrics.cls += entry.value;
              }
            }
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });

          // Long Tasks (> 50ms)
          const longTaskObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              window.__auditorMetrics.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime
              });
            }
          });
          longTaskObserver.observe({ type: 'longtask', buffered: true });
        } catch {}
      });

      // Navigation
      const navStartTime = Date.now();
      await page.goto(targetUrl, {
        waitUntil: 'networkidle',
        timeout: 25000
      }).catch(async () => {
        // Fallback to load state if networkidle times out
        await page.goto(targetUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
      });

      // If warm cache requested, perform reload
      if (isWarmCache) {
        await page.reload({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      }

      // Small pause for metrics to settle
      await page.waitForTimeout(1000);

      // Extract metrics from page
      const inPageMetrics = await page.evaluate(() => {
        const navEntries = performance.getEntriesByType('navigation');
        const nav = navEntries.length > 0 ? navEntries[0] : null;

        const memory = performance.memory ? {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize
        } : null;

        return {
          vitals: window.__auditorMetrics || {},
          navigation: nav ? {
            dnsDuration: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            connectDuration: Math.round(nav.connectEnd - nav.connectStart),
            tlsDuration: nav.secureConnectionStart ? Math.round(nav.connectEnd - nav.secureConnectionStart) : 0,
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            downloadDuration: Math.round(nav.responseEnd - nav.responseStart),
            domInteractive: Math.round(nav.domInteractive),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
            loadEvent: Math.round(nav.loadEventEnd),
            duration: Math.round(nav.duration)
          } : null,
          memory
        };
      }).catch(() => ({ vitals: {}, navigation: null, memory: null }));

      let screenshotBase64 = null;
      if (captureScreenshot) {
        const buf = await page.screenshot({ type: 'jpeg', quality: 70 }).catch(() => null);
        if (buf) screenshotBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
      }

      await context.close().catch(() => {});
      await browser.close().catch(() => {});

      const nav = inPageMetrics.navigation || {};
      const vitals = inPageMetrics.vitals || {};

      return {
        url: targetUrl,
        isMobile,
        isWarmCache,
        auditedAt: new Date().toISOString(),
        isBrowserAudited: true,
        metrics: {
          dnsDurationMs: nav.dnsDuration || 0,
          connectDurationMs: nav.connectDuration || 0,
          tlsDurationMs: nav.tlsDuration || 0,
          ttfbMs: nav.ttfb || 0,
          downloadDurationMs: nav.downloadDuration || 0,
          domInteractiveMs: nav.domInteractive || 0,
          domContentLoadedMs: nav.domContentLoaded || 0,
          loadEventMs: nav.loadEvent || 0,
          navigationDurationMs: nav.duration || (Date.now() - navStartTime),
          fcpMs: Math.round(vitals.fcp || 0),
          lcpMs: Math.round(vitals.lcp || 0),
          cls: Number((vitals.cls || 0).toFixed(3)),
          inpMs: null, // Note: INP requires real user field interactions
          longTasksCount: vitals.longTasks ? vitals.longTasks.length : 0,
          memory: inPageMetrics.memory
        },
        requests: inventory.getAll(),
        requestSummary: inventory.getSummary(),
        consoleLogs,
        pageErrors,
        screenshot: screenshotBase64
      };
    } catch (err) {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      return this._runSyntheticFallback(targetUrl, options, err.message);
    }
  }

  static async _runSyntheticFallback(targetUrl, options, reason) {
    const synthResult = await SyntheticTiming.audit(targetUrl, options);
    const inventory = new RequestInventory(targetUrl);

    // Add main document request
    inventory.addRequest({
      url: targetUrl,
      method: 'GET',
      status: synthResult.status,
      duration: synthResult.metrics.navigationDurationMs,
      resourceType: 'document',
      size: synthResult.metrics.transferSizeBytes,
      headers: {},
      responseHeaders: synthResult.headers,
      timing: {
        dns: synthResult.metrics.dnsDurationMs,
        connect: synthResult.metrics.connectDurationMs,
        ssl: synthResult.metrics.tlsDurationMs,
        ttfb: synthResult.metrics.ttfbMs,
        download: synthResult.metrics.downloadDurationMs
      }
    });

    // Add discovered resources
    for (const res of synthResult.discoveredResources) {
      inventory.addRequest({
        url: res.url,
        method: 'GET',
        status: 200,
        duration: Math.round(synthResult.metrics.ttfbMs + 40),
        resourceType: res.type,
        size: 15000,
        headers: {},
        responseHeaders: {}
      });
    }

    return {
      url: targetUrl,
      isMobile: Boolean(options.isMobile),
      isWarmCache: Boolean(options.warmCache),
      auditedAt: new Date().toISOString(),
      isBrowserAudited: false,
      fallbackNotice: `Using high-precision synthetic timing probe (${reason})`,
      metrics: synthResult.metrics,
      requests: inventory.getAll(),
      requestSummary: inventory.getSummary(),
      consoleLogs: [],
      pageErrors: synthResult.error ? [{ message: synthResult.error }] : [],
      screenshot: null
    };
  }
}

module.exports = PlaywrightAuditor;
