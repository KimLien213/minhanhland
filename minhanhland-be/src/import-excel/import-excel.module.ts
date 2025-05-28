import { Module } from '@nestjs/common';
import { ImportExcelController } from './import-excel.controller';
import { ImportExcelService } from './import-excel.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { MasterDataEntity } from 'src/master-data/entities/master-data.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, MasterDataEntity]),
  ],
  controllers: [ImportExcelController],
  providers: [ImportExcelService]
})
export class ImportExcelModule { }
