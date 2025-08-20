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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(
      body.username,
      body.password
    );
    return this.authService.login(user);
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
    if (req.user.role !== 'ADMIN') {
      throw new UnauthorizedException(
        'Chỉ admin mới có thể thực hiện thao tác này',
      );
    }

    await this.authService.logout(userId);
    return { message: 'Đã đăng xuất người dùng khỏi thiết bị' };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req) {
    const userId = req.user.userId;
    await this.authService.logout(userId);
    return { message: 'Đăng xuất thành công' };
  }
}