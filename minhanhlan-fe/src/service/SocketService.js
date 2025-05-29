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
    this.isConnecting = false;
  }

  connect() {
    if (this.socket?.connected || this.isConnecting) {
      console.log('Socket already connected or connecting');
      return this.socket;
    }

    this.isConnecting = true;
    this.isManualDisconnect = false;

    // Create socket with correct configuration
    this.socket = io(`${import.meta.env.VITE_API_URL}/products`, {
      transports: ['websocket', 'polling'], // Allow both transports
      autoConnect: true,
      reconnection: false, // We'll handle reconnection manually
      timeout: 20000,
      forceNew: true, // Force new connection
    });

    this.setupSocketEvents();

    return this.socket;
  }

  setupSocketEvents() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
      this.isConnecting = false;
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
      this.isConnecting = false;

      // Only attempt reconnection if it wasn't a manual disconnect
      if (!this.isManualDisconnect && reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error);
      this.isConnecting = false;

      if (!this.isManualDisconnect) {
        this.scheduleReconnect();
      }
    });

    // Add debug events
    this.socket.on('product-created', (data) => {
      console.log('🔥 Received product-created event:', data);
    });

    this.socket.on('product-updated', (data) => {
      console.log('🔥 Received product-updated event:', data);
    });

    this.socket.on('product-deleted', (data) => {
      console.log('🔥 Received product-deleted event:', data);
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

      if (!this.isManualDisconnect && !this.socket?.connected && !this.isConnecting) {
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
    this.isConnecting = false;

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

    const roomData = {
      subdivision: String(subdivision),
      apartmentType: String(apartmentType),
    };

    this.socket.emit('join-product-room', roomData);

    this.currentRoom = { subdivision, apartmentType };
    console.log(`🏠 Joined product room: ${subdivision}-${apartmentType}`);
  }

  leaveProductRoom(subdivision, apartmentType) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected');
      return;
    }

    const roomData = {
      subdivision: String(subdivision),
      apartmentType: String(apartmentType),
    };

    this.socket.emit('leave-product-room', roomData);

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

    // Wrap callback to add debugging
    const wrappedCallback = (data) => {
      console.log(`📨 Socket event received: ${event}`, data);
      callback(data);
    };

    this.socket.on(event, wrappedCallback);

    // Store listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(wrappedCallback);

    // Return cleanup function
    return () => {
      this.socket?.off(event, wrappedCallback);
      this.listeners.get(event)?.delete(wrappedCallback);
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
      isConnecting: this.isConnecting,
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

    // If socket exists but disconnected, reconnect
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    } else {
      // Create new connection
      this.connect();
    }
  }
}

export const socketService = new SocketService();