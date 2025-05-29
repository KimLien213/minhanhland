// src/user-sort-preferences/user-sort-preferences.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSortPreference } from './entities/user-sort-preference.entity';
import { UserSortPreferencesController } from './user-sort-preference.controller';
import { UserSortPreferencesService } from './user-sort-preference.service';
@Module({
  imports: [TypeOrmModule.forFeature([UserSortPreference])],
  controllers: [UserSortPreferencesController],
  providers: [UserSortPreferencesService],
  exports: [UserSortPreferencesService],
})
export class UserSortPreferencesModule {}