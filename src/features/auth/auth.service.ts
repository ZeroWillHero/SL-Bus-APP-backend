import { Injectable, Res } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entity/user.entity';
import { Repository } from 'typeorm';
import { AuthRequestDTO } from './dto/authRequest.dto';
import { AppError } from '../../common/exceptions/app.exception';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import type { Response } from 'express';


@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async login(data: AuthRequestDTO, res: Response) {
    const user = await this.userService.findByEmailOrPhone(data.username);
    if (!user) {
      throw new AppError('Invalid username or password', 401);
    }
    // compare password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid username or password', 401);
    }
    // issue both access and refresh tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

    return {
       accessToken,
       user : this.userService.convertToDTO(user) };
  }

  // refresh authentication 
  async refreshAuth (
    @Res({ passthrough: true }) res: Response,
    refreshToken: string,
  ) {
      const descoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',

      );

      // verify the use roles
  }

  private generateAccessToken(user: User) {
    const tokenExpiration = (process.env.ACCESS_TOKEN_EXPIRATION ||
      '15m') as jwt.SignOptions['expiresIn'];
    // generate JWT access token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.userRoles?.map((ur) => ur.role.name) || [],
      },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: tokenExpiration },
    );
    return token;
  }

  private generateRefreshToken(user: User) {
    const tokenExpiration = (process.env.REFRESH_TOKEN_EXPIRATION ||
      '7d') as jwt.SignOptions['expiresIn'];
    // generate JWT refresh token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
      { expiresIn: tokenExpiration },
    );
    return token;
  }
}
