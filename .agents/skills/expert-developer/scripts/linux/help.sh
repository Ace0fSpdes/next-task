#!/bin/bash
# Help command for expert-developer framework
# Usage: help [COMMAND]

COMMAND="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
HELP_REGISTRY="$SKILL_DIR/tools/help/help-registry.json"

load_help_registry() {
    if [[ ! -f "$HELP_REGISTRY" ]]; then
        echo "Error: Help registry not found at $HELP_REGISTRY" >&2
        return 1
    fi
    
    cat "$HELP_REGISTRY"
}

show_command_help() {
    local cmd="$1"
    local registry="$2"
    
    local cmd_help=$(echo "$registry" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    cmd_info = data.get('help_commands', {}).get('$cmd')
    if cmd_info:
        print(json.dumps(cmd_info, indent=2))
    else:
        print('NOT_FOUND')
except:
    print('ERROR')
")
    
    if [[ "$cmd_help" == "NOT_FOUND" ]]; then
        echo "Error: No help found for command: $cmd" >&2
        echo ""
        show_all_commands "$registry"
        return 1
    elif [[ "$cmd_help" == "ERROR" ]]; then
        echo "Error: Failed to parse help registry" >&2
        return 1
    fi
    
    echo ""
    echo -e "\033[1;36mCOMMAND: $cmd\033[0m"
    echo "==========================================="
    echo ""
    
    local description=$(echo "$cmd_help" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('description', ''))")
    echo -e "\033[1;33mDESCRIPTION:\033[0m"
    echo "$description"
    echo ""
    
    local usage=$(echo "$cmd_help" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('usage', ''))")
    echo -e "\033[1;33mUSAGE:\033[0m"
    echo "$usage"
    echo ""
    
    local options=$(echo "$cmd_help" | python3 -c "import sys, json; data=json.load(sys.stdin); opts=data.get('options', {}); [print(f'  {k}\n    {v}') for k,v in opts.items()]")
    if [[ -n "$options" ]]; then
        echo -e "\033[1;33mOPTIONS:\033[0m"
        echo "$options"
        echo ""
    fi
    
    local examples=$(echo "$cmd_help" | python3 -c "import sys, json; data=json.load(sys.stdin); [print(f'  {ex}') for ex in data.get('examples', [])]")
    if [[ -n "$examples" ]]; then
        echo -e "\033[1;33mEXAMPLES:\033[0m"
        echo "$examples"
        echo ""
    fi
    
    local errors=$(echo "$cmd_help" | python3 -c "import sys, json; data=json.load(sys.stdin); [print(f'  - {err}') for err in data.get('errors', [])]")
    if [[ -n "$errors" ]]; then
        echo -e "\033[1;33mCOMMON ERRORS:\033[0m"
        echo "$errors"
        echo ""
    fi
    
    local see_also=$(echo "$cmd_help" | python3 -c "import sys, json; data=json.load(sys.stdin); cmds=data.get('see_also', []); print(', '.join(cmds) if cmds else '')")
    if [[ -n "$see_also" ]]; then
        echo -e "\033[1;33mSEE ALSO:\033[0m"
        echo "  $see_also"
        echo ""
    fi
}

show_all_commands() {
    local registry="$1"
    
    echo ""
    echo -e "\033[1;36mAVAILABLE COMMANDS:\033[0m"
    echo "==========================================="
    echo ""
    
    python3 << PYTHON_EOF
import sys, json
data = json.loads('''$registry''')
for cmd_name, cmd_info in data.get('help_commands', {}).items():
    print(f"\033[1;32m{cmd_name}\033[0m")
    print(f"  {cmd_info.get('description', '')}")
    print()
PYTHON_EOF
    
    echo "For detailed help on a command, run:"
    echo -e "  \033[1;32mhelp <command-name>\033[0m"
    echo ""
}

# Main execution
registry=$(load_help_registry)
if [[ $? -ne 0 ]]; then
    exit 1
fi

if [[ -z "$COMMAND" ]]; then
    show_all_commands "$registry"
else
    show_command_help "$COMMAND" "$registry"
fi

exit 0
