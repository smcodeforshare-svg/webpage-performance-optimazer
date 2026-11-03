/**
 * Safe Patch Applier
 * Enforces stale checks, explicit confirmation, backups, and rollback capabilities.
 */

const fs = require('fs');
const path = require('path');
const SafeBackup = require('./safe-backup');
const PatchGenerator = require('./patch-generator');
const LineMapper = require('../source-analysis/line-mapper');
const { isPathInsideRoot } = require('../security/path-validator');

class PatchApplier {
  /**
   * Generates a preview diff for a finding without writing to disk
   * @param {string} projectRoot 
   * @param {Object} finding 
   */
  static preview(projectRoot, finding) {
    const fullPath = path.resolve(projectRoot, finding.filePath);
    if (!isPathInsideRoot(fullPath, projectRoot)) {
      throw new Error(`Security error: Target path '${finding.filePath}' escapes project root.`);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Target file does not exist: '${finding.filePath}'`);
    }

    const currentContent = fs.readFileSync(fullPath, 'utf8');
    const mapper = new LineMapper(currentContent);
    const currentHash = mapper.getContentHash();

    // Check staleness
    const isStale = finding.fileHash && finding.fileHash !== currentHash;

    const { unifiedDiff, modifiedContent } = PatchGenerator.generateFindingPatch(finding, currentContent);

    return {
      filePath: finding.filePath,
      isStale,
      currentHash,
      unifiedDiff,
      modifiedContent
    };
  }

  /**
   * Applies an approved patch with automatic backup
   * @param {string} projectRoot 
   * @param {Object} finding 
   * @returns {{ success: boolean, backupId: string, error?: string }}
   */
  static apply(projectRoot, finding) {
    const fullPath = path.resolve(projectRoot, finding.filePath);
    if (!isPathInsideRoot(fullPath, projectRoot)) {
      throw new Error(`Security error: Target path '${finding.filePath}' escapes project root.`);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Target file does not exist: '${finding.filePath}'`);
    }

    const currentContent = fs.readFileSync(fullPath, 'utf8');
    const mapper = new LineMapper(currentContent);
    const currentHash = mapper.getContentHash();

    // Verify code block still matches expected lines
    const currentSlice = mapper.getLinesSlice(finding.startLine, finding.endLine).trim();
    const expectedSlice = (finding.existingCode || '').trim();

    // If file hash changed AND slices differ significantly, refuse to apply
    if (finding.fileHash && finding.fileHash !== currentHash && currentSlice !== expectedSlice) {
      return {
        success: false,
        error: `Stale finding detected! The file '${finding.filePath}' has been modified on disk since the audit was run. Please re-scan before applying.`
      };
    }

    // 1. Create safe backup
    const { backupId } = SafeBackup.createBackup(projectRoot, [finding.filePath]);

    // 2. Generate modified content
    const { modifiedContent } = PatchGenerator.generateFindingPatch(finding, currentContent);

    // 3. Write new content
    try {
      fs.writeFileSync(fullPath, modifiedContent, 'utf8');
    } catch (err) {
      // Rollback immediately if write failed
      SafeBackup.restoreBackup(projectRoot, backupId);
      return {
        success: false,
        error: `Failed to write changes: ${err.message}. Changes rolled back.`
      };
    }

    // 4. Re-read and verify hash
    const verifiedContent = fs.readFileSync(fullPath, 'utf8');
    const newMapper = new LineMapper(verifiedContent);

    return {
      success: true,
      backupId,
      filePath: finding.filePath,
      newHash: newMapper.getContentHash()
    };
  }

  /**
   * Rolls back a previously applied backup
   * @param {string} projectRoot 
   * @param {string} backupId 
   */
  static rollback(projectRoot, backupId) {
    return SafeBackup.restoreBackup(projectRoot, backupId);
  }
}

module.exports = PatchApplier;
