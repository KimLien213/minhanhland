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
  HttpStatus,
  HttpException,
  Logger,
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

interface ReorderResponse {
  success: boolean;
  message?: string;
  details?: any;
}

@UseGuards(AuthGuard('jwt'))
@Controller('master-data')
export class MasterDataController {
  private readonly logger = new Logger(MasterDataController.name);

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
    try {
      return await this.masterDataService.create(body);
    } catch (error) {
      this.logger.error('Error creating master data:', error);
      throw error;
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateMasterDataDto,
  ): Promise<MasterDataResponseDto | null> {
    try {
      return await this.masterDataService.update(id, body);
    } catch (error) {
      this.logger.error(`Error updating master data ${id}:`, error);
      throw error;
    }
  }

  @Patch(':id/order')
  async updateOrder(
    @Param('id') id: string,
    @Body('order') order: number,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const success = await this.masterDataService.updateOrder(id, order);
      return { 
        success,
        message: success ? 'Order updated successfully' : 'Failed to update order'
      };
    } catch (error) {
      this.logger.error(`Error updating order for ${id}:`, error);
      throw error;
    }
  }

  // ENHANCED: API để update order cho parent items (tòa nhà)
  @Patch('parents/reorder')
  async updateParentOrders(
    @Body() orderUpdates: OrderUpdateDto[],
  ): Promise<ReorderResponse> {
    try {
      this.logger.log('Received parent reorder request:', JSON.stringify(orderUpdates));
      
      // Basic validation
      if (!Array.isArray(orderUpdates)) {
        throw new HttpException(
          'Request body must be an array of order updates',
          HttpStatus.BAD_REQUEST
        );
      }

      if (orderUpdates.length === 0) {
        throw new HttpException(
          'Order updates array cannot be empty',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate each update item structure
      for (const update of orderUpdates) {
        if (!update || typeof update !== 'object') {
          throw new HttpException(
            'Each update item must be an object',
            HttpStatus.BAD_REQUEST
          );
        }
        
        if (!update.id || typeof update.id !== 'string') {
          throw new HttpException(
            'Each update item must have a valid id (string)',
            HttpStatus.BAD_REQUEST
          );
        }
        
        if (typeof update.order !== 'number' || update.order < 1) {
          throw new HttpException(
            'Each update item must have a valid order (number >= 1)',
            HttpStatus.BAD_REQUEST
          );
        }
      }

      // Call service method
      const result = await this.masterDataService.updateParentOrders(orderUpdates);
      
      this.logger.log('Parent reorder result:', JSON.stringify(result));
      
      return result;
    } catch (error) {
      this.logger.error('Error in updateParentOrders:', error);
      
      // Re-throw HTTP exceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Convert other errors to HTTP exceptions
      throw new HttpException(
        error.message || 'Internal server error during parent reorder',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ENHANCED: API để update order cho children items (loại căn hộ)
  @Patch(':parentId/children/reorder')
  async updateChildrenOrders(
    @Param('parentId') parentId: string,
    @Body() orderUpdates: OrderUpdateDto[],
  ): Promise<ReorderResponse> {
    try {
      this.logger.log(
        `Received children reorder request for parent ${parentId}:`,
        JSON.stringify(orderUpdates)
      );
      
      // Basic validation
      if (!parentId || typeof parentId !== 'string') {
        throw new HttpException(
          'Parent ID must be a valid string',
          HttpStatus.BAD_REQUEST
        );
      }

      if (!Array.isArray(orderUpdates)) {
        throw new HttpException(
          'Request body must be an array of order updates',
          HttpStatus.BAD_REQUEST
        );
      }

      if (orderUpdates.length === 0) {
        throw new HttpException(
          'Order updates array cannot be empty',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate each update item structure
      for (const update of orderUpdates) {
        if (!update || typeof update !== 'object') {
          throw new HttpException(
            'Each update item must be an object',
            HttpStatus.BAD_REQUEST
          );
        }
        
        if (!update.id || typeof update.id !== 'string') {
          throw new HttpException(
            'Each update item must have a valid id (string)',
            HttpStatus.BAD_REQUEST
          );
        }
        
        if (typeof update.order !== 'number' || update.order < 1) {
          throw new HttpException(
            'Each update item must have a valid order (number >= 1)',
            HttpStatus.BAD_REQUEST
          );
        }
      }

      // Call service method
      const result = await this.masterDataService.updateChildrenOrders(
        parentId, 
        orderUpdates
      );
      
      this.logger.log('Children reorder result:', JSON.stringify(result));
      
      return result;
    } catch (error) {
      this.logger.error('Error in updateChildrenOrders:', error);
      
      // Re-throw HTTP exceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Convert other errors to HTTP exceptions
      throw new HttpException(
        error.message || 'Internal server error during children reorder',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const success = await this.masterDataService.delete(id);
      return { 
        success,
        message: success ? 'Item deleted successfully' : 'Failed to delete item'
      };
    } catch (error) {
      this.logger.error(`Error deleting master data ${id}:`, error);
      throw error;
    }
  }

  @Get('/:id')
  async findByType(@Param('id') id: string): Promise<MasterDataResponseDto> {
    try {
      return await this.masterDataService.findById(id);
    } catch (error) {
      this.logger.error(`Error finding master data ${id}:`, error);
      throw error;
    }
  }
}