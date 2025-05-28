import { Module } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { MasterDataController } from './master-data.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterDataEntity } from './entities/master-data.entity';
import { MasterDataRepository } from './repositories/master-data.repository';

@Module({
  imports: [TypeOrmModule.forFeature([MasterDataEntity])],
  providers: [MasterDataService, MasterDataRepository],
  controllers: [MasterDataController],
})
export class MasterDataModule {}
