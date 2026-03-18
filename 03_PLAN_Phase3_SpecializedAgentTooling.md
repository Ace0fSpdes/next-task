# 03_PLAN_Phase3_SpecializedAgentTooling.md

## Execution Plan: Phase 3 - High-Level Agent Tooling

**Objective:** To build specialized, highly-optimized "message types" (commands) for the `n` protocol that directly support the core vision of in-flight deployment logging and other high-frequency agentic workflows. These tools abstract away complexity and minimize operational cost.

---

### **Task 3.1: Implement Optimized Logging Command**

-   **Rationale:** Standard page updates often involve a read-modify-write cycle, which is inefficient for simply appending a line of text. A dedicated logging command can be optimized to a single, cheap `block.children.append` call. This is crucial for agents that provide frequent status updates.
-   **Component:** `src/index.js` (SDK Wrapper)
-   **Action:**
    1.  Create a new public method: `async log(pageId, message, options = {})`.
    2.  This method will *not* read the page first.
    3.  It will construct a single Notion block object. The default block type will be a `to_do` block to represent actionable log entries.
    4.  The block's text will be prepended with a timestamp (e.g., `[2026-03-18T12:00:00Z]`).
    5.  It will support a `--status` option which maps to different block types or emoji prefixes:
        -   `inprogress` (default): `to_do` block with `checked: false` and a "⏳" prefix.
        -   `success`: `to_do` block with `checked: true` and a "✅" prefix.
        -   `fail`: A `callout` block with a red background and a "❌" prefix for high visibility.
        -   `info`: A `paragraph` block with a "ℹ️" prefix.
    6.  It will call `this.client.blocks.children.append` with the constructed block.
-   **Component:** `bin/notion.js` (CLI)
-   **Action:**
    1.  Create a new command: `case 'log': await cmdLog(subArgs); break`.
    2.  The `cmdLog` function will parse the `<page-id>`, the `--message`, and the optional `--status` flag.
    3.  It will call the new `NotionCLI.log()` method with the parsed arguments.
    4.  It will output a simple confirmation (e.g., `{ "log_appended": true, "block_id": "..." }`).
-   **Acceptance Criteria:**
    -   `n log <page> --message "Starting build"` appends a "⏳ [timestamp] Starting build" to-do item to the page.
    -   `n log <page> --message "Build failed" --status fail` appends a high-visibility red callout block to the page.
    -   The command completes significantly faster than a full `n read` followed by `n replace`.

---

### **Task 3.2: Future-Proofing and Documentation**

-   **Component:** Project-wide
-   **Action:**
    1.  **Update Knowledge Base:** All new commands (`stream`, `archive`, `listen`, `log`) and their architectural rationale will be documented in the `.agents/knowledge/` directory. The existing `notion-cli-architecture.md` will be renamed to `n-protocol-architecture.md` and updated.
    2.  **Comprehensive Help Text:** The `showHelp()` function in `bin/notion.js` will be updated to include detailed explanations and examples for all new commands.
    3.  **Create `.env.example`:** If not already present, create a `.env.example` file documenting all required environment variables (`NOTION_API_KEY`, `NOTION_WEBHOOK_SECRET`, etc.).

-   **Acceptance Criteria:**
    -   Running `n --help` provides a clear and complete overview of the entire, expanded command suite.
    -   The `.agents/` directory contains accurate and up-to-date documentation reflecting the final state of the system.
