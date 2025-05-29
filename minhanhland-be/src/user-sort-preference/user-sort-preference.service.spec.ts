import { Test, TestingModule } from '@nestjs/testing';
import { UserSortPreferencesService } from './user-sort-preference.service';

describe('UserSortPreferenceService', () => {
  let service: UserSortPreferencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserSortPreferencesService],
    }).compile();

    service = module.get<UserSortPreferencesService>(UserSortPreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
