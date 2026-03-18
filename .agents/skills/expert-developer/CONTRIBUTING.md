# Contributing to expert-developer Skill

**REQUIRED READING BEFORE DEVELOPING THIS SKILL**

This document contains all development-specific information for the expert-developer skill. All developers working on this skill MUST read this document first.

---

## Framework Architecture

The expert-developer skill provides extensible framework tools for governance tasks. Both frameworks support plugin-based task discovery and execution.

### Windows Framework: `windows-expert.ps1`

- **Language:** PowerShell 5.1+
- **Features:**
  - Task registry with built-in and plugin tasks
  - Structured logging to JSON
  - Fail-loud error reporting with full context
  - Configurable task discovery from `scripts/tasks/` directory
  - Framework configuration system

### Linux Framework: `linux-expert.sh`

- **Language:** Bash 4.0+
- **Features:**
  - Task registry with built-in and plugin tasks
  - Structured logging to JSON (uses Python 3 for portability)
  - Fail-loud error reporting with full context
  - Configurable task discovery from `scripts/tasks/` directory
  - Framework configuration system

### Framework Parity

Both frameworks MUST provide identical feature sets. Any feature added to one framework MUST be added to the other.

---

## Implementation Details

### Task 1: Initialize .agents/ Directory Structure

**File:** `scripts/init-agents-dir.py`

**Implementation Notes:**

- Python 3, cross-platform
- Idempotent: safe to run multiple times
- Fails loud: full error context on failure
- Logs successes: records all created directories
- No external dependencies

**Invoked via:**

- Windows: `windows-expert.ps1 -Task init-agents-dir`
- Linux: `linux-expert.sh init-agents-dir`

### Task 2: Build Semantic Search Index

**Files:**

- Core: `scripts/build-index.py`
- Windows task: `scripts/windows/build-index.ps1`
- Linux task: `scripts/linux/build-index.sh`

**Implementation Details:**

- Scans `.agents/knowledge/` and `.agents/patterns/` for markdown files
- Extracts YAML frontmatter (title, semantic_tags, keywords, category)
- Calculates TF-IDF weights for all terms
- Implements hybrid scoring: 70% TF-IDF + 30% semantic tags
- Builds semantic tags index and category index
- Outputs comprehensive `.agents/index.json`
- Performance target: <1 second for 100+ documents
- Error handling: Graceful degradation with detailed reporting
- Verbose mode for debugging

**Index Structure** (`.agents/index.json`):

```json
{
  "metadata": {
    "version": "1.0",
    "built_at": "2026-03-16T06:00:00Z",
    "documents_indexed": 42
  },
  "vocabulary": {
    "term": {
      "documents": 3,
      "tf_idf": 0.85
    }
  },
  "semantic_tags": {
    "tag": ["doc1", "doc2", "doc3"]
  },
  "categories": {
    "deployment": ["doc1", "doc3"]
  },
  "documents": {
    "doc_id": {
      "path": "knowledge/deployment/doc.md",
      "title": "...",
      "content": "...",
      "category": "deployment",
      "semantic_tags": ["tag1", "tag2"],
      "word_count": 1250
    }
  }
}
```

### Task 3: Semantic Knowledge Search

**Files:**

- Core: `scripts/search-index.py`
- Windows task: `scripts/windows/search-knowledge.ps1`
- Linux task: `scripts/linux/search-knowledge.sh`

**Implementation Details:**

- Hybrid scoring algorithm:
  - 70% TF-IDF relevance
  - 30% semantic tag matching
- Query validation and normalization
- Scope filtering by category
- Pagination support with pre-calculated total pages
- Sub-second search performance target
- Error handling: Comprehensive with actionable messages

**Scoring Algorithm:**

```
final_score = (tfidf_score * 0.7) + (semantic_score * 0.3)

where:
  tfidf_score = sum of TF-IDF weights for matching terms
  semantic_score = percentage of document's semantic tags matching query
```

### Task 4: Display Help

**Files:**

- Windows: `scripts/windows/help.ps1`
- Linux: `scripts/linux/help.sh`
- Registry: `tools/help/help-registry.json`

**Help Registry Structure:**

