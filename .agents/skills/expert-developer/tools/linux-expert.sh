#!/bin/bash

################################################################################
# Linux Expert - Extensible governance framework for Bash-based development tasks
#
# Provides a modular, extensible framework for executing development tasks on Linux/macOS
#
# Features:
# - Plugin-based architecture for adding new tasks
# - Structured logging to .agents/skills/expert-developer/scripts/tools/logs.json
# - Fail-loud error reporting with full context
# - Configurable through JSON configuration files
# - Automatic task discovery and registration
#
# Usage:
#   ./linux-expert.sh init-agents-dir [baseDir]
#   bash linux-expert.sh init-agents-dir "."
#
# Platform: Linux/macOS with Bash 4.0+
# Framework: Extensible plugin architecture
# Logging: JSON append-only logs
################################################################################

set -euo pipefail

# ============================================================================
# FRAMEWORK CONFIGURATION
# ============================================================================

FRAMEWORK_NAME="linux-expert"
FRAMEWORK_VERSION="1.0.0"
FRAMEWORK_PLATFORM="Linux"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TASKS_DIR="$SKILL_DIR/scripts/tasks"
LOGS_DIR="$SKILL_DIR"
LOGS_FILE="$LOGS_DIR/logs.json"

TASK="${1:-}"
BASE_DIR="${2:-.}"
CONFIG_FILE="${CONFIG_FILE:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timing
START_TIME=$(date +%s%N)

# ============================================================================
# LOGGING SYSTEM
# ============================================================================

initialize_logging() {
    # Initialize logging directory and system
    mkdir -p "$LOGS_DIR"
}

new_log_entry() {
    # Create a new log entry object
    # Usage: new_log_entry "success" "operation" "details_json" "errors_json"
    local status=$1
    local operation=$2
    local details=${3:-'{}'}
    local errors=${4:-'[]'}
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    local id="${timestamp%.*}-$(date +%s%N | tail -c 8)"
    local base_dir=$(cd "$BASE_DIR" 2>/dev/null && pwd || echo "$BASE_DIR")
    local duration=$(( ($(date +%s%N) - START_TIME) / 1000000 ))
    
    cat <<EOF
{
  "id": "$id",
  "timestamp": "$timestamp",
  "framework": "$FRAMEWORK_NAME",
  "version": "$FRAMEWORK_VERSION",
  "platform": "$FRAMEWORK_PLATFORM",
  "task": "$TASK",
  "operation": "$operation",
  "status": "$status",
  "baseDir": "$base_dir",
  "details": $details,
  "errors": $errors,
  "duration": $duration
}
EOF
}

write_log() {
    # Write log entry to logs.json
    # Usage: echo "$entry_json" | write_log
    local entry
    entry=$(cat)
    
    # Read existing logs or start with empty array
    local logs="[]"
    if [ -f "$LOGS_FILE" ]; then
        logs=$(cat "$LOGS_FILE")
    fi
    
    # Append new entry using Python (to avoid jq dependency)
    python3 - "$LOGS_FILE" "$entry" <<'PYTHON_EOF'
import sys
import json

logs_file = sys.argv[1]
new_entry = json.loads(sys.argv[2])

# Read existing logs
try:
    with open(logs_file, 'r') as f:
        logs = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    logs = []

# Append new entry
logs.append(new_entry)

# Write back
with open(logs_file, 'w') as f:
    json.dump(logs, f, indent=2)
PYTHON_EOF
}

# ============================================================================
# TASK REGISTRY & DISCOVERY
# ============================================================================

declare -A TASK_REGISTRY
declare -A TASK_HANDLERS
declare -A TASK_DESCRIPTIONS

register_task() {
    # Register a task in the framework
    # Usage: register_task "task-name" "handler_function" "description"
    local name=$1
    local handler=$2
    local description=${3:-""}
    
    TASK_REGISTRY[$name]="1"
    TASK_HANDLERS[$name]=$handler
    TASK_DESCRIPTIONS[$name]=$description
    
    echo -e "${BLUE}Registered task: $name${NC}" >&2
}

