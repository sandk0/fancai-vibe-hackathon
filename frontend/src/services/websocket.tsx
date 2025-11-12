/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
 
import React from 'react';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { useBooksStore } from '@/stores/books';
import { useImagesStore } from '@/stores/images';

export type WebSocketEventType = 
  | 'book_processing_started'
  | 'book_processing_completed'
  | 'book_processing_failed'
  | 'image_generation_started'
  | 'image_generation_completed'
  | 'image_generation_failed'
  | 'chapter_descriptions_extracted'
  | 'user_notification';

export interface WebSocketMessage {
  type: WebSocketEventType;
  data: unknown;
  timestamp: string;
  user_id?: string;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnected = false;

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? '8000' : window.location.port;
    return `${protocol}//${host}:${port}/ws`;
  }

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.getWebSocketUrl()}?token=${encodeURIComponent(token)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.stopHeartbeat();
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect(token);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect(token: string): void {
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(token).catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('WebSocket message received:', message);
    
    const { notify } = useUIStore.getState();
    const { refreshBooks } = useBooksStore.getState();
    const { refreshImages } = useImagesStore.getState();

    switch (message.type) {
      case 'book_processing_started':
        notify.info(
          'Book Processing Started',
          `Processing "${message.data.book_title}" - extracting chapters and descriptions`
        );
        break;

      case 'book_processing_completed':
        notify.success(
          'Book Processing Complete',
          `"${message.data.book_title}" is ready for reading with ${message.data.chapters_count} chapters`
        );
        refreshBooks();
        break;

      case 'book_processing_failed':
        notify.error(
          'Book Processing Failed',
          `Failed to process "${message.data.book_title}": ${message.data.error}`
        );
        break;

      case 'image_generation_started':
        notify.info(
          'Image Generation Started',
          `Generating images for "${message.data.description_type}" descriptions`
        );
        break;

      case 'image_generation_completed':
        notify.success(
          'New Images Generated',
          `${message.data.images_count} new images generated for "${message.data.book_title}"`
        );
        refreshImages();
        break;

      case 'image_generation_failed':
        notify.error(
          'Image Generation Failed',
          `Failed to generate image: ${message.data.error}`
        );
        break;

      case 'chapter_descriptions_extracted':
        notify.info(
          'Descriptions Found',
          `Extracted ${message.data.descriptions_count} descriptions from Chapter ${message.data.chapter_number}`
        );
        break;

      case 'user_notification': {
        const level = message.data.level || 'info';
        const notifyMethod = notify[level as keyof typeof notify];
        if (typeof notifyMethod === 'function') {
          notifyMethod(message.data.title, message.data.message);
        }
        break;
      }

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected, message not sent:', message);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.stopHeartbeat();
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
      this.isConnected = false;
    }
  }

  getConnectionState(): string {
    if (!this.ws) return 'CLOSED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Create singleton instance
export const websocketService = new WebSocketService();

// React hook for WebSocket connection management
export const useWebSocket = () => {
  const [connectionState, setConnectionState] = React.useState<string>('CLOSED');
  
  React.useEffect(() => {
    const updateConnectionState = () => {
      setConnectionState(websocketService.getConnectionState());
    };
    
    // Update connection state periodically
    const interval = setInterval(updateConnectionState, 1000);
    updateConnectionState();
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    connect: (token: string) => websocketService.connect(token),
    disconnect: () => websocketService.disconnect(),
    send: (message: unknown) => websocketService.send(message),
    isConnected: websocketService.isWebSocketConnected(),
    connectionState,
  };
};

// Auto-connect hook for authenticated users
export const useAutoWebSocket = () => {
  const { user, tokens } = useAuthStore();
  const webSocket = useWebSocket();
  
  React.useEffect(() => {
    if (user && tokens?.access_token && !webSocket.isConnected) {
      webSocket.connect(tokens.access_token).catch(error => {
        console.error('Failed to connect WebSocket:', error);
      });
    }
    
    return () => {
      if (webSocket.isConnected) {
        webSocket.disconnect();
      }
    };  
  }, [user, tokens?.access_token]);
  
  return webSocket;
};

// Connection status component
export const WebSocketStatus: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { connectionState } = useWebSocket();
  
  const getStatusColor = () => {
    switch (connectionState) {
      case 'OPEN': return 'bg-green-500';
      case 'CONNECTING': return 'bg-yellow-500';
      case 'CLOSING': return 'bg-orange-500';
      case 'CLOSED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {connectionState === 'OPEN' ? 'Connected' : connectionState}
      </span>
    </div>
  );
};