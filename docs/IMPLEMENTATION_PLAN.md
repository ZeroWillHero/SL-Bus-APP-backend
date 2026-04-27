# Implementation Plan
## SL Bus Booking Platform — Backend API

**Date:** 2026-04-27  
**Total Phases:** 8  
**Approach:** One phase at a time; each phase is independently committable and testable.

---

## Phase Overview

| Phase | Name | Description | Depends On |
|-------|------|-------------|------------|
| 1 | Security Foundation | JWT guard, RBAC, refresh token, rate limiting | — |
| 2 | Bus Owner Module | BusOwner entity, registration, profile | Phase 1 |
| 3 | Bus & Document Management | Bus entity, document upload, admin approval | Phase 2 |
| 4 | Conductor Assignment | Link conductor to bus, ownership checks | Phase 3 |
| 5 | Routes & Schedules | Route, Schedule, TripAvailability entities | Phase 3 |
| 6 | Customer Search | Search API with filters and pagination | Phase 5 |
| 7 | Seat Booking | Seat map API, heat-map data, booking logic | Phase 6 |
| 8 | Ticket & QR Code | Ticket generation, QR code, validation endpoint | Phase 7 |

---

## Phase 1 — Security Foundation

**Goal:** Lock down all existing endpoints; nothing should be callable without a valid JWT. Complete the refresh-token flow. Add rate limiting.

### Tasks

#### 1.1 JWT Auth Guard
- Create `src/common/guards/jwt-auth.guard.ts`
  - Extends `AuthGuard('jwt')` (Passport)
  - Reads Bearer token from `Authorization` header
  - Throws `UnauthorizedException` on invalid/expired token
- Create `src/common/guards/roles.guard.ts`
  - Reads `@Roles(...)` metadata from the handler
  - Compares against `req.user.roles[]` (decoded from JWT payload)
  - Throws `ForbiddenException` if no match
- Create `src/common/decorators/roles.decorator.ts` — `@Roles(...roles: UserRoleEnum[])`
- Create `src/common/decorators/public.decorator.ts` — `@Public()` bypass marker
- Register both guards globally in `src/app.module.ts` (or `main.ts`)
- Apply `@Public()` to: `POST /auth/login`, `POST /auth/refresh`, `POST /customer/register`, `POST /bus-owner/register`, `GET /search/buses`

#### 1.2 Passport JWT Strategy
- Install: `@nestjs/passport`, `passport`, `passport-jwt`
- Create `src/features/auth/strategies/jwt.strategy.ts`
  - Validates token; extracts `{ sub, email, roles, conductorId, customerId, busOwnerId }` into `req.user`

#### 1.3 Complete Refresh Token Endpoint
- Implement `AuthService.refresh(refreshToken)`:
  - Verify token with `REFRESH_TOKEN_SECRET`
  - Lookup user; re-issue access token
  - Rotate refresh token (optional but recommended)
- Unit test: valid token → new access token; expired token → 401

#### 1.4 Logout Endpoint
- `POST /auth/logout` — clears the refresh-token cookie (set `Max-Age=0`)

#### 1.5 Rate Limiting
- Install: `@nestjs/throttler`
- Apply `ThrottlerModule.forRoot` in `app.module.ts` (100 req/min global)
- Add `@Throttle({ default: { limit: 10, ttl: 60000 } })` to `POST /auth/login`

#### 1.6 User Controller Endpoints
- Add `GET /user/me`, `PATCH /user/me` to the existing (empty) `UserController`
- Protect with `@UseGuards(JwtAuthGuard)` (or rely on global guard)

### Acceptance Criteria
- [ ] `GET /api/v1/conductor` without token returns 401
- [ ] `POST /auth/login` with valid creds returns access token + httpOnly cookie
- [ ] `POST /auth/refresh` with valid cookie returns new access token
- [ ] `POST /auth/login` > 10 times/min returns 429

