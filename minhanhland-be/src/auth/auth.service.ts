import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { log } from 'console';
import { ProductFieldPermission } from 'src/product_field_permissions/entities/product_field_permission.entity';
import { UsersService } from 'src/users/users.service';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(ProductFieldPermission)
    private readonly productFieldPermissionRepo: Repository<ProductFieldPermission>,
  ) { }

  async validateUser(username: string, pass: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Wrong password');

    return user;
  }

  async login(user: any) {
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
      },
    };
  }
}