```json
{
  "help_commands": {
    "command_name": {
      "description": "Short description",
      "usage": "command-name [--option VALUE]",
      "options": {
        "--option": "Option description"
      },
      "examples": ["command-name", "command-name --option value"],
      "errors": ["Common error 1", "Common error 2"],
      "see_also": ["other-command"]
    }
  }
}
```

**Adding New Commands:**

1. Edit `tools/help/help-registry.json`
2. Add entry under `help_commands`
3. Include: description, usage, options, examples, errors, see_also
4. Test: `help command-name`

---

## Help System Development

The expert-developer framework includes a comprehensive, expandable help system.

**Registry Location:** `tools/help/help-registry.json`

**Adding Commands to Help:**

```json
{
  "my-command": {
    "description": "My custom command description",
    "usage": "my-command [--option VALUE]",
    "options": {
      "--option": "Option description"
    },
    "examples": ["my-command", "my-command --option value"],
    "errors": ["Missing required parameter", "Invalid option value"],
    "see_also": ["other-command"]
  }
}
```

---

## Error Framework Development

The expert-developer framework includes structured error handling with actionable remediation steps.

**Registry Location:** `tools/help/error-registry.json`

**Error Registry Structure:**

```json
{
  "error_categories": {
    "category_name": {
      "description": "...",
      "errors": {
        "ERROR_CODE": {
          "message": "...",
          "severity": "error|warning|info",
          "remediation": [...],
          "cause": "...",
          "example": "..."
        }
      }
    }
  }
}
```

**Error Categories:**

- **initialization** - Errors during `.agents/` directory initialization
- **indexing** - Errors during index building
- **search** - Errors during knowledge search
- **execution** - Errors during task execution
- **logging** - Errors related to logging and tracking

**Adding New Errors:**

1. Edit `tools/help/error-registry.json`
2. Add error under appropriate category
3. Include: message, severity, remediation, cause, example
4. Errors are automatically available to all frameworks

**Example:**

```json
{
  "MY_ERROR_CODE": {
    "message": "Something went wrong",
    "severity": "error",
    "remediation": ["Step 1 to fix", "Step 2 to fix", "Step 3 to fix"],
    "cause": "Why this error occurs",
    "example": "Example scenario that causes this error"
  }
}
```

**Misuse Pattern Tracking:**

The error framework tracks misuse patterns to enable agent learning:

```json
{
  "misuse_patterns": [
    {
      "pattern": "User runs search before build-index",
      "error": "SEARCH_INDEX_NOT_FOUND",
      "frequency": "common",
      "solution": "Guide user to run build-index first"
    }
  ]
}
```

---

## Extending the Frameworks with Custom Tasks

Add custom tasks by creating files in `scripts/windows/` or `scripts/linux/`:

**Windows Task Example (`scripts/windows/my-task.ps1`):**

```powershell
# My custom task
# Usage: my-task [--option VALUE]

param(
    [Parameter(Mandatory=$true)]
    [string]$Option
)

# Implementation here
Write-Host "Task completed"
exit 0
```

**Linux Task Example (`scripts/linux/my-task.sh`):**

```bash
#!/bin/bash
# My custom task
# Usage: my-task [--option VALUE]

OPTION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --option)
            OPTION="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Implementation here
echo "Task completed"
exit 0
```

**Framework Parity Checklist:**

When adding a new task:

- [ ] Create Windows implementation in `scripts/windows/my-task.ps1`
- [ ] Create Linux implementation in `scripts/linux/my-task.sh`
- [ ] Add entry to `tools/help/help-registry.json`
- [ ] Test on Windows (PowerShell)
- [ ] Test on Linux/macOS (Bash)
- [ ] Verify identical behavior on both platforms
- [ ] Add error cases to `tools/help/error-registry.json`
- [ ] Document in SKILL.md usage section

---

## Logging Implementation

All task execution is logged to:

```
.agents/skills/expert-developer/logs.json
```

**Log Entry Structure:**

```json
{
  "id": "1710589200000000000-a1b2c3d4",
  "timestamp": "2026-03-16T06:00:00.000Z",
  "framework": "windows-expert",
  "version": "1.0.0",
  "platform": "Windows",
  "task": "init-agents-dir",
  "operation": "init-agents-dir",
  "status": "success",
  "baseDir": "C:\\Users\\Project",
  "details": {
    "created": ["agents", "agents/knowledge", "agents/patterns"],
    "baseDir": "C:\\Users\\Project"
  },
  "errors": [],
  "duration": 245
}
```

