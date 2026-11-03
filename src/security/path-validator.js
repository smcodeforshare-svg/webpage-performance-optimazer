/**
 * Security Path Validator
 * Enforces strict boundary checks and prevents directory traversal attacks.
 */

const path = require('path');
const fs = require('fs');

// System directories that must NEVER be scanned as project roots
const FORBIDDEN_SYSTEM_PATHS = [
  '/',
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/lib64',
  '/proc',
  '/root',
  '/sbin',
  '/sys',
  '/usr',
  '/var',
  'C:\\',
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\Windows\\System32'
];

// Directories to skip during scanning to avoid infinite recursion, huge files, and false positives
const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  '.auditor-backups',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'coverage',
  '.cache'
]);

// Allowed extensions for source scanning
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm',
  '.php',
  '.json',
  '.txt', '.md'
]);

/**
 * Validates that a project root path is safe and accessible
 * @param {string} rawPath 
 * @returns {{ valid: boolean, resolvedPath?: string, error?: string }}
 */
function validateProjectPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') {
    return { valid: false, error: 'Project path must be a non-empty string.' };
  }

  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Project path cannot be blank.' };
  }

  // Resolve to absolute path
  const resolved = path.resolve(trimmed);

  // Check against forbidden system paths
  const normalizedResolved = path.normalize(resolved).toLowerCase();
  const rootPath = path.parse(resolved).root.toLowerCase();
  for (const forbidden of FORBIDDEN_SYSTEM_PATHS) {
    const normalizedForbidden = path.normalize(forbidden).toLowerCase();
    if (normalizedResolved === normalizedForbidden || normalizedResolved === rootPath) {
      return { valid: false, error: `Access to system directory '${rawPath}' is strictly forbidden.` };
    }
  }

  // Check if directory exists
  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `Directory does not exist: '${resolved}'` };
  }

  // Check that it is a directory
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return { valid: false, error: `Path is not a directory: '${resolved}'` };
    }
  } catch (err) {
    return { valid: false, error: `Unable to access directory: ${err.message}` };
  }

  return { valid: true, resolvedPath: resolved };
}

/**
 * Ensures that a target file path is strictly located within the specified root directory
 * @param {string} targetFilePath 
 * @param {string} projectRoot 
 * @returns {boolean}
 */
function isPathInsideRoot(targetFilePath, projectRoot) {
  if (!targetFilePath || !projectRoot) return false;

  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(projectRoot, targetFilePath);

  // Prevent path traversal: resolved target must start with resolved root + separator
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(rootWithSep);
}

/**
 * Checks if a directory name should be skipped
 * @param {string} dirName 
 * @returns {boolean}
 */
function isIgnoredDir(dirName) {
  return DEFAULT_IGNORED_DIRS.has(dirName) || dirName.startsWith('.git');
}

/**
 * Checks if a file is an allowed source file type
 * @param {string} filePath 
 * @returns {boolean}
 */
function isAllowedSourceFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

module.exports = {
  validateProjectPath,
  isPathInsideRoot,
  isIgnoredDir,
  isAllowedSourceFile,
  DEFAULT_IGNORED_DIRS,
  ALLOWED_EXTENSIONS
};
