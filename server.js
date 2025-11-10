const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

// Create Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize WebSocket server after HTTP server is created
  server.on('listening', async () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    
    // Import and initialize WebSocket server
    try {
      const { initializeWebSocketServer } = require('./src/lib/websocket-init.js')
      await initializeWebSocketServer(server)
      console.log('✅ WebSocket server initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket server:', error)
      console.log('⚠️  WebSocket functionality will be limited to API routes')
    }
  })

  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})