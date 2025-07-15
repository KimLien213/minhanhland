import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { ProductsModule } from './products/products.module';
import { UserPermissionsModule } from './user-permissions/user-permissions.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './config/database.module';
import { AuthModule } from './auth/auth.module';
import { MasterDataModule } from './master-data/master-data.module';
import { ProductFieldPermissionsModule } from './product_field_permissions/product_field_permissions.module';
import { ImportExcelModule } from './import-excel/import-excel.module';
import { UserSortPreferencesModule } from './user-sort-preference/user-sort-preference.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsersModule,
    DepartmentsModule,
    ProductsModule,
    UserPermissionsModule,
    AuthModule,
    MasterDataModule,
    ProductFieldPermissionsModule,
    ImportExcelModule,
    UserSortPreferencesModule,
    JobsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
