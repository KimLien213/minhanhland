import { Injectable, OnModuleInit } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Seniority, UserRole } from 'src/common/enums';

@Injectable()
export class AdminSeederService implements OnModuleInit {
  constructor(private readonly userService: UsersService) {}

  async onModuleInit() {
    const existingAdmin = await this.userService.findByUsername('admin');
    if (!existingAdmin) {
      const adminDto: CreateUserDto = {
        fullName: 'Phí Thị Kim Liên',
        username: 'admin',
        password: 'Admin@123',
        role: UserRole.ADMIN,
        seniority: Seniority.OVER_5_YEARS
      };
      await this.userService.create(adminDto);
      console.log('✅ Admin account created!');
    } else {
      console.log('ℹ️ Admin account already exists.');
    }
  }
}
