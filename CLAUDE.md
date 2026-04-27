# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run in watch mode for development
npm run start:dev

# Production build and start
npm run build
npm run start:prod

# Lint (auto-fixes) and format
npm run lint
npm run format

# Tests
npm run test                 # unit tests (jest, rootDir=src, *.spec.ts)
npm run test:watch
npm run test:cov
npm run test:e2e             # uses test/jest-e2e.json

# Run a single test file
npx jest src/features/user/user.service.spec.ts

# TypeORM migrations (datasource: src/database/typeorm.datasource.ts)
npm run migration:generate --name=SomeName   # diff entities vs DB
npm run migration:create   --name=SomeName   # blank migration
npm run migration:run
npm run migration:revert
```

Migrations are only executed on app startup when `DB_MIGRATIONS_RUN=true`. Otherwise run them explicitly.

## Environment

PostgreSQL is required. Copy `.env.example` to `.env`. `ConfigModule` loads, in order: `.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, `.env` (or `.env.local`, `.env` when `NODE_ENV` is unset) — see `src/app.module.ts`. DB config is read directly from `process.env` in `src/database/typeorm.options.ts` (it does not use `ConfigService`), so env vars must be present in the process environment before TypeORM bootstraps.

## Architecture

NestJS 11 + TypeORM 0.3 + PostgreSQL. Source is organised as:

- `src/main.ts` — bootstraps the Nest app, mounts Swagger at `api/v1/swagger-ui`, and registers `GlobalHttpExceptionFilter` + `LoggingInterceptor` + `ResponseInterceptor` globally.
- `src/app.module.ts` — wires feature modules and global `ConfigModule`.
- `src/features/*` — feature modules (`auth`, `user`, `conductor`, `roles`, `databse`). Each feature owns its `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, and `entity/`|`entities/`. Note: the database module lives at `src/features/databse/databse.module.ts` (misspelled); keep imports consistent until renamed.
- `src/database/` — TypeORM `DataSource` for the CLI, shared `typeorm.options.ts` factory, and timestamp-prefixed migration files at both `src/database/*-migrations.ts` and `src/database/migrations/*.ts`. Entities are auto-discovered via the glob `**/*.entity.{ts,js}`, so new entities do not need to be registered in `typeorm.options.ts`.
- `src/common/` — cross-cutting: `GlobalHttpExceptionFilter`, `LoggingInterceptor`, `ResponseInterceptor`, and `AppError` (extends `HttpException`).
- `src/utils/` — shared DTOs (`ResponseDTO`, pagination) and enums (e.g. `AuthType`).

### Response and error contract

Every response is normalised by `ResponseInterceptor` into `{ success, message, statusCode, data }`. The interceptor detects and passes through already-wrapped payloads, and unwraps `{ message, data }` shapes. Errors flow through `GlobalHttpExceptionFilter` and emerge as `{ success: false, message, statusCode }`. Throw `AppError(message, HttpStatus)` from services — do not return ad-hoc error objects, and do not hand-build the `ResponseDTO` unless you specifically want to override the auto-wrapping (the `ConductorController` does this).

### Cross-feature patterns

- **Transactions:** For multi-entity writes, open a `QueryRunner` from the injected `DataSource`, call `queryRunner.startTransaction()`, pass `queryRunner.manager` into collaborating services (e.g. `UserService.create(dto, manager?)` accepts an optional `EntityManager`), and always `commit`/`rollback` inside try/catch/finally with `release()`. See `ConductorService.create` for the canonical example.
- **User ↔ Conductor:** One-to-one, owning side on `Conductor.user` with `onDelete: 'CASCADE'`. When creating a conductor, the service first checks if the `User` exists by email and branches between "attach to existing user" vs "create user + conductor in the same transaction".
- **Password handling:** Hashing uses `bcrypt` with cost 10, done in `UserService.create`. `AuthService.login` compares with `bcrypt.compare`; JWT issuance (`generateAccessToken`/`generateRefreshToken`) is stubbed and not yet implemented.
- **DTO boundaries:** Services return DTOs (never raw entities). Conversion helpers (`convertToDTO`, `convertToEntity`) live on the services that own the entity.

### Swagger

Available at `/api/v1/swagger-ui` when the app is running. Bearer auth is pre-configured via `DocumentBuilder.addBearerAuth()`. Decorate controllers with `@ApiTags` and DTO fields with `@ApiProperty` to keep the schema useful.

## Testing notes

Jest config is inline in `package.json` with `rootDir: "src"` and pattern `.*\.spec\.ts$`. E2E tests live under `test/` and use `test/jest-e2e.json`. There is also a Python-based real-world API test at `docs/api_real_world_test.py` that hits a running server — it is not part of `npm test`.
