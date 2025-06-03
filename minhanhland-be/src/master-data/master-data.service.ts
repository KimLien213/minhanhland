// src/master-data/master-data.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { CreateMasterDataDto } from './dto/create-master-data.dto';
import { UpdateMasterDataDto } from './dto/update-master-data.dto';
import { MasterDataResponseDto } from './dto/master-data-response.dto';
import { MasterDataRepository } from './repositories/master-data.repository';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { MasterDataType } from 'src/common/enums';

@Injectable()
export class MasterDataService {
  constructor(private readonly masterDataRepository: MasterDataRepository) {}

  async findAll(dto: PaginationDto) {
    return this.masterDataRepository.findAll(dto);
  }

  async findAllNoPaging(type: MasterDataType) {
    return this.masterDataRepository.findAllNoPaging(type);
  }

  async create(data: CreateMasterDataDto): Promise<MasterDataResponseDto> {
    // Get the next order value
    const maxOrder = await this.masterDataRepository.getMaxOrder(data.parentId);
    
    const entity = await this.masterDataRepository.createMasterData({
      ...data,
      type: data.parentId ? MasterDataType.LOAI_CAN_HO : MasterDataType.TOA_NHA,
      order: maxOrder + 1
    });
    return new MasterDataResponseDto(entity);
  }

  async update(
    id: string,
    data: UpdateMasterDataDto,
  ): Promise<MasterDataResponseDto | null> {
    const entity = await this.masterDataRepository.updateMasterData(id, data);
    return entity ? new MasterDataResponseDto(entity) : null;
  }

  async updateOrder(id: string, newOrder: number): Promise<boolean> {
    return this.masterDataRepository.updateOrder(id, newOrder);
  }

  async delete(id: number): Promise<boolean> {
    return this.masterDataRepository.deleteMasterData(id);
  }

  async findById(id: string): Promise<MasterDataResponseDto> {
    const item = await this.masterDataRepository.findById(id);
    return new MasterDataResponseDto(item);
  }
}