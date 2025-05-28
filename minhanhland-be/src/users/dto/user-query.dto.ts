import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Seniority, UserRole } from 'src/common/enums';
import { PaginationDto } from 'src/common/pagination/pagination.dto';

export class UserQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(Seniority)
  seniority?: Seniority;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
