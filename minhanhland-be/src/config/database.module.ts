import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentEntity } from 'src/departments/entities/department.entity';
import { MasterDataEntity } from 'src/master-data/entities/master-data.entity';
import { ProductFieldPermission } from 'src/product_field_permissions/entities/product_field_permission.entity';
import { ProductImage } from 'src/products/entities/product-image.entity';
import { Product } from 'src/products/entities/product.entity';
import { UserSortPreference } from 'src/user-sort-preference/entities/user-sort-preference.entity';
import { UserEntity } from 'src/users/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [
          UserEntity, 
          DepartmentEntity,
          Product,
          ProductImage,
          MasterDataEntity,
          ProductFieldPermission,
          UserSortPreference
        ],
        synchronize: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
