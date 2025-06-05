import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Put,
  UploadedFiles,
  UseInterceptors,
  Req,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ProductService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductQueryDto } from './dto/product-query.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateProductOrderDto } from './dto/update-product-order.dto';

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Post()
  @UseInterceptors(FilesInterceptor('images', 30, {
    storage: diskStorage({
      destination: './uploads/products',
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    }),
  }))
  async create(@Body() dto: CreateProductDto, @UploadedFiles() files: Express.Multer.File[]) {
    return this.productService.create(dto, files);
  }

  @Put(':id')
  @UseInterceptors(FilesInterceptor('images', 30, {
    storage: diskStorage({
      destination: './uploads/products',
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    }),
  }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productService.update(id, dto, files);
  }

  // NEW: Update product order endpoint
  @Patch('update-order')
  async updateProductOrder(@Body() dto: UpdateProductOrderDto) {
    return this.productService.updateProductOrder(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  @Get()
  findAll(@Query() query: ProductQueryDto, @Req() req) {
    return this.productService.findAllWithFilters(query, req.user.userId);
  }

  @Get('filters')
  getFilterOptions(@Query() query: ProductQueryDto, @Req() req) {
    return this.productService.getFilterOptions(query, req.user.userId);
  }

  @Get('tree')
  getSubdivisionTree() {
    return this.productService.getSubdivisionTree();
  }
}