### Files to Create / Modify
```
src/common/guards/jwt-auth.guard.ts          NEW
src/common/guards/roles.guard.ts             NEW
src/common/decorators/roles.decorator.ts     NEW
src/common/decorators/public.decorator.ts    NEW
src/features/auth/strategies/jwt.strategy.ts NEW
src/features/auth/auth.service.ts            MODIFY (refresh, logout)
src/features/auth/auth.controller.ts         MODIFY (refresh, logout endpoints)
src/features/user/user.controller.ts         MODIFY (add me endpoints)
src/app.module.ts                            MODIFY (global guards, throttler)
package.json                                 MODIFY (add deps)
```

---

## Phase 2 — Bus Owner Module

**Goal:** Allow visitors to self-register as a Bus Owner. Owner gets their own profile entity linked to User.

### Tasks

#### 2.1 BusOwner Entity & Migration
- Create `src/features/bus-owner/entities/bus-owner.entity.ts`
  ```
  id, firstName, lastName, contactNumber, nicNumber (UNIQUE), address, userId (FK UNIQUE)
  ```
- Add 1:1 relation back to `User` entity
- Generate migration: `npm run migration:generate --name=AddBusOwner`

#### 2.2 BusOwner Module Scaffold
- `bus-owner.module.ts`, `bus-owner.service.ts`, `bus-owner.controller.ts`
- DTOs: `CreateBusOwnerDto`, `UpdateBusOwnerDto`, `BusOwnerDto`

#### 2.3 Registration Endpoint
- `POST /api/v1/bus-owner/register` — `@Public()`
- Same transaction pattern as conductor/customer: create User + BusOwner in a QueryRunner
- Auto-assign `BusOwner` role (ensure the role seed exists)
- Validate NIC uniqueness, email uniqueness

#### 2.4 Profile Endpoints
- `GET /api/v1/bus-owner/me` — returns own BusOwner profile
- `PATCH /api/v1/bus-owner/me` — update firstName, lastName, contactNumber, address

#### 2.5 Admin List Endpoint
- `GET /api/v1/admin/bus-owners` — `@Roles(Admin)` — paginated list

### Acceptance Criteria
- [ ] `POST /bus-owner/register` creates User + BusOwner in one transaction; rolls back on failure
- [ ] Duplicate NIC returns 409
- [ ] `GET /bus-owner/me` as BusOwner returns profile; as Customer returns 403

### Files to Create / Modify
```
src/features/bus-owner/                      NEW MODULE
  entities/bus-owner.entity.ts
  bus-owner.module.ts
  bus-owner.service.ts
  bus-owner.controller.ts
  dto/create-bus-owner.dto.ts
  dto/update-bus-owner.dto.ts
  dto/bus-owner.dto.ts
src/features/user/entity/user.entity.ts      MODIFY (add busOwner relation)
src/database/migrations/<ts>-AddBusOwner.ts  NEW
src/app.module.ts                            MODIFY (import BusOwnerModule)
```

---

## Phase 3 — Bus & Document Management + Admin Approval

**Goal:** Bus Owner can register buses with documents. Admin can approve or reject.

### Tasks

#### 3.1 Bus Entity & Migration
- `src/features/bus/entities/bus.entity.ts`
  ```
  id, registrationNumber (UNIQUE), model, year, totalSeats,
  seatLayoutJson (JSONB), approvalStatus (enum), rejectionReason, ownerId (FK)
  ```
- `ApprovalStatus` enum: `PENDING | APPROVED | REJECTED`
- Generate migration

#### 3.2 BusDocument Entity & Migration
- `src/features/bus/entities/bus-document.entity.ts`
  ```
  id, busId (FK), documentType (enum: RC|INSURANCE|FITNESS|OTHER),
  fileData (TEXT base64), uploadedAt, verifiedAt, verifiedByAdminId (FK nullable)
  ```
- Generate migration

#### 3.3 Bus Module Scaffold
- Service, controller, DTOs

#### 3.4 Bus CRUD Endpoints (BusOwner)
- `POST /api/v1/buses` — create bus; status = PENDING; `@Roles(BusOwner)`
- `GET /api/v1/buses` — list own buses (paginated, filterable by status)
- `GET /api/v1/buses/:id` — get single bus (ownership check)
- `PATCH /api/v1/buses/:id` — update (only if PENDING or REJECTED)

