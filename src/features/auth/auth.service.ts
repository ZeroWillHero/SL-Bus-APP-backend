import { HttpStatus, Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entity/user.entity';
import { Repository } from 'typeorm';
import { AuthRequestDTO } from './dto/authRequest.dto';
import { AppError } from '../../common/exceptions/app.exception';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { AuthRegisterDTO } from './dto/auth.register.dto';
import { AuthenticatedUser } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) { }

  async login(data: AuthRequestDTO, res: Response) {
    const user = await this.userService.findByEmailOrPhone(data.username);
    // user && console.log('User found for login:', user.email); // Debug log
    if (!user) {
      console.log('No user found with username:', data.username); // Debug log
      throw new AppError(
        'Invalid username or password',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        'Invalid username or password',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user: this.userService.convertToDTO(user) };
  }

  async refresh(refreshToken: string, res: Response) {
    if (!refreshToken) {
      throw new AppError('Refresh token not found', HttpStatus.UNAUTHORIZED);
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
      ) as jwt.JwtPayload;
    } catch {
      throw new AppError(
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['userRoles', 'userRoles.role'],
    });
    if (!user) {
      throw new AppError('User not found', HttpStatus.UNAUTHORIZED);
    }

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);
    this.setRefreshCookie(res, newRefreshToken);
    return { accessToken: newAccessToken };
  }

  logout(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSite: 'lax' | 'strict' | 'none' = isProd ? 'none' : 'lax';
    const cookiePath = process.env.REFRESH_COOKIE_PATH || '/api/v1/auth/refresh';
    res.cookie('refresh_token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite,
      path: cookiePath,
      maxAge: 0,
    });
    return null;
  }

  public async register(data: AuthRequestDTO, res: Response<AuthRegisterDTO>) {
    const existingUser = await this.userRepo.findOne({
      where: [{ email: data.username }, { phone: data.username }],
    });

    if (existingUser) {
      throw new AppError(
        'User with this email or phone already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = this.userRepo.create({
      email: data.username,
      password: hashedPassword,
    });
    const savedUser = await this.userRepo.save(newUser);
    return this.userService.convertToDTO(savedUser);
  }

  public async verify(authUser: AuthenticatedUser) {
    const user = await this.userRepo.findOne({
      where: { id: authUser.userId },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user) {
      throw new AppError('User not found', HttpStatus.UNAUTHORIZED);
    }

    return this.userService.convertToDTO(user);
  }

  private setRefreshCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSite: 'lax' | 'strict' | 'none' = isProd ? 'none' : 'lax';
    const cookiePath = process.env.REFRESH_COOKIE_PATH || '/api/v1/auth/refresh';
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite,
      path: cookiePath,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  generateAccessToken(user: User): string {
    const expiresIn = (process.env.ACCESS_TOKEN_EXPIRATION ||
      '15m') as jwt.SignOptions['expiresIn'];
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.userRoles?.map((ur) => ur.role.name) ?? [],
      },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn },
    );
  }

  private generateRefreshToken(user: User): string {
    const expiresIn = (process.env.REFRESH_TOKEN_EXPIRATION ||
      '7d') as jwt.SignOptions['expiresIn'];
    return jwt.sign(
      { sub: user.id, email: user.email },
      process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
      { expiresIn },
    );
  }
}
