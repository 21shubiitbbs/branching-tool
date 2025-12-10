import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3001';

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect() {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.emit('github:get-status');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    // Register all event listeners
    this.setupEventListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // GitHub events
    this.socket.on('github:connected', (data) => {
      this.notifyListeners('github:connected', data);
    });

    this.socket.on('github:disconnected', () => {
      this.notifyListeners('github:disconnected', {});
    });

    this.socket.on('github:status', (data) => {
      this.notifyListeners('github:status', data);
    });

    this.socket.on('github:branches-updated', (branches) => {
      this.notifyListeners('github:branches-updated', branches);
    });

    this.socket.on('github:push', (data) => {
      this.notifyListeners('github:push', data);
    });

    this.socket.on('github:pull-request', (data) => {
      this.notifyListeners('github:pull-request', data);
    });

    this.socket.on('github:branch-created', (data) => {
      this.notifyListeners('github:branch-created', data);
    });

    this.socket.on('github:branch-deleted', (data) => {
      this.notifyListeners('github:branch-deleted', data);
    });

    this.socket.on('github:pr-created', (data) => {
      this.notifyListeners('github:pr-created', data);
    });

    this.socket.on('github:error', (data) => {
      this.notifyListeners('github:error', data);
    });
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  private notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();