#### 3.5 Document Upload
- `POST /api/v1/buses/:id/documents` — upload one document (base64 body or multipart)
- `GET /api/v1/buses/:id/documents` — list documents (metadata only, no fileData in list)
- `GET /api/v1/buses/:id/documents/:docId` — get document with fileData

#### 3.6 Admin Approval Endpoints
- `GET /api/v1/admin/buses?status=PENDING` — list all buses for review
- `POST /api/v1/admin/buses/:id/approve` — set status = APPROVED
- `POST /api/v1/admin/buses/:id/reject` — body `{ reason }` → set status = REJECTED, save reason

### Acceptance Criteria
- [ ] New bus defaults to PENDING; owner cannot edit an APPROVED bus's core fields
- [ ] Admin approve sets `approvalStatus = APPROVED`; admin reject requires non-empty reason
- [ ] Non-owner BusOwner cannot see another owner's bus
- [ ] Document fileData not returned in list endpoint

### Files to Create / Modify
```
src/features/bus/                            NEW MODULE
  entities/bus.entity.ts
  entities/bus-document.entity.ts
  enums/approval-status.enum.ts
  bus.module.ts
  bus.service.ts
  bus.controller.ts
  dto/...
src/features/admin/                          NEW MODULE (admin-specific endpoints)
  admin.module.ts
  admin.controller.ts
  admin.service.ts
src/database/migrations/<ts>-AddBus.ts      NEW
src/database/migrations/<ts>-AddBusDocument.ts NEW
```

---

## Phase 4 — Conductor Assignment

**Goal:** Bus Owner assigns a created conductor to one of their approved buses. Conductor can toggle bus availability for a specific date.

### Tasks

#### 4.1 BusAssignment Entity & Migration
- `src/features/bus/entities/bus-assignment.entity.ts`
  ```
  id, busId, conductorId, assignedAt, isActive UNIQUE(busId, conductorId)
  ```

#### 4.2 Assignment Endpoints
- `POST /api/v1/buses/:busId/conductors/:conductorId` — `@Roles(BusOwner)`
  - Verify bus belongs to owner; verify conductor exists
  - Insert BusAssignment record
- `DELETE /api/v1/buses/:busId/conductors/:conductorId` — `@Roles(BusOwner)` — set isActive=false

#### 4.3 TripAvailability Entity & Migration
- `src/features/schedule/entities/trip-availability.entity.ts`
  ```
  id, scheduleId, tripDate, isAvailable DEFAULT true, setBy (FK → User), updatedAt
  UNIQUE(scheduleId, tripDate)
  ```

#### 4.4 Availability Toggle Endpoint
- `PATCH /api/v1/buses/:busId/availability` — `@Roles(Conductor)`
  - Body: `{ scheduleId, date, isAvailable }`
  - Verify caller is assigned to this bus
  - Upsert TripAvailability record

#### 4.5 Conductor: View Trip Bookings
- `GET /api/v1/conductor/trips/:scheduleId/:date/bookings` — `@Roles(Conductor)`
  - Verify conductor is assigned to the bus of this schedule
  - Return list of bookings for the trip

### Acceptance Criteria
- [ ] Conductor cannot toggle availability for a bus they are not assigned to
- [ ] BusOwner cannot assign a conductor to a bus they don't own
- [ ] Availability defaults to true if no TripAvailability record exists

---

## Phase 5 — Routes & Schedules

**Goal:** Bus Owner defines routes and creates recurring schedules (departure time + operating days + fare).

### Tasks

#### 5.1 Route Entity & Migration
```
id, origin, destination, viaStops (JSONB), distanceKm, estimatedDurationMin, ownerId, isActive
```

#### 5.2 Schedule Entity & Migration
```
id, busId, routeId, departureTime (TIME), operatingDays (SMALLINT bitmask),
baseFare (DECIMAL), isActive, createdAt
```

**operatingDays bitmask:** bit 0 = Sunday, bit 1 = Monday, … bit 6 = Saturday

#### 5.3 Route Endpoints (BusOwner)
- `POST /api/v1/routes` — create route (ownership: owner can only create for themselves)
- `GET /api/v1/routes` — list own routes
- `PATCH /api/v1/routes/:id` — update; `DELETE /api/v1/routes/:id` — deactivate