**Required Fields:**

- `id` - Unique identifier (nanotime + random)
- `timestamp` - ISO 8601 UTC timestamp
- `framework` - "windows-expert" or "linux-expert"
- `version` - Framework version
- `platform` - "Windows" or "Linux" or "macOS"
- `task` - Task name
- `operation` - Operation performed
- `status` - "success" or "failure"
- `baseDir` - Working directory
- `details` - Task-specific details
- `errors` - Array of error messages if failed
- `duration` - Execution time in milliseconds

**Automatic Log Pruning:**

Logs older than 24 hours are automatically pruned via `prune-logs.py`.

---

## Knowledge & Patterns Update Rules

### knowledge/.changelog/ Structure

When agent discovers something new about how systems work:

```
knowledge/.changelog/
├── YYYYMMDDHHmm-discovery-name.md
│   timestamp: 2026-03-15T14:30:45Z
│   agent: implementer-1
│   phase: feature-implementation
│   discovery: |
│     What was discovered about how things work
│   impact: Critical/Medium/Low
│   updated_files: knowledge/[domain].md
│
└── [YYYYMMDDHHmm-discovery-name.md]
```

### patterns/ Update Rules

When agent discovers a new pattern or remediation:

```
1. Non-obvious solution discovered
   ↓
2. Agent documents in patterns/[domain].md
   ↓
3. Includes:
   - Problem description
   - Why it wasn't obvious
   - Solution with code example
   - When to apply it
   - Burn-in status (manual / 1-day / 1-week)
   ↓
4. Entry added to knowledge/.changelog/ with UTC timestamp
   ↓
5. Next agent invocation loads updated patterns/
```

---

## Tool Execution & Self-Remediation

### Tool Structure

Each tool in `.agents/tools/` is a wrapper that:

1. Reads from `.agents/tools/scripts/[name].ts`
2. Executes logic
3. Logs to `.agents/tools/logs/` (UTC timestamp)
4. Returns success/failure JSON
5. On error: generates structured error message

### Self-Remediation Loop

```
Agent calls: tools/[tool-name] [options]
    ↓
Tool executes and logs to .agents/tools/logs/
    ↓
On failure:
  1. Agent reads error log
  2. Searches patterns/ for similar errors
  3. Finds remediation procedure
  4. Retries with corrected parameters
  5. Logs retry attempt with fix applied
  6. Updates patterns/ if novel approach
    ↓
On success:
  1. Agent reads tool output
  2. Confirms expected behavior
  3. Updates knowledge/ with any new learnings
  4. Logs success to .agents/tools/logs/
```

---

## Web-Fetch Integration

Agent uses `exa-web-search-free` skill when:

### 1. Unknowns & Documentation Gaps

```
Agent needs info not in knowledge/:
  ↓
Searches knowledge/ (miss)
  ↓
Searches patterns/ (miss)
  ↓
Consults references.md (miss)
  ↓
Invokes exa-web-search-free skill
  ↓
Fetches from:
  - Official documentation
  - GitHub issues/discussions
  - StackOverflow answers
  - Community patterns
  ↓
Adds findings to knowledge/
  ↓
Logs web-fetch to knowledge/.changelog/
```

### 2. Known Patterns (Double-Check)

```
Agent knows pattern exists but wants to verify:
  ↓
Searches patterns/
  ↓
Pattern found but wants latest best practices
  ↓
Invokes exa-web-search-free skill
  ↓
Verifies approach is still current
  ↓
Updates patterns/ if new information found
  ↓
Logs verification to knowledge/.changelog/
```

---

## Anti-Patterns

| Don't                                       | Why                              |
| ------------------------------------------- | -------------------------------- |
| Create directories you don't need           | Bloat, confusion                 |
| Skip knowledge/.changelog/                  | Lose learnings                   |
| Ignore patterns/ when implementing          | Reinvent wheels                  |
| Forget to update knowledge/ after discovery | Lose context for next agent      |
| Log without timestamps                      | Can't track when issues occurred |
| Put project-specific context in SKILL.md    | Skill becomes unmaintainable     |
| Skip web-fetch for unknowns                 | Miss latest best practices       |
| Implement without searching patterns/ first | Duplicate work                   |

