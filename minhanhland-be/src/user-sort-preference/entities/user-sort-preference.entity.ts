// src/user-sort-preferences/entities/user-sort-preference.entity.ts
import { BaseEntity } from 'src/common/entities/base.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';

@Entity('user_sort_preferences')
@Unique(['pageKey'])
export class UserSortPreference extends BaseEntity {

  @Column({ name: 'page_key', type: 'varchar', length: 100 })
  pageKey: string; // 'products', 'users', 'departments', etc.

  @Column({ name: 'sort_by', type: 'varchar', length: 100, nullable: true })
  sortBy: string | null;

  @Column({ name: 'sort_order', type: 'enum', enum: ['ASC', 'DESC'], default: 'DESC' })
  sortOrder: 'ASC' | 'DESC';
}