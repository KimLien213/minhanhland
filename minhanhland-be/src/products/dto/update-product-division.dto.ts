import { IsString, IsArray, ValidateNested } from 'class-validator';

export class UpdateProductDivisionDto {
  @IsString()
  apartmentType: string;

  @IsArray()
  productIds: string[];
}