# Software Requirements Specification (SRS)
## SL Bus Booking Platform — Backend API

**Version:** 1.0  
**Date:** 2026-04-27  
**Status:** Draft  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [User Roles & Stakeholders](#3-user-roles--stakeholders)
4. [Current System State](#4-current-system-state)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Data Model](#7-data-model)
8. [API Design](#8-api-design)
9. [Security Model](#9-security-model)
10. [External Integrations](#10-external-integrations)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for the **SL Bus Booking Platform** — a multi-tenant, role-based bus booking system built as a NestJS REST API backed by PostgreSQL. It covers all functional and non-functional requirements from registration through ticket generation.

### 1.2 Scope

The platform enables:

- **Bus owners** to register, submit buses for admin approval, assign conductors, and publish route schedules.
- **Admins** to verify bus documentation and approve/reject buses.
- **Conductors** to mark buses available or unavailable on a given day.
- **Customers** to search for buses by origin/destination/date, view seat availability via a heat map, book seats, and receive QR-coded tickets.

This document covers the **backend API only**. Frontend UI implementation is out of scope.

### 1.3 Definitions

| Term | Meaning |
|------|---------|
| Bus Owner | A registered operator who owns one or more buses |
| Conductor | A person assigned to operate a specific bus on a route |
| Admin | A platform super-user who approves buses and manages the system |
| Customer | A passenger who searches and books bus seats |
| Route | A source → destination pair (e.g., Colombo → Kandy) |
| Schedule | A recurring or one-off trip on a route with departure time |
| Time Slot | A departure time window assigned to a schedule |
| Trip | One occurrence of a schedule on a given date |
| Seat Layout | The physical seat configuration of a bus (rows × columns) |
| Booking | A confirmed seat reservation for a trip |
| Ticket | A booking record with a unique QR code for boarding verification |
| QR Code | A machine-readable 2-D barcode encoding ticket data |

### 1.4 References

- NestJS 11 documentation
- TypeORM 0.3 documentation
- IATA / general seat-map conventions
- QR code standard ISO/IEC 18004

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a greenfield REST API. The current codebase provides a complete **user identity and role management foundation** (User, Conductor, Customer, Role, UserRole entities, JWT auth, bcrypt password hashing). Bus operations, scheduling, booking, and ticketing are yet to be implemented.

### 2.2 Product Feature Summary

| # | Feature | Status |
|---|---------|--------|
| F-01 | User registration (Customer, Conductor, Bus Owner) | Partial |
| F-02 | JWT authentication (login + refresh) | Partial |
| F-03 | Role-Based Access Control (RBAC) | Partial |
| F-04 | Bus Owner profile management | Not started |
| F-05 | Bus registration & document upload | Not started |
| F-06 | Admin document verification & bus approval | Not started |
| F-07 | Conductor account creation by bus owner | Partial |
| F-08 | Route management | Not started |
| F-09 | Schedule & time-slot management | Not started |
| F-10 | Conductor availability toggle | Not started |
| F-11 | Customer bus search | Not started |
| F-12 | Seat layout & heat-map data API | Not started |
| F-13 | Seat booking | Not started |
| F-14 | Ticket generation with QR code | Not started |
| F-15 | Ticket validation (scan endpoint) | Not started |

### 2.3 Operating Environment

- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 11
- **ORM:** TypeORM 0.3 with PostgreSQL 15+
- **Cache:** Redis 7 (in-memory fallback provided)
- **Deployment:** Containerized (Docker); environment config via `.env`

---

## 3. User Roles & Stakeholders

### 3.1 Roles

| Role | Description |
|------|-------------|
| `Admin` | Platform administrator. Has full system access. |
| `BusOwner` | Registered bus operator. Can manage their own buses, schedules, and conductors. |
| `Conductor` | Assigned to a specific bus. Can update availability for their bus. |
| `Customer` | End passenger. Can search buses, book seats, and retrieve tickets. |

### 3.2 Role Hierarchy for Endpoint Access

```
Admin
  └── All endpoints

BusOwner
  ├── Own profile
  ├── Own buses (CRUD + document upload)
  ├── Schedules for own buses
  └── Conductor accounts for own buses

Conductor
  ├── Own profile
  └── Availability toggle for assigned bus

Customer
  ├── Own profile
  ├── Bus search
  ├── Seat map read
  ├── Booking (own bookings)
  └── Ticket retrieval
```

---

## 4. Current System State

### 4.1 What Is Already Built

| Module | Entities | Endpoints | Notes |
|--------|----------|-----------|-------|
| User | `User` | None exposed | Service has full CRUD; controller has no routes |
| Auth | — | `POST /auth/login` | Working; refresh token stubbed |
| Conductor | `Conductor` | Full CRUD | License doc stored as base64; `isLicenseVerified` flag exists but no approval flow |
| Customer | `Customer` | Full CRUD | Address and contact stored |
| Roles | `Role` | Full CRUD | Seed data expected: Admin, BusOwner, Conductor, Customer |
| UserRoles | `UserRole` | Full CRUD + filter | Works; auto-assigned on conductor/customer create |
| Cache | — | — | Redis + in-memory hybrid; operational |
| Logging | — | — | Request/response logging with sensitive field sanitization |
| Response Wrapper | — | — | All responses normalized to `{ success, message, statusCode, data }` |

### 4.2 Critical Gaps (Must Fix First)

1. **No JWT guard** — endpoints are publicly accessible.
2. **No RBAC decorator** — role checks not enforced at route level.
3. **Refresh token not implemented** — method stubbed.
4. **User endpoints missing** — controller has no handlers.
5. **No `BusOwner` role or entity** — only Conductor and Customer profiles exist.
6. **`isVerified` on User never set** — no activation flow.

---

## 5. Functional Requirements

### 5.1 Authentication & Authorization (FR-AUTH)

| ID | Requirement |
|----|-------------|
| FR-AUTH-01 | The system shall authenticate users via email or phone + password and return a signed JWT access token (15 min) and a signed httpOnly refresh token cookie (7 days). |
| FR-AUTH-02 | The system shall validate the refresh token cookie and issue a new access token. |
| FR-AUTH-03 | The system shall reject expired or tampered tokens with HTTP 401. |
| FR-AUTH-04 | Every non-public endpoint shall require a valid Bearer token. |
| FR-AUTH-05 | Every restricted endpoint shall verify the caller's role(s) before processing the request. |
| FR-AUTH-06 | The system shall expose `POST /auth/logout` to invalidate the refresh-token cookie. |

### 5.2 User Registration (FR-USER)

| ID | Requirement |
|----|-------------|
| FR-USER-01 | A visitor shall register as a **Customer** by supplying email, password, first name, last name, and contact number. |
| FR-USER-02 | A visitor shall register as a **Bus Owner** by supplying email, password, first name, last name, contact number, NIC number, and address. |
| FR-USER-03 | The system shall hash passwords with bcrypt (cost 10) before persisting. |
| FR-USER-04 | Email and phone shall be unique across all users. |
| FR-USER-05 | On successful registration the user's `isVerified` shall be set to `false`; a future verification flow may activate it. |
| FR-USER-06 | Authenticated users shall be able to read and update their own profile. |

### 5.3 Bus Owner (FR-OWNER)

| ID | Requirement |
|----|-------------|
| FR-OWNER-01 | A Bus Owner shall be able to view their profile. |
| FR-OWNER-02 | A Bus Owner shall be able to add a new bus by providing: registration number, model, year, total seats, seat layout (rows × columns or custom map), and upload supporting documents (RC, insurance, fitness certificate). |
| FR-OWNER-03 | Each newly added bus shall have `approvalStatus = PENDING`. |
| FR-OWNER-04 | A Bus Owner shall be able to list all their buses and view individual bus details including approval status. |
| FR-OWNER-05 | A Bus Owner shall be able to update bus details and re-submit documents only if the bus is in `PENDING` or `REJECTED` status. |
| FR-OWNER-06 | A Bus Owner shall be able to create Conductor accounts (via existing conductor create flow) and assign conductors to one of their approved buses. |
| FR-OWNER-07 | A Bus Owner shall be able to define Routes for their approved buses (origin, destination, via-stops, estimated duration, distance). |
| FR-OWNER-08 | A Bus Owner shall be able to create Schedules for a route+bus combination (departure time, days of week, fare per seat). |

### 5.4 Admin (FR-ADMIN)

| ID | Requirement |
|----|-------------|
| FR-ADMIN-01 | An Admin shall be able to list all buses with status filter (`PENDING`, `APPROVED`, `REJECTED`). |
| FR-ADMIN-02 | An Admin shall be able to view a bus's submitted documents. |
| FR-ADMIN-03 | An Admin shall be able to approve a bus (`approvalStatus = APPROVED`) with an optional note. |
| FR-ADMIN-04 | An Admin shall be able to reject a bus (`approvalStatus = REJECTED`) with a mandatory rejection reason. |
| FR-ADMIN-05 | An Admin shall be able to re-review a previously rejected bus after the owner re-submits. |
| FR-ADMIN-06 | An Admin shall be able to list, create, update, and deactivate user accounts. |
| FR-ADMIN-07 | An Admin shall be able to manage roles and user-role assignments. |

### 5.5 Conductor (FR-CONDUCTOR)

| ID | Requirement |
|----|-------------|
| FR-CONDUCTOR-01 | A Conductor account shall be created by a Bus Owner (existing flow) and linked to a specific bus. |
| FR-CONDUCTOR-02 | A Conductor shall be able to mark their assigned bus as **available** or **unavailable** for a given date (trip-level toggle). |
| FR-CONDUCTOR-03 | The availability toggle shall create or update a `TripAvailability` record for (busId, scheduleId, date). |
| FR-CONDUCTOR-04 | A Conductor shall be able to view the list of bookings for their bus on a given trip date. |
| FR-CONDUCTOR-05 | A Conductor shall be able to scan/validate a ticket QR code and mark it as `BOARDED`. |

### 5.6 Bus & Route Management (FR-BUS)

| ID | Requirement |
|----|-------------|
| FR-BUS-01 | A `Bus` record shall store: id, registrationNumber, model, year, totalSeats, seatLayoutJson, approvalStatus, ownerId, createdAt, updatedAt. |
| FR-BUS-02 | A `BusDocument` record shall store: id, busId, documentType (enum: RC, INSURANCE, FITNESS), fileData (base64), uploadedAt, verifiedAt, verifiedByAdminId. |
| FR-BUS-03 | A `Route` record shall store: id, origin, destination, viaStops (JSONB), distanceKm, estimatedDurationMin, ownerId, isActive. |
| FR-BUS-04 | A `Schedule` record shall store: id, busId, routeId, departureTime, operatingDays (bitmask or JSONB), baseFare, isActive. |

### 5.7 Customer Search (FR-SEARCH)

| ID | Requirement |
|----|-------------|
| FR-SEARCH-01 | A Customer (or unauthenticated visitor) shall search for buses by: origin, destination, travel date. |
| FR-SEARCH-02 | Search results shall only include buses whose schedule matches the travel date's day-of-week, whose bus is `APPROVED`, and whose `TripAvailability` is not marked unavailable for that date. |
| FR-SEARCH-03 | Each search result shall include: busId, operator name, route, departure time, estimated arrival, available seats count, fare. |
| FR-SEARCH-04 | Results shall be sortable by departure time and fare. |
| FR-SEARCH-05 | Pagination shall be supported (default page size 20). |

### 5.8 Seat Booking (FR-BOOKING)

| ID | Requirement |
|----|-------------|
| FR-BOOKING-01 | An authenticated Customer shall be able to retrieve the seat map for a specific trip (busId, scheduleId, date), showing each seat as FREE, BOOKED, or SELECTED (own pending booking). |
| FR-BOOKING-02 | The seat map response shall be structured for heat-map rendering: `{ rows, columns, seats: [{ seatNumber, row, column, status }] }`. |
| FR-BOOKING-03 | A Customer shall be able to book one or more available seats for a trip in a single request. |
| FR-BOOKING-04 | The system shall prevent double-booking of the same seat on the same trip using a database-level unique constraint on (tripId, seatNumber) and optimistic locking or serializable transaction. |
| FR-BOOKING-05 | A `Booking` record shall store: id, customerId, busId, scheduleId, tripDate, seatNumbers (JSONB), totalFare, status (CONFIRMED, CANCELLED, BOARDED), bookedAt. |
| FR-BOOKING-06 | A Customer shall be able to cancel a booking up to a configurable cutoff time before departure; cancellation sets `status = CANCELLED` and frees the seats. |
| FR-BOOKING-07 | A Customer shall be able to list their own bookings (with filters: upcoming, past, cancelled). |

### 5.9 Ticket & QR Code (FR-TICKET)

| ID | Requirement |
|----|-------------|
| FR-TICKET-01 | On booking confirmation the system shall generate a `Ticket` record containing: ticketId, bookingId, qrPayload (JSON string), qrCodePng (base64-encoded PNG), issuedAt. |
| FR-TICKET-02 | The QR payload shall encode: `{ ticketId, bookingId, customerId, busRegistration, routeOrigin, routeDestination, tripDate, seatNumbers, totalFare, issuedAt }` signed with a server secret (HMAC-SHA256). |
| FR-TICKET-03 | The QR code PNG shall be generated server-side (library: `qrcode`). |
| FR-TICKET-04 | An authenticated Customer shall retrieve their ticket(s) by bookingId; the response shall include the base64 QR code image. |
| FR-TICKET-05 | A Conductor shall validate a ticket by submitting the raw QR payload; the system shall verify the HMAC signature, check the booking status, and return `VALID` or an error reason. |
| FR-TICKET-06 | On successful validation the booking status shall transition to `BOARDED` (idempotent — already-boarded tickets return success without error). |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-PERF-01 | Search API shall respond within 500 ms for up to 10 000 schedules in the database. |
| NFR-PERF-02 | Seat map API shall respond within 200 ms; use Redis cache with 30-second TTL; invalidate on any booking change for the trip. |
| NFR-PERF-03 | Booking API shall handle at least 50 concurrent seat-booking requests for the same trip without double-booking. |

### 6.2 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | All non-public endpoints shall require a valid JWT (Bearer). |
| NFR-SEC-02 | Role checks shall be enforced server-side; client-supplied role claims shall be ignored. |
| NFR-SEC-03 | Passwords shall never appear in API responses or logs. |
| NFR-SEC-04 | Document files (base64) shall never be exposed in list endpoints; only in single-resource endpoints with proper role authorization. |
| NFR-SEC-05 | QR payloads shall be HMAC-signed; the secret shall be stored in an env var and never hardcoded. |
| NFR-SEC-06 | Rate limiting shall be applied to login (10 req/min) and booking (20 req/min) endpoints. |

### 6.3 Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | Multi-step writes (user + profile creation, booking + ticket) shall use database transactions with rollback on failure. |
| NFR-REL-02 | The application shall start successfully even if Redis is unavailable (in-memory cache fallback). |

### 6.4 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MAINT-01 | Each new feature shall have at least one unit test (service layer) and one integration/e2e test (controller layer). |
| NFR-MAINT-02 | Every new entity shall have a corresponding TypeORM migration. |
| NFR-MAINT-03 | All public API endpoints shall be documented via Swagger (`@ApiTags`, `@ApiOperation`, `@ApiProperty`). |

---

## 7. Data Model

### 7.1 Existing Entities (retain, minor extensions)

```
User
  id            UUID PK
  email         VARCHAR UNIQUE NOT NULL
  phone         VARCHAR UNIQUE
  password      VARCHAR NOT NULL
  isVerified    BOOLEAN DEFAULT false
  createdAt     TIMESTAMP
  updatedAt     TIMESTAMP

Conductor (1:1 → User)
  id                UUID PK
  firstName         VARCHAR
  lastName          VARCHAR
  licenseNumber     VARCHAR
  licenseExpiryDate DATE
  licenseDoc        TEXT (base64)
  contactNumber     VARCHAR
  isLicenseVerified BOOLEAN DEFAULT false
  userId            UUID FK

Customer (1:1 → User)
  id            UUID PK
  firstName     VARCHAR
  lastName      VARCHAR
  contactNumber VARCHAR
  address       VARCHAR
  userId        UUID FK

Role
  id    UUID PK
  name  VARCHAR UNIQUE   -- Admin | BusOwner | Conductor | Customer

UserRole
  id        UUID PK
  userId    UUID FK
  roleId    UUID FK
  createdAt TIMESTAMP
  UNIQUE(userId, roleId)
```

### 7.2 New Entities

```
BusOwner (1:1 → User)
  id            UUID PK
  firstName     VARCHAR NOT NULL
  lastName      VARCHAR NOT NULL
  contactNumber VARCHAR NOT NULL
  nicNumber     VARCHAR UNIQUE NOT NULL
  address       TEXT NOT NULL
  userId        UUID FK UNIQUE

Bus (N:1 → BusOwner)
  id                 UUID PK
  registrationNumber VARCHAR UNIQUE NOT NULL
  model              VARCHAR NOT NULL
  year               SMALLINT NOT NULL
  totalSeats         SMALLINT NOT NULL
  seatLayoutJson     JSONB NOT NULL   -- { rows, columns, seats:[{num,row,col,type}] }
  approvalStatus     ENUM(PENDING, APPROVED, REJECTED) DEFAULT PENDING
  rejectionReason    TEXT
  ownerId            UUID FK → BusOwner
  createdAt          TIMESTAMP
  updatedAt          TIMESTAMP

BusDocument (N:1 → Bus)
  id              UUID PK
  busId           UUID FK
  documentType    ENUM(RC, INSURANCE, FITNESS, OTHER)
  fileData        TEXT (base64)
  uploadedAt      TIMESTAMP
  verifiedAt      TIMESTAMP
  verifiedByAdminId UUID FK → User

BusAssignment (link Conductor ↔ Bus)
  id          UUID PK
  busId       UUID FK
  conductorId UUID FK
  assignedAt  TIMESTAMP
  isActive    BOOLEAN DEFAULT true
  UNIQUE(busId, conductorId)

Route
  id                  UUID PK
  origin              VARCHAR NOT NULL
  destination         VARCHAR NOT NULL
  viaStops            JSONB               -- [{name, order}]
  distanceKm          DECIMAL(8,2)
  estimatedDurationMin INT
  ownerId             UUID FK → BusOwner
  isActive            BOOLEAN DEFAULT true

Schedule
  id             UUID PK
  busId          UUID FK → Bus
  routeId        UUID FK → Route
  departureTime  TIME NOT NULL
  operatingDays  SMALLINT NOT NULL   -- bitmask: bit0=Sun … bit6=Sat
  baseFare       DECIMAL(10,2) NOT NULL
  isActive       BOOLEAN DEFAULT true
  createdAt      TIMESTAMP

TripAvailability  (conductor availability per trip-date)
  id          UUID PK
  scheduleId  UUID FK → Schedule
  tripDate    DATE NOT NULL
  isAvailable BOOLEAN NOT NULL DEFAULT true
  setBy       UUID FK → User  (conductor)
  updatedAt   TIMESTAMP
  UNIQUE(scheduleId, tripDate)

Booking
  id          UUID PK
  customerId  UUID FK → Customer
  scheduleId  UUID FK → Schedule
  tripDate    DATE NOT NULL
  seatNumbers JSONB NOT NULL   -- ["A1","A2"]
  totalFare   DECIMAL(10,2) NOT NULL
  status      ENUM(CONFIRMED, CANCELLED, BOARDED) DEFAULT CONFIRMED
  bookedAt    TIMESTAMP
  cancelledAt TIMESTAMP

Ticket (1:1 → Booking)
  id          UUID PK
  bookingId   UUID FK UNIQUE
  qrPayload   TEXT NOT NULL    -- JSON string
  qrCodePng   TEXT NOT NULL    -- base64 PNG
  hmacSignature VARCHAR NOT NULL
  issuedAt    TIMESTAMP

BookedSeat  (unique seat reservation per trip)
  id          UUID PK
  scheduleId  UUID FK
  tripDate    DATE NOT NULL
  seatNumber  VARCHAR NOT NULL
  bookingId   UUID FK → Booking
  UNIQUE(scheduleId, tripDate, seatNumber)
```

### 7.3 Entity Relationship Overview

```
User ──1:1── BusOwner ──1:N── Bus ──1:N── BusDocument
                         │              └── 1:N── Schedule ──N:1── Route
                         └──1:N── Route

User ──1:1── Conductor ──N:N── Bus  (via BusAssignment)

User ──1:1── Customer ──1:N── Booking ──1:1── Ticket
                                    └──1:N── BookedSeat
```

---

## 8. API Design

### 8.1 Base URL

`/api/v1`

### 8.2 Endpoint Summary

#### Auth
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/auth/login` | None | — | Login, get tokens |
| POST | `/auth/refresh` | Cookie | — | Refresh access token |
| POST | `/auth/logout` | Bearer | Any | Clear refresh cookie |

#### Customer Registration
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/customer/register` | None | — | Register as customer |
| GET | `/customer/me` | Bearer | Customer | Own profile |
| PATCH | `/customer/me` | Bearer | Customer | Update own profile |

#### Bus Owner Registration
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/bus-owner/register` | None | — | Register as bus owner |
| GET | `/bus-owner/me` | Bearer | BusOwner | Own profile |
| PATCH | `/bus-owner/me` | Bearer | BusOwner | Update own profile |

#### Bus Management
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/buses` | Bearer | BusOwner | Add a new bus |
| GET | `/buses` | Bearer | BusOwner | List own buses |
| GET | `/buses/:id` | Bearer | BusOwner, Admin | Bus detail |
| PATCH | `/buses/:id` | Bearer | BusOwner | Update bus (PENDING/REJECTED only) |
| POST | `/buses/:id/documents` | Bearer | BusOwner | Upload documents |
| GET | `/buses/:id/documents` | Bearer | BusOwner, Admin | List documents |

#### Admin — Bus Verification
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/admin/buses` | Bearer | Admin | List all buses (filterable by status) |
| POST | `/admin/buses/:id/approve` | Bearer | Admin | Approve bus |
| POST | `/admin/buses/:id/reject` | Bearer | Admin | Reject bus with reason |

#### Conductor Assignment
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/conductor` | Bearer | BusOwner | Create conductor account |
| POST | `/buses/:busId/conductors/:conductorId` | Bearer | BusOwner | Assign conductor to bus |
| DELETE | `/buses/:busId/conductors/:conductorId` | Bearer | BusOwner | Unassign conductor |
| PATCH | `/buses/:busId/availability` | Bearer | Conductor | Toggle bus availability for a date |

#### Routes & Schedules
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/routes` | Bearer | BusOwner | Create route |
| GET | `/routes` | Bearer | BusOwner | List own routes |
| POST | `/schedules` | Bearer | BusOwner | Create schedule |
| GET | `/schedules` | Bearer | BusOwner | List own schedules |
| PATCH | `/schedules/:id` | Bearer | BusOwner | Update schedule |
| DELETE | `/schedules/:id` | Bearer | BusOwner | Deactivate schedule |

#### Search (Public)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/search/buses` | None | — | Search buses by origin, destination, date |

#### Seat Map
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/trips/:scheduleId/:date/seats` | Bearer | Customer | Get seat heat-map for a trip |

#### Bookings
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/bookings` | Bearer | Customer | Book seat(s) |
| GET | `/bookings` | Bearer | Customer | List own bookings |
| GET | `/bookings/:id` | Bearer | Customer | Booking detail |
| POST | `/bookings/:id/cancel` | Bearer | Customer | Cancel booking |

#### Tickets
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/tickets/:bookingId` | Bearer | Customer | Get ticket with QR code |
| POST | `/tickets/validate` | Bearer | Conductor | Validate QR payload |

---

## 9. Security Model

### 9.1 JWT Strategy

```
JwtAuthGuard  →  validates Bearer token signature + expiry
RolesGuard    →  checks decoded token's roles[] against @Roles(...) decorator
```

Both guards registered globally; `@Public()` decorator bypasses them for open endpoints.

### 9.2 RBAC Decorator Pattern

```typescript
@Roles(UserRole.Admin, UserRole.BusOwner)
@Get('/admin/buses')
findAll() {}
```

### 9.3 Ownership Checks

- BusOwner endpoints: service verifies `bus.ownerId === req.user.busOwnerId`.
- Conductor endpoints: service verifies `busAssignment.conductorId === req.user.conductorId`.
- Customer endpoints: service verifies `booking.customerId === req.user.customerId`.

### 9.4 QR Code Signing

```
payload = JSON.stringify({ ticketId, bookingId, … })
signature = HMAC-SHA256(payload, QR_SECRET)
qrPayload = base64(payload + "." + signature)
```

Validation reverses this: decode → split → recompute HMAC → compare.

---

## 10. External Integrations

| Integration | Purpose | Library | Phase |
|-------------|---------|---------|-------|
| `qrcode` (npm) | Server-side QR PNG generation | `qrcode` | Phase 5 |
| Redis | Seat map cache + token blacklist | `ioredis` (existing) | Phase 1 |
| Multer / base64 | Document file handling | `@nestjs/platform-express` / manual | Phase 3 |
| Throttler | Rate limiting | `@nestjs/throttler` | Phase 1 |

---

*End of SRS v1.0*
