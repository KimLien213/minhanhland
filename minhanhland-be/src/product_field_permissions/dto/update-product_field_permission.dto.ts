import { PartialType } from '@nestjs/mapped-types';
import { CreateProductFieldPermissionDto } from './create-product_field_permission.dto';

export class UpdateProductFieldPermissionDto extends PartialType(CreateProductFieldPermissionDto) {}
