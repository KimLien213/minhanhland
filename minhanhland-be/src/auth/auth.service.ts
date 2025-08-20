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

  async validateUser(username: string, pass: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Wrong password');
    
    // Kiểm tra nếu đã có token active (single device login)
    if (user.currentJwtToken) {
      try {
        // Verify token cũ có còn valid không
        this.jwtService.verify(user.currentJwtToken);
        
        // Nếu token còn valid, từ chối login (single session)
        throw new UnauthorizedException(
          'Tài khoản đã được đăng nhập trên thiết bị hoặc trình duyệt khác. Vui lòng đăng xuất và thử lại.'
        );
      } catch (error) {
        // Token hết hạn hoặc invalid, cho phép login mới
        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
          console.log('Previous token expired or invalid, allowing new login');
        } else {
          // Re-throw nếu là lỗi UnauthorizedException
          throw error;
        }
      }
    }
    
    return user;
  }

  async login(user: any) {
    const payload = { 
      sub: user.id, 
      username: user.username, 
      role: user.role,
      loginTime: Date.now()
    };
    
    // Tạo JWT token mới
    const jwtToken = this.jwtService.sign(payload);
    
    // Lưu JWT token vào database
    await this.userRepo.update(user.id, {
      currentJwtToken: jwtToken,
      loginTime: new Date()
    });
    
    return {
      access_token: jwtToken,
    };
  }

  async logout(userId: string) {
    await this.userRepo.update(userId, {
      currentJwtToken: null,
      loginTime: null
    });
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
}
