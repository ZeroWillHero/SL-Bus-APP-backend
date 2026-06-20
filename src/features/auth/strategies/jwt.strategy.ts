import { ForbiddenException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  isBanned?: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default_secret',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (payload.isBanned) {
      throw new ForbiddenException('Account is banned. Contact support.');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