discover_tasks() {
    # Discover and load tasks from tasks directory
    if [ ! -d "$TASKS_DIR" ]; then
        echo -e "${BLUE}Tasks directory not found: $TASKS_DIR${NC}" >&2
        return 0
    fi
    
    while IFS= read -r task_file; do
        echo -e "${BLUE}Loading task: $(basename "$task_file")${NC}" >&2
        # shellcheck source=/dev/null
        source "$task_file"
    done < <(find "$TASKS_DIR" -maxdepth 1 -name "*.sh" -type f 2>/dev/null || true)
}

# ============================================================================
# BUILT-IN TASKS
# ============================================================================

init_agents_dir_handler() {
    # Handler for init-agents-dir task
    local base_dir=$1
    
    local python_script="$SKILL_DIR/scripts/init-agents-dir.py"
    
    if [ ! -f "$python_script" ]; then
        echo "Python script not found: $python_script" >&2
        return 1
    fi
    
    echo -e "${BLUE}Executing: python3 '$python_script' '$base_dir'${NC}" >&2
    
    local output
    output=$(python3 "$python_script" "$base_dir" 2>&1) || {
        local exit_code=$?
        echo "Script exited with code $exit_code: $output" >&2
        return 1
    }
    
    # Validate JSON output
    if ! echo "$output" | python3 -m json.tool > /dev/null 2>&1; then
        echo "Failed to parse script output: $output" >&2
        return 1
    fi
    
    echo "$output"
}

register_task "init-agents-dir" "init_agents_dir_handler" "Initialize .agents/ directory structure"

# ============================================================================
# TASK EXECUTION ENGINE
# ============================================================================

invoke_task() {
    # Execute a registered task with error handling and logging
    local task_name=$1
    local base_dir=${2:-.}
    
    if [ -z "$task_name" ]; then
        echo -e "${RED}✗ No task specified${NC}" >&2
        local available_tasks
        available_tasks=$(printf '%s ' "${!TASK_REGISTRY[@]}")
        echo "Available tasks: $available_tasks" >&2
        return 1
    fi
    
    # Check if task exists
    if [ -z "${TASK_REGISTRY[$task_name]:-}" ]; then
        echo -e "${RED}✗ Task not found: $task_name${NC}" >&2
        local available_tasks
        available_tasks=$(printf '%s ' "${!TASK_REGISTRY[@]}")
        echo "Available tasks: $available_tasks" >&2
        return 1
    fi
    
    echo -e "${BLUE}Executing task: $task_name${NC}" >&2
    
    local handler="${TASK_HANDLERS[$task_name]}"
    
    # Execute task and capture result
    local result
    if ! result=$($handler "$base_dir"); then
        # Log failure
        local errors=$(echo "$result" | python3 -c "import sys, json; print(json.dumps([sys.stdin.read()]))" 2>/dev/null || echo '["Unknown error"]')
        local entry
        entry=$(new_log_entry "failure" "$task_name" "{}" "$errors")
        echo "$entry" | write_log
        
        # Fail loud
        echo -e "${RED}✗ Task failed: $task_name${NC}" >&2
        echo -e "${RED}$result${NC}" >&2
        echo "" >&2
        echo -e "${YELLOW}Log: $LOGS_FILE${NC}" >&2
        
        return 1
    fi
    
    # Log success
    local entry
    entry=$(new_log_entry "success" "$task_name" "$result" "[]")
    echo "$entry" | write_log
    
    # Report success
    echo -e "${GREEN}✓ Task completed successfully: $task_name${NC}" >&2
    echo -e "${GREEN}  Log: $LOGS_FILE${NC}" >&2
    
    return 0
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

main() {
    # Framework entry point
    
    echo -e "${BLUE}$FRAMEWORK_NAME v$FRAMEWORK_VERSION on $FRAMEWORK_PLATFORM${NC}" >&2
    echo -e "${BLUE}Task: $TASK${NC}" >&2
    echo -e "${BLUE}Base Dir: $BASE_DIR${NC}" >&2
    
    # Validate task specified
    if [ -z "$TASK" ]; then
        echo -e "${RED}✗ No task specified${NC}" >&2
        echo "Usage: $0 <task> [baseDir]" >&2
        return 1
    fi
    
    # Initialize
    initialize_logging
    
    # Discover and load external tasks
    discover_tasks
    
    # Execute task
    invoke_task "$TASK" "$BASE_DIR"
}

# Run framework
main "$@"
