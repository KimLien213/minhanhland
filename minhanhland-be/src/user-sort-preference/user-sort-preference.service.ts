// src/user-sort-preferences/user-sort-preferences.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSortPreference } from './entities/user-sort-preference.entity';

export interface SaveSortPreferenceDto {
  pageKey: string;
  sortBy: string | null;
  sortOrder: 'ASC' | 'DESC';
}

@Injectable()
export class UserSortPreferencesService {
  constructor(
    @InjectRepository(UserSortPreference)
    private readonly sortPreferenceRepo: Repository<UserSortPreference>,
  ) {}

  async saveSortPreference(
    dto: SaveSortPreferenceDto,
  ): Promise<UserSortPreference> {
    const existing = await this.sortPreferenceRepo.findOne({
      where: {
        pageKey: dto.pageKey,
      },
    });

    if (existing) {
      existing.sortBy = dto.sortBy;
      existing.sortOrder = dto.sortOrder;
      return this.sortPreferenceRepo.save(existing);
    } else {
      const newPreference = this.sortPreferenceRepo.create({
        pageKey: dto.pageKey,
        sortBy: dto.sortBy,
        sortOrder: dto.sortOrder,
      });
      return this.sortPreferenceRepo.save(newPreference);
    }
  }

  async getSortPreference(
    pageKey: string,
  ): Promise<UserSortPreference | null> {
    return this.sortPreferenceRepo.findOne({
      where: {
        pageKey,
      },
    });
  }

  async getAllUserSortPreferences(): Promise<UserSortPreference[]> {
    return this.sortPreferenceRepo.find();
  }
}