---
title: "Pattern: Purging Windows Reserved Filename Artifacts"
semantic_tags: [windows, filesystem, git, bug, pattern, tool]
keywords: [nul, con, prn, aux, reserved names, delete, unlink, git error]
category: patterns
created_at: 2026-03-18T06:40:00Z
updated_at: 2026-03-18T06:40:00Z
---

# Pattern: Purging Windows Reserved Filename Artifacts

## Problem

On the Windows operating system, certain filenames are reserved and cannot be created or deleted through normal means. These include `CON`, `PRN`, `AUX`, `NUL`, and others (e.g., `COM1`-`COM9`).

These files can sometimes be created accidentally by misconfigured tools or cross-platform scripts. Once they exist, they cause significant problems:

1.  **`git` will fail:** `git add .` will error out with messages like `error: invalid path 'nul'` and `fatal: adding files failed`. This completely blocks the commit process.
2.  **Standard shell commands fail:** `rm nul` in Git Bash or `del nul` in CMD will often fail with "No such file or directory" or similar errors, even though the file is clearly visible.

This creates a state where the repository is "stuck" and cannot be committed.

## Solution: `windows-safe-delete.js` Utility

A specialized tool has been created to solve this problem. It bypasses the standard Windows API name checks and deletes the problematic file.

**Location:** `.agents/tools/windows-safe-delete.js`

### How It Works

1.  **Node.js `fs` Module:** It uses Node.js's built-in filesystem module, which has more robust file handling capabilities than typical shell commands.
2.  **Windows Extended Path Syntax:** Its primary weapon is the Windows-specific extended path syntax: `\\?\C:\...`. This syntax signals to the Windows API that it should not perform its usual path parsing or name validation, allowing it to operate directly on the filesystem object. The script attempts a standard deletion and, upon failure, automatically retries with this special syntax.

### How to Use

If you encounter a reserved filename artifact that is blocking a commit, use this tool to purge it.

1.  **Identify the path** to the problematic file (e.g., `nul`, `con`).
2.  **Execute the script** from the repository root, passing the file path as an argument:

```bash
node .\.agents\tools\windows-safe-delete.js path\to\your\nul
```

The script will confirm the deletion. Once the file is gone, you can proceed with your `git add .` and `git commit` operations.
