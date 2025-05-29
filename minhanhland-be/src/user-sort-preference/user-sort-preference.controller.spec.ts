import { Test, TestingModule } from '@nestjs/testing';
import { UserSortPreferenceController } from './user-sort-preference.controller';
import { UserSortPreferenceService } from './user-sort-preference.service';

describe('UserSortPreferenceController', () => {
  let controller: UserSortPreferenceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserSortPreferenceController],
      providers: [UserSortPreferenceService],
    }).compile();

    controller = module.get<UserSortPreferenceController>(UserSortPreferenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
