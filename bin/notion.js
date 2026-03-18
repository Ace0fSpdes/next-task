#!/usr/bin/env node

/**
 * notion — A CLI binary for interacting with Notion workspaces.
 *
 * Eliminates folder-based writebacks. Content flows directly between
 * your terminal and Notion pages as markdown. No directories to maintain,
 * no sync state to manage, no conflicts to resolve.
 *
 * Usage: notion <command> [options]
 *
 * Environment:
 *   NOTION_API_KEY    Required. Your Notion internal integration token.
 *   NOTION_VERSION    Optional. API version (default: 2026-03-11).
 *
 * @see https://developers.notion.com/guides/data-apis/working-with-markdown-content
 * @see https://developers.notion.com/reference/intro
 */

const { NotionCLI } = require('../src/index.js')
const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const command = args[0]

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------
function getClient() {
  const apiKey = process.env.NOTION_API_KEY
  if (!apiKey) {
    error('NOTION_API_KEY environment variable is required.')
    error('Set it:  set NOTION_API_KEY=secret_xxxxxxxxxxxxx')
    process.exit(1)
  }
  return new NotionCLI(apiKey, {
    notionVersion: process.env.NOTION_VERSION || '2026-03-11'
  })
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------
function out(data) {
  if (typeof data === 'string') {
    process.stdout.write(data)
    if (!data.endsWith('\n')) process.stdout.write('\n')
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

function error(msg) {
  console.error(`notion: ${msg}`)
}

// ---------------------------------------------------------------------------
// Argument helpers
// ---------------------------------------------------------------------------
function getFlag(name, argList) {
  const idx = argList.indexOf(`--${name}`)
  return idx > -1 ? argList[idx + 1] : null
}

function hasFlag(name, argList) {
  return argList.includes(`--${name}`)
}

function parseJsonFlag(name, argList) {
  const raw = getFlag(name, argList)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    error(`Invalid JSON for --${name}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Stdin reader — for piped content
// ---------------------------------------------------------------------------
async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => data += chunk)
    process.stdin.on('end', () => resolve(data))
  })
}

// ---------------------------------------------------------------------------
// Content resolver — file, stdin, or inline flag
// ---------------------------------------------------------------------------
async function resolveContent(argList) {
  // --file path/to/file.md
  const filePath = getFlag('file', argList)
  if (filePath) {
    const resolved = path.resolve(filePath)
    if (!fs.existsSync(resolved)) {
      error(`File not found: ${resolved}`)
      process.exit(1)
    }
    return fs.readFileSync(resolved, 'utf8')
  }

  // --content "inline markdown"
  const inline = getFlag('content', argList)
  if (inline) return inline

  // Piped stdin
  const stdin = await readStdin()
  if (stdin.trim()) return stdin

  return null
}

// ---------------------------------------------------------------------------
// HELP
// ---------------------------------------------------------------------------
function showHelp() {
  out(`
notion — Interact with Notion workspaces from the command line.

USAGE
  notion <command> [options]

ENVIRONMENT
  NOTION_API_KEY    Required. Your Notion internal integration token.
  NOTION_VERSION    Optional. API version (default: 2026-03-11).

MARKDOWN COMMANDS (no more folder writebacks)
  read <page-id>                  Read a page as markdown
  write <parent-id>               Create a page from markdown
  edit <page-id>                  Search-and-replace within a page
  replace <page-id>               Replace all page content with new markdown
  append <page-id>                Append markdown to end of a page
  stream <page-id>                Stream a page's content block-by-block

RESOURCE COMMANDS
  search <query>                  Search pages and databases
  page get <id>                   Get page metadata
  page create <parent-id>         Create a page (block-based)
  page update <id>                Update page properties
  page delete <id>                Trash a page
  db query <id>                   Query a database
  db get <id>                     Get database schema
  block get <id>                  Get a block
  block children <id>             List block children
  block append <id>               Append blocks to a parent
  user list                       List workspace users
  user get <id>                   Get a user
  me                              Current bot info
  comments <page-id>              List comments
  comment create                  Create a comment

MARKDOWN EXAMPLES
  notion read abc123
  notion read https://notion.so/My-Page-abc123

  notion write parent-id --content "# Hello\\nWorld"
  notion write parent-id --file ./notes.md
  echo "# Piped" | notion write parent-id
  notion write parent-id --file report.md --title "Q4 Report" --icon "📊"

  notion edit page-id --old "Draft proposal" --new "Draft proposal (due Friday)"
  notion replace page-id --file ./updated.md
  cat new-content.md | notion replace page-id

  notion append page-id --content "## New Section\\nMore content here"
  echo "- Added item" | notion append page-id

OPTIONS (vary by command)
  --content <text>      Inline markdown content
  --file <path>         Read content from a file
  --title <text>        Page title (write command)
  --icon <emoji|url>    Page icon
  --cover <url>         Page cover image
  --old <text>          Text to find (edit command)
  --new <text>          Replacement text (edit command)
  --replace-all         Replace all matches (edit command)
  --force               Allow deleting child pages (replace command)
  --transcript          Include meeting transcripts (read command)
  --filter <json>       Filter for search/db queries
  --sorts <json>        Sort for db queries
  --limit <n>           Max results
  --properties <json>   Page properties JSON (page update)
`)
}

// ---------------------------------------------------------------------------
// MARKDOWN COMMANDS
// ---------------------------------------------------------------------------

// notion read <page-id> [--transcript]
async function cmdRead(subArgs) {
  const pageId = subArgs[0]
  if (!pageId) {
    error('Page ID is required.  Usage: notion read <page-id>')
    process.exit(1)
  }

  const notion = getClient()
  const result = await notion.readMarkdown(pageId, {
    includeTranscript: hasFlag('transcript', subArgs)
  })

  out(result.markdown)
}

// notion write <parent-id> [--content|--file|stdin] [--title] [--icon] [--cover]
async function cmdWrite(subArgs) {
  const parentId = subArgs[0]
  if (!parentId) {
    error('Parent ID is required.  Usage: notion write <parent-id> --content "# Title"')
    process.exit(1)
  }

  const content = await resolveContent(subArgs)
  if (!content) {
    error('Content is required. Use --content, --file, or pipe via stdin.')
    process.exit(1)
  }

  const notion = getClient()
  const result = await notion.writeMarkdown(parentId, content, {
    title: getFlag('title', subArgs),
    icon: getFlag('icon', subArgs),
    cover: getFlag('cover', subArgs)
  })

  out({ id: result.id, url: result.url, created: true })
}

// notion edit <page-id> --old "find" --new "replace" [--replace-all]
async function cmdEdit(subArgs) {
  const pageId = subArgs[0]
  if (!pageId) {
    error('Page ID is required.  Usage: notion edit <page-id> --old "text" --new "replacement"')
    process.exit(1)
  }

  const oldStr = getFlag('old', subArgs)
  const newStr = getFlag('new', subArgs)

  if (!oldStr || newStr === null || newStr === undefined) {
    error('Both --old and --new flags are required.')
    process.exit(1)
  }

  const edit = { old_str: oldStr, new_str: newStr }
  if (hasFlag('replace-all', subArgs)) {
    edit.replace_all_matches = true
  }

  const notion = getClient()
  const result = await notion.editMarkdown(pageId, [edit])

  out(result.markdown)
}

// notion replace <page-id> [--content|--file|stdin] [--force]
async function cmdReplace(subArgs) {
  const pageId = subArgs[0]
  if (!pageId) {
    error('Page ID is required.  Usage: notion replace <page-id> --file new.md')
    process.exit(1)
  }

  const content = await resolveContent(subArgs)
  if (!content) {
    error('Content is required. Use --content, --file, or pipe via stdin.')
    process.exit(1)
  }

  const notion = getClient()
  const result = await notion.replaceMarkdown(
    pageId,
    content,
    hasFlag('force', subArgs)
  )

  out(result.markdown)
}

// notion append <page-id> [--content|--file|stdin]
async function cmdAppend(subArgs) {
  const pageId = subArgs[0]
  if (!pageId) {
    error('Page ID is required.  Usage: n append <page-id> --content "new stuff"')
    process.exit(1)
  }

  const content = await resolveContent(subArgs)
  if (!content) {
    error('Content is required. Use --content, --file, or pipe via stdin.')
    process.exit(1)
  }

  const notion = getClient()
  const result = await notion.appendMarkdown(pageId, content)

  out(result.markdown)
}

// n stream <page-id>
async function cmdStream(subArgs) {
	const pageId = subArgs[0]
	if (!pageId) {
		error('Page ID is required.  Usage: n stream <page-id>')
		process.exit(1)
	}

	const notion = getClient()
	try {
		for await (const block of notion.streamBlocks(pageId)) {
			out(blockToSimpleMarkdown(block))
		}
	} catch (e) {
		// This will be handled by the main error handler, but we could add
		// stream-specific error logic here if needed in the future.
		throw e
	}
}

// ---------------------------------------------------------------------------
// RESOURCE COMMANDS
// ---------------------------------------------------------------------------
// RESOURCE COMMANDS
// ---------------------------------------------------------------------------

async function cmdSearch(subArgs) {
  const query = subArgs[0] || ''
  const notion = getClient()
  const results = await notion.search(query, {
    limit: parseInt(getFlag('limit', subArgs)) || 100,
    filter: parseJsonFlag('filter', subArgs),
    sort: parseJsonFlag('sort', subArgs)
  })
  out(results)
}

async function cmdPageGet(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Page ID required.'); process.exit(1) }
  const notion = getClient()
  out(await notion.getPage(id))
}

async function cmdPageCreate(subArgs) {
  const parentId = subArgs[0]
  if (!parentId) { error('Parent ID required.'); process.exit(1) }

  const title = getFlag('title', subArgs) || 'Untitled'
  const content = await resolveContent(subArgs)
  const useMarkdown = hasFlag('markdown', subArgs)

  const notion = getClient()

  if (useMarkdown && content) {
    const result = await notion.writeMarkdown(parentId, content, {
      title, icon: getFlag('icon', subArgs)
    })
    out(result)
  } else {
    const properties = {
      title: { title: [{ text: { content: title } }] }
    }
    const options = {}
    if (getFlag('icon', subArgs)) options.icon = getFlag('icon', subArgs)
    if (content) options.children = parseContentToBlocks(content)
    out(await notion.createPage(parentId, properties, options))
  }
}

async function cmdPageUpdate(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Page ID required.'); process.exit(1) }

  const notion = getClient()
  const updates = {}
  const props = parseJsonFlag('properties', subArgs)
  if (props) updates.properties = props
  const icon = getFlag('icon', subArgs)
  if (icon) updates.icon = icon
  if (hasFlag('archived', subArgs)) {
    updates.archived = getFlag('archived', subArgs) === 'true'
  }

  out(await notion.updatePage(id, updates))
}

async function cmdPageDelete(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Page ID required.'); process.exit(1) }
  const notion = getClient()
  out(await notion.deletePage(id))
}

async function cmdDbQuery(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Database ID required.'); process.exit(1) }
  const notion = getClient()
  out(await notion.queryDatabase(id, {
    limit: parseInt(getFlag('limit', subArgs)) || 100,
    filter: parseJsonFlag('filter', subArgs),
    sorts: parseJsonFlag('sorts', subArgs)
  }))
}

async function cmdDbGet(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Database ID required.'); process.exit(1) }
  const notion = getClient()
  out(await notion.getDatabase(id))
}

async function cmdBlockGet(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Block ID required.'); process.exit(1) }
  const notion = getClient()
  out(await notion.getBlock(id))
}

async function cmdBlockChildren(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Block ID required.'); process.exit(1) }
  const notion = getClient()
  out(await notion.getBlockChildren(id, {
    limit: parseInt(getFlag('limit', subArgs)) || 100
  }))
}

async function cmdBlockAppend(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Block ID required.'); process.exit(1) }

  const content = await resolveContent(subArgs)
  const blocksJson = parseJsonFlag('blocks', subArgs)

  let children
  if (blocksJson) {
    children = blocksJson
  } else if (content) {
    children = parseContentToBlocks(content)
  } else {
    error('Content or --blocks JSON required.')
    process.exit(1)
  }

  const notion = getClient()
  out(await notion.appendBlocks(id, children))
}

async function cmdUserList(subArgs) {
  const notion = getClient()
  out(await notion.listUsers({
    limit: parseInt(getFlag('limit', subArgs)) || 100
  }))
}

async function cmdUserGet(subArgs) {
  const id = subArgs[0]
  if (!id) { error('User ID required.'); process.exit(1) }
  const notion = getClient()
  out(await notion.getUser(id))
}

async function cmdMe() {
  const notion = getClient()
  out(await notion.getMe())
}

async function cmdComments(subArgs) {
  const id = subArgs[0]
  if (!id) { error('Page/Block ID required.'); process.exit(1) }
  const notion = getClient()
  out(await notion.listComments(id, {
    limit: parseInt(getFlag('limit', subArgs)) || 100
  }))
}

async function cmdCommentCreate(subArgs) {
  const parentId = getFlag('parent', subArgs)
  const discussionId = getFlag('discussion', subArgs)
  const content = getFlag('content', subArgs) || await readStdin()

  if (!parentId && !discussionId) {
    error('Either --parent or --discussion is required.')
    process.exit(1)
  }
  if (!content || !content.trim()) {
    error('Comment content is required (--content or stdin).')
    process.exit(1)
  }

  const notion = getClient()
  out(await notion.createComment({ parentId, discussionId, content }))
}

// ---------------------------------------------------------------------------
// Simple markdown-to-blocks parser (for block-based page create / append)
// ---------------------------------------------------------------------------

// A simplified version of block-to-markdown for the stream command
function blockToSimpleMarkdown(block) {
  if (block.type in block && block[block.type].rich_text) {
    const text = block[block.type].rich_text.map(rt => rt.plain_text).join('');
    switch (block.type) {
      case 'paragraph': return text;
      case 'heading_1': return `# ${text}`;
      case 'heading_2': return `## ${text}`;
      case 'heading_3': return `### ${text}`;
      case 'bulleted_list_item': return `- ${text}`;
      case 'numbered_list_item': return `1. ${text}`;
      case 'to_do': return `- [${block.to_do.checked ? 'x' : ' '}] ${text}`;
      case 'quote': return `> ${text}`;
      case 'callout': return `> ${block.callout.icon.emoji} ${text}`;
      default: return text;
    }
  }
  if (block.type === 'divider') return '---';
  return `[Unsupported Block Type: ${block.type}]`;
}
function parseContentToBlocks(content) {
  const blocks = []
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('- [x] ')) {
      blocks.push({ object: 'block', type: 'to_do', to_do: {
        rich_text: [{ type: 'text', text: { content: trimmed.slice(6) } }],
        checked: true
      }})
    } else if (trimmed.startsWith('- [ ] ')) {
      blocks.push({ object: 'block', type: 'to_do', to_do: {
        rich_text: [{ type: 'text', text: { content: trimmed.slice(6) } }],
        checked: false
      }})
    } else if (trimmed.startsWith('### ')) {
      blocks.push({ object: 'block', type: 'heading_3', heading_3: {
        rich_text: [{ type: 'text', text: { content: trimmed.slice(4) } }]
      }})
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ object: 'block', type: 'heading_2', heading_2: {
        rich_text: [{ type: 'text', text: { content: trimmed.slice(3) } }]
      }})
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ object: 'block', type: 'heading_1', heading_1: {
        rich_text: [{ type: 'text', text: { content: trimmed.slice(2) } }]
      }})
    } else if (trimmed.startsWith('- ')) {
      blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: {
        rich_text: [{ type: 'text', text: { content: trimmed.slice(2) } }]
      }})
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: {
        rich_text: [{ type: 'text', text: { content: trimmed.replace(/^\d+\.\s/, '') } }]
      }})
    } else if (trimmed.startsWith('> ')) {
      blocks.push({ object: 'block', type: 'quote', quote: {
        rich_text: [{ type: 'text', text: { content: trimmed.slice(2) } }]
      }})
    } else if (trimmed === '---') {
      blocks.push({ object: 'block', type: 'divider', divider: {} })
    } else {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: {
        rich_text: [{ type: 'text', text: { content: trimmed } }]
      }})
    }
  }

  return blocks
}

