import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { UserEntity } from 'src/users/entities/user.entity';

@Entity('departments')
export class DepartmentEntity extends BaseEntity {
  @Column()
  name: string;

  @Column({ name: 'description', nullable: true })
  description?: string;

  @Column({ name: 'head_id', nullable: true })
  headId: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'head_id' })
  head?: UserEntity;
}
