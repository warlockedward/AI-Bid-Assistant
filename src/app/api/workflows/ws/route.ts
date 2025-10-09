import { NextRequest } from 'next/server'
import { websocketManager } from '@/lib/websocket-server'

export async function GET(request: NextRequest) {
  // This endpoint is handled by the WebSocket server
  // The actual WebSocket upgrade is handled in the server configuration
  return new Response('WebSocket endpoint - use WebSocket protocol', {
    status: 426,
    headers: {
      'Upgrade': 'websocket'
    }
  })
}