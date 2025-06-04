// entities/product.entity.ts - Bỏ qua index problematic
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { ProductImage } from './product-image.entity';
import { MasterDataEntity } from 'src/master-data/entities/master-data.entity';
import { ProductStatus } from 'src/common/enums';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('products')
// Chỉ tạo index cho sort_order, bỏ qua index có thể conflict
@Index('idx_products_sort_order', ['subdivision', 'apartmentType', 'sortOrder'])
export class Product extends BaseEntity {
  // Mã tòa
  @Column({
    name: 'building_code',
    type: 'varchar',
    length: 255,
    nullable: true
  })
  buildingCode?: string;

  // Mã căn
  @Column({ name: 'apartment_code', type: 'varchar', length: 255 })
  apartmentCode: string;

  // Mã căn x
  @Column({
    name: 'apartment_encode', type: 'varchar', length: 255,
    nullable: true
  })
  apartmentEncode?: string;

  // Diện tích
  @Column({
    type: 'decimal', precision: 10, scale: 2,
    nullable: true
  })
  area?: number;

  // Giá bán
  @Column({
    name: 'selling_price',
    nullable: true
  })
  sellingPrice?: string;

  // Thuế phí
  @Column({ nullable: true, type: 'decimal', precision: 20, scale: 2 })
  tax: number;

  // Nội thất
  @Column({ name: 'furniture_note', type: 'text', nullable: true })
  furnitureNote: string | null;

  // TT sổ đỏ
  @Column({ name: 'mortgage_info', type: 'text', nullable: true })
  mortgageInfo: string | null;

  // Ghi chú
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Hướng ban công
  @Column({
    name: 'balcony_direction',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  balconyDirection: string | null;

  // NEW: Sort order field - chỉ thêm cột, không tạo index phức tạp
  @Column({
    name: 'sort_order',
    type: 'int',
    nullable: true,
    default: 0
  })
  sortOrder: number;

  // Hình ảnh
  @OneToMany(() => ProductImage, (image) => image.product, { cascade: true })
  imageList: ProductImage[];

  // tình trạng
  @Column({
    type: 'enum',
    enum: ProductStatus,
    nullable: false,
    default: ProductStatus.DANG_BAN,
  })
  status: ProductStatus;

  // Số điện thoại liên hệ chủ nhà
  @Column({ name: 'apartment_contact_info', type: 'varchar', length: 255, nullable: true })
  apartmentContactInfo: string;

  // Số điện thoại sale
  @Column({ name: 'contact_info', type: 'varchar', length: 255, nullable: true })
  contactInfo: string;

  // Báo nguồn
  @Column({ nullable: true })
  source: string;

  @JoinColumn({ name: 'subdivision' })
  @ManyToOne(() => MasterDataEntity, (type) => type.productSubs, {
    onDelete: 'CASCADE',
  })
  subdivision: MasterDataEntity;

  @JoinColumn({ name: 'apartment_type' })
  @ManyToOne(() => MasterDataEntity, (type) => type.products, {
    onDelete: 'CASCADE',
  })
  apartmentType: MasterDataEntity;
}