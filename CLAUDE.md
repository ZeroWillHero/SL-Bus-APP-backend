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

Migrations live exclusively in `src/database/migrations/*.ts`. The glob in `typeorm.options.ts` points only there. Migrations are only executed on app startup when `DB_MIGRATIONS_RUN=true`. Otherwise run them explicitly.

If the DB already has the schema but `typeorm_migrations` is missing entries (e.g. after cloning onto an existing DB), fake-insert the missing rows rather than running destructive migrations:
```sql
INSERT INTO typeorm_migrations(name, timestamp) VALUES ('MigrationClassName', 1234567890000);
```

## Environment

PostgreSQL + Redis are required. Copy `.env.example` to `.env`. `ConfigModule` loads, in order: `.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, `.env` (or `.env.local`, `.env` when `NODE_ENV` is unset) — see `src/app.module.ts`. DB config is read directly from `process.env` in `src/database/typeorm.options.ts` (it does not use `ConfigService`), so env vars must be present in the process environment before TypeORM bootstraps. Redis is used for the two-tier cache (`REDIS_*` env vars; falls back to in-memory LRU). OTP TTL is controlled by `CACHE_TTL_MS`.

## Architecture

NestJS 11 + TypeORM 0.3 + PostgreSQL. Source is organised as:

- `src/main.ts` — bootstraps the Nest app, mounts Swagger at `/api/v1/swagger-ui`, enables CORS (configurable via `CORS_ORIGINS`), cookie-parser, and registers `GlobalHttpExceptionFilter` + `LoggingInterceptor` + `ResponseInterceptor` globally.
- `src/app.module.ts` — wires all feature modules, global `ConfigModule`, and applies three app-wide guards: `ThrottlerGuard` (100 req/60 s), `JwtAuthGuard`, and `RolesGuard`.
- `src/features/*` — feature modules. Each owns its `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, and `entity/`|`entities/`. Note: the database module is misspelled as `src/features/databse/`; keep imports consistent until renamed.
- `src/database/` — TypeORM `DataSource` for the CLI (`typeorm.datasource.ts`), shared `typeorm.options.ts` factory, and migrations under `src/database/migrations/*.ts`. Entities are auto-discovered via `**/*.entity.{ts,js}` — no manual registration needed.
- `src/common/` — `GlobalHttpExceptionFilter`, `LoggingInterceptor`, `ResponseInterceptor`, `AppError`, `JwtAuthGuard`, `RolesGuard`, `@Public()` decorator, `@Roles()` decorator, and `CacheModule` setup.
- `src/utils/` — shared DTOs (`ResponseDTO`, `PaginationDto`, `PageResponseDto`) and enums (`AuthType`, `UserType`).

### Feature modules overview

| Module | Key responsibility |
|---|---|
| `auth` | Login (bcrypt + OTP 2FA), JWT access/refresh tokens, register, `/verify` endpoint |
| `user` | Core user CRUD; `findByEmailOrPhone` used by auth; owns `convertToDTO` |
| `conductor` | Conductor profile (license, docs); 1:1 with User; created by BusOwner flow |
| `customer` | Customer profile; 1:1 with User |
| `bus-owner` | Bus owner profile (NIC); 1:1 with User; owns buses and routes |
| `roles` | RBAC role definitions |
| `user-roles` | Junction table assigning roles to users |
| `bus` | Bus registration, approval workflow (PENDING/APPROVED/REJECTED), seat layout (JSONB), documents; also owns `AssignmentService` |
| `route` | Route definitions (origin, destination, via-stops JSONB, distance, duration); owned by BusOwner; nullable FK to Bus for direct assignment |
| `schedule` | Recurring trip: Bus + Route + departureTime + `operatingDays` bitmask (Sun=bit0…Sat=bit6) + baseFare |
| `booking` | Seat selection, BookedSeat records, fare + coupon calculation, status lifecycle, QR ticket generation |
| `payment` | Payment record linked 1:1 to Booking |
| `coupon` | Discount codes (PERCENTAGE/FIXED_AMOUNT), usage limits, per-user caps, validity window |
| `search` | Trip search filtered by origin/destination/date using the schedule bitmask |
| `otp` | 6-digit OTP gen, SMS delivery via `sms` module, cache-based verification |
| `sms` | SMS gateway integration (used exclusively by `otp`) |
| `trip-availability` | Seat availability checks across schedules and dates |
| `admin` | Admin utilities and DB seeding |

### Data model relationships

```
User ──1:1──► Conductor
User ──1:1──► Customer
User ──1:1──► BusOwner
User ──1:N──► UserRole ──N:1──► Role

