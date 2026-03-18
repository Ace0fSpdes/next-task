# 02_PLAN_Phase2_RealTimeWebhooks.md

## Execution Plan: Phase 2 - The Real-Time Layer

**Objective:** To break free from the synchronous request-reply cycle and enable a real-time, event-driven architecture where agents are *notified* of changes instead of polling for them. This is the foundation of the "cascading knowledge" vision.

---

### **Task 2.1: Design and Build the Webhook Listener Service**

-   **Component:** New File: `webhook-listener/index.js`
-   **Technology Stack:** Node.js with a lightweight web framework (e.g., Fastify or Express) for simplicity and performance.
-   **Core Logic:**
    1.  **Endpoint:** The service will expose a single `POST /webhook` endpoint.
    2.  **Validation:** Upon receiving a request, it must first validate the `x-notion-signature-v1` header to ensure the request is genuinely from Notion. This is a critical security measure. The secret will be loaded from environment variables.
    3.  **Request Handling:** Notion requires a `200 OK` response within 3 seconds. Therefore, the service will immediately acknowledge the request and push the full payload into an in-memory queue (e.g., a simple JavaScript array or a more robust library like `p-queue`) for background processing. It must not block the event loop waiting for work to complete.
    4.  **Processing:** A background worker will pull events from the queue. It will parse the event to identify the `page_id` and the type of change.
    5.  **Action (Initial Version):** For the initial implementation, the action will be simple: log the event to the console. This decouples the listener from the "action" part of the system, which can be built out later (e.g., pushing to a message bus like Redis Pub/Sub, or calling other agents).
-   **Configuration:** All configuration (port, Notion secret) will be managed via environment variables (`PORT`, `NOTION_WEBHOOK_SECRET`).
-   **Acceptance Criteria:**
    -   The service starts without errors.
    -   When a configured page in Notion is updated, the service receives a POST request, validates the signature, and logs the event payload to the console.
    -   The service responds to Notion with a `200 OK` in under 3 seconds.

---

### **Task 2.2: Integrate Webhook Management into the `n` Protocol**

-   **Objective:** To allow users and agents to manage webhook subscriptions directly from the command line, without needing to use the Notion API GUI.
-   **Challenge:** The Notion API for managing webhooks is not part of the standard `@notionhq/client` SDK. It requires direct `fetch` calls to the `https://api.notion.com/v1/webhooks` endpoint.
-   **Component:** `src/index.js` (SDK Wrapper)
-   **Action:**
    1.  Create a new set of methods in `NotionCLI` for webhook management (e.g., `createWebhook`, `deleteWebhook`, `listWebhooks`).
    2.  These methods will use the client's internal `request` method or a direct `fetch` call, manually constructing the request to the `/v1/webhooks` endpoint. They will need to handle authentication headers correctly.
-   **Component:** `bin/notion.js` (CLI)
-   **Action:**
    1.  Create a new top-level command: `case 'listen': ...`.
    2.  Create sub-commands:
        -   `n listen create <page-id> --url <webhook-url>`: Calls `NotionCLI.createWebhook`, creating a subscription that fires on `page.updated` events for the specified page.
        -   `n listen delete <webhook-id>`: Calls `NotionCLI.deleteWebhook`.
        -   `n listen list`: Calls `NotionCLI.listWebhooks`.
-   **Acceptance Criteria:**
    -   `n listen create ...` successfully registers a new webhook and outputs its ID.
    -   Updating the target page in Notion causes a POST request to the specified URL.
    -   `n listen list` shows the newly created webhook.
    -   `n listen delete <id>` successfully removes the webhook.
