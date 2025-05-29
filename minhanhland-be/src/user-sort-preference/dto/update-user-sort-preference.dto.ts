import { PartialType } from '@nestjs/mapped-types';
import { CreateUserSortPreferenceDto } from './create-user-sort-preference.dto';

export class UpdateUserSortPreferenceDto extends PartialType(CreateUserSortPreferenceDto) {}
