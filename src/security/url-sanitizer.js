/**
 * URL Sanitizer and Security Validator
 * Ensures only HTTP/HTTPS protocols are audited and removes sensitive query parameters.
 */

const { URL } = require('url');

const SENSITIVE_QUERY_PARAMS = [
  'token',
  'api_key',
  'apikey',
  'auth',
  'key',
  'secret',
  'password',
  'passwd',
  'access_token',
  'session',
  'bearer'
];

/**
 * Validates whether a URL has a supported scheme (http or https) and valid syntax
 * @param {string} rawUrl 
 * @returns {{ valid: boolean, parsed?: URL, error?: string }}
 */
function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string.' };
  }

  const trimmed = rawUrl.trim();
  let parsed;

  try {
    parsed = new URL(trimmed);
  } catch (err) {
    if (!trimmed.includes('://')) {
      return { valid: false, error: 'URL must include a valid protocol scheme (e.g. http:// or https://).' };
    }
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { valid: false, error: `Unsupported protocol '${parsed.protocol}'. Only http: and https: are allowed.` };
  }

  // Reject local file protocol, ftp, javascript, data URLs
  if (['file:', 'ftp:', 'javascript:', 'data:', 'vbscript:'].includes(protocol)) {
    return { valid: false, error: `Dangerous protocol '${protocol}' rejected.` };
  }

  return { valid: true, parsed };
}

/**
 * Strips sensitive tokens and credentials from URL for logging and reports
 * @param {string} rawUrl 
 * @returns {string}
 */
function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  try {
    const parsed = new URL(rawUrl);

    // Strip userinfo (username:password@)
    parsed.username = '';
    parsed.password = '';

    // Redact sensitive query parameters
    const params = parsed.searchParams;
    for (const key of Array.from(params.keys())) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_QUERY_PARAMS.some(p => lowerKey.includes(p))) {
        params.set(key, 'REDACTED');
      }
    }

    return decodeURIComponent(parsed.toString());
  } catch {
    return rawUrl
      .replace(/([?&])(token|api_?key|auth|secret|password)=[^&#]*/gi, '$1$2=REDACTED')
      .replace(/:\/\/[^:]+:[^@]+@/, '://REDACTED@REDACTED/');
  }
}

/**
 * Checks if a URL targets localhost or loopback interface
 * @param {string} rawUrl 
 * @returns {boolean}
 */
function isLocalhostUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
  } catch {
    return false;
  }
}

module.exports = {
  validateUrl,
  sanitizeUrl,
  isLocalhostUrl
};
