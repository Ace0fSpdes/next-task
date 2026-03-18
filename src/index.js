/**
 * Notion CLI - Core SDK Wrapper
 *
 * Wraps @notionhq/client with markdown-first operations that eliminate
 * folder-based writebacks. Content goes directly to/from Notion pages
 * as markdown — no local directory trees, no sync conflicts.
 *
 * API Version: 2026-03-11
 * SDK: @notionhq/client 5.13.0
 *
 * @see https://developers.notion.com/guides/data-apis/working-with-markdown-content
 */

const { Client } = require('@notionhq/client')
const {
  isFullPage,
  isFullDataSource,
  isFullBlock,
  isFullUser,
  isFullComment,
  collectPaginatedAPI,
  iteratePaginatedAPI,
  extractNotionId,
  isNotionClientError,
  APIResponseError
} = require('@notionhq/client')

class NotionCLI {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('NOTION_API_KEY is required. Set it in your environment.')
    }

    this.client = new Client({
      auth: apiKey,
      notionVersion: options.notionVersion || '2026-03-11',
      timeoutMs: options.timeoutMs || 60000,
      retry: options.retry !== false ? {
        maxRetries: options.maxRetries || 2,
        initialRetryDelayMs: options.initialRetryDelayMs || 1000,
        maxRetryDelayMs: options.maxRetryDelayMs || 60000
      } : false
    })
  }

  // ---------------------------------------------------------------------------
  // MARKDOWN OPERATIONS — The folder-killer surface
  // These replace the need for local directories entirely.
  // ---------------------------------------------------------------------------

  /**
   * Read a page's content as markdown.
   * Handles truncated pages by iteratively fetching unknown blocks.
   *
   * @param {string} pageId - Page ID or Notion URL
   * @param {object} options
   * @param {boolean} options.includeTranscript - Include meeting transcripts
   * @param {boolean} options.fetchUnknowns - Recursively fetch truncated blocks (default: true)
   * @returns {Promise<{markdown: string, truncated: boolean, id: string}>}
   *
   * @see https://developers.notion.com/reference/retrieve-page-markdown
   */
  async readMarkdown(pageId, options = {}) {
    const id = this._parseId(pageId)
    const params = { page_id: id }

    if (options.includeTranscript) {
      params.include_transcript = true
    }

    const response = await this.client.pages.retrieveMarkdown(params)

    // Handle truncated pages — fetch unknown blocks and stitch together
    if (response.truncated && options.fetchUnknowns !== false) {
      let allMarkdown = response.markdown
      for (const blockId of response.unknown_block_ids || []) {
        try {
          const blockResp = await this.client.pages.retrieveMarkdown({
            page_id: blockId
          })
          allMarkdown += '\n' + blockResp.markdown
        } catch (e) {
          // object_not_found means permission denied — skip silently
          if (e.code !== 'object_not_found') throw e
        }
      }
      return { markdown: allMarkdown, truncated: false, id: response.id }
    }

    return {
      markdown: response.markdown,
      truncated: response.truncated,
      id: response.id
    }
  }

  /**
   * Create a new page with markdown content.
   * If no title property is provided, the first # h1 is extracted as title.
   *
   * @param {string} parentId - Parent page ID, database ID, or Notion URL
   * @param {string} markdown - Markdown content for the page body
   * @param {object} options
   * @param {string} options.title - Explicit title (overrides h1 extraction)
   * @param {string} options.icon - Emoji or URL for page icon
   * @param {string} options.cover - URL for page cover image
   * @returns {Promise<object>} - Created page object
   *
   * @see https://developers.notion.com/guides/data-apis/working-with-markdown-content#creating-a-page-with-markdown
   */
  async writeMarkdown(parentId, markdown, options = {}) {
    const id = this._parseId(parentId)

    // Detect parent type
    let parentType = 'page_id'
    try {
      await this.client.databases.retrieve({ database_id: id })
      parentType = 'database_id'
    } catch (e) {
      // Not a database — use page_id
    }

    const pageData = {
      parent: { [parentType]: id },
      markdown: markdown
    }

    // Only set title explicitly if provided — otherwise Notion extracts from h1
    if (options.title) {
      pageData.properties = {
        title: {
          title: [{ text: { content: options.title } }]
        }
      }
    }

    if (options.icon) {
      pageData.icon = this._parseIcon(options.icon)
    }

    if (options.cover) {
      pageData.cover = this._parseCover(options.cover)
    }

    return this.client.pages.create(pageData)
  }

  /**
   * Search-and-replace within a page's markdown content.
   * Each operation finds old_str and replaces with new_str.
   *
   * @param {string} pageId - Page ID or Notion URL
   * @param {Array<{old_str: string, new_str: string, replace_all_matches?: boolean}>} edits
   * @returns {Promise<{markdown: string, id: string}>}
   *
   * @see https://developers.notion.com/guides/data-apis/working-with-markdown-content#updating-content-with-search-and-replace
   */
  async editMarkdown(pageId, edits) {
    const id = this._parseId(pageId)

    const response = await this.client.pages.updateMarkdown({
      page_id: id,
      type: 'update_content',
      update_content: {
        content_updates: edits
      }
    })

    return { markdown: response.markdown, id: response.id }
  }

  /**
   * Replace ALL content in a page with new markdown.
   *
   * @param {string} pageId - Page ID or Notion URL
   * @param {string} markdown - New markdown content
   * @param {boolean} allowDeletingContent - Allow deleting child pages/databases
   * @returns {Promise<{markdown: string, id: string}>}
   *
   * @see https://developers.notion.com/guides/data-apis/working-with-markdown-content#replacing-all-page-content
   */
  async replaceMarkdown(pageId, markdown, allowDeletingContent = false) {
    const id = this._parseId(pageId)

    const params = {
      page_id: id,
      type: 'replace_content',
      replace_content: {
        new_str: markdown
      }
    }

    if (allowDeletingContent) {
      params.replace_content.allow_deleting_content = true
    }

    const response = await this.client.pages.updateMarkdown(params)
    return { markdown: response.markdown, id: response.id }
  }

  /**
   * Append markdown content to the end of a page.
   * Uses the legacy insert_content command (no `after` = append).
   *
   * @param {string} pageId - Page ID or Notion URL
   * @param {string} markdown - Markdown to append
   * @returns {Promise<{markdown: string, id: string}>}
   */
  async appendMarkdown(pageId, markdown) {
    const id = this._parseId(pageId)

    const response = await this.client.pages.updateMarkdown({
      page_id: id,
      type: 'insert_content',
      insert_content: {
        content: markdown
      }
    })

    return { markdown: response.markdown, id: response.id }
  }

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  /**
   * Search across workspace pages and databases.
   *
   * @param {string} query - Search query
   * @param {object} options
   * @param {number} options.limit - Max results per page (default 100)
   * @param {object} options.filter - {property: "object", value: "page"|"data_source"}
   * @param {object} options.sort - {timestamp: "last_edited_time", direction: "ascending"|"descending"}
   * @returns {Promise<Array>}
   */
  async search(query = '', options = {}) {
    const params = {
      query,
      page_size: options.limit || 100,
      ...(options.filter && { filter: options.filter }),
      ...(options.sort && { sort: options.sort })
    }

    return collectPaginatedAPI(this.client.search, params)
  }

  // ---------------------------------------------------------------------------
  // PAGE OPERATIONS
  // ---------------------------------------------------------------------------

  async getPage(pageId) {
    const id = this._parseId(pageId)
    return this.client.pages.retrieve({ page_id: id })
  }

  async createPage(parentId, properties, options = {}) {
    const id = this._parseId(parentId)

    let parentType = 'page_id'
    try {
      await this.client.databases.retrieve({ database_id: id })
      parentType = 'database_id'
    } catch (e) {
      // Not a database
    }

    const pageData = {
      parent: { [parentType]: id },
      properties
    }

    if (options.icon) pageData.icon = this._parseIcon(options.icon)
    if (options.cover) pageData.cover = this._parseCover(options.cover)
    if (options.children) pageData.children = options.children
    if (options.markdown) pageData.markdown = options.markdown

    return this.client.pages.create(pageData)
  }

  async updatePage(pageId, updates) {
    const id = this._parseId(pageId)
    const updateData = { page_id: id }

    if (updates.properties) updateData.properties = updates.properties
    if (updates.icon) updateData.icon = this._parseIcon(updates.icon)
    if (updates.archived !== undefined) updateData.archived = updates.archived

    return this.client.pages.update(updateData)
  }

  async deletePage(pageId) {
    return this.updatePage(pageId, { archived: true })
  }

  // ---------------------------------------------------------------------------
  // DATABASE OPERATIONS
  // ---------------------------------------------------------------------------

  async queryDatabase(databaseId, options = {}) {
    const id = this._parseId(databaseId)
    const params = {
      database_id: id,
      page_size: options.limit || 100,
      ...(options.filter && { filter: options.filter }),
      ...(options.sorts && { sorts: options.sorts }),
      ...(options.start_cursor && { start_cursor: options.start_cursor })
    }

    return this.client.databases.query(params)
  }

  async getDatabase(databaseId) {
    const id = this._parseId(databaseId)
    return this.client.databases.retrieve({ database_id: id })
  }

  // ---------------------------------------------------------------------------
  // BLOCK OPERATIONS
  // ---------------------------------------------------------------------------

  async getBlock(blockId) {
    const id = this._parseId(blockId)
    return this.client.blocks.retrieve({ block_id: id })
  }

  async getBlockChildren(blockId, options = {}) {
    const id = this._parseId(blockId)
    return collectPaginatedAPI(
      this.client.blocks.children.list,
      { block_id: id, page_size: options.limit || 100 }
    )
  }

  async appendBlocks(blockId, children) {
    const id = this._parseId(blockId)
    return this.client.blocks.children.append({
      block_id: id,
      children
    })
  }

  /**
   * Fast, specialized logging command that appends a single block with a timestamp.
   *
   * @param {string} pageId - Page ID or Notion URL
   * @param {string} message - Log message content
   * @param {object} options
   * @param {string} options.status - Status for log styling (inprogress, success, fail, info, or custom emoji)
   * @returns {Promise<object>} - Appended block response
   */
  async log(pageId, message, options = {}) {
    const id = this._parseId(pageId)
    const status = options.status || 'inprogress'
    const timestamp = `[${new Date().toISOString()}]`

    let block = { object: 'block' }
    let textContent = `${timestamp} ${message}`

    if (status === 'inprogress') {
      block.type = 'to_do'
      block.to_do = {
        rich_text: [{ type: 'text', text: { content: `⏳ ${textContent}` } }],
        checked: false
      }
    } else if (status === 'success') {
      block.type = 'to_do'
      block.to_do = {
        rich_text: [{ type: 'text', text: { content: `✅ ${textContent}` } }],
        checked: true
      }
    } else if (status === 'fail') {
      block.type = 'callout'
      block.callout = {
        rich_text: [{ type: 'text', text: { content: textContent } }],
        icon: { type: 'emoji', emoji: '❌' },
        color: 'red_background'
      }
    } else if (status === 'info') {
      block.type = 'paragraph'
      block.paragraph = {
        rich_text: [{ type: 'text', text: { content: `ℹ️ ${textContent}` } }]
      }
    } else {
      // Arbitrary emoji status indicator support
      block.type = 'to_do'
      block.to_do = {
        rich_text: [{ type: 'text', text: { content: `${status} ${textContent}` } }],
        checked: false
      }
    }

    return this.client.blocks.children.append({
      block_id: id,
      children: [block]
    })
  }

  /**
   * Stream all blocks from a page, handling pagination automatically.
   * This is a memory-efficient way to process large pages.
   *
   * @param {string} pageId - Page ID or Notion URL
   * @param {object} options
   * @param {number} options.pageSize - Number of blocks to fetch per API call (max 100)
   * @returns {AsyncGenerator<BlockObjectResponse>}
   */
  async *streamBlocks(pageId, options = {}) {
    const id = this._parseId(pageId)
    let has_more = true
    let start_cursor = undefined

    while (has_more) {
      const response = await this.client.blocks.children.list({
        block_id: id,
        page_size: options.pageSize || 100,
        start_cursor: start_cursor,
      })

      for (const block of response.results) {
        yield block
      }

      has_more = response.has_more
      start_cursor = response.next_cursor
    }
  }

  // ---------------------------------------------------------------------------
  // USER OPERATIONS
  // ---------------------------------------------------------------------------
  // USER OPERATIONS
  // ---------------------------------------------------------------------------

  async listUsers(options = {}) {
    return collectPaginatedAPI(
      this.client.users.list,
      { page_size: options.limit || 100 }
    )
  }

  async getUser(userId) {
    return this.client.users.retrieve({ user_id: userId })
  }

  async getMe() {
    return this.client.users.me()
  }

  // ---------------------------------------------------------------------------
  // WEBHOOK OPERATIONS
  // ---------------------------------------------------------------------------

  async _webhookFetch(path, method = 'GET', body = null) {
    const url = `https://api.notion.com/v1/webhooks${path}`
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.client.auth}`,
        'Notion-Version': this.client.notionVersion,
        'Content-Type': 'application/json'
      }
    }
    if (body) {
      options.body = JSON.stringify(body)
    }

    const res = await fetch(url, options)
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(`Webhook API Error: ${res.status} ${res.statusText} - ${JSON.stringify(errorData)}`)
    }
    return res.json()
  }

  async createWebhook(pageId, url) {
    const id = this._parseId(pageId)
    // The specific endpoints are undocumented/internal to the specification.
    // Making a reasonable assumption based on REST principles as specified in the plan.
    // "creating a subscription that fires on page.updated events for the specified page."
    return this._webhookFetch('', 'POST', {
      filter: {
        type: 'page.updated',
        page_id: id
      },
      target: {
        url: url
      }
    })
  }

  async deleteWebhook(webhookId) {
    return this._webhookFetch(`/${webhookId}`, 'DELETE')
  }

  async listWebhooks() {
    return this._webhookFetch('', 'GET')
  }

  // ---------------------------------------------------------------------------
  // COMMENT OPERATIONS
  // ---------------------------------------------------------------------------

  async listComments(blockId, options = {}) {
    const id = this._parseId(blockId)
    return collectPaginatedAPI(
      this.client.comments.list,
      { block_id: id, page_size: options.limit || 100 }
    )
  }

  async createComment(options) {
    const commentData = {
      rich_text: [{
        type: 'text',
        text: { content: options.content }
      }]
    }

    if (options.parentId) {
      commentData.parent = { page_id: this._parseId(options.parentId) }
    }
    if (options.discussionId) {
      commentData.discussion_id = options.discussionId
    }

    return this.client.comments.create(commentData)
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  _parseId(input) {
    if (!input) return null
    const extracted = extractNotionId(input)
    return extracted || input.replace(/-/g, '')
  }

  _parseIcon(icon) {
    if (icon.startsWith('http')) {
      return { type: 'external', external: { url: icon } }
    }
    return { type: 'emoji', emoji: icon }
  }

  _parseCover(url) {
    return { type: 'external', external: { url } }
  }

  // Static utilities — re-export SDK helpers
  static extractId(url) { return extractNotionId(url) }
  static isFullPage(obj) { return isFullPage(obj) }
  static isFullDataSource(obj) { return isFullDataSource(obj) }
  static isFullBlock(obj) { return isFullBlock(obj) }
  static isFullUser(obj) { return isFullUser(obj) }
  static isFullComment(obj) { return isFullComment(obj) }
  static isNotionClientError(error) { return isNotionClientError(error) }
  static isAPIResponseError(error) { return APIResponseError.isAPIResponseError(error) }
}

module.exports = { NotionCLI }
