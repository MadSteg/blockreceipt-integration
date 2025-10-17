import { WebSocketServer } from 'ws';
import { createLogger } from './logger';
import { notificationService } from './services/notificationService';

const logger = createLogger('websocket');

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws' // Use specific path to avoid conflicts with Vite
  });

  wss.on('connection', (ws, req) => {
    logger.info('[websocket] New WebSocket connection established');
    
    let userId: string | null = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'authenticate':
            userId = data.userId;
            if (userId) {
              notificationService.registerWebSocketClient(userId, ws);
              logger.info(`[websocket] User ${userId} authenticated`);
              
              // Send initial notifications
              const notifications = notificationService.getUserNotifications(userId);
              const unreadCount = notificationService.getUnreadCount(userId);
              
              ws.send(JSON.stringify({
                type: 'initial_data',
                data: {
                  notifications,
                  unreadCount
                }
              }));
            }
            break;
            
          case 'mark_read':
            if (userId && data.notificationId) {
              const success = notificationService.markAsRead(userId, data.notificationId);
              ws.send(JSON.stringify({
                type: 'mark_read_response',
                data: { success, notificationId: data.notificationId }
              }));
            }
            break;
            
          case 'mark_all_read':
            if (userId) {
              const count = notificationService.markAllAsRead(userId);
              ws.send(JSON.stringify({
                type: 'mark_all_read_response',
                data: { markedCount: count }
              }));
            }
            break;
            
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
            
          default:
            logger.warn(`[websocket] Unknown message type: ${data.type}`);
        }
      } catch (error) {
        logger.error(`[websocket] Error processing message: ${error}`);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    ws.on('close', () => {
      if (userId) {
        logger.info(`[websocket] User ${userId} disconnected`);
      } else {
        logger.info('[websocket] Anonymous connection closed');
      }
    });

    ws.on('error', (error) => {
      logger.error(`[websocket] WebSocket error: ${error}`);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      data: { message: 'Connected to BlockReceipt notifications' }
    }));
  });

  logger.info('[websocket] WebSocket server initialized');
  
  return wss;
}