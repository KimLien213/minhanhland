// products.service.ts - Thêm method updateProductOrder
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductOrderDto } from './dto/update-product-order.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import * as fs from 'fs';
import * as path from 'path';
import { MasterDataEntity } from 'src/master-data/entities/master-data.entity';
import { ProductFieldPermission } from 'src/product_field_permissions/entities/product_field_permission.entity';
import { UserSortPreferencesService } from 'src/user-sort-preference/user-sort-preference.service';
import { ProductGateway } from './product.gateway';
import { log } from 'console';
import { UpdateProductDivisionDto } from './dto/update-product-division.dto';
import { BulkDeleteProductDto } from './dto/bulk-delete.product';


interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  type: 'added' | 'updated' | 'removed';
}

interface DiffResult {
  hasChanges: boolean;
  changes: FieldChange[];
  summary: string;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly imageRepo: Repository<ProductImage>,
    @InjectRepository(MasterDataEntity)
    private readonly masterDataRepo: Repository<MasterDataEntity>,
    @InjectRepository(ProductFieldPermission)
    private readonly permissionsRepo: Repository<ProductFieldPermission>,
    private readonly userSortPreferencesService: UserSortPreferencesService,
    private readonly productGateway: ProductGateway,
  ) { }

  // Helper method để tạo diff giữa old và new entity
  private createEntityDiff(oldEntity: any, newEntity: any): DiffResult {
    const changes: FieldChange[] = [];
    const excludeFields = ['id', 'createdAt', 'updatedAt', 'imageList']; // Những field không cần check

    // Lấy tất cả các keys từ cả old và new entity
    const allKeys = new Set([
      ...Object.keys(oldEntity || {}),
      ...Object.keys(newEntity || {})
    ]);

    for (const key of allKeys) {
      if (excludeFields.includes(key)) continue;

      const oldValue = oldEntity[key];
      const newValue = newEntity[key];

      // Xử lý các trường hợp khác nhau
      if (oldValue === undefined && newValue !== undefined) {
        changes.push({
          field: key,
          oldValue: null,
          newValue,
          type: 'added'
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        changes.push({
          field: key,
          oldValue,
          newValue: null,
          type: 'removed'
        });
      } else if (this.isDifferent(oldValue, newValue)) {
        changes.push({
          field: key,
          oldValue,
          newValue,
          type: 'updated'
        });
      }
    }

    const hasChanges = changes.length > 0;
    const summary = hasChanges
      ? `${changes.length} field(s) changed: ${changes.map(c => c.field).join(', ')}`
      : 'No changes detected';

    return {
      hasChanges,
      changes,
      summary
    };
  }

  // Helper method để so sánh 2 giá trị (handle objects, arrays, primitives)
  private isDifferent(oldValue: any, newValue: any): boolean {
    // Nếu cả 2 đều null/undefined
    if (oldValue == null && newValue == null) return false;

    // Nếu 1 trong 2 là null/undefined
    if (oldValue == null || newValue == null) return true;

    // Nếu là object/array, so sánh JSON
    if (typeof oldValue === 'object' || typeof newValue === 'object') {
      try {
        return JSON.stringify(oldValue) !== JSON.stringify(newValue);
      } catch {
        return oldValue !== newValue;
      }
    }

    // So sánh primitive values
    return oldValue !== newValue;
  }

  // Helper method để format diff cho logging
  private formatDiffForLogging(diff: DiffResult): string {
    if (!diff.hasChanges) return '📋 No changes detected';

    const lines = ['📋 Changes detected:'];

    for (const change of diff.changes) {
      const icon = change.type === 'added' ? '➕' : change.type === 'removed' ? '➖' : '🔄';
      const oldVal = this.formatValue(change.oldValue);
      const newVal = this.formatValue(change.newValue);

      lines.push(`   ${icon} ${change.field}: ${oldVal} → ${newVal}`);
    }

    return lines.join('\n');
  }

  // Helper method để format giá trị cho display
  private formatValue(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  // NEW: Update product order method
  async updateProductOrder(dto: UpdateProductOrderDto) {
    try {
      console.log('🔄 Updating product order:', dto);

      // Lấy thông tin products hiện tại để so sánh
      const productIds = dto.orderUpdates.map(item => item.id);
      const originalProducts = await this.productRepo.find({
        where: { id: In(productIds) },
        select: ['id', 'sortOrder', 'apartmentCode']
      });

      const changes: Array<{ productId: string, apartmentCode: string, oldOrder: number, newOrder: number }> = [];

      // Start transaction
      await this.productRepo.manager.transaction(async (manager) => {
        // Update each product's sort order và track changes
        for (const orderItem of dto.orderUpdates) {
          const originalProduct = originalProducts.find(p => p.id === orderItem.id);

          if (originalProduct && originalProduct.sortOrder !== orderItem.order) {
            changes.push({
              productId: orderItem.id,
              apartmentCode: originalProduct.apartmentCode,
              oldOrder: originalProduct.sortOrder,
              newOrder: orderItem.order
            });
          }

          await manager.update(Product,
            { id: orderItem.id },
            { sortOrder: orderItem.order }
          );
        }
      });

      // Log changes
      if (changes.length > 0) {
        console.log('📋 Sort order changes:');
        for (const change of changes) {
          console.log(`   🔄 ${change.apartmentCode}: ${change.oldOrder} → ${change.newOrder}`);
        }
      } else {
        console.log('📋 No sort order changes detected');
      }

      console.log('✅ Product order updated successfully');

      return {
        success: true,
        message: 'Product order updated successfully',
        updatedCount: dto.orderUpdates.length,
        changesCount: changes.length,
        changes: changes
      };

    } catch (error) {
      console.error('❌ Error updating product order:', error);
      throw new Error('Failed to update product order');
    }
  }

  async updateProductDivision(dto: UpdateProductDivisionDto) {
    const apartmentTypeEntity = await this.masterDataRepo.findOne({
      where: { id: dto.apartmentType },
    });
    if (!apartmentTypeEntity) {
      throw new Error("Bảng hàng không tồn tại");
    }
    try {
      this.productRepo.createQueryBuilder()
        .update(Product)
        .set({ apartmentType: { id: apartmentTypeEntity.id }, subdivision: { id: apartmentTypeEntity.parentId } })
        .whereInIds(dto.productIds)
        .execute();
    } catch (error) {
      console.error('❌ Error updating product divion:', error);
      throw new Error('Không thể chuyển tòa nhà - phân khu. Vui lòng liên hệ admin');
    }
  }

  async create(dto: CreateProductDto, files: Express.Multer.File[]) {
    const apartmentTypeEntity = await this.masterDataRepo.findOne({
      where: { id: dto.apartmentType },
    });
    const subdivisionEntity = await this.masterDataRepo.findOne({
      where: { id: dto.subdivision },
    });

    // Get the highest sort order for this apartment type and subdivision
    const maxSortOrder = await this.productRepo
      .createQueryBuilder('product')
      .select('MAX(product.sortOrder)', 'maxOrder')
      .where('product.apartmentType.id = :apartmentType', { apartmentType: dto.apartmentType })
      .andWhere('product.subdivision.id = :subdivision', { subdivision: dto.subdivision })
      .getRawOne();

    const nextSortOrder = (maxSortOrder?.maxOrder || 0) + 1;

    const product = this.productRepo.create({
      ...dto,
      apartmentType: apartmentTypeEntity,
      subdivision: subdivisionEntity,
      sortOrder: nextSortOrder, // Set initial sort order
    });

    if (files?.length) {
      product.imageList = files.map((f) =>
        this.imageRepo.create({ url: `/uploads/products/${f.filename}` }),
      );
    }

    const savedProduct = await this.productRepo.save(product);

    // Load full product with relations for notification
    const fullProduct = await this.productRepo.findOne({
      where: { id: savedProduct.id },
      relations: ['imageList', 'apartmentType', 'subdivision'],
    });

    // Emit WebSocket notification with error handling
    try {
      console.log(`🔔 Sending product created notification for: ${fullProduct.apartmentCode}`);
      console.log(`   Subdivision ID: ${dto.subdivision}, ApartmentType ID: ${dto.apartmentType}`);

      // Pass the IDs, not the full objects
      this.productGateway.notifyProductCreated(
        fullProduct,
        dto.subdivision, // This is the ID string
        dto.apartmentType, // This is the ID string
      );
    } catch (error) {
      console.error('❌ Error sending WebSocket notification:', error);
    }

    return fullProduct;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    files: Express.Multer.File[],
  ) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['imageList', 'apartmentType', 'subdivision'],
    });

    if (!product) throw new Error('Product not found');
    // Tạo bản copy của entity cũ để so sánh (deep clone)
    const originalProduct = JSON.parse(JSON.stringify(product));

    // Store original subdivision and apartmentType IDs for notification
    const originalSubdivision = product.subdivision.id;
    const originalApartmentType = product.apartmentType.id;
    const order = product.sortOrder;

    // Tạo entity mới với các thay đổi
    const updatedProductData = { ...product, ...dto };

    // Kiểm tra diff trước khi update
    const diff = this.createEntityDiff(originalProduct, updatedProductData);

    // Log chi tiết những gì đã thay đổi
    console.log(`🔍 Checking changes for product: ${product.apartmentCode}`);
    console.log(this.formatDiffForLogging(diff));

    // Nếu không có thay đổi gì, có thể skip update
    if (!diff.hasChanges && (!files?.length)) {
      console.log('⏭️ No changes detected, skipping update');
      return product;
    }

    Object.assign(product, dto);
    product.imageList = [];
    product.sortOrder = order;

    if (dto.imageIds?.length) {
      const images = await this.imageRepo.find({
        where: {
          id: In(dto.imageIds),
        },
      });
      product.imageList = images;
    }

    if (files?.length) {
      const newFiles = files.map((f) =>
        new ProductImage(`/uploads/products/${f.filename}`),
      );
      product.imageList = (product.imageList || []).concat(newFiles);
    }

    const updatedProduct = await this.productRepo.save(product);

    // Load full product with relations for notification
    const fullProduct = await this.productRepo.findOne({
      where: { id: updatedProduct.id },
      relations: ['imageList', 'apartmentType', 'subdivision'],
    });

    // Emit WebSocket notification with error handling
    try {
      console.log(`🔔 Sending product updated notification for: ${fullProduct.apartmentCode}`);
      console.log(`   Subdivision ID: ${originalSubdivision}, ApartmentType ID: ${originalApartmentType}`);

      // Pass the IDs, not the full objects
      this.productGateway.notifyProductUpdated(
        fullProduct,
        originalSubdivision, // This is the ID string
        originalApartmentType, // This is the ID string
      );
    } catch (error) {
      console.error('❌ Error sending WebSocket notification:', error);
    }

    return updatedProduct;
  }

  async remove(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['imageList', 'apartmentType', 'subdivision'],
    });

    if (!product) throw new Error('Product not found');

    // Store the IDs for notification
    const subdivision = product.subdivision.id;
    const apartmentType = product.apartmentType.id;
    const apartmentCode = product.apartmentCode;

    if (product?.imageList?.length) {
      for (const img of product.imageList) {
        const filepath = path.join('./', img.url);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }
    }

    await this.imageRepo.delete({ product: { id } });
    const result = await this.productRepo.delete(id);

    // Emit WebSocket notification with error handling
    try {
      // Pass the IDs, not the full objects
      this.productGateway.notifyProductDeleted(product, subdivision, apartmentType);
    } catch (error) {
      console.error('❌ Error sending WebSocket notification:', error);
    }

    return result;
  }

  async removeAll(dto: BulkDeleteProductDto) {
    const ids = Array.from(new Set(dto.productIds)).filter(Boolean);
    if (!ids.length) throw new BadRequestException('Empty ids');

    return await this.productRepo.delete({ id: In(ids) });
  }

  async findAllWithFilters(query: ProductQueryDto, userId: string) {
    const builder = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.imageList', 'images');

    const permission = await this.permissionsRepo.findOne({
      where: { user: { id: userId } },
    });
    const productIds = permission?.productIds || [];

    const filterFields = [
      'buildingCode',
      'apartmentCode',
      'apartmentEncode',
      'area',
      'sellingPrice',
      'tax',
      'furnitureNote',
      'mortgageInfo',
      'description',
      'balconyDirection',
      'status',
      'apartmentContactInfo',
      'contactInfo',
      'source',
    ];

    for (const field of filterFields) {
      if (Array.isArray(query[field]) && query[field].length > 0) {
        builder.andWhere(`product.${field} IN (:...${field})`, {
          [field]: query[field],
        });
      } else if (query[field] !== undefined && query[field] !== null) {
        builder.andWhere(`product.${field} = :${field}`, {
          [field]: query[field],
        });
      }
    }
    if (productIds.length > 0) {
      builder.andWhere('product.id NOT IN (:...ids)', { ids: productIds });
    }

    if (query.search) {
      builder.andWhere(
        '(product.apartmentCode LIKE :search OR product.apartmentEncode LIKE :search OR product.contactInfo LIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    builder.andWhere('(product.apartmentType.id = :apartmentType)', {
      apartmentType: query.apartmentType,
    });
    builder.andWhere('(product.subdivision.id = :subdivision)', {
      subdivision: query.subdivision,
    });

    // Get user's sort preference
    const sortPreference = await this.userSortPreferencesService.getSortPreference(
      'products',
    );

    // Apply sorting - use user preference if available, otherwise use query params
    if (query.sortBy) {
      // Save new sort preference
      await this.userSortPreferencesService.saveSortPreference({
        pageKey: 'products',
        sortBy: query.sortBy,
        sortOrder: query.sortOrder || 'DESC',
      });
      builder.orderBy(`product.${query.sortBy}`, query.sortOrder || 'DESC');
    } else if (sortPreference && sortPreference.sortBy) {
      // Use saved preference
      builder.orderBy(`product.${sortPreference.sortBy}`, sortPreference.sortOrder);
    } else {
      // Default sorting by sortOrder first, then by createdAt
      builder.orderBy('product.sortOrder', 'ASC')
        .addOrderBy('product.createdAt', 'DESC');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    builder.skip((page - 1) * limit).take(limit);

    const [data, total] = await builder.getManyAndCount();

    // Include current sort info in response
    const currentSort = query.sortBy ? {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder || 'DESC',
    } : sortPreference ? {
      sortBy: sortPreference.sortBy,
      sortOrder: sortPreference.sortOrder,
    } : {
      sortBy: 'sortOrder',
      sortOrder: 'ASC' as const,
    };

    return {
      data,
      total,
      page,
      limit,
      currentSort,
    };
  }

  async getFilterOptions(query: ProductQueryDto, userId: string) {
    const fields = [
      'buildingCode',
      'apartmentCode',
      'apartmentEncode',
      'area',
      'sellingPrice',
      'tax',
      'furnitureNote',
      'mortgageInfo',
      'description',
      'balconyDirection',
      'status',
      'apartmentContactInfo',
      'contactInfo',
      'source',
    ];

    const result = {};
    const permission = await this.permissionsRepo.findOne({
      where: { user: { id: userId } },
    });
    const productIds = permission?.productIds || [];

    for (const field of fields) {
      const builder = this.productRepo.createQueryBuilder('product');
      builder.select(`DISTINCT product.${field}`, 'value')
      builder.where(`product.${field} IS NOT NULL`);
      if (productIds.length > 0) {
        builder.andWhere('product.id NOT IN (:...ids)', { ids: productIds });
      }

      if (query.search) {
        builder.andWhere(
          '(product.apartmentCode LIKE :search OR product.contactInfo LIKE :search)',
          { search: `%${query.search}%` },
        );
      }
      builder.andWhere('(product.apartmentType.id = :apartmentType)', {
        apartmentType: query.apartmentType,
      });
      builder.andWhere('(product.subdivision.id = :subdivision)', {
        subdivision: query.subdivision,
      });
      const distinctValues = await builder.orderBy(`product.${field}`, 'ASC')
        .getRawMany();

      result[field] = distinctValues.map((r) => r.value);
    }

    return result;
  }

  async getSubdivisionTree() {
    const products = await this.productRepo
      .createQueryBuilder('product')
      .select(['product.buildingCode'])
      .distinct(true)
      .getRawMany();

    const tree = {};
    for (const row of products) {
      const subdivision = row.product_subdivision;
      const building = row.product_buildingCode;
      const id = row.product_id;
      if (!tree[subdivision]) tree[subdivision] = [];
      tree[subdivision].push({ id, buildingCode: building });
    }

    return Object.entries(tree).map(([subdivision, buildings]) => ({
      subdivision,
      buildings,
    }));
  }
}