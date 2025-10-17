import { createLogger } from '../logger';

const logger = createLogger('notifications');

export interface Notification {
  id: string;
  userId: string;
  type: 'brand_request' | 'reward_earned' | 'receipt_shared' | 'system_update';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface BrandAccessRequest {
  brandName: string;
  receiptId: string;
  incentive: string;
  requestId: string;
}

class NotificationService {
  private notifications = new Map<string, Notification[]>();
  private websocketClients = new Map<string, any>();

  constructor() {
    this.initializeSampleNotifications();
  }

  private initializeSampleNotifications() {
    // Sample notifications for demo
    const sampleNotifications: Notification[] = [
      {
        id: 'notif_1',
        userId: 'customer_123',
        type: 'brand_request',
        title: 'Nike wants access to your receipt',
        message: 'Share your Nike Air Max purchase to get early access to new releases',
        data: {
          brandName: 'Nike',
          receiptId: 'receipt_001',
          incentive: 'Early access to new releases',
          requestId: 'req_001'
        },
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif_2',
        userId: 'customer_123',
        type: 'reward_earned',
        title: 'You earned 150 points!',
        message: 'Your Starbucks purchase qualified for bonus rewards',
        data: {
          points: 150,
          merchantName: 'Starbucks',
          receiptId: 'receipt_002'
        },
        read: false,
        createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }
    ];

    this.notifications.set('customer_123', sampleNotifications);
  }

  /**
   * Create a brand access request notification
   */
  async createBrandAccessRequest(
    userId: string,
    brandName: string,
    receiptId: string,
    incentive: string
  ): Promise<Notification> {
    const notification: Notification = {
      id: `notif_${Date.now()}`,
      userId,
      type: 'brand_request',
      title: `${brandName} wants access to your receipt`,
      message: `Share your ${brandName} purchase to ${incentive}`,
      data: {
        brandName,
        receiptId,
        incentive,
        requestId: `req_${Date.now()}`
      },
      read: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    this.addNotification(userId, notification);
    this.sendRealTimeNotification(userId, notification);

    logger.info(`[notifications] Brand access request created: ${brandName} -> ${userId}`);
    
    return notification;
  }

  /**
   * Create a reward earned notification
   */
  async createRewardNotification(
    userId: string,
    points: number,
    merchantName: string,
    receiptId: string
  ): Promise<Notification> {
    const notification: Notification = {
      id: `notif_${Date.now()}`,
      userId,
      type: 'reward_earned',
      title: `You earned ${points} points!`,
      message: `Your ${merchantName} purchase qualified for bonus rewards`,
      data: {
        points,
        merchantName,
        receiptId
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    this.addNotification(userId, notification);
    this.sendRealTimeNotification(userId, notification);

    logger.info(`[notifications] Reward notification created: ${points} points for ${userId}`);
    
    return notification;
  }

  /**
   * Create a receipt shared confirmation notification
   */
  async createReceiptSharedNotification(
    userId: string,
    brandName: string,
    receiptId: string
  ): Promise<Notification> {
    const notification: Notification = {
      id: `notif_${Date.now()}`,
      userId,
      type: 'receipt_shared',
      title: 'Receipt shared successfully',
      message: `${brandName} now has access to your purchase data`,
      data: {
        brandName,
        receiptId
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    this.addNotification(userId, notification);
    this.sendRealTimeNotification(userId, notification);

    logger.info(`[notifications] Receipt shared notification: ${receiptId} -> ${brandName}`);
    
    return notification;
  }

  /**
   * Get all notifications for a user
   */
  getUserNotifications(userId: string): Notification[] {
    const userNotifications = this.notifications.get(userId) || [];
    
    // Filter out expired notifications
    const now = new Date();
    const validNotifications = userNotifications.filter(notif => 
      !notif.expiresAt || new Date(notif.expiresAt) > now
    );

    // Update the stored notifications to remove expired ones
    this.notifications.set(userId, validNotifications);

    return validNotifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(userId: string): number {
    const notifications = this.getUserNotifications(userId);
    return notifications.filter(notif => !notif.read).length;
  }

  /**
   * Mark notification as read
   */
  markAsRead(userId: string, notificationId: string): boolean {
    const userNotifications = this.notifications.get(userId) || [];
    const notification = userNotifications.find(notif => notif.id === notificationId);
    
    if (notification) {
      notification.read = true;
      logger.info(`[notifications] Marked as read: ${notificationId} for ${userId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(userId: string): number {
    const userNotifications = this.notifications.get(userId) || [];
    let markedCount = 0;
    
    userNotifications.forEach(notif => {
      if (!notif.read) {
        notif.read = true;
        markedCount++;
      }
    });

    if (markedCount > 0) {
      logger.info(`[notifications] Marked ${markedCount} notifications as read for ${userId}`);
    }

    return markedCount;
  }

  /**
   * Delete a notification
   */
  deleteNotification(userId: string, notificationId: string): boolean {
    const userNotifications = this.notifications.get(userId) || [];
    const index = userNotifications.findIndex(notif => notif.id === notificationId);
    
    if (index !== -1) {
      userNotifications.splice(index, 1);
      this.notifications.set(userId, userNotifications);
      logger.info(`[notifications] Deleted notification: ${notificationId} for ${userId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Register a WebSocket client for real-time notifications
   */
  registerWebSocketClient(userId: string, ws: any): void {
    this.websocketClients.set(userId, ws);
    logger.info(`[notifications] WebSocket client registered for ${userId}`);

    ws.on('close', () => {
      this.websocketClients.delete(userId);
      logger.info(`[notifications] WebSocket client disconnected for ${userId}`);
    });
  }

  /**
   * Send real-time notification via WebSocket
   */
  private sendRealTimeNotification(userId: string, notification: Notification): void {
    const ws = this.websocketClients.get(userId);
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
        logger.info(`[notifications] Real-time notification sent to ${userId}`);
      } catch (error) {
        logger.error(`[notifications] Failed to send real-time notification: ${error}`);
        this.websocketClients.delete(userId);
      }
    }
  }

  /**
   * Add notification to user's list
   */
  private addNotification(userId: string, notification: Notification): void {
    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.push(notification);
    
    // Keep only last 50 notifications per user
    if (userNotifications.length > 50) {
      userNotifications.splice(0, userNotifications.length - 50);
    }
    
    this.notifications.set(userId, userNotifications);
  }

  /**
   * Clean up expired notifications (should be run periodically)
   */
  cleanupExpiredNotifications(): number {
    let totalCleaned = 0;
    const now = new Date();

    for (const [userId, userNotifications] of this.notifications.entries()) {
      const validNotifications = userNotifications.filter(notif => 
        !notif.expiresAt || new Date(notif.expiresAt) > now
      );
      
      const cleanedCount = userNotifications.length - validNotifications.length;
      if (cleanedCount > 0) {
        this.notifications.set(userId, validNotifications);
        totalCleaned += cleanedCount;
      }
    }

    if (totalCleaned > 0) {
      logger.info(`[notifications] Cleaned up ${totalCleaned} expired notifications`);
    }

    return totalCleaned;
  }
}

export const notificationService = new NotificationService();