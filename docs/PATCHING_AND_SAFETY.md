# Patching, Safety & Rollback Guide

Auditor Pro v3.0 is built around the principle of **zero silent file modifications**. Code is only modified with explicit user permission, and every change is backed by an automated rollback mechanism.

---

## The Safe Patch Workflow

```
[ Static / Runtime Finding ]
             ↓
[ Unified Diff Preview ]
             ↓
[ Stale Check (SHA-256 Verification) ]
             ↓
[ Explicit User Confirmation Modal ]
             ↓
[ Snapshot Created in .auditor-backups/ ]
             ↓
[ Atomic Code Replacement ]
             ↓
[ Post-Write Hash Verification ]
```

---

## 1. Stale Finding Prevention
Whenever a file is scanned, Auditor Pro stores its SHA-256 hash. When you click **Apply Safe Patch**:
1. Auditor Pro reads the current file from disk.
2. It compares the current hash against the hash at audit time.
3. If the file has changed on disk since the audit, the patch button is disabled with the warning:
   `STALE FINDING: File has been modified on disk. Please re-scan before applying.`
This guarantees you never overwrite intermediate edits or apply a patch at the wrong line offset.

---

## 2. Automated Backups (`.auditor-backups/`)
Before modifying any file on disk, Auditor Pro creates an isolated snapshot in `.auditor-backups/<backup-id>/`:
```
.auditor-backups/
└── backup-1698582000-a7b2/
    ├── manifest.json
    └── src/
        └── components/
            └── ProductList.jsx
```
The `manifest.json` tracks the exact timestamp, original file paths, and cryptographic checksums.

---

## 3. Instant Rollback
To restore a file:
1. Navigate to the **Safe Patching & Diffs** tab.
2. Under **Rollback & Backups**, find the backup entry.
3. Click **Restore Backup**. The original file is restored immediately.

---

## 4. Downloadable Patch Files
If you prefer to review or apply changes using Git or standard developer tooling:
1. Click **Download .patch File**.
2. Apply the patch manually in your project terminal:
   ```bash
   git apply ProductList.patch
   ```
