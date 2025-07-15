import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request) {
    // Lấy IP từ request
    const clientIp = this.getClientIp(req);

    const user = await this.authService.validateUser(
      body.username,
      body.password,
      clientIp,
    );
    return this.authService.login(user, clientIp);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req) {
    const userId = req.user.userId;
    return this.authService.getMe(userId);
  }

  @Post('force-logout/:userId')
  @UseGuards(AuthGuard('jwt'))
  async forceLogout(@Req() req, @Param('userId') userId: string) {
    // Chỉ admin mới có thể force logout user khác
    if (req.user.role !== 'ADMIN') {
      throw new UnauthorizedException(
        'Chỉ admin mới có thể thực hiện thao tác này',
      );
    }

    await this.authService.logout(userId);
    return { message: 'Đã đăng xuất người dùng khỏi thiết bị' };
  }

  @Get('active-sessions')
  @UseGuards(AuthGuard('jwt'))
  async getActiveSessions(@Req() req) {
    if (req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('Chỉ admin mới có thể xem thông tin này');
    }

    return this.authService.getCurrentLoginDevices();
  }

  
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req) {
    const userId = req.user.userId;
    await this.authService.logout(userId);
    return { message: 'Đăng xuất thành công' };
  }
  
  private getClientIp(req: any): string {
  return (
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  ).split(',')[0].trim();
}
}
