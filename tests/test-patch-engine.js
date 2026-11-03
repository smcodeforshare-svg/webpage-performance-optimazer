const assert = require('assert');
const path = require('path');
const fs = require('fs');
const DiffEngine = require('../src/patches/diff-engine');
const SafeBackup = require('../src/patches/safe-backup');
const PatchApplier = require('../src/patches/patch-applier');

function testPatchEngine() {
  console.log('Running test: Safe Patch Engine & Rollback...');

  const tempProjectDir = path.join(__dirname, 'temp-patch-test-project');
  if (!fs.existsSync(tempProjectDir)) fs.mkdirSync(tempProjectDir, { recursive: true });

  const testFileRel = 'test-component.js';
  const testFileFull = path.join(tempProjectDir, testFileRel);
  const initialContent = `import React from 'react';\n\nexport function Item() {\n  return <div>Original</div>;\n}\n`;

  fs.writeFileSync(testFileFull, initialContent, 'utf8');

  // 1. Unified Diff Engine Test
  const modifiedContent = initialContent.replace('Original', 'Optimized');
  const diff = DiffEngine.createUnifiedDiff(initialContent, modifiedContent, testFileRel);
  assert.ok(diff.includes('--- a/test-component.js'));
  assert.ok(diff.includes('+++ b/test-component.js'));
  assert.ok(diff.includes('-  return <div>Original</div>;'));
  assert.ok(diff.includes('+  return <div>Optimized</div>;'));

  // 2. Safe Backup Test
  const { backupId } = SafeBackup.createBackup(tempProjectDir, [testFileRel]);
  assert.ok(backupId.startsWith('backup-'));

  const backups = SafeBackup.listBackups(tempProjectDir);
  assert.ok(backups.length >= 1);
  assert.strictEqual(backups[0].backupId, backupId);

  // 3. Patch Application Test
  const dummyFinding = {
    filePath: testFileRel,
    startLine: 4,
    endLine: 4,
    existingCode: '  return <div>Original</div>;',
    replacementCode: '  return <div>Optimized</div>;'
  };

  const applyRes = PatchApplier.apply(tempProjectDir, dummyFinding);
  assert.strictEqual(applyRes.success, true);

  const updatedContent = fs.readFileSync(testFileFull, 'utf8');
  assert.ok(updatedContent.includes('Optimized'));
  assert.ok(!updatedContent.includes('Original'));

  // 4. Rollback Test
  const rollbackRes = PatchApplier.rollback(tempProjectDir, backupId);
  assert.strictEqual(rollbackRes.success, true);

  const restoredContent = fs.readFileSync(testFileFull, 'utf8');
  assert.strictEqual(restoredContent, initialContent);

  // Cleanup temp files
  try {
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  } catch {}

  console.log('✓ Safe Patch Engine & Rollback tests passed.');
}

module.exports = testPatchEngine;
if (require.main === module) testPatchEngine();