// ---------------------------------------------------------------------------
// COMMAND ROUTER
// ---------------------------------------------------------------------------
async function main() {
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    showHelp()
    process.exit(0)
  }

  if (command === '--version' || command === '-v') {
    const pkg = require('../package.json')
    out(`notion-cli v${pkg.version}`)
    process.exit(0)
  }

  const subCommand = args[1]
  const subArgs = args.slice(1)     // everything after command
  const subSubArgs = args.slice(2)  // everything after subcommand

  try {
    switch (command) {
      // Markdown-first commands — the folder killers
      case 'read':    await cmdRead(subArgs); break
      case 'write':   await cmdWrite(subArgs); break
      case 'edit':    await cmdEdit(subArgs); break
      case 'replace': await cmdReplace(subArgs); break
      case 'append':  await cmdAppend(subArgs); break
      case 'stream':  await cmdStream(subArgs); break

      // Search
      case 'search':  await cmdSearch(subArgs); break

      // Pages
      case 'page':
        switch (subCommand) {
          case 'get':    await cmdPageGet(subSubArgs); break
          case 'create': await cmdPageCreate(subSubArgs); break
          case 'update': await cmdPageUpdate(subSubArgs); break
          case 'delete': await cmdPageDelete(subSubArgs); break
          default:
            error(`Unknown page command: ${subCommand}. Use: get, create, update, delete`)
            process.exit(1)
        }
        break

      // Databases
      case 'db':
      case 'database':
        switch (subCommand) {
          case 'query': await cmdDbQuery(subSubArgs); break
          case 'get':   await cmdDbGet(subSubArgs); break
          default:
            error(`Unknown db command: ${subCommand}. Use: query, get`)
            process.exit(1)
        }
        break

      // Blocks
      case 'block':
        switch (subCommand) {
          case 'get':      await cmdBlockGet(subSubArgs); break
          case 'children': await cmdBlockChildren(subSubArgs); break
          case 'append':   await cmdBlockAppend(subSubArgs); break
          default:
            error(`Unknown block command: ${subCommand}. Use: get, children, append`)
            process.exit(1)
        }
        break

      // Users
      case 'user':
      case 'users':
        switch (subCommand) {
          case 'list': await cmdUserList(subSubArgs); break
          case 'get':  await cmdUserGet(subSubArgs); break
          default:
            error(`Unknown user command: ${subCommand}. Use: list, get`)
            process.exit(1)
        }
        break

      // Bot identity
      case 'me': await cmdMe(); break

      // Comments
      case 'comments': await cmdComments(subArgs); break
      case 'comment':
        if (subCommand === 'create') {
          await cmdCommentCreate(subSubArgs)
        } else {
          error(`Unknown comment command: ${subCommand}. Use: create`)
          process.exit(1)
        }
        break

      default:
        error(`Unknown command: ${command}`)
        showHelp()
        process.exit(1)
    }
  } catch (err) {
    if (NotionCLI.isNotionClientError(err)) {
      error(`Notion API error: ${err.message}`)
      if (err.code) error(`Code: ${err.code}`)
      if (err.status) error(`Status: ${err.status}`)
    } else {
      error(`Unexpected error: ${err.message}`)
    }
    process.exit(1)
  }
}

main()
