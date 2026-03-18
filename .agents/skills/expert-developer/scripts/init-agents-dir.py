#!/usr/bin/env python3
"""
Initialize .agents/ directory structure for any project

This script creates the complete .agents/ directory hierarchy
required for self-learning governance and agent remediation.

Idempotent: Safe to run multiple times
Platform: Windows and Linux compatible

Usage:
  python3 init-agents-dir.py [baseDir]
  
Example:
  python3 init-agents-dir.py "C:\Users\Project"
  python3 init-agents-dir.py "."
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Complete directory structure required for expert-developer governance
AGENTS_STRUCTURE = [
    ".agents",
    ".agents/knowledge",
    ".agents/knowledge/deployment",
    ".agents/knowledge/architecture",
    ".agents/knowledge/troubleshooting",
    ".agents/knowledge/.changelog",
    ".agents/patterns",
    ".agents/patterns/.changelog",
    ".agents/truth",
    ".agents/tools",
    ".agents/tools/logs",
    ".agents/tools/errors",
    ".agents/tools/errors/.archive",
]


def init_agents_dir(base_dir: str = ".") -> dict:
    """Initialize .agents/ directory structure"""
    result = {
        "success": True,
        "baseDir": str(Path(base_dir).resolve()),
        "created": [],
        "errors": [],
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    try:
        # Resolve base directory
        resolved = Path(base_dir).resolve()

        # Create each directory in structure
        for dir_name in AGENTS_STRUCTURE:
            full_path = resolved / dir_name

            try:
                # Check if directory exists
                if not full_path.exists():
                    # Directory doesn't exist, create it
                    full_path.mkdir(parents=True, exist_ok=True)
                    result["created"].append(dir_name)
                elif not full_path.is_dir():
                    result["errors"].append(
                        f"{dir_name} exists but is not a directory"
                    )
                    result["success"] = False
            except Exception as err:
                result["errors"].append(f"Failed to create {dir_name}: {str(err)}")
                result["success"] = False

        # Verify all directories exist
        for dir_name in AGENTS_STRUCTURE:
            full_path = resolved / dir_name
            try:
                if not full_path.exists() or not full_path.is_dir():
                    result["errors"].append(f"{dir_name} could not be verified")
                    result["success"] = False
            except Exception as err:
                result["errors"].append(f"{dir_name} verification failed: {str(err)}")
                result["success"] = False

    except Exception as err:
        result["errors"].append(f"Fatal error: {str(err)}")
        result["success"] = False

    return result


def main():
    """Main entry point"""
    base_dir = sys.argv[1] if len(sys.argv) > 1 else "."

    result = init_agents_dir(base_dir)

    # Output result as JSON for tool consumption
    print(json.dumps(result, indent=2))

    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
