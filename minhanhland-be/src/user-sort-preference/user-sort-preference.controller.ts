// src/user-sort-preferences/user-sort-preferences.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SaveSortPreferenceDto, UserSortPreferencesService } from './user-sort-preference.service';

@UseGuards(AuthGuard('jwt'))
@Controller('user-sort-preferences')
export class UserSortPreferencesController {
  constructor(
    private readonly userSortPreferencesService: UserSortPreferencesService,
  ) {}

  @Post()
  async saveSortPreference(
    @Body() dto: SaveSortPreferenceDto,
  ) {
    return this.userSortPreferencesService.saveSortPreference(
      dto,
    );
  }

  @Get(':pageKey')
  async getSortPreference(
    @Param('pageKey') pageKey: string,
  ) {
    return this.userSortPreferencesService.getSortPreference(
      pageKey,
    );
  }

  @Get()
  async getAllSortPreferences() {
    return this.userSortPreferencesService.getAllUserSortPreferences();
  }
}