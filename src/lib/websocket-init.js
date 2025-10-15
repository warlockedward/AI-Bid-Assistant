/**
 * WebSocket server initialization for Next.js
 * This module sets up the WebSocket server alongside the Next.js HTTP server
 */

let isInitialized = false

async function initializeWebSocketServer(server) {
  if (isInitialized) {
    console.log('WebSocket server already initialized')
    return
  }

  try {
    console.log('WebSocket server initialization temporarily disabled')
    console.log('WebSocket functionality will be available through API routes')
    isInitialized = true
  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error)
  }
}

function isWebSocketServerInitialized() {
  return isInitialized
}

module.exports = {
  initializeWebSocketServer,
  isWebSocketServerInitialized
}