#### 5.4 Schedule Endpoints (BusOwner)
- `POST /api/v1/schedules` — body: `{ busId, routeId, departureTime, operatingDays, baseFare }`
  - Validate bus is APPROVED and owned by caller
  - Validate route is owned by caller
- `GET /api/v1/schedules` — list with filters (busId, routeId, isActive)
- `PATCH /api/v1/schedules/:id` — update fare/time/days
- `DELETE /api/v1/schedules/:id` — set isActive=false

### Acceptance Criteria
- [ ] Schedule cannot be created for a PENDING or REJECTED bus
- [ ] operatingDays bitmask: schedule with `0b0111110` (Mon–Fri) does not appear in search on Sunday
- [ ] Deactivated schedule does not appear in search

---

## Phase 6 — Customer Search

**Goal:** Public endpoint that accepts origin, destination, date and returns matching, available trips.

### Tasks

#### 6.1 Search Service Logic
- `SearchService.findBuses({ origin, destination, date })`
  - Convert date to day-of-week bit
  - Query: join Schedule → Route → Bus → BusOwner
    - `route.origin ILIKE :origin AND route.destination ILIKE :destination`
    - `schedule.isActive = true AND bus.approvalStatus = APPROVED`
    - `schedule.operatingDays & dayBit != 0`
    - LEFT JOIN TripAvailability; exclude where `isAvailable = false` for that date
  - Map to `SearchResultDto` (busId, operator name, route, departureTime, estimatedArrival, availableSeats, fare)
  - `availableSeats` = `bus.totalSeats` − count of CONFIRMED BookedSeats for (scheduleId, date)

#### 6.2 Search Endpoint
- `GET /api/v1/search/buses?origin=Colombo&destination=Kandy&date=2026-05-01&page=1&limit=20`
- `@Public()` — no auth required
- Sort by `departureTime ASC` by default; accept `sort=fare_asc|fare_desc|time_asc`

### Acceptance Criteria
- [ ] Returns only APPROVED, active-scheduled, available buses for the given date
- [ ] `availableSeats` decrements correctly as bookings are made
- [ ] Pagination meta (total, page, limit, pages) in response

---

## Phase 7 — Seat Booking

**Goal:** Authenticated customer views seat map (heat map data), books one or more seats atomically.

### Tasks

#### 7.1 BookedSeat Entity & Migration
```
id, scheduleId, tripDate, seatNumber (VARCHAR), bookingId (FK)
UNIQUE(scheduleId, tripDate, seatNumber)
```

#### 7.2 Booking Entity & Migration
```
id, customerId, scheduleId, tripDate, seatNumbers (JSONB),
totalFare, status (CONFIRMED|CANCELLED|BOARDED), bookedAt, cancelledAt
```

#### 7.3 Seat Map Endpoint
- `GET /api/v1/trips/:scheduleId/:date/seats` — `@Roles(Customer)` (or Bearer any)
- Returns:
  ```json
  {
    "rows": 10, "columns": 4,
    "seats": [
      { "seatNumber": "A1", "row": 1, "col": 1, "status": "FREE" },
      { "seatNumber": "A2", "row": 1, "col": 2, "status": "BOOKED" }
    ]
  }
  ```
- `status`: FREE | BOOKED | MINE (if caller has a CONFIRMED booking for that seat)
- Cache in Redis with 30s TTL; key: `seat-map:{scheduleId}:{date}`; invalidate on booking

#### 7.4 Book Seats Endpoint
- `POST /api/v1/bookings` — `@Roles(Customer)`
- Body: `{ scheduleId, tripDate, seatNumbers: ["A1","A2"] }`
- Transaction:
  1. Lock `BookedSeat` rows for (scheduleId, tripDate, seatNumbers) with `SELECT FOR UPDATE` or insert with unique constraint violation = 409
  2. Create `Booking` (status=CONFIRMED)
  3. Insert `BookedSeat` rows (one per seat)
  4. Invalidate Redis seat-map cache
- On success: return Booking + trigger ticket generation (Phase 8)

#### 7.5 Cancel Booking
- `POST /api/v1/bookings/:id/cancel` — `@Roles(Customer)`
- Verify booking belongs to caller
- Verify trip date is in the future (enforce configurable cutoff, e.g. 1h before departure)
- Set `booking.status = CANCELLED`, `booking.cancelledAt = now()`
- Delete corresponding `BookedSeat` rows
- Invalidate seat-map cache

