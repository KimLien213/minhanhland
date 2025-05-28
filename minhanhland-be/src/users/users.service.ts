import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { paginate } from 'src/common/pagination/pagination.helper';
import { UserQueryDto } from './dto/user-query.dto';
import * as bcrypt from 'bcrypt';
import { DepartmentEntity } from 'src/departments/entities/department.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}
  async findAllNoPaging() {
    return this.userRepo.find();
  }
  async findAll(dto: UserQueryDto) {
    const query = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.department', 'department');

    if (dto.role) {
      query.andWhere('user.role = :role', { role: dto.role });
    }
    if (dto.seniority) {
      query.andWhere('user.seniority = :seniority', {
        seniority: dto.seniority,
      });
    }
    if (dto.departmentId) {
      query.andWhere('department.id = :departmentId', {
        departmentId: dto.departmentId,
      });
    }

    return paginate(query, dto, ['user.fullName', 'user.username', 'user.email', 'department.name']);
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { username },
      relations: ['department'],
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { email },
      relations: ['department'],
    });
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['department'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existsUsername = await this.findByUsername(dto.username);
    if (existsUsername)
      throw new BadRequestException('Username already exists');

    if (dto.email) {
      const existsEmail = await this.findByEmail(dto.email);
      if (existsEmail) throw new BadRequestException('Email already exists');
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({ ...dto, department: { id: dto.departmentId }, password: hashed });
    return this.userRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findById(id);

    if (dto.username && dto.username !== user.username) {
      const exists = await this.findByUsername(dto.username);
      if (exists) throw new BadRequestException('Username already exists');
    }

    if (dto.email && dto.email !== user.email) {
      const exists = await this.findByEmail(dto.email);
      if (exists) throw new BadRequestException('Email already exists');
    }

    Object.assign(user, dto);
    let userDepartment = new DepartmentEntity();
    userDepartment.id = dto.departmentId;
    user.department = userDepartment;
    return this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepo.softRemove(user);
  }
}
