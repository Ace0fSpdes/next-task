#!/bin/bash
# Semantic search in .agents/ knowledge base
# Usage: search-knowledge --query TEXT [--scope SCOPE] [--limit N] [--page N] [--base-dir PATH]

QUERY=""
SCOPE=""
LIMIT=5
PAGE=1
BASE_DIR="."

while [[ $# -gt 0 ]]; do
    case $1 in
        --query)
            QUERY="$2"
            shift 2
            ;;
        --scope)
            SCOPE="$2"
            shift 2
            ;;
        --limit)
            LIMIT="$2"
            shift 2
            ;;
        --page)
            PAGE="$2"
            shift 2
            ;;
        --base-dir)
            BASE_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Validate query
if [[ -z "$QUERY" ]]; then
    echo "Error: --query parameter is required" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PYTHON_SCRIPT="$SKILL_DIR/search-index.py"
INDEX_PATH="$BASE_DIR/.agents/index.json"
LOGS_FILE="$SKILL_DIR/scripts/tools/logs.json"

# Check index exists
if [[ ! -f "$INDEX_PATH" ]]; then
    echo "Error: Index not found at $INDEX_PATH. Run 'build-index' first." >&2
    exit 1
fi

# Create logs directory
LOGS_DIR=$(dirname "$LOGS_FILE")
mkdir -p "$LOGS_DIR" 2>/dev/null

# Build Python command
python_args=(
    "$PYTHON_SCRIPT"
    "--query" "$QUERY"
    "--index" "$INDEX_PATH"
    "--limit" "$LIMIT"
    "--page" "$PAGE"
)

if [[ -n "$SCOPE" ]]; then
    python_args+=(
        "--scope" "$SCOPE"
    )
fi

# Run Python script
result=$(python3 "${python_args[@]}" 2>&1)
exit_code=$?

# Parse result
success=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null)
total_results=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total_results', 0))" 2>/dev/null)

# Log execution
log_entry=$(python3 << PYTHON_EOF
import json
from datetime import datetime, timezone

log = {
    "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
    "command": "search-knowledge",
    "parameters": {
        "query": "$QUERY",
        "scope": "$SCOPE",
        "limit": $LIMIT,
        "page": $PAGE
    },
    "success": $success,
    "total_results": $total_results
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

# Format and display results
if [[ "$success" == "True" ]] && echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('results') else 1)" 2>/dev/null; then
    echo ""
    echo -e "\033[1;36mSEARCH RESULTS\033[0m"
    echo "============================================"
    echo -e "Query: \033[1;33m$QUERY\033[0m"
    
    if [[ -n "$SCOPE" ]]; then
        echo -e "Scope: \033[1;33m$SCOPE\033[0m"
    fi
    
    pagination=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); p=data.get('pagination', {}); print(f\"{p.get('page', 1)}/{p.get('total_pages', 1)}\")" 2>/dev/null)
    echo -e "Page: \033[1;33m$pagination\033[0m"
    echo -e "Results: \033[1;33m$total_results\033[0m"
    echo ""
    
    # Display each result
    python3 << 'PYTHON_EOF'
import sys, json
data = json.loads("""$result""")
for i, result in enumerate(data.get('results', []), 1):
    print(f"[{i}] \033[1;32m{result['title']}\033[0m")
    print(f"    Path: {result['path']}")
    print(f"    Category: {result['category']}")
    print(f"    Score: {result['relevance_score']}")
    if result.get('semantic_tags'):
        print(f"    Tags: {', '.join(result['semantic_tags'])}")
    print()
PYTHON_EOF
    
    # Pagination info
    has_next=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); p=data.get('pagination', {}); print(p.get('has_next', False))" 2>/dev/null)
    if [[ "$has_next" == "True" ]]; then
        next_page=$((PAGE + 1))
        echo -e "Next page: \033[1;36msearch-knowledge --query \"$QUERY\" --page $next_page\033[0m"
        echo ""
    fi
    
    echo "$result"
    exit 0
elif [[ "$success" == "True" ]]; then
    echo ""
    echo -e "\033[1;33mNo results found for: $QUERY\033[0m"
    echo ""
    echo -e "\033[1;36mSuggestions:\033[0m"
    echo "  - Try different search terms"
    echo "  - Remove --scope filter to search all documents"
    echo "  - Run 'build-index' to refresh the index"
    echo ""
    echo "$result"
    exit 0
else
    message=$(echo "$result" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('message', 'Unknown error'))" 2>/dev/null)
    echo "Error: Search failed - $message" >&2
    echo "$result" >&2
    exit 1
fi
