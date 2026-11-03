const assert = require('assert');
const path = require('path');
const { validateProjectPath, isPathInsideRoot, isIgnoredDir, isAllowedSourceFile } = require('../src/security/path-validator');

function testPathValidator() {
  console.log('Running test: Path Validator & Security...');

  // 1. Valid local directory
  const currentDir = path.resolve(__dirname, '..');
  const res = validateProjectPath(currentDir);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.resolvedPath, currentDir);

  // 2. Reject non-existent directory
  const badRes = validateProjectPath('/non/existent/path/here/12345');
  assert.strictEqual(badRes.valid, false);

  // 3. Reject root / system directories
  const sysRoot = validateProjectPath('/');
  assert.strictEqual(sysRoot.valid, false);

  // 4. Directory traversal check
  assert.strictEqual(isPathInsideRoot('src/components/App.jsx', currentDir), true);
  assert.strictEqual(isPathInsideRoot('../../etc/passwd', currentDir), false);

  // 5. Ignored dirs
  assert.strictEqual(isIgnoredDir('node_modules'), true);
  assert.strictEqual(isIgnoredDir('.git'), true);
  assert.strictEqual(isIgnoredDir('__pycache__'), true);
  assert.strictEqual(isIgnoredDir('src'), false);

  // 6. Allowed extensions
  assert.strictEqual(isAllowedSourceFile('App.jsx'), true);
  assert.strictEqual(isAllowedSourceFile('server.py'), true);
  assert.strictEqual(isAllowedSourceFile('styles.css'), true);
  assert.strictEqual(isAllowedSourceFile('archive.zip'), false);
  assert.strictEqual(isAllowedSourceFile('binary.exe'), false);

  console.log('✓ Path Validator tests passed.');
}

module.exports = testPathValidator;
if (require.main === module) testPathValidator();
