// src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageCleanupJob } from './image-cleanup.job';
import { ProductImage } from 'src/products/entities/product-image.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { JobsController } from './jobs.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ProductImage, UserEntity]),
  ],
  providers: [ImageCleanupJob],
  controllers: [JobsController],
  exports: [ImageCleanupJob],
})
export class JobsModule {}