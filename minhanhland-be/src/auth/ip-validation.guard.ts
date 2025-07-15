import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class IpValidationGuard implements CanActivate {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Để JWT Guard xử lý
    }

    // Lấy IP hiện tại
    const currentIp = this.getClientIp(request);
    
    // Lấy thông tin user từ database
    const userEntity = await this.userRepo.findOne({
      where: { id: user.userId }
    });

    if (!userEntity) {
      throw new UnauthorizedException('User not found');
    }

    // Kiểm tra IP
    if (!userEntity.lastLoginIp) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại để cập nhật bảo mật.');
    }

    if (userEntity.lastLoginIp !== currentIp) {
      // Xóa IP khỏi database để bắt buộc login lại
      await this.userRepo.update(userEntity.id, { lastLoginIp: null });
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ do thay đổi IP. Vui lòng đăng nhập lại.');
    }

    return true;
  }

  private getClientIp(req: any): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      '127.0.0.1'
    ).split(',')[0].trim();
  }
}