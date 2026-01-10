/**
 * Push Notification Types for fancai PWA
 *
 * Type definitions for Web Push API integration.
 * Supports book processing, image generation, and sync notifications.
 *
 * @module types/push
 */

// =============================================================================
// Push Notification Types
// =============================================================================

/**
 * Types of push notifications supported by the application
 */
export type PushNotificationType =
  | 'book_ready'      // Book parsing/processing completed
  | 'image_ready'     // Image generation completed
  | 'sync_complete'   // Background sync completed
  | 'general';        // Generic notification

/**
 * Push notification payload received from backend
 */
export interface PushPayload {
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Icon URL (defaults to app icon) */
  icon?: string;
  /** Badge icon URL for mobile */
  badge?: string;
  /** Tag for notification grouping/replacement */
  tag?: string;
  /** Custom data for click handling */
  data?: PushNotificationData;
  /** Action buttons for the notification */
  actions?: PushNotificationAction[];
  /** Timestamp when the event occurred */
  timestamp?: number;
  /** Whether to require interaction to dismiss */
  requireInteraction?: boolean;
  /** Vibration pattern (mobile) */
  vibrate?: number[];
}

/**
 * Custom data attached to push notifications
 */
export interface PushNotificationData {
  /** Type of notification for routing */
  type: PushNotificationType;
  /** URL to navigate to on click */
  url?: string;
  /** Related book ID */
  bookId?: string;
  /** Related book title */
  bookTitle?: string;
  /** Related chapter number */
  chapterNumber?: number;
  /** Related image ID */
  imageId?: string;
  /** Related description ID */
  descriptionId?: string;
  /** Timestamp of the event */
  timestamp?: number;
  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/**
 * Action button in notification
 */
export interface PushNotificationAction {
  /** Action identifier */
  action: string;
  /** Button text */
  title: string;
  /** Icon URL for the action */
  icon?: string;
}

// =============================================================================
// Push Subscription Types
// =============================================================================

/**
 * Encryption keys from PushSubscription
 */
export interface PushSubscriptionKeys {
  /** Public key for encryption (P-256 ECDH) */
  p256dh: string;
  /** Authentication secret */
  auth: string;
}

/**
 * Payload sent to backend for subscription registration
 */
export interface PushSubscriptionPayload {
  /** Push service endpoint URL */
  endpoint: string;
  /** Encryption keys */
  keys: PushSubscriptionKeys;
  /** Expiration time (if any) */
  expirationTime?: number | null;
  /** User agent for analytics */
  userAgent?: string;
  /** Device type */
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

/**
 * Unsubscribe request payload
 */
export interface PushUnsubscribePayload {
  /** Push service endpoint URL to unsubscribe */
  endpoint: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * VAPID public key response from backend
 */
export interface VapidPublicKeyResponse {
  /** Base64 URL-safe encoded VAPID public key */
  publicKey: string;
}

/**
 * Subscription registration response from backend
 */
export interface PushSubscribeResponse {
  /** Success message */
  message: string;
  /** Subscription ID on backend */
  subscriptionId?: string;
}

/**
 * Unsubscribe response from backend
 */
export interface PushUnsubscribeResponse {
  /** Success message */
  message: string;
}

/**
 * User's push subscriptions list
 */
export interface PushSubscriptionInfo {
  /** Subscription ID on backend */
  id: string;
  /** Push service endpoint */
  endpoint: string;
  /** Device type */
  deviceType?: string;
  /** User agent */
  userAgent?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last successful push timestamp */
  lastUsedAt?: string;
}

/**
 * List of user's push subscriptions response
 */
export interface PushSubscriptionsResponse {
  /** Array of subscriptions */
  subscriptions: PushSubscriptionInfo[];
  /** Total count */
  total: number;
}

// =============================================================================
// Permission State Types
// =============================================================================

/**
 * Push permission state with loading state
 */
export type PushPermissionState = 'granted' | 'denied' | 'default' | 'loading';

// =============================================================================
// Event Types for Service Worker Communication
// =============================================================================

/**
 * Message sent from Service Worker to client on push
 */
export interface PushReceivedMessage {
  type: 'PUSH_RECEIVED';
  payload: PushPayload;
  timestamp: number;
}

/**
 * Message sent from Service Worker when notification is clicked
 */
export interface NotificationClickMessage {
  type: 'NOTIFICATION_CLICKED';
  action?: string;
  data?: PushNotificationData;
  timestamp: number;
}

/**
 * Union type of all SW messages related to push
 */
export type PushServiceWorkerMessage = PushReceivedMessage | NotificationClickMessage;
