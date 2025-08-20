import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserEntity } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub }
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Lấy token từ header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    // Kiểm tra token có match với token trong DB không
    if (!user.currentJwtToken || user.currentJwtToken !== token) {
      throw new UnauthorizedException('Token không hợp lệ. Vui lòng đăng nhập lại.');
    }
    return { 
      userId: payload.sub, 
      username: payload.username, 
      role: payload.role 
    };
  }
}