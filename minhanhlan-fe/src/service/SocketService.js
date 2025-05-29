// src/service/SocketService.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.currentRoom = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectTimer = null;
    this.isManualDisconnect = false;
  }

  connect() {
    if (this.socket?.connected) return;

    this.isManualDisconnect = false;
    this.socket = io(`${import.meta.env.VITE_API_URL}/products`, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false, // We'll handle reconnection manually
      timeout: 20000,
    });

    this.setupSocketEvents();
    this.socket.connect();

    return this.socket;
  }

  setupSocketEvents() {
    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay

      // Clear any pending reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Rejoin room if we were in one
      if (this.currentRoom) {
        const { subdivision, apartmentType } = this.currentRoom;
        this.joinProductRoom(subdivision, apartmentType);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);

      // Only attempt reconnection if it wasn't a manual disconnect
      if (!this.isManualDisconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error);

      if (!this.isManualDisconnect) {
        this.scheduleReconnect();
      }
    });
  }

  scheduleReconnect() {
    // Don't schedule if we're already trying to reconnect
    if (this.reconnectTimer) return;

    // Don't reconnect if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('🔌 Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;

    console.log(`🔌 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (!this.isManualDisconnect && !this.socket?.connected) {
        console.log(`🔌 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.socket?.connect();

        // Exponential backoff with jitter
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2 + Math.random() * 1000,
          this.maxReconnectDelay
        );
      }
    }, this.reconnectDelay);
  }

  disconnect() {
    this.isManualDisconnect = true;

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear current room
    this.currentRoom = null;

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Reset counters
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }

  joinProductRoom(subdivision, apartmentType) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, storing room info for later');
      this.currentRoom = { subdivision, apartmentType };
      return;
    }

    this.socket.emit('join-product-room', {
      subdivision,
      apartmentType,
    });

    this.currentRoom = { subdivision, apartmentType };
    console.log(`🏠 Joined product room: ${subdivision}-${apartmentType}`);
  }

  leaveProductRoom(subdivision, apartmentType) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected');
      return;
    }

    this.socket.emit('leave-product-room', {
      subdivision,
      apartmentType,
    });

    this.currentRoom = null;
    console.log(`🏠 Left product room: ${subdivision}-${apartmentType}`);
  }

  // Listen for product events
  onProductCreated(callback) {
    return this.addEventListener('product-created', callback);
  }

  onProductUpdated(callback) {
    return this.addEventListener('product-updated', callback);
  }

  onProductDeleted(callback) {
    return this.addEventListener('product-deleted', callback);
  }

  // Generic event listener with auto cleanup
  addEventListener(event, callback) {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return () => { };
    }

    this.socket.on(event, callback);

    // Store listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return cleanup function
    return () => {
      this.socket?.off(event, callback);
      this.listeners.get(event)?.delete(callback);
    };
  }

  // Clean up all listeners
  removeAllListeners() {
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket?.off(event, callback);
      });
    });
    this.listeners.clear();
  }

  // Check connection status
  isConnected() {
    return this.socket?.connected || false;
  }

  // Get connection info
  getConnectionInfo() {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      currentRoom: this.currentRoom,
      nextReconnectDelay: this.reconnectDelay,
    };
  }

  // Force reconnect (for manual retry)
  forceReconnect() {
    if (this.socket?.connected) {
      console.log('🔌 Already connected');
      return;
    }

    console.log('🔌 Force reconnecting...');
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.isManualDisconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.connect();
  }
}

export const socketService = new SocketService();