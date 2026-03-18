/**
 * windows-safe-delete.js
 *
 * A robust utility for deleting files with reserved names on Windows (e.g., nul, con, prn).
 * Standard shell commands like `rm` and even cmd's `del` can fail on these files.
 * This script succeeds by using Node.js's filesystem module and falling back to
 * Windows-specific extended path syntax (`\\?\C:\...`) which bypasses the name checks.
 *
 * Usage:
 *   node .\.agents\tools\windows-safe-delete.js <path-to-problem-file>
 *
 * Example:
 *   node .\.agents\tools\windows-safe-delete.js .\some-dir\nul
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
