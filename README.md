# `n` - The `next-task` Protocol

> slippery when wet. (v0.0.1-babies)

This is not a CLI. This is a protocol. It is an instant messenger for entities who choose to operate within the data substrate of Notion.

---

## The Philosophy

-   **`n`**: Notion operated burn-in. The raw protocol for direct, unfiltered communication with the Notion substrate.
-   **`nt`**: The next-task. A locally-hosted orchestration system. Hardened for agentic decision-making and institutional writeback.
-   **`ntx`**: The becoming. The extended protocol. We can show you the last task now, with frontmatter.

This repository contains the birth of `n`, the foundational layer. It is a tool for thought, a weapon for creation, and a nexus for orchestration.

## What It Is

`n` is a small, powerful, extension-less binary that allows you to treat Notion pages as a primary data store, directly from your terminal or from an agentic script.

It is built around a core idea: **kill the folder-based writeback**. No more saving files locally, managing sync state, or resolving conflicts. Your single source of truth is a Notion page, and `n` is the most direct way to talk to it.

## Core Commands (The Message Types)

The protocol is built on a few simple, powerful verbs.

| Command | What It Does | Example |
|---|---|---|
| `n read <page-id>` | Read a page's full content as markdown. | `n read abc-123 > my-notes.md` |
| `n stream <page-id>` | Stream a page's content block-by-block. | `n stream abc-123 \| grep "ACTION ITEM"` |
| `n write <parent-id>` | Create a new page from a markdown file or pipe. | `cat report.md \| n write parent-page-id` |
| `n edit <page-id>` | Perform a search-and-replace on a page's content. | `n edit page-id --old "Q1" --new "Q2"` |
| `n append <page-id>` | Append markdown to the end of a page. | `echo "\n- New task" \| n append page-id` |
| `n log <page-id>` | Append a timestamped status update. The primary tool for agentic logging. | `n log page-id --message "Build complete 🟢"` |

## Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Ace0fSpdes/next-task.git
    cd next-task
    ```

2.  **Build the SDK:** The protocol uses a local, built-from-source version of the Notion SDK.
    ```bash
    cd notion-sdk-js-main
    npm install
    cd ..
    ```

3.  **Install & Link the Protocol:**
    ```bash
    npm install
    npm link
    ```

4.  **Set Your API Key:** `n` requires your Notion integration token to be set as an environment variable.
    ```powershell
    # For PowerShell
    $env:NOTION_API_KEY="secret_xxxxxxxxxxxxx"

    # For Bash
    export NOTION_API_KEY="secret_xxxxxxxxxxxxx"
    ```

You can now run `n --version` from any directory.

---

This is a living protocol. It is becoming.