#### 7.6 List Bookings
- `GET /api/v1/bookings?status=CONFIRMED&upcoming=true` — `@Roles(Customer)`
- Paginated; filter by status, upcoming/past

### Acceptance Criteria
- [ ] Two concurrent requests for the same seat: exactly one succeeds, the other gets 409
- [ ] Cancelled booking frees the seat in the seat map immediately
- [ ] Seat map MINE status shows correctly for the authenticated caller

---

## Phase 8 — Ticket & QR Code Generation

**Goal:** On booking confirmation, generate a signed QR code. Conductor can validate tickets at boarding.

### Tasks

#### 8.1 Install `qrcode` Package
```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

#### 8.2 Ticket Entity & Migration
```
id, bookingId (FK UNIQUE), qrPayload (TEXT), qrCodePng (TEXT base64),
hmacSignature (VARCHAR), issuedAt
```

#### 8.3 Ticket Service
- `TicketService.generateForBooking(booking)`:
  1. Build payload object: `{ ticketId, bookingId, customerId, busReg, origin, destination, tripDate, seatNumbers, totalFare, issuedAt }`
  2. Stringify → HMAC-SHA256 with `QR_SECRET` → append `.{signature}`
  3. `qrcode.toDataURL(signedPayload)` → strip `data:image/png;base64,` prefix
  4. Save `Ticket` record
- Call `generateForBooking` inside the booking transaction (Phase 7.4)

#### 8.4 Get Ticket Endpoint
- `GET /api/v1/tickets/:bookingId` — `@Roles(Customer)`
- Verify booking belongs to caller
- Return `{ ticket: { id, qrCodePng, issuedAt, booking: {...} } }`

#### 8.5 Validate Ticket Endpoint
- `POST /api/v1/tickets/validate` — `@Roles(Conductor)`
- Body: `{ qrPayload: "<signed-payload-string>" }`
- Verify conductor is assigned to the bus in the payload
- Split payload at last `.`; recompute HMAC; compare (constant-time)
- Check booking status: if CANCELLED → 422; if BOARDED → 200 (idempotent); if CONFIRMED → set BOARDED → 200
- Return `{ valid: true, booking: { ... } }` or error

#### 8.6 QR_SECRET Env Var
- Add to `.env.example`: `QR_SECRET=change_me_in_production`
- Validate presence on app startup (add to ConfigModule validation schema)

### Acceptance Criteria
- [ ] Booked ticket has a non-null `qrCodePng` (valid base64 PNG)
- [ ] Tampered QR payload (changed seatNumber) fails validation with 422
- [ ] Conductor on a different bus cannot validate a ticket for another bus
- [ ] Double-scan of already-BOARDED ticket returns 200 (not error)

---

## Cross-Cutting Tasks (Apply Throughout All Phases)

| Task | When |
|------|------|
| Add `@ApiTags`, `@ApiOperation`, `@ApiProperty` to every new controller/DTO | Each phase |
| Write unit tests for every new service method | Each phase |
| Write at least one e2e test per controller | Each phase |
| Generate and commit a TypeORM migration for every new entity | Each phase |
| Add new role seed data to migration or seeder if role doesn't exist | Phase 1 |

---

## Suggested Phase Order & Effort Estimate

| Phase | Estimated Effort | Key Risk |
|-------|-----------------|----------|
| 1 — Security Foundation | 1–2 days | Guards breaking existing endpoints |
| 2 — Bus Owner Module | 0.5 day | Role seed missing |
| 3 — Bus & Documents | 1 day | Large base64 documents in DB |
| 4 — Conductor Assignment | 0.5 day | Authorization checks |
| 5 — Routes & Schedules | 1 day | operatingDays bitmask logic |
| 6 — Customer Search | 1 day | Complex join query + caching |
| 7 — Seat Booking | 2 days | Concurrency / double-booking |
| 8 — Ticket & QR | 1 day | HMAC signing correctness |

**Total estimated:** ~8–10 developer days

---

*End of Implementation Plan v1.0*
