/**
 * WebSocket server initialization for Next.js
 * This module sets up the WebSocket server alongside the Next.js HTTP server
 */

import { websocketManager } from './websocket-server'
import { Server } from 'http'

let isInitialized = false

export function initializeWebSocketServer(server: Server) {
  if (isInitialized) {
    console.log('WebSocket server already initialized')
    return
  }

  try {
    websocketManager.initialize(server)
    isInitialized = true
    console.log('WebSocket server initialized successfully')
  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error)
  }
}

export function isWebSocketServerInitialized() {
  return isInitialized
}