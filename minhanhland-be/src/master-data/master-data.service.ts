// src/master-data/master-data.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateMasterDataDto } from './dto/create-master-data.dto';
import { UpdateMasterDataDto } from './dto/update-master-data.dto';
import { MasterDataResponseDto } from './dto/master-data-response.dto';
import { MasterDataRepository } from './repositories/master-data.repository';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { MasterDataType } from 'src/common/enums';

interface OrderUpdateDto {
  id: string;
  order: number;
}

@Injectable()
export class MasterDataService {
  constructor(private readonly masterDataRepository: MasterDataRepository) {}

  async findAll(dto: PaginationDto) {
    return this.masterDataRepository.findAll(dto);
  }

  async findAllNoPaging(type: MasterDataType) {
    return this.masterDataRepository.findAllNoPaging(type);
  }

  async create(data: CreateMasterDataDto): Promise<MasterDataResponseDto> {
    try {
      // Validate parent exists if parentId is provided
      if (data.parentId) {
        const parent = await this.masterDataRepository.findById(data.parentId);
        if (!parent) {
          throw new BadRequestException('Parent not found');
        }
        if (parent.parentId !== null) {
          throw new BadRequestException('Cannot create child of child item');
        }
      }

      // Get the next order value
      const maxOrder = await this.masterDataRepository.getMaxOrder(data.parentId);
      
      const entity = await this.masterDataRepository.createMasterData({
        ...data,
        type: data.parentId ? MasterDataType.LOAI_CAN_HO : MasterDataType.TOA_NHA,
        order: maxOrder + 1
      });
      
      console.log('Created master data item:', entity);
      return new MasterDataResponseDto(entity);
    } catch (error) {
      console.error('Error creating master data:', error);
      throw error;
    }
  }

  async update(
    id: string,
    data: UpdateMasterDataDto,
  ): Promise<MasterDataResponseDto | null> {
    try {
      // Check if item exists
      const existingItem = await this.masterDataRepository.findById(id);
      if (!existingItem) {
        throw new NotFoundException('Item not found');
      }

      const entity = await this.masterDataRepository.updateMasterData(id, data);
      return entity ? new MasterDataResponseDto(entity) : null;
    } catch (error) {
      console.error('Error updating master data:', error);
      throw error;
    }
  }

  async updateOrder(id: string, newOrder: number): Promise<boolean> {
    try {
      if (newOrder < 1) {
        throw new BadRequestException('Order must be greater than 0');
      }

      const item = await this.masterDataRepository.findById(id);
      if (!item) {
        throw new NotFoundException('Item not found');
      }

      return this.masterDataRepository.updateOrder(id, newOrder);
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  // ENHANCED: Update order cho parent items với validation
  async updateParentOrders(orderUpdates: OrderUpdateDto[]): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      console.log('Service: Updating parent orders:', orderUpdates);

      // Validate input
      if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
        throw new BadRequestException('Invalid order updates data');
      }

      // Validate each update item
      for (const update of orderUpdates) {
        if (!update.id || typeof update.order !== 'number' || update.order < 1) {
          throw new BadRequestException(`Invalid update item: ${JSON.stringify(update)}`);
        }
      }

      // Check for duplicate orders
      const orders = orderUpdates.map(u => u.order);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        throw new BadRequestException('Duplicate orders detected');
      }

      // Validate that orders are sequential starting from 1
      orders.sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          throw new BadRequestException('Orders must be sequential starting from 1');
        }
      }

      const success = await this.masterDataRepository.updateParentOrders(orderUpdates);
      
      if (success) {
        console.log('Service: Parent reorder completed successfully');
        return { 
          success: true, 
          message: 'Parent order updated successfully',
          details: { updatedCount: orderUpdates.length }
        };
      } else {
        return { 
          success: false, 
          message: 'Failed to update parent order in database' 
        };
      }
    } catch (error) {
      console.error('Service: Error in updateParentOrders:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      return { 
        success: false, 
        message: 'Internal server error',
        details: { error: error.message }
      };
    }
  }

  // ENHANCED: Update order cho children items với validation
  async updateChildrenOrders(
    parentId: string, 
    orderUpdates: OrderUpdateDto[]
  ): Promise<{
    success: boolean;
    message?: string;
    details?: any;
  }> {
    try {
      console.log('Service: Updating children orders for parent:', parentId, orderUpdates);

      // Validate parentId
      if (!parentId) {
        throw new BadRequestException('Parent ID is required');
      }

      // Check if parent exists
      const parent = await this.masterDataRepository.findById(parentId);
      if (!parent) {
        throw new NotFoundException('Parent not found');
      }

      // Validate input
      if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
        throw new BadRequestException('Invalid order updates data');
      }

      // Validate each update item
      for (const update of orderUpdates) {
        if (!update.id || typeof update.order !== 'number' || update.order < 1) {
          throw new BadRequestException(`Invalid update item: ${JSON.stringify(update)}`);
        }
      }

      // Check for duplicate orders
      const orders = orderUpdates.map(u => u.order);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        throw new BadRequestException('Duplicate orders detected');
      }

      // Validate that orders are sequential starting from 1
      orders.sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          throw new BadRequestException('Orders must be sequential starting from 1');
        }
      }

      const success = await this.masterDataRepository.updateChildrenOrders(parentId, orderUpdates);
      
      if (success) {
        console.log('Service: Children reorder completed successfully');
        return { 
          success: true, 
          message: 'Children order updated successfully',
          details: { 
            parentId,
            updatedCount: orderUpdates.length 
          }
        };
      } else {
        return { 
          success: false, 
          message: 'Failed to update children order in database' 
        };
      }
    } catch (error) {
      console.error('Service: Error in updateChildrenOrders:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      return { 
        success: false, 
        message: 'Internal server error',
        details: { error: error.message }
      };
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const item = await this.masterDataRepository.findById(id);
      if (!item) {
        throw new NotFoundException('Item not found');
      }

      // If this is a parent and has children, warn or prevent deletion
      if (item.children && item.children.length > 0) {
        console.log(`Deleting parent item with ${item.children.length} children`);
        // Could add a check here to prevent deletion if needed
      }

      return this.masterDataRepository.deleteMasterData(id);
    } catch (error) {
      console.error('Error deleting master data:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<MasterDataResponseDto> {
    const item = await this.masterDataRepository.findById(id);
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return new MasterDataResponseDto(item);
  }
}