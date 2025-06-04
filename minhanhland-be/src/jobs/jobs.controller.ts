import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ImageCleanupJob } from './image-cleanup.job';

@Controller('jobs')
export class JobsController {
  constructor(private readonly imageCleanupJob: ImageCleanupJob) {}

  @Get('image-cleanup/stats')
  async getImageCleanupStats() {
    return this.imageCleanupJob.getCleanupStats();
  }

  @Get('image-cleanup/run')
  async runImageCleanup() {
    const result = await this.imageCleanupJob.runCleanupManually();
    return {
      message: 'Image cleanup completed successfully',
      ...result
    };
  }

  @Get('image-cleanup/status')
  async getCleanupStatus() {
    const stats = await this.imageCleanupJob.getCleanupStats();
    
    return {
      status: 'healthy',
      stats,
      recommendations: this.generateRecommendations(stats)
    };
  }

  private generateRecommendations(stats: any): string[] {
    const recommendations = [];
    
    if (stats.productImages.orphanedRecords > 0) {
      recommendations.push(`Found ${stats.productImages.orphanedRecords} orphaned image records that should be cleaned up`);
    }
    
    const fileDbRatio = stats.productImages.fileCount / stats.productImages.dbCount;
    if (fileDbRatio > 1.2) {
      recommendations.push('File count significantly higher than database records - consider running cleanup');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('No issues detected - image storage is clean');
    }
    
    return recommendations;
  }
}