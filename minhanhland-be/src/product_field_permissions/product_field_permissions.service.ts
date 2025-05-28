import { In, Repository } from 'typeorm';
import { CreateProductFieldPermissionDto } from './dto/create-product_field_permission.dto';
import { ProductFieldPermission } from './entities/product_field_permission.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { PaginationDto } from 'src/common/pagination/pagination.dto';

@Injectable()
export class ProductFieldPermissionService {
  constructor(
    @InjectRepository(ProductFieldPermission)
    private readonly repo: Repository<ProductFieldPermission>,
  ) {}

  async findAll(query: PaginationDto) {
    const rawPermissions = await this.repo.createQueryBuilder('per')
      .leftJoinAndSelect('per.user', 'user');
      
    if (query.search) {
      rawPermissions.andWhere(
        '(user.fullName LIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    rawPermissions.skip((page - 1) * limit).take(limit);

    const [data, total] = await rawPermissions.getManyAndCount();
    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findByUser(userId: string): Promise<ProductFieldPermission[]> {
    return this.repo.find({ where: { user: { id: userId } } });
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async removeByUser(userId: string): Promise<void> {
    await this.repo.delete({ user: { id: userId } });
  }

  async createBulk(
    dto: CreateProductFieldPermissionDto,
  ): Promise<ProductFieldPermission[]> {
    await this.repo.delete({ user: In(dto.userIds) });

    const entities = dto.userIds.map((userId) =>
      this.repo.create({
        user: { id: userId },
        fieldNames: dto.fieldNames,
        productIds: dto.productIds,
      }),
    );

    return this.repo.save(entities);
  }
}
