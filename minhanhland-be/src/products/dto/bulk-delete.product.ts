import { IsString, IsArray, ValidateNested } from 'class-validator';

export class BulkDeleteProductDto {
  @IsArray()
  productIds: string[];
}