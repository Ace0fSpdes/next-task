const http = require('http')
const crypto = require('crypto')

const PORT = process.env.PORT || 3000
const NOTION_WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET

if (!NOTION_WEBHOOK_SECRET) {
  console.error('ERROR: NOTION_WEBHOOK_SECRET environment variable is required.')
  process.exit(1)
}

const queue = []

function processQueue() {
  if (queue.length === 0) return
  const event = queue.shift()
  try {
    const payload = JSON.parse(event.body)
    console.log('--- Webhook Event Received ---')
    console.log(`Page ID: ${payload.data?.id || payload.page_id}`)
    console.log(`Event Type: ${payload.type}`)
    console.log(`Full Payload:`, JSON.stringify(payload, null, 2))
  } catch (err) {
    console.error('Failed to parse webhook event', err)
  }
  // Schedule next item
  setImmediate(processQueue)
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', () => {
      const signature = req.headers['x-notion-signature-v1']
      if (!signature) {
        res.writeHead(401, { 'Content-Type': 'text/plain' })
        res.end('Missing Signature')
        return
      }

      const hmac = crypto.createHmac('sha256', NOTION_WEBHOOK_SECRET)
      hmac.update(body)
      const expectedSignature = hmac.digest('base64')

      try {
          if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            // Validation success
            queue.push({ body, headers: req.headers })
            res.writeHead(200, { 'Content-Type': 'text/plain' })
            res.end('OK')

            // Start processing queue if it's the only item
            if (queue.length === 1) {
              setImmediate(processQueue)
            }
          } else {
            // Validation failed
            res.writeHead(401, { 'Content-Type': 'text/plain' })
            res.end('Invalid Signature')
          }
      } catch (err) {
          // Fallback if timingSafeEqual throws due to length mismatch
          res.writeHead(401, { 'Content-Type': 'text/plain' })
          res.end('Invalid Signature')
      }
    })
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
})

server.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`)
})
