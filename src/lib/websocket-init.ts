/**
 * WebSocket server initialization for Next.js
 * This module sets up the WebSocket server alongside the Next.js HTTP server
 */

import { websocketManager } from './websocket-server'
import { Server } from 'http'

let isInitialized = false

export function initializeWebSocketServer(server: Server) {
  if (isInitialized) {
    logger.warn('WebSocket server already initialized', {
      component: 'websocket-init'
    })
    return
  }

  try {
    websocketManager.initialize(server)
    isInitialized = true
    logger.info('WebSocket server initialized successfully', {
      component: 'websocket-init'
    })
  } catch (error) {
    logger.error('Failed to initialize WebSocket server', {
      component: 'websocket-init'
    }, error as Error)
  }
}

export function isWebSocketServerInitialized() {
  return isInitialized
}