/**
 * Safe Backup and Rollback Manager
 * Creates isolated snapshots before file modifications and supports instant rollback.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isPathInsideRoot } = require('../security/path-validator');

class SafeBackup {
  static getBackupsDir(projectRoot) {
    return path.join(projectRoot, '.auditor-backups');
  }

  /**
   * Creates a backup of specific files before modifying them
   * @param {string} projectRoot 
   * @param {string[]} relativeFilePaths 
   * @returns {{ backupId: string, backupDir: string, manifest: Object }}
   */
  static createBackup(projectRoot, relativeFilePaths) {
    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const backupsRoot = this.getBackupsDir(projectRoot);
    const backupDir = path.join(backupsRoot, backupId);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const manifest = {
      backupId,
      createdAt: new Date().toISOString(),
      files: []
    };

    for (const relPath of relativeFilePaths) {
      const sourcePath = path.join(projectRoot, relPath);
      if (!isPathInsideRoot(sourcePath, projectRoot)) {
        throw new Error(`Security violation: File '${relPath}' escapes project root.`);
      }

      if (fs.existsSync(sourcePath)) {
        const content = fs.readFileSync(sourcePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        // Copy file into backup directory
        const destPath = path.join(backupDir, relPath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, content);

        manifest.files.push({
          relPath,
          sha256: hash,
          sizeBytes: content.length
        });
      }
    }

    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    return { backupId, backupDir, manifest };
  }

  /**
   * Restores files from a specific backup ID
   * @param {string} projectRoot 
   * @param {string} backupId 
   * @returns {{ success: boolean, restoredFiles: string[], error?: string }}
   */
  static restoreBackup(projectRoot, backupId) {
    const backupDir = path.join(this.getBackupsDir(projectRoot), backupId);
    const manifestPath = path.join(backupDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      return { success: false, restoredFiles: [], error: `Backup '${backupId}' not found.` };
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      return { success: false, restoredFiles: [], error: `Corrupt backup manifest: ${err.message}` };
    }

    const restoredFiles = [];

    for (const fileInfo of manifest.files) {
      const backupFilePath = path.join(backupDir, fileInfo.relPath);
      const targetFilePath = path.join(projectRoot, fileInfo.relPath);

      if (!isPathInsideRoot(targetFilePath, projectRoot)) {
        continue;
      }

      if (fs.existsSync(backupFilePath)) {
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.copyFileSync(backupFilePath, targetFilePath);
        restoredFiles.push(fileInfo.relPath);
      }
    }

    return { success: true, restoredFiles };
  }

  /**
   * Lists all available backups for a project
   * @param {string} projectRoot 
   */
  static listBackups(projectRoot) {
    const backupsRoot = this.getBackupsDir(projectRoot);
    if (!fs.existsSync(backupsRoot)) return [];

    const backups = [];
    try {
      const dirs = fs.readdirSync(backupsRoot);
      for (const d of dirs) {
        const manifestPath = path.join(backupsRoot, d, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            backups.push(manifest);
          } catch {}
        }
      }
    } catch {}

    // Sort newest first
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return backups;
  }
}

module.exports = SafeBackup;
