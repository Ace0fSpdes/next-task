---
title: Notion CLI Binary Built
semantic_tags: [changelog, implementation, notion-cli]
keywords: [notion, cli, markdown-api, npm-link, binary]
category: changelog
created_at: 2026-03-17T22:00:00Z
updated_at: 2026-03-17T22:00:00Z
---

# 2026-03-17 — Notion CLI Binary Built

## What Changed

- Fixed `package.json` dependency path: `file:../notion-sdk-js-main` → `file:./notion-sdk-js-main`
- Enhanced `src/index.js` with 5 markdown-first methods:
  - `readMarkdown()` — with truncation recovery
  - `writeMarkdown()` — create pages from markdown
  - `editMarkdown()` — search-and-replace
  - `replaceMarkdown()` — full content replacement
  - `appendMarkdown()` — append to end
- Rewrote `bin/notion.js` with:
  - 5 markdown commands as first-class citizens
  - Content resolution from --file, --content, or stdin
  - Structured error handling for Notion API errors
  - --version, --help flags
- Built SDK via `npm install` in `notion-sdk-js-main/`
- Installed project deps and ran `npm link`
- Verified: `ntn --help` and `ntn --version` work from any directory

## Decisions

- Markdown commands are top-level (`ntn read`, not `ntn page read-markdown`)
  because they are the primary use case — folder writebacks are dead
- Content input supports 3 methods: --content flag, --file flag, piped stdin
- Truncated pages are automatically stitched by fetching unknown_block_ids
- API version defaults to 2026-03-11 (latest with markdown endpoints)

## Notion API Reference Used

- https://developers.notion.com/guides/data-apis/working-with-markdown-content
- https://developers.notion.com/reference/retrieve-page-markdown
- https://developers.notion.com/reference/update-page-markdown
- https://developers.notion.com/reference/post-page (markdown param)
