// src/master-data/master-data.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { CreateMasterDataDto } from './dto/create-master-data.dto';
import { UpdateMasterDataDto } from './dto/update-master-data.dto';
import { MasterDataResponseDto } from './dto/master-data-response.dto';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { MasterDataType } from 'src/common/enums';
import { AuthGuard } from '@nestjs/passport';

interface OrderUpdateDto {
  id: string;
  order: number;
}

@UseGuards(AuthGuard('jwt'))
@Controller('master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}
  
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.masterDataService.findAll(query);
  }

  @Get('all')
  findAllNoPaging() {
    return this.masterDataService.findAllNoPaging(MasterDataType.TOA_NHA);
  }

  @Post()
  async create(
    @Body() body: CreateMasterDataDto,
  ): Promise<MasterDataResponseDto> {
    return this.masterDataService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateMasterDataDto,
  ): Promise<MasterDataResponseDto | null> {
    return this.masterDataService.update(id, body);
  }

  @Patch(':id/order')
  async updateOrder(
    @Param('id') id: string,
    @Body('order') order: number,
  ): Promise<{ success: boolean }> {
    const success = await this.masterDataService.updateOrder(id, order);
    return { success };
  }

  // API để update order cho parent items
  @Patch('parents/reorder')
  async updateParentOrders(
    @Body() orderUpdates: OrderUpdateDto[],
  ): Promise<{ success: boolean }> {
    const success = await this.masterDataService.updateParentOrders(orderUpdates);
    return { success };
  }

  // API để update order cho children items
  @Patch(':parentId/children/reorder')
  async updateChildrenOrders(
    @Param('parentId') parentId: string,
    @Body() orderUpdates: OrderUpdateDto[],
  ): Promise<{ success: boolean }> {
    const success = await this.masterDataService.updateChildrenOrders(parentId, orderUpdates);
    return { success };
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.masterDataService.delete(id);
    return { success };
  }

  @Get('/:id')
  async findByType(@Param('id') id: string): Promise<MasterDataResponseDto> {
    return this.masterDataService.findById(id);
  }
}