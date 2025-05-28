import { IsOptional, IsString } from 'class-validator';

export class UpdateMasterDataDto {
  id: string;

  @IsOptional()
  @IsString({ message: 'msg.masterdata.validate.name.isString' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'msg.masterdata.validate.description.isString' })
  description?: string;
}
