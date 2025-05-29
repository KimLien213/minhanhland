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

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'https://43fe-1-55-100-207.ngrok-free.app', 'http://localhost:54240'],
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
  }

  @SubscribeMessage('leave-product-room')
  handleLeaveRoom(
    @MessageBody() data: { subdivision: string; apartmentType: string },
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `${data.subdivision}-${data.apartmentType}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left room: ${roomName}`);
  }

  // Emit product created event
  notifyProductCreated(product: any, subdivision: string, apartmentType: string) {
    const roomName = `${subdivision}-${apartmentType}`;
    this.server.to(roomName).emit('product-created', {
      type: 'PRODUCT_CREATED',
      data: product,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Product created notification sent to room: ${roomName}`);
  }

  // Emit product updated event
  notifyProductUpdated(product: any, subdivision: string, apartmentType: string) {
    const roomName = `${subdivision}-${apartmentType}`;
    this.server.to(roomName).emit('product-updated', {
      type: 'PRODUCT_UPDATED',
      data: product,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Product updated notification sent to room: ${roomName}`);
  }

  // Emit product deleted event
  notifyProductDeleted(productId: string, subdivision: string, apartmentType: string) {
    const roomName = `${subdivision}-${apartmentType}`;
    this.server.to(roomName).emit('product-deleted', {
      type: 'PRODUCT_DELETED',
      data: { id: productId },
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Product deleted notification sent to room: ${roomName}`);
  }
}