#!/bin/bash
# Build semantic search index from .agents/ documents
# Usage: build-index [--base-dir PATH] [--output PATH] [--verbose]

BASE_DIR="."
OUTPUT=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --base-dir)
            BASE_DIR="$2"
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PYTHON_SCRIPT="$SKILL_DIR/build-index.py"
LOGS_FILE="$SKILL_DIR/scripts/tools/logs.json"

# Set default output
if [[ -z "$OUTPUT" ]]; then
    OUTPUT="$BASE_DIR/.agents/index.json"
fi

# Check base dir
if [[ ! -d "$BASE_DIR" ]]; then
    echo "Error: Base directory not found: $BASE_DIR" >&2
    exit 1
fi

# Create logs directory
LOGS_DIR=$(dirname "$LOGS_FILE")
mkdir -p "$LOGS_DIR" 2>/dev/null

# Build command
PYTHON_CMD=(
    "$PYTHON_SCRIPT"
    "--docs-dir" "$BASE_DIR/.agents"
    "--output" "$OUTPUT"
)

if [[ "$VERBOSE" == "true" ]]; then
    PYTHON_CMD+=("--verbose")
fi

# Run Python script
if [[ "$VERBOSE" == "true" ]]; then
    echo "[INFO] Running: python3 $PYTHON_SCRIPT --docs-dir $BASE_DIR/.agents --output $OUTPUT"
fi

result=$(python3 "$PYTHON_SCRIPT" --docs-dir "$BASE_DIR/.agents" --output "$OUTPUT" ${VERBOSE:+--verbose} 2>&1)
exit_code=$?

# Parse result
success=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null)

# Log execution
log_entry=$(python3 << PYTHON_EOF
import json
from datetime import datetime, timezone

log = {
    "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
    "command": "build-index",
    "parameters": {
        "base_dir": "$BASE_DIR",
        "output": "$OUTPUT",
        "verbose": "$VERBOSE"
    },
    "success": $success
}
print(json.dumps(log))
PYTHON_EOF
)

# Append to logs
if [[ -f "$LOGS_FILE" ]]; then
    logs=$(cat "$LOGS_FILE")
else
    logs='{"logs": []}'
fi

logs=$(echo "$logs" | python3 -c "
import sys, json
data = json.load(sys.stdin)
data['logs'].append(json.loads('''$log_entry'''))
print(json.dumps(data, indent=2))
")

echo "$logs" > "$LOGS_FILE" 2>/dev/null

# Output result
echo "$result"

if [[ "$success" == "True" ]]; then
    if [[ "$VERBOSE" == "true" ]]; then
        echo "[OK] Index built successfully" >&2
        docs=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('documents_indexed', 0))" 2>/dev/null)
        vocab=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('vocabulary_size', 0))" 2>/dev/null)
        echo "[STATS] Documents: $docs" >&2
        echo "[STATS] Vocabulary: $vocab" >&2
    fi
    exit 0
else
    error=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('error', 'Unknown error'))" 2>/dev/null)
    echo "Error: Build failed - $error" >&2
    exit 1
fi
