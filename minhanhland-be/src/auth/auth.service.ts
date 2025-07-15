import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ProductFieldPermission } from 'src/product_field_permissions/entities/product_field_permission.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { IsNull, Not, Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(ProductFieldPermission)
    private readonly productFieldPermissionRepo: Repository<ProductFieldPermission>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async validateUser(username: string, pass: string, clientIp: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Wrong password');
    
    // Kiểm tra IP - chỉ cho phép đăng nhập từ 1 thiết bị duy nhất
    if (user.lastLoginIp && user.lastLoginIp !== clientIp) {
      throw new UnauthorizedException('Tài khoản đã được đăng nhập trên thiết bị khác. Vui lòng đăng xuất khỏi thiết bị cũ trước khi đăng nhập.');
    }
    return user;
  }

  async login(user: any, clientIp: string) {
     await this.userRepo.update(user.id, {
      lastLoginIp: clientIp
    });
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
  

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);

    const permission = await this.productFieldPermissionRepo.findOne({
      where: { user: { id: userId } },
    });

    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      email: user.email,
      permissions: {
        fieldNames: permission?.fieldNames || [],
        productIds: permission?.productIds || [],
        menuIds: permission?.menuIds || [],
      },
    };
  }
  // Thêm method để logout và xóa IP
  async logout(userId: string) {
    await this.userRepo.update(userId, {
      lastLoginIp: null
    });
  }
  
async getCurrentLoginDevices() {
  // Lấy danh sách user đang đăng nhập (có IP)
  const users = await this.userRepo.find({
    where: { lastLoginIp: Not(IsNull()) },
    select: ['id', 'username', 'fullName', 'lastLoginIp']
  });
  
  return users.map(user => ({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    lastLoginIp: user.lastLoginIp
  }));
}
}
