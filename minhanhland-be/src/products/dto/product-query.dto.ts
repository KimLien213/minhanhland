import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/pagination/pagination.dto';

export class ProductQueryDto extends PaginationDto {
  @IsString()
  apartmentType: string;
  @IsString()
  subdivision: string;
  @IsOptional()
  buildingCode?: string[];
  @IsOptional()
  apartmentCode?: string[];
  @IsOptional()
  area?: string[];
  @IsOptional()
  sellingPrice?: string[];
  @IsOptional()
  furnitureNote?: string[];
  @IsOptional()
  mortgage?: string[];
  @IsOptional()
  balconyDirection?: string[];
  @IsOptional()
  mainDoorDirection?: string[];
  @IsOptional()
  tax?: string[];
  @IsOptional()
  contactInfo?: string[];
  @IsOptional()
  description?: string[];
}
