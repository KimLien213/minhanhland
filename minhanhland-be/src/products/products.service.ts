import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import * as fs from 'fs';
import * as path from 'path';
import { MasterDataEntity } from 'src/master-data/entities/master-data.entity';
import { ProductFieldPermission } from 'src/product_field_permissions/entities/product_field_permission.entity';
import { UserSortPreferencesService } from 'src/user-sort-preference/user-sort-preference.service';
import { ProductGateway } from './product.gateway';

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
  // Sửa trong ProductService - chỉ các phần create, update, remove
  async create(dto: CreateProductDto, files: Express.Multer.File[]) {
    const apartmentTypeEntity = await this.masterDataRepo.findOne({
      where: { id: dto.apartmentType },
    });
    const subdivisionEntity = await this.masterDataRepo.findOne({
      where: { id: dto.subdivision },
    });

    const product = this.productRepo.create({
      ...dto,
      apartmentType: apartmentTypeEntity,
      subdivision: subdivisionEntity,
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

    // Store original subdivision and apartmentType IDs for notification
    const originalSubdivision = product.subdivision.id;
    const originalApartmentType = product.apartmentType.id;

    Object.assign(product, dto);
    product.imageList = [];

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
        '(product.apartmentCode LIKE :search OR product.buildingCode LIKE :search OR product.contactInfo LIKE :search)',
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
      // Default sorting
      builder.orderBy('product.createdAt', 'DESC');
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
      sortBy: 'createdAt',
      sortOrder: 'DESC' as const,
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
