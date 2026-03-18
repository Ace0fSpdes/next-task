---
title: Notion CLI Architecture
semantic_tags: [notion, cli, binary, sdk-wrapper, markdown-api]
keywords: [notion-cli, bin, npm-link, shebang, markdown, writeback]
category: architecture
created_at: 2026-03-17T22:00:00Z
updated_at: 2026-03-17T22:00:00Z
---

# Notion CLI Architecture

## Purpose

Extension-less CLI binary (`ntn`) that wraps the official `@notionhq/client` SDK (v5.13.0).
Eliminates folder-based writebacks by routing all content through Notion's markdown API endpoints.

## Structure

```
cliTools-workshop/
├── bin/notion.js          ← Shebang entry point (#!/usr/bin/env node)
├── src/index.js           ← NotionCLI class wrapping the SDK
├── package.json           ← bin mapping: "notion" → "./bin/notion.js"
├── notion-sdk-js-main/    ← Local copy of @notionhq/client (built via tsc)
└── .env.example           ← Required env var documentation
```

## How the Extension-less Binary Works

1. `package.json` declares `"bin": { "ntn": "./bin/notion.js" }`
2. `npm link` creates a shim in the global npm prefix (no extension needed)
3. The shim delegates to Node.js via the `#!/usr/bin/env node` shebang
4. Windows: npm creates `.cmd` and PowerShell wrappers automatically

## Key API Endpoints Used

| CLI Command | SDK Method | HTTP Endpoint |
|-------------|-----------|---------------|
| `notion read` | `pages.retrieveMarkdown()` | `GET /v1/pages/:id/markdown` |
| `notion write` | `pages.create({ markdown })` | `POST /v1/pages` |
| `notion edit` | `pages.updateMarkdown({ type: "update_content" })` | `PATCH /v1/pages/:id/markdown` |
| `notion replace` | `pages.updateMarkdown({ type: "replace_content" })` | `PATCH /v1/pages/:id/markdown` |
| `notion append` | `pages.updateMarkdown({ type: "insert_content" })` | `PATCH /v1/pages/:id/markdown` |

## Content Input Methods

All write commands accept content three ways:
1. `--content "inline text"` — direct argument
2. `--file ./path.md` — read from file
3. `echo "text" | notion write id` — piped stdin

## SDK Dependency

Uses `file:./notion-sdk-js-main` — a local file reference.
The SDK must be built (`npm install` in its directory runs `tsc`) before the CLI works.
API version: 2026-03-11 (configurable via `NOTION_VERSION` env var).
