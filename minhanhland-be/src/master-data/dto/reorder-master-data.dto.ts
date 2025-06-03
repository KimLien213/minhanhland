import { IsArray, IsNotEmpty, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class ReorderItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  order: number;
}

export class ReorderMasterDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}