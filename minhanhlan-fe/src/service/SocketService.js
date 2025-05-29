// src/service/SocketService.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.currentRoom = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectTimer = null;
    this.isManualDisconnect = false;
    this.isConnecting = false;
    this.eventHandlers = new Map(); // Track event handlers to prevent duplicates
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
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: false,
      timeout: 20000,
      forceNew: true,
    });

    this.setupSocketEvents();

    return this.socket;
  }

  setupSocketEvents() {
    if (!this.socket) return;

    // Remove existing listeners first to prevent duplicates
    this.removeAllListeners();

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

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
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

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

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.currentRoom = null;

    if (this.socket) {
      this.removeAllListeners(); // Clean up listeners before disconnect
      this.socket.disconnect();
      this.socket = null;
    }

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
  }

  // IMPROVED: Prevent duplicate event listeners
  onProductCreated(callback) {
    return this.addEventListener('product-created', callback);
  }

  onProductUpdated(callback) {
    return this.addEventListener('product-updated', callback);
  }

  onProductDeleted(callback) {
    return this.addEventListener('product-deleted', callback);
  }

  // IMPROVED: Enhanced event listener with duplicate prevention
  addEventListener(event, callback) {
    if (!this.socket) {
      return () => { };
    }

    // Create a unique key for this event + callback combination
    const callbackKey = `${event}_${Date.now()}_${Math.random()}`;

    // Wrap callback to add debugging and prevent duplicates
    const wrappedCallback = (data) => {
      // Call the original callback
      callback(data);
    };

    // Store the wrapper for cleanup
    this.eventHandlers.set(callbackKey, {
      event,
      callback: wrappedCallback
    });

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
      this.eventHandlers.delete(callbackKey);
    };
  }

  // IMPROVED: Better cleanup of all listeners
  removeAllListeners() {
    // Clean up tracked listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket?.off(event, callback);
      });
    });
    this.listeners.clear();

    // Clean up event handlers
    this.eventHandlers.forEach(({ event, callback }) => {
      this.socket?.off(event, callback);
    });
    this.eventHandlers.clear();

    // Remove all listeners from socket as final cleanup
    if (this.socket) {
      this.socket.removeAllListeners();
    }
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
      activeListeners: this.eventHandlers.size,
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

    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }
}

export const socketService = new SocketService();