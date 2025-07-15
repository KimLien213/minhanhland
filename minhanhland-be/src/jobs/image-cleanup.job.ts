// src/jobs/image-cleanup.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductImage } from 'src/products/entities/product-image.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageCleanupJob {
  private readonly logger = new Logger(ImageCleanupJob.name);
  private readonly uploadsPath = './uploads/products';
  private readonly avatarsPath = './uploads/avatars';

  constructor(
    @InjectRepository(ProductImage)
    private readonly productImageRepo: Repository<ProductImage>,
  ) {}

  // Chạy lúc 2:00 AM hàng ngày
  @Cron('0 2 * * *', {
    name: 'image-cleanup',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleImageCleanup() {
    this.logger.log('🧹 Starting daily image cleanup job...');
    
    try {
      const startTime = Date.now();
      
      // Cleanup product images
      const productStats = await this.cleanupProductImages();
      
      // Cleanup avatar images
      const avatarStats = await this.cleanupAvatarImages();
      
      const duration = Date.now() - startTime;
      
      this.logger.log(`✅ Image cleanup completed in ${duration}ms`);
      this.logger.log(`📊 Stats: Products: ${JSON.stringify(productStats)}, Avatars: ${JSON.stringify(avatarStats)}`);
      
    } catch (error) {
      this.logger.error('❌ Error during image cleanup:', error);
    }
  }

  // Manual trigger method for testing
  async runCleanupManually(): Promise<{
    productStats: any;
    avatarStats: any;
    duration: number;
  }> {
    this.logger.log('🔧 Manual image cleanup triggered...');
    
    const startTime = Date.now();
    
    try {
      const productStats = await this.cleanupProductImages();
      const avatarStats = await this.cleanupAvatarImages();
      const duration = Date.now() - startTime;
      
      this.logger.log(`✅ Manual cleanup completed in ${duration}ms`);
      
      return {
        productStats,
        avatarStats,
        duration
      };
    } catch (error) {
      this.logger.error('❌ Error during manual cleanup:', error);
      throw error;
    }
  }

  private async cleanupProductImages(): Promise<{
    orphanedFiles: number;
    orphanedRecords: number;
    totalScanned: number;
    errors: string[];
  }> {
    this.logger.log('🔍 Cleaning up product images...');
    
    const stats = {
      orphanedFiles: 0,
      orphanedRecords: 0,
      totalScanned: 0,
      errors: []
    };

    try {
      // 1. Get all product images from database
      const dbImages = await this.productImageRepo.find({
        relations: ['product']
      });
      
      this.logger.log(`📊 Found ${dbImages.length} product images in database`);

      // 2. Clean up orphaned records (images without products)
      const orphanedRecords = dbImages.filter(img => !img.product);
      
      if (orphanedRecords.length > 0) {
        this.logger.log(`🗑️ Found ${orphanedRecords.length} orphaned image records`);
        
        for (const orphanedImg of orphanedRecords) {
          try {
            // Delete physical file if exists
            const filePath = path.join('.', orphanedImg.url);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              this.logger.debug(`🗑️ Deleted orphaned file: ${filePath}`);
            }
            
            // Delete database record
            await this.productImageRepo.remove(orphanedImg);
            stats.orphanedRecords++;
            
          } catch (error) {
            const errorMsg = `Failed to cleanup orphaned record ${orphanedImg.id}: ${error.message}`;
            this.logger.error(errorMsg);
            stats.errors.push(errorMsg);
          }
        }
      }

      // 3. Scan filesystem and clean up orphaned files
      if (fs.existsSync(this.uploadsPath)) {
        const files = fs.readdirSync(this.uploadsPath);
        stats.totalScanned = files.length;
        
        this.logger.log(`📊 Scanning ${files.length} files in uploads/products/`);

        // Get all valid image URLs from database
        const validImageUrls = new Set(
          dbImages
            .filter(img => img.product) // Only include images with valid products
            .map(img => img.url)
        );

        for (const file of files) {
          try {
            const filePath = path.join(this.uploadsPath, file);
            const relativePath = `/uploads/products/${file}`;
            
            // Skip directories
            if (fs.statSync(filePath).isDirectory()) {
              continue;
            }

            // Check if file is referenced in database
            if (!validImageUrls.has(relativePath)) {
              // Check file age - only delete files older than 1 day to avoid deleting recent uploads
              const fileStats = fs.statSync(filePath);
              const ageInHours = (Date.now() - fileStats.mtime.getTime()) / (1000 * 60 * 60);
              
              if (ageInHours > 24) {
                fs.unlinkSync(filePath);
                stats.orphanedFiles++;
                this.logger.debug(`🗑️ Deleted orphaned file: ${relativePath} (age: ${ageInHours.toFixed(1)}h)`);
              } else {
                this.logger.debug(`⏳ Skipping recent file: ${relativePath} (age: ${ageInHours.toFixed(1)}h)`);
              }
            }
          } catch (error) {
            const errorMsg = `Failed to process file ${file}: ${error.message}`;
            this.logger.error(errorMsg);
            stats.errors.push(errorMsg);
          }
        }
      }

      this.logger.log(`✅ Product image cleanup completed: ${JSON.stringify(stats)}`);
      return stats;

    } catch (error) {
      this.logger.error('❌ Error in product image cleanup:', error);
      stats.errors.push(`General error: ${error.message}`);
      return stats;
    }
  }

  private async cleanupAvatarImages(): Promise<{
    orphanedFiles: number;
    totalScanned: number;
    errors: string[];
  }> {
    this.logger.log('🔍 Cleaning up avatar images...');
    
    const stats = {
      orphanedFiles: 0,
      totalScanned: 0,
      errors: []
    };

    try {
      // Note: You'll need to inject UserEntity repository if you want to clean avatars
      // For now, we'll just scan the filesystem
      
      if (fs.existsSync(this.avatarsPath)) {
        const files = fs.readdirSync(this.avatarsPath);
        stats.totalScanned = files.length;
        
        this.logger.log(`📊 Scanning ${files.length} files in uploads/avatars/`);

        // TODO: Implement avatar cleanup logic
        // You would need to:
        // 1. Get all users with avatarUrl from database
        // 2. Compare with files in filesystem
        // 3. Delete orphaned files
        
        this.logger.log('⚠️ Avatar cleanup not fully implemented yet');
      }

      return stats;

    } catch (error) {
      this.logger.error('❌ Error in avatar cleanup:', error);
      stats.errors.push(`General error: ${error.message}`);
      return stats;
    }
  }

  // Health check method
  async getCleanupStats(): Promise<{
    productImages: {
      dbCount: number;
      fileCount: number;
      orphanedRecords: number;
    };
    lastCleanup?: Date;
  }> {
    try {
      const dbImageCount = await this.productImageRepo.count();
      
      let fileCount = 0;
      if (fs.existsSync(this.uploadsPath)) {
        const files = fs.readdirSync(this.uploadsPath);
        fileCount = files.filter(file => {
          const filePath = path.join(this.uploadsPath, file);
          return fs.statSync(filePath).isFile();
        }).length;
      }

      const orphanedRecords = await this.productImageRepo.count({
        where: { product: null }
      });

      return {
        productImages: {
          dbCount: dbImageCount,
          fileCount,
          orphanedRecords
        }
      };
    } catch (error) {
      this.logger.error('Error getting cleanup stats:', error);
      throw error;
    }
  }
}