const assert = require('assert');
const { validateUrl, sanitizeUrl, isLocalhostUrl } = require('../src/security/url-sanitizer');

function testUrlSanitizer() {
  console.log('Running test: URL Sanitizer & Security...');

  // 1. Valid URLs
  const v1 = validateUrl('http://localhost:3000/dashboard');
  assert.strictEqual(v1.valid, true);

  const v2 = validateUrl('https://api.example.com/v1/users?active=true');
  assert.strictEqual(v2.valid, true);

  // 2. Reject dangerous protocols
  const d1 = validateUrl('file:///etc/passwd');
  assert.strictEqual(d1.valid, false);

  const d2 = validateUrl('javascript:alert(1)');
  assert.strictEqual(d2.valid, false);

  const d3 = validateUrl('ftp://ftp.example.com');
  assert.strictEqual(d3.valid, false);

  // 3. Sensitive parameter redaction
  const s1 = sanitizeUrl('https://example.com/api?token=secret123&page=2');
  assert.ok(!s1.includes('secret123'));
  assert.ok(s1.includes('REDACTED'));
  assert.ok(s1.includes('page=2'));

  const s2 = sanitizeUrl('https://user:mypassword@example.com/resource');
  assert.ok(!s2.includes('mypassword'));

  // 4. Localhost check
  assert.strictEqual(isLocalhostUrl('http://localhost:3000'), true);
  assert.strictEqual(isLocalhostUrl('http://127.0.0.1:8080'), true);
  assert.strictEqual(isLocalhostUrl('https://example.com'), false);

  console.log('✓ URL Sanitizer tests passed.');
}

module.exports = testUrlSanitizer;
if (require.main === module) testUrlSanitizer();
