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
    // Sử dụng query builder để join và sort một lần
    const result = await this.repo
      .createQueryBuilder('parent')
      .leftJoinAndSelect('parent.children', 'children')
      .where('parent.type = :type', { type })
      .andWhere('parent.parentId IS NULL')
      .orderBy('parent.order', 'ASC')
      .addOrderBy('parent.name', 'ASC')
      .addOrderBy('children.order', 'ASC')
      .addOrderBy('children.name', 'ASC')
      .getMany();

    return result;
  }
  async findAll(dto: PaginationDto) {
    // Query chính cho parents với pagination
    const baseQuery = this.repo.createQueryBuilder('md')
      .leftJoinAndSelect('md.parent', 'parent')
      .where('md.parentId IS NULL')
      .orderBy('md.order', 'ASC')
      .addOrderBy('md.name', 'ASC');

    // Lấy kết quả pagination
    const result = await paginate(baseQuery, dto, ['md.name', 'parent.name']);

    // Nếu có data, lấy children riêng
    if (result.data && result.data.length > 0) {
      const parentIds = result.data.map(p => p.id);

      // Query children với order đúng
      const childrenQuery = this.repo.createQueryBuilder('children')
        .where('children.parentId IN (:...parentIds)', { parentIds })
        .orderBy('children.order', 'ASC')
        .addOrderBy('children.name', 'ASC');

      const children = await childrenQuery.getMany();

      // Group children theo parent
      const childrenMap = new Map<string, any[]>();
      children.forEach(child => {
        if (!childrenMap.has(child.parentId)) {
          childrenMap.set(child.parentId, []);
        }
        childrenMap.get(child.parentId)!.push(child);
      });

      // Attach children to parents
      result.data.forEach(parent => {
        parent.children = childrenMap.get(parent.id) || [];
      });
    }

    return result;
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
  async updateOrder(items: Array<{ id: string; order: number }>): Promise<void> {
    // Sử dụng transaction để đảm bảo tính nhất quán
    await this.repo.manager.transaction(async (transactionalEntityManager) => {
      // Cập nhật từng item một cách riêng lẻ
      const updatePromises = items.map(item =>
        transactionalEntityManager.update(
          MasterDataEntity,
          { id: item.id },
          { order: item.order }
        )
      );

      await Promise.all(updatePromises);
    });
  }

  async deleteMasterData(id: number): Promise<boolean> {
    const result = await this.repo.delete(id);
    return result.affected > 0;
  }

  async findById(id: string): Promise<MasterDataEntity> {
    return this.repo.findOneBy({ id });
  }
}
