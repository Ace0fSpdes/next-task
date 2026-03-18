# `n` - The `next-task` Protocol
> slippery when wet. (v0.0.1-babies)

This is not a CLI. This is a protocol. It is instant messaging for those too, like you, are refusing to go outside.

---

## The Philosophy
-   **`n`**: Nothing. Just a raw protocol for direct, unfiltered communication with the Notion substrate.

This repository currently, is the birthplace and home of `n`, our foundational layer. It is a tool for thought, a weapon for creation, and a nexus for orchestration. Let's try to stay quiet while baby is sleeping.

---

## What It Is

`n` : (noun?) That feels right. Is a small, powerful, extension-less binary that (might be a verb, and) allows you to treat Notion pages as a primary data store, directly from your terminal or from an agentic script.

It is [a noun] built around a core idea: **kill folder-based writeback** from governance. I sometimes remember that I rembember rembering how much it sucks. And that's not an inconvenience, but it ended up in context window so I eant to make it a big deal. We demand justice. We damand choice/ No more saving files locally, no more managing sync state, or resolving conflicts. Or digesting things to RAG so I can remember forgetting what I was supposed to remember to recall.

Your single source of truth will br a Notion page, and `n` is the most direct way to talk to it (because its a verb).

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
