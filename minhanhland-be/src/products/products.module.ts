import { Module } from '@nestjs/common';
import { ProductService } from './products.service';
import { ProductController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { MasterDataEntity } from 'src/master-data/entities/master-data.entity';
import { ProductFieldPermission } from 'src/product_field_permissions/entities/product_field_permission.entity';
import { UsersModule } from 'src/users/users.module';
import { UserSortPreferencesModule } from 'src/user-sort-preference/user-sort-preference.module';
import { ProductGateway } from './product.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage, MasterDataEntity, ProductFieldPermission]),
    UsersModule,
    UserSortPreferencesModule
  ],
  controllers: [ProductController],
  providers: [ProductService, ProductGateway],
  exports: [ProductGateway],
})
export class ProductsModule {}
