# 01_PLAN_Phase1_CoreProtocolEnhancements.md

## Execution Plan: Phase 1 - Enhance Core Protocol `n`

**Objective:** To evolve `n` from a basic CRUD tool into a sophisticated client that supports the demands of multi-agent systems, focusing on token efficiency, governance, and granular data access.

---

### **Task 1.1: Implement Block Streaming**

-   **Component:** `src/index.js` (SDK Wrapper)
-   **Action:**
    1.  Create a new public async generator method: `async function* streamBlocks(pageId, options = {})`.
    2.  This method will use `this.client.blocks.children.list` as its core.
    3.  It will handle pagination internally, using a `do-while` loop with `start_cursor` and `next_cursor` to fetch all blocks from the page.
    4.  For each block fetched, it will `yield` the block object. This allows the calling agent to process one block at a time.
-   **Component:** `bin/notion.js` (CLI)
-   **Action:**
    1.  Create a new command: `case 'stream': await cmdStream(subArgs); break`.
    2.  The `cmdStream` function will call the new `NotionCLI.streamBlocks()` method.
    3.  It will iterate through the yielded blocks using a `for await...of` loop.
    4.  For each block, it will perform a simple conversion to a line of markdown (e.g., a paragraph block becomes its text content) and write it to `stdout`.
-   **Acceptance Criteria:**
    -   `n stream <page-id>` outputs the content of a page block-by-block, without loading the entire page into memory first.
    -   The command works correctly on pages that require pagination (more than 100 blocks).

---

### **Task 1.2: Implement Governed Archiving**

-   **Component:** `bin/notion.js` (CLI)
-   **Action:**
    1.  Create a new command: `case 'archive': await cmdArchive(subArgs); break`.
    2.  The `cmdArchive` function will take a `<page-id>` and an optional `--path` argument. The `--path` will default to `./.archives`.
    3.  **Governance Logic:** The function will resolve the absolute path of the target directory. It will then check if the *basename* of this directory is exactly `.archives`. If it is not, the command will fail with a clear error message and a non-zero exit code.
    4.  If the path is valid, it will call `NotionCLI.readMarkdown(pageId)`.
    5.  It will then write the returned markdown to a file named `{pageId}.md` inside the validated directory.
-   **Acceptance Criteria:**
    -   `n archive <page-id>` creates `./.archives/<page-id>.md`.
    -   `n archive <page-id> --path ./some/other/dir` fails with an error.
    -   `n archive <page-id> --path ./some/other/.archives` succeeds.

---

### **Task 1.3: Implement Interactive Pagination for Database Queries**

-   **Component:** `src/index.js` (SDK Wrapper)
-   **Action:**
    1.  The existing `queryDatabase` method uses `collectPaginatedAPI`, which hides pagination details. This needs to change.
    2.  Refactor `queryDatabase` to *not* use `collectPaginatedAPI`.
    3.  It will now directly call `this.client.databases.query`.
    4.  It will accept `options.start_cursor` and pass it to the SDK.
    5.  It will return the entire response object from the SDK, which includes the `results` array, `has_more`, and `next_cursor`.
-   **Component:** `bin/notion.js` (CLI)
-   **Action:**
    1.  Modify `cmdDbQuery`.
    2.  Add support for `--page-size <n>` and `--start-cursor <cursor>` flags.
    3.  The function will now call the refactored `NotionCLI.queryDatabase` with these new options.
    4.  The output will be the full JSON response, allowing the calling agent to see the `next_cursor` and decide whether to make another request.
-   **Acceptance Criteria:**
    -   `n db query <id> --page-size 10` returns exactly 10 results (if available) and a `next_cursor`.
    -   A subsequent call using `n db query <id> --page-size 10 --start-cursor <cursor-from-previous-call>` returns the next page of results.
