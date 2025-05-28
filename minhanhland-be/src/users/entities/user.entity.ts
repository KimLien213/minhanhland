import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { DepartmentEntity } from 'src/departments/entities/department.entity';
import { Seniority, UserRole } from 'src/common/enums';
import { ProductFieldPermission } from 'src/product_field_permissions/entities/product_field_permission.entity';
@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  @JoinColumn({name: 'department_id'})
  department?: DepartmentEntity;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: 'note', nullable: true, type: 'text' })
  note?: string;

  @Column({ type: 'enum', enum: Seniority })
  seniority: Seniority;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl?: string;

  @OneToMany(() => ProductFieldPermission, (permission) => permission.user)
  fieldPermissions: ProductFieldPermission[];
}
