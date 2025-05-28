import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsString()
  apartmentCode: string;

  @IsString()
  apartmentType: string;

  @Type(() => Number)
  @IsNumber()
  area: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tax: number;

  @IsString()
  sellingPrice: string;

  @IsOptional()
  @IsString()
  furnitureNote?: string;

  @IsOptional()
  @IsString()
  balconyDirection?: string;

  @IsOptional()
  @IsString()
  mainDoorDirection?: string;

  @IsOptional()
  @IsString()
  mortgage?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;
}
