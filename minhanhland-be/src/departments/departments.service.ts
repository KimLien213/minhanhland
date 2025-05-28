// src/departments/departments.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentEntity } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { paginate } from 'src/common/pagination/pagination.helper';
import { UserEntity } from 'src/users/entities/user.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly departmentRepo: Repository<DepartmentEntity>,
  ) { }

  async findAll() {
    const query = this.departmentRepo.createQueryBuilder('department')
      .leftJoinAndSelect('department.head', 'head');

    return query.getMany();
  }
  async paginate(dto: PaginationDto) {
    const query = this.departmentRepo.createQueryBuilder('department')
      .leftJoinAndSelect('department.head', 'head');

    return paginate(query, dto, ['department.name', 'department.description', 'head.fullName']);
  }

  async findById(id: string) {
    const department = await this.departmentRepo.findOne({
      where: { id },
      relations: ['head'],
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const exists = await this.departmentRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new BadRequestException('Department name already exists');

    const department = this.departmentRepo.create({ ...dto, head: {id: dto.headId}});
    return this.departmentRepo.save(department);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const department = await this.findById(id);

    if (dto.name && dto.name !== department.name) {
      const exists = await this.departmentRepo.findOne({ where: { name: dto.name } });
      if (exists) throw new BadRequestException('Department name already exists');
    }

    Object.assign(department, dto);
    let head = new UserEntity();
    head.id = dto.headId;
    department.head = head;
    return this.departmentRepo.save(department);
  }

  async remove(id: string) {
    const department = await this.findById(id);
    await this.departmentRepo.softRemove(department);
  }
}