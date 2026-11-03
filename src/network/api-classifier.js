/**
 * API Request Classifier
 * Analyzes URL patterns, content-types, resource types, and HTTP methods to identify API calls.
 * Includes support for REST APIs, GraphQL, WordPress REST API (/wp-json/), and WordPress AJAX (admin-ajax.php).
 */

const { URL } = require('url');

const API_PATH_PATTERNS = [
  /\/api\//i,
  /\/wp-json\//i,              // WordPress REST API
  /admin-ajax\.php/i,          // WordPress AJAX endpoint
  /[?&]rest_route=/i,          // WordPress REST query format (?rest_route=/...)
  /\/v[0-9]+\//i,
  /\/graphql/i,
  /\/rest\//i,
  /\.json(\?|$)/i,
  /\/data\//i,
  /\/query/i,
  /\/rpc\//i
];

const STATIC_EXTENSIONS = new Set([
  '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.map', '.html'
]);

class ApiClassifier {
  /**
   * Evaluates if a network request is an API endpoint
   * @param {Object} req 
   * @returns {{ isApi: boolean, confidence: string, reason: string }}
   */
  static classify(req) {
    const urlStr = req.url || '';
    const resourceType = (req.resourceType || '').toLowerCase();
    const method = (req.method || 'GET').toUpperCase();
    const contentType = (req.responseHeaders?.['content-type'] || req.headers?.['content-type'] || '').toLowerCase();

    // Direct fetch / xhr resource types
    if (['fetch', 'xhr'].includes(resourceType)) {
      return {
        isApi: true,
        confidence: 'verified',
        reason: `Browser resourceType is '${resourceType}'.`
      };
    }

    // JSON content type
    if (contentType.includes('application/json') || contentType.includes('application/ld+json')) {
      return {
        isApi: true,
        confidence: 'verified',
        reason: `Response Content-Type is '${contentType}'.`
      };
    }

    // WordPress AJAX or REST API check
    if (/admin-ajax\.php/i.test(urlStr)) {
      return {
        isApi: true,
        confidence: 'verified',
        reason: 'WordPress AJAX endpoint (admin-ajax.php).'
      };
    }

    if (/\/wp-json\//i.test(urlStr) || /[?&]rest_route=/i.test(urlStr)) {
      return {
        isApi: true,
        confidence: 'verified',
        reason: 'WordPress REST API endpoint.'
      };
    }

    // Check URL path patterns
    for (const pattern of API_PATH_PATTERNS) {
      if (pattern.test(urlStr)) {
        return {
          isApi: true,
          confidence: 'strongly_supported',
          reason: `URL matches API path convention '${pattern}'.`
        };
      }
    }

    // Non-GET methods with body
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      try {
        const parsed = new URL(urlStr);
        const ext = parsed.pathname.slice(parsed.pathname.lastIndexOf('.')).toLowerCase();
        if (!STATIC_EXTENSIONS.has(ext)) {
          return {
            isApi: true,
            confidence: 'strongly_supported',
            reason: `Mutating HTTP method '${method}'.`
          };
        }
      } catch {}
    }

    return {
      isApi: false,
      confidence: 'strongly_supported',
      reason: 'Static asset or standard page document navigation.'
    };
  }
}

module.exports = ApiClassifier;
