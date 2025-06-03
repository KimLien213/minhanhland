// src/master-data/repositories/master-data.repository.ts
import { Repository } from 'typeorm';
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

  // Thêm method để update order cho nhiều items cùng lúc
  async updateMultipleOrders(orderUpdates: { id: string; order: number }[]): Promise<boolean> {
    try {
      await this.repo.manager.transaction(async (manager) => {
        for (const update of orderUpdates) {
          await manager.update(MasterDataEntity, update.id, { order: update.order });
        }
      });
      return true;
    } catch (error) {
      console.error('Error updating multiple orders:', error);
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
    const result = await this.repo.delete(id);
    return result.affected > 0;
  }

  async findById(id: string): Promise<MasterDataEntity> {
    return this.repo.findOne({
      where: { id },
      relations: ['children']
    });
  }
}