import {
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ImportExcelService } from './import-excel.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('import-excel')
export class ImportExcelController {
  constructor(private readonly importService: ImportExcelService) {}

  @Post('products')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async importProducts(@UploadedFiles() files: Express.Multer.File[]) {
    const result = await this.importService.importExcelFiles(files);
    return {
      totalFiles: files.length,
      imported: result,
    };
  }
}
