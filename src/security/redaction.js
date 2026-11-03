/**
 * Data Redaction Utility
 * Strips authorization headers, cookies, API keys, and sensitive tokens.
 */

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
  'session-token',
  'token'
]);

/**
 * Sanitizes HTTP headers by masking sensitive credentials
 * @param {Record<string, string>} headers 
 * @returns {Record<string, string>}
 */
function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {};

  const clean = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.has(lowerKey)) {
      clean[key] = '[REDACTED_CREDENTIAL]';
    } else {
      clean[key] = String(value);
    }
  }
  return clean;
}

/**
 * Masks secrets from source code text (e.g. before sending to AI or exports)
 * @param {string} text 
 * @returns {string}
 */
function redactSourceSecrets(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // JWT tokens
    .replace(/ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}/g, '[REDACTED_JWT_TOKEN]')
    // OpenAI, Stripe, AWS style API keys
    .replace(/(sk-[A-Za-z0-9]{20,})/g, '[REDACTED_API_KEY]')
    .replace(/(AKIA[0-9A-Z]{16})/g, '[REDACTED_AWS_KEY]')
    // Generic password/secret assignments
    .replace(/(password|passwd|secret|apikey|api_key|token)\s*[:=]\s*["'][^"'\n]{6,}["']/gi, '$1 = "[REDACTED]"');
}

module.exports = {
  redactHeaders,
  redactSourceSecrets
};