---

## Testing & Validation

### Before Committing Changes

- [ ] All Windows scripts tested on PowerShell 5.1+
- [ ] All Linux scripts tested on Bash 4.0+
- [ ] Framework parity verified (both platforms behave identically)
- [ ] Help registry entries validated
- [ ] Error registry entries have complete remediation steps
- [ ] Logging format verified (valid JSON)
- [ ] No external dependencies added (Python 3 + Bun only)
- [ ] YAML frontmatter examples are valid
- [ ] Index building tested with sample documents
- [ ] Search tested with multiple queries
- [ ] Pagination edge cases validated

### Running Tests

```bash
# Windows - Test framework
powershell -ExecutionPolicy Bypass -File .agents/skills/expert-developer/tools/windows-expert.ps1 -Task init-agents-dir -BaseDir "test-dir"

# Linux - Test framework
bash .agents/skills/expert-developer/tools/linux-expert.sh init-agents-dir test-dir

# Test index building
cd .agents/skills/expert-developer && python scripts/build-index.py

# Test search
cd .agents/skills/expert-developer && python scripts/search-index.py --query "test"
```

---

## Development Workflow

### When Adding a Feature

1. **Plan:** Update this CONTRIBUTING.md with implementation details
2. **Implement:** Create Windows AND Linux implementations
3. **Test:** Verify on both platforms
4. **Document:** Update SKILL.md with user-facing documentation
5. **Registry:** Add entries to help-registry.json and error-registry.json
6. **Validate:** Run all tests, check framework parity
7. **Commit:** Include implementation details in commit message

### When Fixing a Bug

1. **Diagnose:** Identify which framework(s) affected
2. **Fix:** Apply fix to Windows AND Linux versions
3. **Test:** Verify fix on both platforms
4. **Validate:** Test doesn't break existing functionality
5. **Document:** Update CONTRIBUTING.md if implementation changed
6. **Commit:** Include root cause analysis in commit message

### When Deprecating

1. **Announce:** Update SKILL.md with deprecation notice
2. **Timeline:** Provide clear sunset date
3. **Alternative:** Document recommended replacement
4. **Archive:** Keep in codebase but mark as archived
5. **Migrate:** Guide users to new approach

---

## Version Management

**Current Version:** 1.0.0

**Versioning Scheme:** MAJOR.MINOR.PATCH

- **MAJOR:** Breaking changes to framework API or task interface
- **MINOR:** New tasks, features, or non-breaking changes
- **PATCH:** Bug fixes, documentation updates, registry changes

**Update Locations:**

- `windows-expert.ps1` - `$version = "1.0.0"`
- `linux-expert.sh` - `VERSION="1.0.0"`
- Logs - `"version": "1.0.0"`

---

## Documentation Requirements

Every feature MUST have:

1. **SKILL.md** - User-facing usage documentation
2. **CONTRIBUTING.md** - Developer/implementation details (this file)
3. **Help Registry** - Command help in `tools/help/help-registry.json`
4. **Error Registry** - Error cases in `tools/help/error-registry.json`
5. **Code Comments** - Implementation notes for complex logic
6. **Tests** - Validation of behavior on Windows and Linux

---

## Enforcement

**MANDATORY:** Any developer working on this skill MUST:

- [ ] Read this CONTRIBUTING.md completely
- [ ] Understand framework architecture and parity requirements
- [ ] Follow Windows + Linux dual implementation rule
- [ ] Keep SKILL.md user-focused (no dev details)
- [ ] Keep CONTRIBUTING.md dev-focused (no user guidance)
- [ ] Update registries (help + error) for new features
- [ ] Test on both platforms before committing
- [ ] Document in both files before merging

**Enforcement Mechanisms:**

1. Pull request template checks for CONTRIBUTING.md awareness
2. Pre-commit hook validates file separations
3. CI/CD tests both Windows and Linux scripts
4. Code review verifies framework parity
5. Failing checks block merge to dev/main

---

## Questions?

Refer back to this CONTRIBUTING.md. If information is missing:

1. Check SKILL.md for user-facing context
2. Check implementation files (build-index.py, search-index.py, etc.)
3. Check registries (help, error) for patterns
4. Update this file with findings for future developers
