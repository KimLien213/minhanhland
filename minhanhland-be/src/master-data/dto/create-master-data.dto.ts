import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMasterDataDto {
  @IsNotEmpty({ message: 'msg.masterdata.validate.name.isNotEmpty' })
  @IsString({ message: 'msg.masterdata.validate.name.isString' })
  name: string;

  @IsOptional()
  @IsString({ message: 'msg.masterdata.validate.description.isString' })
  description?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
