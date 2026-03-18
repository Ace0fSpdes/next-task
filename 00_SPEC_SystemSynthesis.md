# 00_SPEC_SystemSynthesis.md

## Specification: System Architecture from Research Synthesis

This document synthesizes the findings from our research agents into a concrete technical specification for the `n` protocol and its surrounding ecosystem.

---

### 1. Core Protocol (`n` CLI)

#### 1.1. Transport Layer:
-   The protocol will use the official `@notionhq/client` SDK, specifically leveraging the `v2026-03-11` API version which provides native, bidirectional markdown endpoints. This is the most efficient and direct transport available.

#### 1.2. Data Format:
-   **Markdown is the primary payload type.** Research confirms it is up to **70% more token-efficient** than raw blocks (JSON) or other formats like XML. This is critical for minimizing LLM operational costs.
-   The system must gracefully handle Notion's "enhanced markdown" (e.g., `<callout>`, tabs for indentation) when reading, and submit standard markdown when writing.

#### 1.3. Core Commands (The "Message Types"):
-   `n read <page>`: Fetches content. Must handle page truncation by recursively fetching `unknown_block_ids`.
-   `n write <parent> --content...`: Creates a new thread/page.
-   `n edit <page> --old --new`: A targeted message to amend a previous thought.
-   `n replace <page> --content...`: A destructive message to completely overwrite a thread.
-   `n append <page> --content...`: The most common message type; adds to an existing conversation.

---

### 2. Real-Time Layer (Webhook Service)

#### 2.1. Asynchronous Notifications:
-   A standalone webhook listener service is required to move from a synchronous "pull" model to an asynchronous "push" model. This is the key to real-time cascading of information.
-   This service will listen for page update events from Notion's webhooks API.

#### 2.2. Conflict Avoidance:
-   Notion's underlying CRDT (Conflict-free Replicated Data Types) architecture handles simultaneous edits at the data layer. Our system will leverage this. We do not need to build our own complex locking or operational transform logic.

---

### 3. Agent-Facing Features

#### 3.1. Token & Cost Efficiency:
-   **Streaming:** A `n stream <page>` command will be implemented. It will use an async iterator to yield blocks one by one, allowing agents to process large pages without loading the entire content into their context window, directly addressing the primary driver of token cost.
-   **Optimized Logging:** A `n log <page>` command will be a highly optimized `append` operation, using a single, cheap API call to add a timestamped block. This is designed for high-frequency status updates.

#### 3.2. Governance and Security:
-   **Governed Archiving:** An `n archive <page> --path <dir>` command will enforce a "safe-by-default" local write policy. It will *only* succeed if the target path is within a pre-approved directory name (e.g., `.archives`), preventing agents from writing sensitive data to insecure locations.

#### 3.3. Data Exploration:
-   **Interactive Pagination:** The `n db query` command will fully support Notion's pagination model (`--page-size`, `--start-cursor`), allowing agents to efficiently walk through large databases without consuming massive amounts of memory or API quota.

---

### 4. Operational Principles (Inferred from Research)

-   **Cache Aggressively:** Research shows prompt caching can reduce costs by up to 90%. While not part of the `n` protocol itself, the surrounding agentic framework must implement caching for pages that are frequently read but rarely change (e.g., system prompts, architectural docs).
-   **Use a Model Ladder:** The system should default to cheaper, faster models for simple tasks (like the `n log` command) and only escalate to more powerful models for complex reasoning.
-   **Design for Failure:** The webhook listener must be resilient. The CLI must return clear, machine-readable error codes.
