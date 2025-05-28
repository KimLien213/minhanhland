import { BaseEntity } from 'src/common/entities/base.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('product_field_permissions')
export class ProductFieldPermission extends BaseEntity {
  @ManyToOne(() => UserEntity, (user) => user.fieldPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column('json', { name: 'field_names', nullable: false })
  fieldNames: string[];

  @Column('json', { name: 'product_ids',  nullable: true })
  productIds: string[];
}
