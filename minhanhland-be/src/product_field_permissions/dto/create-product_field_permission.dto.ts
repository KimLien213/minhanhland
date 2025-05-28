import { IsArray, IsUUID, IsString, IsOptional } from 'class-validator';

export class CreateProductFieldPermissionDto {
  @IsArray()
  @IsUUID('all', { each: true })
  userIds: string[];

  @IsArray()
  @IsString({ each: true })
  fieldNames: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  productIds: string[];
}
