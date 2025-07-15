import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductOrderItem {
  @IsString()
  id: string;

  @IsString()
  order: number;
}

export class UpdateProductOrderDto {
  @IsString()
  apartmentType: string;

  @IsString()
  subdivision: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOrderItem)
  orderUpdates: ProductOrderItem[];
}