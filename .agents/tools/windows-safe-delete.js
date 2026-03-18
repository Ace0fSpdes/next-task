/**
 * @file .agents/tools/windows-safe-delete.js
 * @description A robust utility for deleting files with reserved names on Windows (e.g., nul, con, prn).
 *
 * ## The Problem
 * On Windows, certain filenames are reserved. If a file with one of these names is created
 * (often by cross-platform tools or scripts), it cannot be deleted through normal means.
 * This will block `git add .` with an `error: invalid path '...'` and prevent commits.
 * Standard `rm` or `del` commands often fail with "No such file or directory".
 *
 * ## The Solution
 * This script bypasses standard Windows API name checks to purge the artifact. It uses Node.js's
 * filesystem module and, if necessary, falls back to Windows-specific extended path syntax
 * (`\\?\C:\...`), which operates directly on the filesystem object without path validation.
 *
 * ## Usage
 * From the repository root, execute this script with node, passing the path to the problematic file.
 *
 * @example
 * // To delete a file named 'nul' in the current directory
 * node .\.agents\tools\windows-safe-delete.js .\nul
 *
 * @example
 * // To delete a file named 'con' in a subdirectory
 * node .\.agents\tools\windows-safe-delete.js .\some-dir\con
 */

const fs = require('fs');
const path = require('path');

const fileToDelete = process.argv[2];

if (!fileToDelete) {
  console.error('Error: A file path must be provided.');
  console.error('Usage: node windows-safe-delete.js <path-to-file>');
  process.exit(1);
}

const absolutePath = path.resolve(fileToDelete);

if (!fs.existsSync(absolutePath)) {
  console.error(`Error: File not found at "${absolutePath}"`);
  process.exit(1);
}

try {
  fs.unlinkSync(absolutePath);
  console.log(`✅ File successfully deleted: "${absolutePath}"`);
} catch (err) {
  // If the standard unlink fails, try the Windows-specific extended path syntax.
  if (process.platform === 'win32') {
    console.log('Standard delete failed. Attempting Windows extended path syntax...');
    const extendedPath = '\\\\?\\' + absolutePath;
    try {
      fs.unlinkSync(extendedPath);
      console.log(`✅ File successfully deleted using extended path: "${extendedPath}"`);
    } catch (e) {
      console.error(`❌ Fatal: Error deleting file with extended path: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.error(`❌ Fatal: Error deleting file: ${err.message}`);
    process.exit(1);
  }
}
