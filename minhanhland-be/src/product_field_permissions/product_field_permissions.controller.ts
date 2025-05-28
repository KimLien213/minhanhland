import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateProductFieldPermissionDto } from './dto/create-product_field_permission.dto';
import { ProductFieldPermissionService } from './product_field_permissions.service';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('product-field-permissions')
@UseGuards(AuthGuard('jwt'))
export class ProductFieldPermissionController {
  constructor(private readonly service: ProductFieldPermissionService) {}

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Post('bulk')
  async createBulk(@Body() dto: CreateProductFieldPermissionDto) {
    return this.service.createBulk(dto);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.service.findByUser(userId);
  }

  @Delete('user/:userId')
  async removeByUser(@Param('userId') userId: string) {
    return this.service.removeByUser(userId);
  }
}
