// src/master-data/repositories/master-data.repository.ts
import { In, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MasterDataEntity } from '../entities/master-data.entity';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { paginate } from 'src/common/pagination/pagination.helper';
import { MasterDataType } from 'src/common/enums';

@Injectable()
export class MasterDataRepository {
  constructor(
    @InjectRepository(MasterDataEntity)
    private readonly repo: Repository<MasterDataEntity>,
  ) { }

  async findAllNoPaging(type: MasterDataType) {
    return this.repo.find({
      where: {
        type,
      },
      relations: ['children'],
      order: {
        order: 'ASC',
        children: {
          order: 'ASC'
        }
      }
    });
  }

  async findAll(dto: PaginationDto) {
    // Nếu không có search thì lấy tất cả dữ liệu
    if (!dto.search) {
      const allData = await this.repo.find({
        where: { parentId: null }, // Chỉ lấy parent records
        relations: ['children'],
        order: {
          order: 'ASC',
          children: {
            order: 'ASC'
          }
        }
      });

      return {
        data: allData,
        meta: {
          page: 1,
          limit: allData.length,
          total: allData.length
        }
      };
    }

    // Nếu có search thì dùng pagination như cũ
    const query = this.repo.createQueryBuilder('md')
      .leftJoinAndSelect('md.children', 'children')
      .where('md.parentId IS NULL')
      .orderBy('md.order', 'ASC')
      .addOrderBy('children.order', 'ASC');

    return paginate(query, dto, ['md.name', 'children.name']);
  }

  async createMasterData(
    data: Partial<MasterDataEntity>,
  ): Promise<MasterDataEntity> {
    const masterData = this.repo.create(data);
    return this.repo.save(masterData);
  }

  async updateMasterData(
    id: string,
    data: Partial<MasterDataEntity>,
  ): Promise<MasterDataEntity | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ 
      where: { id },
      relations: ['children']
    });
  }

  async updateOrder(id: string, newOrder: number): Promise<boolean> {
    const result = await this.repo.update(id, { order: newOrder });
    return result.affected > 0;
  }

  // ENHANCED: Improved method để update order cho nhiều items cùng lúc
  async updateMultipleOrders(orderUpdates: { id: string; order: number }[]): Promise<boolean> {
    try {
      await this.repo.manager.transaction(async (manager) => {
        // Log để debug
        console.log('Starting transaction for order updates:', orderUpdates);
        
        for (const update of orderUpdates) {
          console.log(`Updating item ${update.id} to order ${update.order}`);
          
          const result = await manager.update(MasterDataEntity, update.id, { 
            order: update.order 
          });
          
          console.log(`Update result for ${update.id}:`, result);
          
          if (result.affected === 0) {
            throw new Error(`No entity found with id ${update.id}`);
          }
        }
        
        console.log('Transaction completed successfully');
      });
      return true;
    } catch (error) {
      console.error('Error updating multiple orders:', error);
      return false;
    }
  }

  // ENHANCED: Specific method for updating parent orders
  async updateParentOrders(orderUpdates: { id: string; order: number }[]): Promise<boolean> {
    try {
      console.log('Updating parent orders:', orderUpdates);
      
      // Validate that all items are actually parent items (no parentId)
      const itemIds = orderUpdates.map(update => update.id);
      const items = await this.repo.find({
        where: { id: In(itemIds) },
        select: ['id', 'parentId']
      });
      
      // Check if all items are parent items
      const nonParentItems = items.filter(item => item.parentId !== null);
      if (nonParentItems.length > 0) {
        console.error('Some items are not parent items:', nonParentItems);
        return false;
      }
      
      return this.updateMultipleOrders(orderUpdates);
    } catch (error) {
      console.error('Error in updateParentOrders:', error);
      return false;
    }
  }

  // ENHANCED: Specific method for updating children orders
  async updateChildrenOrders(parentId: string, orderUpdates: { id: string; order: number }[]): Promise<boolean> {
    try {
      console.log('Updating children orders for parent:', parentId, orderUpdates);
      
      // Validate that all items belong to the specified parent
      const itemIds = orderUpdates.map(update => update.id);
      const items = await this.repo.find({
        where: { id: In(itemIds) },
        select: ['id', 'parentId']
      });
      
      // Check if all items belong to the correct parent
      const invalidItems = items.filter(item => item.parentId !== parentId);
      if (invalidItems.length > 0) {
        console.error('Some items do not belong to the specified parent:', invalidItems);
        return false;
      }
      
      return this.updateMultipleOrders(orderUpdates);
    } catch (error) {
      console.error('Error in updateChildrenOrders:', error);
      return false;
    }
  }

  async getMaxOrder(parentId?: string): Promise<number> {
    const query = this.repo.createQueryBuilder('md');

    if (parentId) {
      query.where('md.parentId = :parentId', { parentId });
    } else {
      query.where('md.parentId IS NULL');
    }

    const result = await query
      .select('MAX(md.order)', 'maxOrder')
      .getRawOne();

    return result?.maxOrder || 0;
  }

  async deleteMasterData(id: string): Promise<boolean> {
    try {
      // Start transaction to handle cascading deletes properly
      await this.repo.manager.transaction(async (manager) => {
        const item = await manager.findOne(MasterDataEntity, {
          where: { id },
          relations: ['children']
        });
        
        if (!item) {
          throw new Error('Item not found');
        }
        
        // If this is a parent item, also delete all children
        if (item.children && item.children.length > 0) {
          console.log(`Deleting ${item.children.length} children of parent ${id}`);
          await manager.delete(MasterDataEntity, { parentId: id });
        }
        
        // Delete the main item
        const result = await manager.delete(MasterDataEntity, id);
        
        if (result.affected === 0) {
          throw new Error('No entity was deleted');
        }
        
        console.log(`Successfully deleted item ${id} and its children`);
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting master data:', error);
      return false;
    }
  }

  async findById(id: string): Promise<MasterDataEntity> {
    return this.repo.findOne({
      where: { id },
      relations: ['children']
    });
  }
}