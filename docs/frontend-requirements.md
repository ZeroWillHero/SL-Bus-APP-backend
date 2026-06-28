# SL Bus — Frontend Application Requirements

**Base API URL:** `https://<your-domain>/api/v1`  
**Auth:** `Authorization: Bearer <accessToken>` header on all protected requests  
**Response shape (all endpoints):**
```json
{ "success": true, "message": "...", "data": <payload> }
```

---

## Table of Contents

1. [Shared / Auth Flows](#1-shared--auth-flows)
2. [Bus Owner & Conductor App](#2-bus-owner--conductor-app)
3. [Customer Booking App](#3-customer-booking-app)
4. [Admin Panel (Web)](#4-admin-panel-web)
5. [Shared Enums & Types](#5-shared-enums--types)
6. [Error Handling Contract](#6-error-handling-contract)

---

## 1. Shared / Auth Flows

These flows are shared across all three applications.

### 1.1 OTP → Registration

**Bus Owner registration:** `POST /bus-owner/register`  
**Customer registration:** `POST /customer` then `POST /user-roles`  
**Conductor:** Created by bus owner, not self-registered.

#### Registration flow (Bus Owner & Customer)

```
1. User fills form (name, email, phone, password, NIC if bus owner)
2. App calls  POST /otp/send  { phone }
3. User enters OTP
4. App calls  POST /otp/verify  { phone, code }
5. App calls  POST /bus-owner/register  OR  POST /customer  with form data
6. Redirect to login
```

**OTP Send**
```
POST /otp/send
Body: { "phone": "+94771234567" }
Rate limit: 5 req / 60 s
```

**OTP Verify**
```
POST /otp/verify
Body: { "phone": "+94771234567", "code": "123456" }
```

### 1.2 Login (all roles — 2FA required)

Login requires **username + password + OTP** in a single request.
The OTP must be sent to the user's phone first.

```
1. User enters email/phone + password
2. App calls  POST /otp/send  { phone }
3. User enters OTP from SMS
4. App calls  POST /auth/login  with all three fields
5. Store accessToken; refresh token is set as httpOnly cookie automatically
```

```
POST /auth/login
Body: { "username": "email or phone", "password": "...", "otp": "123456" }
Response data: { "accessToken": "...", "user": UserDTO }
```

Store `accessToken` in memory (not localStorage). Use the httpOnly refresh-token cookie automatically on `POST /auth/refresh`.

### 1.3 Token Refresh

Call `POST /auth/refresh` (no body needed — cookie is sent automatically).  
Do this silently when any API call returns HTTP 401.

### 1.4 Logout

```
POST /auth/logout   (clears the httpOnly refresh-token cookie)
```

Clear the in-memory `accessToken` and redirect to login.

### 1.5 Verify Session

On app startup, call `GET /auth/verify` to restore session.  
If it fails, redirect to login.

---

## 2. Bus Owner & Conductor App

**Target users:** Bus owners and conductors they employ.  
**Platform:** Mobile app (React Native / Flutter) or responsive web.  
**Roles served:** `BusOwner`, `Conductor`

After login the app reads `user.roles` from the JWT/verify response and routes to the correct home screen.

---

### 2.1 Bus Owner — Screens

#### Screen: Bus Owner Registration

Fields:
- First name, last name
- Contact number (used for OTP)
- NIC number
- Address
- Email, password

Flow: OTP → Register (see §1.1)

```
POST /bus-owner/register
Body: { firstName, lastName, contactNumber, nicNumber, address, email, password }
```

After registration the account status is `PENDING` until admin approves it.  
Show a "Your account is under review" banner on the home screen when `approvalStatus !== APPROVED`.

---

#### Screen: Bus Owner Home / Dashboard

Show summary cards:
- Total buses (count by status: PENDING / APPROVED / REJECTED)
- Total routes
- Total conductors
- Total schedules (active)

Data source: derive counts from the list APIs below; no dedicated stats endpoint exists for bus owner.

---

#### Screen: My Profile

```
GET /bus-owner/me
Response data: BusOwnerDto (includes user, buses[])
```

Show: name, NIC, contact, address, approval status badge, rejection reason if REJECTED.

Edit:
```
PATCH /bus-owner/me
Body: { firstName?, lastName?, contactNumber?, address? }
```

---

#### Screen: Bus List

```
GET /buses
Response data: BusDto[]   (filtered server-side to own buses)
```

List cards showing: registration number, model, type badge, seat count, approval status badge.  
Tap to open **Bus Detail**.  
FAB → **Add Bus**.

---

#### Screen: Add Bus

Fields:
- Registration number (required)
- Model name (required)
- Bus type: NORMAL / AC / SLEEPER
- Year of manufacture
- Total seats
- Seat layout: rows × columns (converted to `seatLayoutJson`)

```
POST /buses
Body: { registrationNumber, model, busType, year, totalSeats, seatLayoutJson: { rows, columns } }
```

After creation upload documents (see Bus Documents screen).

---

#### Screen: Bus Detail

Tabs:
1. **Info** — registration, model, type, year, seats, status, rejection reason
2. **Documents** — document list + upload
3. **Routes** — assigned routes
4. **Conductors** — assigned conductors
5. **Schedules** — schedules for this bus

**Info tab**

```
GET /buses/:id
```

Edit (only when status is PENDING or REJECTED):
```
PATCH /buses/:id
Body: { registrationNumber?, model?, busType?, year?, totalSeats?, seatLayoutJson? }
```

**Documents tab**

```
GET /buses/:id/documents           → list (metadata only)
GET /buses/:id/documents/:docId    → full doc with fileData (base64)
POST /buses/:id/documents          → upload
Body: { documentType: string, fileData: "<base64>", fileName: string }
```

Document types to support (free-text accepted by the API): `REGISTRATION`, `INSURANCE`, `ROUTE_PERMIT`, `ROADWORTHY_CERTIFICATE`.  
Show verification badge per document (`isVerified`).

**Routes tab**

```
GET /buses/:id/routes        → routes assigned to this bus
POST /buses/:id/routes/:routeId   → assign a route (show route picker from GET /routes)
DELETE /buses/:id/routes/:routeId → unassign
```

**Conductors tab**

```
GET /buses/:id/conductors                     → active conductors
POST /buses/:id/conductors/:conductorId        → assign (show conductor picker from GET /conductors)
DELETE /buses/:id/conductors/:conductorId      → unassign
```

**Schedules tab**

Filtered by `busId` (see §2.1 Schedules screen).

---

#### Screen: Route List

```
GET /routes
Response data: RouteDto[]
```

List: origin → destination, distance, duration, active badge.  
FAB → **Add Route**.

---

#### Screen: Add / Edit Route

Fields:
- Origin (required)
- Destination (required)
- Distance km
- Estimated duration (minutes)

```
POST /routes   { origin, destination, distanceKm, estimatedDurationMin }
PATCH /routes/:id   (same fields, all optional)
DELETE /routes/:id   → deactivates
```

After creating a route, allow adding stops:

**Stops sub-screen:**

```
GET /routes/:id/stops
POST /routes/:id/stops   { stopName, stopOrder, priceFromOrigin }
PATCH /routes/:id/stops/:stopId
DELETE /routes/:id/stops/:stopId
```

`stopOrder` is zero-based. Origin is order 0, first via-stop is 1, destination is last.  
`priceFromOrigin` is fare in LKR from route origin to that stop.

---

#### Screen: Schedule List

```
GET /schedules?busId=<id>   (or without filter to see all)
Response data: ScheduleDto[]
```

List: route name, departure time, operating days (visual day-of-week chips), base fare, active badge.  
FAB → **Add Schedule**.

---

#### Screen: Add / Edit Schedule

Fields:
- Bus selector (from `GET /buses`)
- Route selector (from `GET /routes`)
- Departure time (HH:mm)
- Operating days (checkboxes Sun–Sat, stored as bitmask)
- Base fare (LKR)

**Operating days bitmask:**  
Bit 0 = Sunday, Bit 1 = Monday … Bit 6 = Saturday  
Example: Mon+Fri = `(1 << 1) | (1 << 5)` = `34`

```
POST /schedules   { busId, routeId, departureTime, operatingDays, baseFare }
PATCH /schedules/:id   (same fields, all optional)
DELETE /schedules/:id   → deactivates
```

> **Note:** Schedules can only be created for buses with `approvalStatus === APPROVED`.

---

#### Screen: Conductor List

```
GET /conductors
Response data: ConductorDTO[]   (filtered to own conductors)
```

List: name, phone, email, license number.  
FAB → **Add Conductor**.

---

#### Screen: Add Conductor

Fields:
- First name, last name
- Phone number
- Email
- Password (initial password for the conductor)
- License number (optional)

```
POST /conductors
Body: { firstName, lastName, phoneNumber, email, password, licenseNumber? }
```

The conductor is automatically linked to the authenticated bus owner.  
A user account is created for them using the supplied email/password.

---

### 2.2 Conductor — Screens

#### Screen: Conductor Home

Show today's assigned buses with schedules.

```
GET /conductor/me/buses
Response data: BusDto[]   (buses the conductor is assigned to)
```

For each bus show active schedules (cross-reference with `GET /schedules?busId=<id>`).

---

#### Screen: Today's Trips

For each schedule assigned to the conductor's buses:
- Show route, departure time, current date
- Toggle trip availability for today

```
PATCH /schedules/:scheduleId/trips/:date/availability
Date format: YYYY-MM-DD
Body: { "isAvailable": false }   ← required; false = cancel this trip, true = re-open it
```

Tap a trip to open the **Trip Boarding** screen.

---

#### Screen: Trip Boarding

Shows the seat map and passenger list for a specific trip date.

**Seat map:**
```
GET /trips/:scheduleId/:date/seats
Response data: { scheduleId, tripDate, rows, columns, seats: [{ seatNumber, row, col, status }] }
Seat status: FREE | BOOKED | MINE
```

Render a visual grid. BOOKED seats are shown as occupied.  
Tap a BOOKED seat to view the booking info (look up by seatNumber in booking list).

**Scan QR ticket:**
```
POST /bookings/scan
Body: { token: "<qr-token-string>" }
```
Marks the passenger as BOARDED.

**Board by booking ID:**
```
POST /bookings/:id/board
```

**Cash / walk-in booking:**
```
POST /bookings/cash
Body: { scheduleId, tripDate, seatNumbers: ["A1"], passengerName?, passengerPhone? }
```
Creates a CONFIRMED booking immediately (no payment step needed — cash is assumed).

---

## 3. Customer Booking App

**Target users:** Passengers booking bus seats.  
**Platform:** Mobile app (React Native / Flutter) preferred; can also be web.  
**Roles served:** `Customer` (and unauthenticated users for search)

---

### 3.1 Customer Registration & Login

Registration flow (§1.1):

```
POST /otp/send        { phone }
POST /otp/verify      { phone, code }
POST /customer        { firstName, lastName, contactNumber, address, email, password, phone? }
```

After creating the customer profile, assign the Customer role:
```
POST /user-roles   { userId: <new user id>, roleId: <Customer role id> }
```

> Get the Customer `roleId` from `GET /roles` on first app load and cache it.

Login flow: same as §1.2.

---

### 3.2 Customer — Screens

#### Screen: Home / Search

Search form:
- Origin (text input)
- Destination (text input)
- Travel date (date picker, YYYY-MM-DD)

```
GET /search/buses?origin=<>&destination=<>&date=<YYYY-MM-DD>&page=1&limit=20&sort=time_asc
```

Sort options: `time_asc`, `fare_asc`, `fare_desc`.  
**No auth required** — guests can search.

Show result cards: route name (origin → destination), via stops, departure time, bus type badge (NORMAL/AC/SLEEPER), base fare, bus model.

---

#### Screen: Seat Selection

Launched from a search result card.

```
GET /trips/:scheduleId/:date/seats
Response: { rows, columns, seats: [{ seatNumber, row, col, status }] }
```

Render a visual seat grid:
- FREE seats: selectable (tap to toggle selection)
- BOOKED seats: greyed out, unselectable
- MINE seats (already booked by current user): shown as "My Seat"

Show selected seats, base fare × count, coupon field.

**Validate coupon:**
```
GET /coupons/:code/validate?fare=<totalFareNumber>   ← fare query param is required
Response: { discountType, discountValue, maxDiscount, discountAmount, payableAmount }
```

Show discount preview. Proceed to **Booking Confirmation**.

---

#### Screen: Booking Confirmation

Summary:
- Route, date, departure time
- Seat numbers
- Fare breakdown: base fare, discount, payable amount
- Coupon code (if applied)
- Payment method selector: CARD / MOBILE_WALLET

On confirm:

**Step 1 — Create booking (status: PENDING_PAYMENT)**
```
POST /bookings
Body: { scheduleId, tripDate, seatNumbers: ["A1","B2"], couponCode? }
Response data: BookingDto (id, payableAmount, status: PENDING_PAYMENT)
```

**Step 2 — Pay**
```
POST /payments
Body: { bookingId, paymentMethod: "CARD" | "MOBILE_WALLET", amount: <payableAmount> }
Response data: PaymentDto (status: COMPLETED)
```

On payment success redirect to **Ticket / Booking Detail**.

> Payment gateway integration: the current backend records payment intent but does not integrate a real payment provider. Implement your chosen gateway (e.g. PayHere, Stripe) on the client side and call `POST /payments` once the gateway confirms success.

---

#### Screen: My Bookings

```
GET /bookings                      → all bookings
GET /bookings?status=CONFIRMED     → confirmed only
GET /bookings?upcoming=true        → upcoming trips
```

List cards: route, trip date, seats, status badge (PENDING_PAYMENT / CONFIRMED / CANCELLED / BOARDED), payable amount.

Tap → **Booking Detail**.

---

#### Screen: Booking Detail / Ticket

```
GET /bookings/:id/ticket
Response data: TicketDto
```

TicketDto fields to display:
- Ticket reference (`ticketRef`)
- Status badge
- Customer name
- Origin → Destination, via stops
- Departure time, trip date, estimated arrival
- Bus registration, model
- Seat numbers
- Fare breakdown
- Payment method & status
- QR code image (base64 PNG — render with `<img src="data:image/png;base64,..." />`)

**Cancel booking:**
```
POST /bookings/:id/cancel
```

Show cancel button only when status is `PENDING_PAYMENT` or `CONFIRMED`.  
If already paid, inform user that a refund will be processed.

---

#### Screen: My Profile

```
GET /user/me           ← note: no /api/v1 prefix; full path is <domain>/user/me
PATCH /user/me   { email?, phone? }
```

Show customer details from `GET /api/v1/customer/:id` using the customer ID from UserDTO.

---

## 4. Admin Panel (Web)

**Target users:** System administrators.  
**Platform:** Web application (React + TypeScript recommended).  
**Role required:** `Admin` on all endpoints.

---

### 4.1 Layout

**Sidebar navigation:**
- Dashboard
- Users
- Bus Owners
- Buses
- Payments
- Coupons

**Top bar:** logged-in admin name, logout button.

---

### 4.2 Screen: Dashboard

Show summary stats (derive from list API counts or add dedicated endpoints in future):

| Card | API |
|------|-----|
| Total users | `GET /admin/users` → total count from pagination |
| Pending bus owners | `GET /admin/bus-owners` → filter client-side by `approvalStatus === PENDING` |
| Pending buses | `GET /admin/buses?status=PENDING` |
| Revenue (month) | `GET /admin/payments/stats` |

**Payment stats:**
```
GET /admin/payments/stats
Response data: { totalRevenue, completedCount, pendingCount, refundedCount, ... }
```

Show a simple revenue chart (daily/weekly breakdown if the API returns it).

---

### 4.3 Screen: User Management

```
GET /admin/users?page=1&limit=20&search=<>&email=<>&phone=<>
Response data: { items: UserDTO[], total, page, limit }
```

Table columns: ID (short), email, phone, roles, verified, banned, created at, Actions.

**Actions:**
- View detail: `GET /admin/users/:id`
- Ban: `POST /admin/users/:id/ban`
- Unban: `POST /admin/users/:id/unban`
- Delete (destructive, confirm dialog): `DELETE /admin/users/:id`

Show a `isBanned` badge. Banned users cannot log in.

---

### 4.4 Screen: Bus Owner Approval

```
GET /admin/bus-owners?page=1&limit=20&search=<name/NIC>&sortOrder=DESC
```

Available query params: `search`, `email`, `contactNumber`, `isActive` (boolean), `sortOrder` (ASC|DESC), `page`, `limit`.  
> The API does not have a server-side `approvalStatus` filter for bus owners. Load all and filter client-side by `approvalStatus`, or use `isActive=false` to narrow down unverified accounts.

Filters shown in UI: search by name/NIC, sort by date.

Table: name, NIC, contact, status badge, registered date, actions.

**Detail drawer/page:**
```
GET /admin/bus-owners/:id
```

Shows full profile including linked buses.

**Approve:**
```
POST /admin/bus-owners/:id/approve
```

**Reject (requires reason):**
```
POST /admin/bus-owners/:id/reject
Body: { reason: "..." }
```

Show a modal with a required reason text area before calling reject.

---

### 4.5 Screen: Bus Approval

```
GET /admin/buses?page=1&limit=20&approvalStatus=PENDING
```

Filters: approval status.

Table: registration number, model, type, owner name, status badge, submitted date, actions.

**Detail page:**
```
GET /admin/buses/:id
```

Shows bus info + seat layout preview.

**Documents tab:**
```
GET /admin/buses/:id/documents                       → list documents (metadata only)
POST /admin/buses/:id/documents/:docId/verify        → mark document verified
```

> There is no admin-specific endpoint to fetch a document's file data. To preview a file, use `GET /buses/:id/documents/:docId` — note this endpoint is role-guarded to `BusOwner` only, so the admin panel cannot directly preview raw file content from the current API. Consider adding an admin document-fetch endpoint in the backend, or display document metadata without an inline preview.

Show each document with verification badge. Admins can verify individual documents.

**Approve bus:**
```
POST /admin/buses/:id/approve
```

**Reject bus:**
```
POST /admin/buses/:id/reject
Body: { reason: "..." }
```

**Delete bus (destructive):**
```
DELETE /admin/buses/:id
```

---

### 4.6 Screen: Payment Management

```
GET /admin/payments?page=1&limit=20&status=<>&paymentMethod=<>&fromDate=<YYYY-MM-DD>&toDate=<YYYY-MM-DD>
```

Filters: status (PENDING / COMPLETED / FAILED / REFUNDED), method (CASH / CARD / MOBILE_WALLET), date range.

Table: ID, booking ID, amount (LKR), method, status badge, paid at, actions.

**Detail:**
```
GET /admin/payments/:id
```

Shows full payment record with linked booking summary.

---

### 4.7 Screen: Coupon Management

```
GET /admin/coupons
```

Table: code, type, value, valid from/until, usage (`usedCount / usageLimit`), active badge, actions.

**Create coupon (modal/drawer):**
```
POST /admin/coupons
Body: {
  code: string,
  description?: string,
  discountType: "PERCENTAGE" | "FIXED_AMOUNT",
  discountValue: number,
  minFare?: number,
  maxDiscount?: number,
  usageLimit?: number,
  perUserLimit: number,
  validFrom: "YYYY-MM-DD",
  validUntil: "YYYY-MM-DD"
}
```

**Edit coupon:**
```
PATCH /admin/coupons/:id   (same fields, all optional)
```

**Deactivate:**
```
DELETE /admin/coupons/:id
```

> `DELETE` deactivates — it does not hard-delete. Reflect this in the UI by updating the `isActive` badge rather than removing the row.

---

## 5. Shared Enums & Types

```typescript
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type BookingStatus  = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'BOARDED';
type PaymentStatus  = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
type PaymentMethod  = 'CASH' | 'CARD' | 'MOBILE_WALLET';
type DiscountType   = 'PERCENTAGE' | 'FIXED_AMOUNT';
type BusType        = 'NORMAL' | 'AC' | 'SLEEPER';

// Operating days bitmask helper
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function operatingDaysToArray(mask: number): string[] {
  return DAYS.filter((_, i) => (mask >> i) & 1);
}
function arrayToOperatingDays(days: number[]): number {
  return days.reduce((mask, d) => mask | (1 << d), 0);
}
// days[] values: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
```

---

## 6. Error Handling Contract

All errors return:
```json
{ "success": false, "message": "Human readable error", "statusCode": 400 }
```

Common HTTP status codes:
| Status | Meaning |
|--------|---------|
| 400 | Validation error or bad request body |
| 401 | Missing or expired access token |
| 403 | Authenticated but wrong role |
| 404 | Resource not found |
| 409 | Conflict (duplicate registration number, seat already booked, etc.) |
| 429 | Rate limit exceeded (show "Try again in X seconds") |
| 500 | Server error |

**Recommended global interceptor pattern:**
1. On 401 → call `POST /auth/refresh` once → retry original request → if still 401 → logout
2. On 429 → parse `Retry-After` header and show countdown
3. On 409 for seat booking → refresh seat map and highlight newly-booked seats

---

## 7. API Base Paths — Quick Reference

| App | Base URL |
|-----|----------|
| All apps | `GET /auth/verify`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| All apps | `POST /otp/send`, `POST /otp/verify` |
| Bus Owner app | `/bus-owner/*`, `/buses/*`, `/routes/*`, `/schedules/*`, `/conductors/*` |
| Conductor app | `/conductor/me/buses`, `/schedules/:id/trips/:date/availability`, `/bookings/scan`, `/bookings/cash`, `/bookings/:id/board`, `/trips/:scheduleId/:date/seats` |
| Customer app | `/search/buses`, `/trips/:scheduleId/:date/seats`, `/bookings/*`, `/payments/*`, `/coupons/:code/validate`, `/customer/*` |
| Admin panel | `/admin/users/*`, `/admin/bus-owners/*`, `/admin/buses/*`, `/admin/payments/*`, `/admin/coupons/*` |
