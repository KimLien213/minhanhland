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
    const query = this.repo.createQueryBuilder('md')
      .leftJoinAndSelect('md.children', 'children') // Chỉ cần load children, không cần parent
      .where('md.parentId IS NULL') // Chỉ lấy parent records
      .orderBy('md.name', 'ASC')
      .addOrderBy('children.name', 'ASC');

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
    return this.repo.findOne({ where: { id } });
  }

  async updateOrder(id: string, newOrder: number): Promise<boolean> {
    const result = await this.repo.update(id, { order: newOrder });
    return result.affected > 0;
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

  async deleteMasterData(id: number): Promise<boolean> {
    const result = await this.repo.delete(id);
    return result.affected > 0;
  }

  async findById(id: string): Promise<MasterDataEntity> {
    return this.repo.findOneBy({ id });
  }
}