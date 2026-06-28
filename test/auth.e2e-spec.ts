/**
 * Auth integration test.
 *
 * Bootstraps the NestJS HTTP pipeline (controller → guard → interceptor → service)
 * with all external I/O (TypeORM, Redis, SMS gateway) replaced by in-memory doubles,
 * then exercises the auth endpoints via supertest.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import * as bcrypt from 'bcrypt';

import { AuthModule } from '../src/features/auth/auth.module';
import { User } from '../src/features/user/entity/user.entity';
import { GlobalHttpExceptionFilter } from '../src/common/filters/global-http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// ─── Mock factory helpers ──────────────────────────────────────────────────────

const makeUserRepo = (user?: Partial<User>) => ({
  findOne: jest.fn().mockResolvedValue(user ?? null),
  create: jest.fn().mockImplementation((data) => data),
  save: jest
    .fn()
    .mockImplementation(async (data) => ({ id: 'new-uuid', ...data })),
});

const makeCacheManager = (stored?: string) => ({
  get: jest.fn().mockResolvedValue(stored ?? null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

async function buildApp(
  userRepo: ReturnType<typeof makeUserRepo>,
  cacheManager: ReturnType<typeof makeCacheManager>,
): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AuthModule],
  })
    .overrideProvider(getRepositoryToken(User))
    .useValue(userRepo)
    .overrideProvider(CACHE_MANAGER)
    .useValue(cacheManager)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.use(cookieParser());
  await app.init();
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Auth endpoints (integration)', () => {
  let app: INestApplication;
  let hashedPassword: string;

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash('Password123!', 10);
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ── POST /api/v1/auth/register ──────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('201 – creates a new user when email is not taken', async () => {
      const userRepo = makeUserRepo(undefined);
      const cache = makeCacheManager();
      app = await buildApp(userRepo, cache);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'newuser@example.com',
          password: 'Password123!',
          otp: '',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('400 – rejects when email is already registered', async () => {
      const existingUser: Partial<User> = {
        id: 'existing-uuid',
        email: 'taken@example.com',
        password: hashedPassword,
        isVerified: true,
        isBanned: false,
      };
      const userRepo = makeUserRepo(existingUser as User);
      const cache = makeCacheManager();
      app = await buildApp(userRepo, cache);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'taken@example.com',
          password: 'Password123!',
          otp: '',
        })
        .expect(400);
    });
  });

  // ── POST /api/v1/auth/login ─────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('401 – rejects when user does not exist', async () => {
      const userRepo = makeUserRepo(undefined);
      const cache = makeCacheManager();
      app = await buildApp(userRepo, cache);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'nobody@example.com', password: 'pw', otp: '123456' })
        .expect(401);
    });

    it('403 – rejects when OTP is missing/wrong', async () => {
      const user: Partial<User> = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '+94771234567',
        password: hashedPassword,
        isVerified: true,
        isBanned: false,
        userRoles: [],
      };
      const userRepo = makeUserRepo(user as User);
      // OTP not in cache → verify throws → login throws 403
      const cache = makeCacheManager(undefined);
      app = await buildApp(userRepo, cache);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'test@example.com',
          password: 'Password123!',
          otp: 'wrong',
        })
        .expect(403);
    });

    it('401 – rejects when password is incorrect (OTP valid)', async () => {
      const user: Partial<User> = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '+94771234567',
        password: hashedPassword,
        isVerified: true,
        isBanned: false,
        userRoles: [],
      };
      const userRepo = makeUserRepo(user as User);
      const cache = makeCacheManager('123456'); // OTP in cache
      app = await buildApp(userRepo, cache);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'test@example.com',
          password: 'WrongPassword!',
          otp: '123456',
        })
        .expect(401);
    });

    it('200 – returns accessToken and sets refresh cookie on success', async () => {
      const user: Partial<User> = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '+94771234567',
        password: hashedPassword,
        isVerified: true,
        isBanned: false,
        userRoles: [{ role: { name: 'Customer' } } as any],
      };
      const userRepo = makeUserRepo(user as User);
      const cache = makeCacheManager('123456'); // valid OTP
      app = await buildApp(userRepo, cache);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'test@example.com',
          password: 'Password123!',
          otp: '123456',
        })
        .expect(200);

      expect(res.body.data?.accessToken ?? res.body.accessToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('403 – rejects when account is not verified', async () => {
      const user: Partial<User> = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '+94771234567',
        password: hashedPassword,
        isVerified: false,
        isBanned: false,
        userRoles: [],
      };
      const userRepo = makeUserRepo(user as User);
      const cache = makeCacheManager('123456');
      app = await buildApp(userRepo, cache);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'test@example.com',
          password: 'Password123!',
          otp: '123456',
        })
        .expect(403);
    });

    it('403 – rejects when account is banned', async () => {
      const user: Partial<User> = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '+94771234567',
        password: hashedPassword,
        isVerified: true,
        isBanned: true,
        userRoles: [],
      };
      const userRepo = makeUserRepo(user as User);
      const cache = makeCacheManager('123456');
      app = await buildApp(userRepo, cache);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'test@example.com',
          password: 'Password123!',
          otp: '123456',
        })
        .expect(403);
    });
  });

  // ── POST /api/v1/auth/logout ────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('200 – clears the refresh_token cookie', async () => {
      const userRepo = makeUserRepo(undefined);
      const cache = makeCacheManager();
      app = await buildApp(userRepo, cache);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(200);

      const cookies: string[] = res.headers['set-cookie'] ?? [];
      const hasExpiredCookie = cookies.some(
        (c) => c.includes('refresh_token=') && c.includes('Max-Age=0'),
      );
      expect(hasExpiredCookie).toBe(true);
    });
  });
});
