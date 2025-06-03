// src/master-data/entities/master-data.entity.ts
import { BaseEntity } from 'src/common/entities/base.entity';
import { MasterDataType } from 'src/common/enums';
import { Product } from 'src/products/entities/product.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('master_data')
export class MasterDataEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: MasterDataType })
  type: MasterDataType;

  @Column({ type: 'int', default: 0 })
  order: number;

  @OneToMany(() => Product, (image) => image.apartmentType, {
    cascade: true,
  })
  products?: Product[];

  @OneToMany(() => Product, (image) => image.subdivision, {
    cascade: true,
  })
  productSubs?: Product[];

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @ManyToOne(() => MasterDataEntity, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: MasterDataEntity;

  @OneToMany(() => MasterDataEntity, (child) => child.parent)
  children: MasterDataEntity[];
}