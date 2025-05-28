import { Module } from '@nestjs/common';
import { ProductFieldPermissionController } from './product_field_permissions.controller';
import { ProductFieldPermissionService } from './product_field_permissions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductFieldPermission } from './entities/product_field_permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductFieldPermission])],
  controllers: [ProductFieldPermissionController],
  providers: [ProductFieldPermissionService],
})
export class ProductFieldPermissionsModule {}
