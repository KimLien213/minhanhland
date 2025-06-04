// src/products/product.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Product } from './entities/product.entity';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://103.75.184.184:3082', 'http://localhost:54240'],
    credentials: true,
  },
  namespace: '/products',
})
export class ProductGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ProductGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-product-room')
  handleJoinRoom(
    @MessageBody() data: { subdivision: string; apartmentType: string },
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `${data.subdivision}-${data.apartmentType}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined room: ${roomName}`);
    
    // Confirm join to client
    client.emit('room-joined', { room: roomName });
  }

  @SubscribeMessage('leave-product-room')
  handleLeaveRoom(
    @MessageBody() data: { subdivision: string; apartmentType: string },
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `${data.subdivision}-${data.apartmentType}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left room: ${roomName}`);
    
    // Confirm leave to client
    client.emit('room-left', { room: roomName });
  }

  // Helper method to get room info
  getRoomInfo(): any {
    const rooms = this.server.sockets.adapter.rooms;
    const roomInfo = {};
    
    rooms.forEach((sockets, roomName) => {
      if (!roomName.startsWith('/')) { // Skip socket ID rooms
        roomInfo[roomName] = sockets.size;
      }
    });
    
    return roomInfo;
  }

  // Emit product created event - FIXED: Only emit to specific room
  notifyProductCreated(product: any, subdivision: string, apartmentType: string) {
    const roomName = `${subdivision}-${apartmentType}`;
    
    const payload = {
      type: 'PRODUCT_CREATED',
      data: product,
      timestamp: new Date().toISOString(),
    };

    // ONLY emit to specific room - removed the broadcast to all clients
    this.server.to(roomName).emit('product-created', payload);
    
    this.logger.log(`Product created notification sent to room: ${roomName} (${this.server.sockets.adapter.rooms.get(roomName)?.size || 0} clients)`);
    this.logger.debug('Room info:', this.getRoomInfo());
  }

  // Emit product updated event - FIXED: Only emit to specific room
  notifyProductUpdated(product: any, subdivision: string, apartmentType: string) {
    const roomName = `${subdivision}-${apartmentType}`;
    
    const payload = {
      type: 'PRODUCT_UPDATED',
      data: product,
      timestamp: new Date().toISOString(),
    };

    // ONLY emit to specific room - removed the broadcast to all clients
    this.server.to(roomName).emit('product-updated', payload);
  }

  // Emit product deleted event - FIXED: Only emit to specific room
  notifyProductDeleted(product: Product, subdivision: string, apartmentType: string) {
    const roomName = `${subdivision}-${apartmentType}`;
    
    const payload = {
      type: 'PRODUCT_DELETED',
      data: { id: product.id, apartmentCode: product.apartmentCode },
      timestamp: new Date().toISOString(),
    };

    // ONLY emit to specific room - removed the broadcast to all clients
    this.server.to(roomName).emit('product-deleted', payload);
  }

  // Debug method to broadcast to all clients (keep for debugging if needed)
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.log(`Broadcasted ${event} to all ${this.server.sockets.sockets.size} connected clients`);
  }
}