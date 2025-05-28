import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('product_images')
export class ProductImage extends BaseEntity {
  @Column({ name: 'url', type: 'text' })
  url: string;

  @ManyToOne(() => Product, (product) => product.imageList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "product_id"})
  product: Product;

  constructor(url: string, id?: string,) {
    super();
    if (id) {
      this.id = id;
    }
    this.url = url;
  }
}