BusOwner ──1:N──► Bus
BusOwner ──1:N──► Route
Bus      ──N:M──► Conductor   (via BusAssignment: busId, conductorId, isActive, assignedAt)
Bus      ──1:N──► BusDocument
Bus      ──1:N──► Schedule
Bus      ──1:N──► Route       (nullable busId FK; a route is owned by BusOwner but optionally assigned to one Bus)
Schedule ──N:1──► Route
Schedule ──1:N──► Booking
Booking  ──N:1──► Customer
Booking  ──1:N──► BookedSeat   (unique: scheduleId + tripDate + seatNumber)
Booking  ──1:1──► Payment
Booking  ──N:1──► Coupon (nullable)
Coupon   ──1:N──► CouponUsage
```

**BookedSeat** is the seat-lock record. Its unique constraint `(scheduleId, tripDate, seatNumber)` prevents double-booking. A `Booking` also stores `seatNumbers` as a JSONB array for quick retrieval.

**Schedule.operatingDays** is a smallint bitmask. To check if a schedule runs on a given JS `Date`: `(operatingDays >> date.getDay()) & 1`.

**BusAssignment** soft-deletes via `isActive` flag — never hard-deleted. Re-assigning reactivates the existing row.

**Route ownership vs assignment:** A `Route` is always owned by a `BusOwner` (auth boundary). It optionally holds a `busId` FK pointing to the specific `Bus` it serves. `POST /api/v1/buses/:id/routes/:routeId` sets that FK; `DELETE` clears it.

### Role-based access on key endpoints

| Endpoint | Admin | BusOwner | Conductor | Customer |
|---|---|---|---|---|
| `GET /api/v1/buses` | All buses | Own buses | Assigned buses | — |
| `GET /api/v1/buses/:id` | — | Own only | — | — |
| `POST /api/v1/buses` | — | ✓ | — | — |
| `POST /api/v1/buses/:id/conductors/:conductorId` | — | Own bus only | — | — |
| `GET /api/v1/conductor/me/buses` | — | — | Assigned buses | — |

### Response and error contract

Every response is normalised by `ResponseInterceptor` into `{ success, message, statusCode, data }`. The interceptor detects and passes through already-wrapped payloads, and unwraps `{ message, data }` shapes. Errors flow through `GlobalHttpExceptionFilter` and emerge as `{ success: false, message, statusCode }`. Throw `AppError(message, HttpStatus)` from services — do not return ad-hoc error objects, and do not hand-build `ResponseDTO` unless you specifically want to override auto-wrapping (the `ConductorController` does this).

### Cross-feature patterns

- **Transactions:** Open a `QueryRunner` from the injected `DataSource`, call `queryRunner.startTransaction()`, pass `queryRunner.manager` into collaborating services (services accept an optional `EntityManager`), and always `commit`/`rollback` inside try/catch/finally with `release()`. See `ConductorService.create` for the canonical example.
- **User creation flows:** `ConductorService.create` checks whether a User with the given email exists, then either attaches to it or creates User + Conductor in the same transaction.
- **Password handling:** Hashing uses bcrypt cost 10, done in `UserService.create`. `AuthService.login` compares with `bcrypt.compare`.
- **Login flow:** Login requires username + password + OTP (2FA). The OTP must be sent to the user's phone first via `POST /api/v1/otp/send`, then included in the login payload. `AuthService.login` verifies the OTP before checking the password.
- **Roles in JWT:** `AuthService.generateAccessToken` embeds `roles: user.userRoles?.map(ur => ur.role.name)`. `findByEmailOrPhone` must load `relations: ['userRoles', 'userRoles.role']` for this to work.
- **DTO boundaries:** Services return DTOs (never raw entities). Conversion helpers (`convertToDTO`, `convertToEntity`) live on the services that own the entity.
- **Auth guards:** `@Public()` bypasses `JwtAuthGuard`. `@Roles('RoleName')` enforces role via `RolesGuard` (reads `req.user.roles` string array set by JWT strategy). Apply `@Roles` per-method when different methods on the same controller need different roles.
- **Circular dependencies:** Several modules form circular import chains (`BusModule ↔ ConductorModule ↔ ScheduleModule`). Resolve with `forwardRef()` on **both** sides: the module `imports` array and the provider constructor injection (`@Inject(forwardRef(() => Service))`). Omitting either side causes a runtime `UndefinedModuleException`.
- **Relation loading for toDto():** When a service's `toDto()` maps nested relations (e.g. `bus.schedules`, `bus.routes`), the find call must explicitly list those relation paths. Omitting them returns `undefined` even if the entity has the `@OneToMany` decorator. Also, `@ManyToOne` decorators must include the inverse reference `(entity) => entity.collection` for bidirectional loading to work.

### Swagger

Available at `/api/v1/swagger-ui` when the app is running. Bearer auth is pre-configured. Decorate controllers with `@ApiTags` and DTO fields with `@ApiProperty`.

## Testing notes

Jest config is inline in `package.json` with `rootDir: "src"` and pattern `.*\.spec\.ts$`. E2E tests live under `test/` and use `test/jest-e2e.json`. There is also a Python-based real-world API test at `docs/api_real_world_test.py` that hits a running server — it is not part of `npm test`.
