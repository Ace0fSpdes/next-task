---
name: expert-developer
description: Universal development governance. Use when implementing features, fixing bugs, or establishing patterns. Enforces `.agents/` structure for self-learning and self-remediation.
---

# expert-developer (Workflow Enforcement)

**Enforce:** `.agents/` governance structure for every project. Every implementation must follow this critical path.

## Preflight (Empty Knowledge Base Only)

If `.agents/knowledge/` is empty, ENFORCE THIS SEEDING WORKFLOW before proceeding:

### Phase 1: Seed Knowledge Base & Build Platform (Parallel Agents)

1. **Knowledge Documents Agent** — Create 5-10 documents explaining HOW SYSTEMS WORK
   - Architecture, data flow, design patterns, storage, LLM integration, etc.
   - YAML frontmatter required on ALL documents
   - Save to: `.agents/knowledge/`

2. **Patterns Documents Agent** — Create 5-10 documents showing HOW TO DEVELOP
   - Naming, code style, type safety, error handling, testing, schemas, tools, etc.
   - YAML frontmatter required on ALL documents
   - Save to: `.agents/patterns/`

3. **Project References Agent** — Create unified reference docs + metadata
   - Consolidate all project documentation into `.agents/references.md`
   - Create `.agents/semantic-metadata.json` for project docs (NO frontmatter added to original files)
   - Metadata: path, title, semantic_tags, keywords, category, summary

4. **Build Platform Agent** — Explore, design, build, and seed rigorous build system
   - Research build platform requirements and agentic-debugging patterns
   - Design architecture for rigorous testing with agent self-debugging
   - Create `.agents/build/` complete directory structure and configuration
   - Build tools: `.agents/tools/build-reporter/` (HTML + JSON report generation)
   - Build tools: `.agents/tools/regression-analyzer/` (baseline comparison and gating)
   - Create `.agents/agents/build-agent.md` for autonomous build failure investigation
   - Seed `.agents/build/config.json` and phase definitions
   - Seed `.agents/baselines/` with initial regression baselines (all packages)
   - Seed `.agents/knowledge/build/` with failure patterns, performance issues, quality guidance
   - Seed `.agents/patterns/build/` with remediation procedures
   - Create GitHub Actions workflows (build.yml, regression.yml, agentic-debug.yml)
   - Create/update Husky hooks (.husky/pre-commit, .husky/commit-msg)
   - Update turbo.json with new build tasks and dependencies

### Phase 2: Build & Seed Build Platform

After agents 4 and 5 complete:

- Build platform infrastructure constructed
- Initial baselines and configurations in place
- Knowledge base seeded with failure patterns and remediation procedures
- GitHub Actions workflows and Husky hooks configured

### Phase 3: Build Index

After all seeding agents (1-5) complete:

```bash
# From repository root
python .agents/skills/expert-developer/scripts/build-index.py --verbose
```

**Verify:** Index reports documents indexed, vocabulary size, categories

### Phase 3: Manual Semantic Ingestion (Optional Bulk Upload)

If `.agents/semantic-metadata.json` exists with project documentation metadata:

```bash
# From repository root
python .agents/skills/expert-developer/scripts/ingest-semantic-metadata.py --metadata-file .agents/semantic-metadata.json
```

**What this does:**

- Reads metadata file (without adding frontmatter to original project docs)
- Adds semantic data to index
- Makes project documentation discoverable without modifying source files

---

## Critical Path (Phase 4: After Preflight Complete)

1. **Verify Structure** — `.agents/` exists with `knowledge/`, `patterns/`, `tools/logs/`
   - Windows: `powershell -ExecutionPolicy Bypass -File .agents/skills/expert-developer/tools/windows-expert.ps1 -Task init-agents-dir -BaseDir "."`
   - Linux: `bash .agents/skills/expert-developer/tools/linux-expert.sh init-agents-dir .`

2. **Search First** — Query `knowledge/` for context, `patterns/` for procedures
   - Windows: `powershell -ExecutionPolicy Bypass -File .agents/skills/expert-developer/scripts/windows/search-knowledge.ps1 -Query "YOUR_QUERY"`
   - Linux: `bash .agents/skills/expert-developer/scripts/linux/search-knowledge.sh --query "YOUR_QUERY"`

3. **Web Search for Best Practice** — Before ANY mutation/implementation
   - Invoke: `exa-web-search-free` skill
   - Search: Latest best practices for your specific task
   - Document: Findings in `knowledge/.changelog/` (UTC timestamp)

4. **Implement** — Follow patterns/, document decisions, log to `knowledge/.changelog/` (UTC timestamp)

5. **Capture Knowledge** — Update `knowledge/` and `patterns/` with discoveries during implementation

6. **Rebuild Index** — After any knowledge updates, rebuild the search index
   - Windows: `powershell -ExecutionPolicy Bypass -File .agents/skills/expert-developer/scripts/windows/build-index.ps1`
   - Linux: `bash .agents/skills/expert-developer/scripts/linux/build-index.sh`

---

## Directory Structure (Enforced)

```
.agents/
├── knowledge/           ← How systems work (discoveries, architecture)
│   └── .changelog/      ← Timestamped learnings from implementations
├── patterns/            ← How to code/operate (procedures, remediation)
├── tools/
│   ├── help/            ← help-registry.json, error-registry.json
│   ├── windows-expert.ps1
│   └── linux-expert.sh
├── logs.json            ← Append-only execution logs (skill-level, not tools-level)
├── plans/               ← Implementation plans (timestamped per deliverable)
├── skills/              ← Subskills (expert-developer is here)
├── index.json           ← Semantic search index (auto-generated)
├── references.md        ← Project-wide documentation (unified)
└── semantic-metadata.json ← Project doc metadata for ingestion
```

---

## YAML Frontmatter (Required for all OWN documents)

Apply to documents you CREATE in `.agents/knowledge/` and `.agents/patterns/`:

```yaml
---
title: Document Title
semantic_tags: [tag1, tag2]
keywords: [keyword1, keyword2]
category: deployment
created_at: 2026-03-16T06:00:00Z
updated_at: 2026-03-16T06:00:00Z
---
```

**DO NOT modify project docs** with YAML frontmatter. Use `semantic-metadata.json` instead.

---

## Anti-Patterns ❌

- Skip preflight seeding → Knowledge base stays empty, agents get no context
- Skip web search for mutations → Miss latest best practices
- Forget `knowledge/.changelog/` updates → Lose learnings
- Ignore `patterns/` when implementing → Duplicate work
- Forget to rebuild index after changes → Searches miss new knowledge
- Add YAML frontmatter to project docs → Corrupts original sources (use metadata.json)

---

## When to Use

- **Before ANY implementation** — Run preflight if knowledge empty, then search for context
- **During implementation** — Search patterns/ for procedures, update knowledge/.changelog/
- **Before mutation/feature** — Web search for best practices, document findings
- **After discovery** — Capture learnings in knowledge/ and patterns/
- **When stuck** — Search patterns/ for remediation procedures
- **Before committing** — Rebuild index so future work finds your discoveries

---

## Developer Notes

> **⚠️ DEVELOPERS MODIFYING THIS SKILL:** Read [CONTRIBUTING.md](CONTRIBUTING.md) first (REQUIRED). Contains framework architecture, implementation details, cross-platform parity rules, and enforcement mechanisms.

> **This file is workflow enforcement for users. CONTRIBUTING.md is development guidance for skill maintainers.**
