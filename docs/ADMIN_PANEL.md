# SL Bus App — Admin Panel Implementation Guide

> **Audience:** Frontend developers building the admin web application.  
> **Backend base URL:** `http://localhost:3000` (configure per environment)  
> **Swagger UI:** `GET /api/v1/swagger-ui`  
> **API prefix:** All endpoints (except `/auth/*` and `/user/*`) are under `/api/v1/`


## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication & Token Management](#2-authentication--token-management)
3. [Request Conventions](#3-request-conventions)
4. [Response Envelope](#4-response-envelope)
5. [Error Handling](#5-error-handling)
6. [Roles & Access Control](#6-roles--access-control)
7. [Enums Reference](#7-enums-reference)
8. [Admin Pages & Feature Map](#8-admin-pages--feature-map)
9. [API Reference — Dashboard / Stats](#9-api-reference--dashboard--stats)
10. [API Reference — Bus Owner Management](#10-api-reference--bus-owner-management)
11. [API Reference — Bus & Document Management](#11-api-reference--bus--document-management)
12. [API Reference — Conductor Management](#12-api-reference--conductor-management)
13. [API Reference — Customer Management](#13-api-reference--customer-management)
14. [API Reference — Payment Management](#14-api-reference--payment-management)
15. [API Reference — Coupon Management](#15-api-reference--coupon-management)
16. [Supplementary Data — Routes & Schedules](#16-supplementary-data--routes--schedules)
17. [Supplementary Data — Bookings & Seat Maps](#17-supplementary-data--bookings--seat-maps)
18. [Pagination Pattern](#18-pagination-pattern)
19. [Operating Days Bitmask](#19-operating-days-bitmask)
20. [Seat Layout Grid](#20-seat-layout-grid)

---

## 1. Architecture Overview

The admin panel needs to interact with three layers of the API:

| Layer | Who uses it | What it covers |
|---|---|---|
| **Admin-exclusive** (`/api/v1/admin/*`) | Admin only | Bus approval, all payments, coupon CRUD, bus-owner list |
| **Shared management** (`/api/v1/conductor`, `/api/v1/customer`, etc.) | Admin (also BusOwner/Conductor for own data) | Create conductors, customers, view schedules |
| **Auth** (`/auth/*`, `/user/*`) | Everyone | Login, refresh token, own profile |

The admin user has the `Admin` role in the JWT. Roles are **additive** — the bootstrap process (see test script) assigns Admin to a user who also has BusOwner so both scopes are accessible. In production, create a dedicated admin-only user.

---

## 2. Authentication & Token Management

### Login

```
POST /auth/login
Content-Type: application/json
```

**Request body:**
```json
{
  "username": "admin@slbus.lk",
  "password": "Admin@123"
}
```

**Response** (wrapped in the standard envelope — see §4):
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "accessToken": "<JWT>",
    "user": {
      "id": "uuid",
      "email": "admin@slbus.lk",
      "phone": null,
      "isVerified": true,
      "createdAt": "2026-04-30T...",
      "updatedAt": "2026-04-30T..."
    }
  }
}
```

> **Important:** The server also sets an `httpOnly` cookie named `refresh_token` with `Path=/auth/refresh`. You cannot read this cookie from JavaScript — the browser sends it automatically on refresh calls.

### Token Storage Recommendation

```
localStorage / sessionStorage  →  accessToken  (short-lived, 15 min)
httpOnly cookie                →  refresh_token (auto-managed by browser, 7 days)
```

Store `accessToken` and `user` from `data` after login. Discard them on logout.

### Refresh Access Token

When any request returns `401`, silently refresh before retrying:

```
POST /auth/refresh
```

No body needed. The browser sends the httpOnly cookie automatically.

**Response:**
```json
{
  "data": {
    "accessToken": "<new-JWT>"
  }
}
```

Replace the stored `accessToken` and retry the original request.

### Logout

```
POST /auth/logout
Authorization: Bearer <accessToken>
```

Clears the `refresh_token` cookie server-side. Also clear `accessToken` from local storage in the frontend.

### JWT Payload

The decoded JWT contains:
```json
{
  "sub": "user-uuid",
  "email": "admin@slbus.lk",
  "roles": ["Admin"],
  "iat": 1234567890,
  "exp": 1234568790
}
```

Use `roles` to conditionally render admin-only UI sections.

---

## 3. Request Conventions

Every request to a protected endpoint must include:

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Recommended Axios Instance

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  withCredentials: true, // required — sends the httpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      const { data } = await api.post('/auth/refresh');
      const newToken = data.data.accessToken;
      localStorage.setItem('accessToken', newToken);
      err.config.headers.Authorization = `Bearer ${newToken}`;
      return api(err.config);
    }
    return Promise.reject(err);
  },
);
```

---

## 4. Response Envelope

**Every** API response is wrapped in this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  statusCode: number;
  data: T;
}
```

To get the actual payload, always read `response.data.data`.

```typescript
const res = await api.get('/api/v1/admin/bus-owners');
const busOwners = res.data.data; // BusOwnerDto[]
```

**Exception:** `GET /user/me` and `PATCH /user/me` return the `UserDTO` directly (not wrapped).

---

## 5. Error Handling

Error responses follow the same envelope with `success: false`:

```json
{
  "success": false,
  "message": "Bus not found",
  "statusCode": 404
}
```

| HTTP Code | Meaning | Common causes |
|---|---|---|
| `400` | Bad request | Missing required fields, invalid format |
| `401` | Unauthorized | No token, expired token, invalid token |
| `403` | Forbidden | Authenticated but wrong role |
| `404` | Not found | Resource UUID doesn't exist |
| `409` | Conflict | Duplicate NIC, email already taken, seat already booked |
| `422` | Unprocessable | Business rule violation (e.g., booking a cancelled trip) |
| `429` | Rate limited | Login endpoint: max 10 requests/minute |
| `500` | Server error | Unexpected backend failure |

```typescript
try {
  const res = await api.post(`/api/v1/admin/buses/${id}/approve`);
  toast.success(res.data.message);
} catch (err) {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.message ?? 'Something went wrong';
    toast.error(message);
  }
}
```

---

## 6. Roles & Access Control

| Role | Description | Key permissions |
|---|---|---|
| `Admin` | System administrator | All `/admin/*` endpoints, conductor/customer CRUD, bus approval |
| `BusOwner` | Bus company owner | Own buses, routes, schedules, conductor assignment |
| `Conductor` | Bus conductor | Toggle trip availability, board passengers |
| `Customer` | Passenger | Search, book, pay, cancel, get ticket |

**Admin panel requires the `Admin` role for all pages.** If `roles` in the decoded JWT does not contain `"Admin"`, redirect to `/login`.

```typescript
import jwtDecode from 'jwt-decode';

function isAdmin(token: string): boolean {
  try {
    const { roles } = jwtDecode<{ roles: string[] }>(token);
    return roles.includes('Admin');
  } catch {
    return false;
  }
}
```

---

## 7. Enums Reference

### ApprovalStatus
```typescript
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
```

### DocumentType
```typescript
type DocumentType = 'RC' | 'INSURANCE' | 'FITNESS' | 'OTHER';

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  RC:        'Registration Certificate',
  INSURANCE: 'Insurance',
  FITNESS:   'Fitness Certificate',
  OTHER:     'Other Document',
};
```

### BookingStatus
```typescript
type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'BOARDED';
```

### PaymentStatus
```typescript
type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
```

### PaymentMethod
```typescript
type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_WALLET';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH:          'Cash',
  CARD:          'Card',
  MOBILE_WALLET: 'Mobile Wallet',
};
```

### DiscountType
```typescript
type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
```

---

## 8. Admin Pages & Feature Map

| Page | Route | API calls |
|---|---|---|
| Login | `/login` | `POST /auth/login` |
| Dashboard | `/` | `GET /admin/payments/stats` |
| Bus Owners | `/bus-owners` | `GET /admin/bus-owners` |
| Buses — Pending | `/buses?status=PENDING` | `GET /admin/buses?status=PENDING` |
| Buses — All | `/buses` | `GET /admin/buses` |
| Bus Detail | `/buses/:id` | `GET /admin/buses/:id`, `GET /admin/buses/:id/documents` |
| Bus Approve/Reject | (modal on detail page) | `POST /admin/buses/:id/approve`, `POST /admin/buses/:id/reject` |
| Conductors | `/conductors` | `GET /conductor`, `POST /conductor`, `PATCH /conductor/:id`, `DELETE /conductor/:id` |
| Customers | `/customers` | `GET /customer`, `PATCH /customer/:id`, `DELETE /customer/:id` |
| Payments | `/payments` | `GET /admin/payments`, `GET /admin/payments/stats` |
| Payment Detail | `/payments/:id` | `GET /admin/payments/:id` |
| Coupons | `/coupons` | `GET /admin/coupons`, `POST /admin/coupons`, `PATCH /admin/coupons/:id`, `DELETE /admin/coupons/:id` |

---

## 9. API Reference — Dashboard / Stats

### Revenue Statistics

```
GET /api/v1/admin/payments/stats
Authorization: Bearer <admin-token>
```

**Response `data`:**
```typescript
interface PaymentStatsDto {
  totalPayments:  number;          // total transaction count
  totalRevenue:   number;          // sum of all COMPLETED payments (LKR)
  totalRefunded:  number;          // sum of all REFUNDED amounts (LKR)
  netRevenue:     number;          // totalRevenue - totalRefunded
  byMethod: {                      // revenue broken down by payment method
    CASH:          number;
    CARD:          number;
    MOBILE_WALLET: number;
  };
  byStatus: {                      // transaction counts by status
    PENDING:   number;
    COMPLETED: number;
    FAILED:    number;
    REFUNDED:  number;
  };
}
```

**Suggested dashboard widgets:**
- KPI cards: Net Revenue, Total Transactions, Refund Rate
- Bar chart: Revenue by payment method (`byMethod`)
- Donut chart: Transaction status breakdown (`byStatus`)

---

## 10. API Reference — Bus Owner Management

### List All Bus Owners

```
GET /api/v1/admin/bus-owners
Authorization: Bearer <admin-token>
```

**Response `data`:** `BusOwnerDto[]`

```typescript
interface BusOwnerDto {
  id:            string;
  firstName:     string;
  lastName:      string;
  contactNumber: string;
  nicNumber:     string;   // National Identity Card number
  address:       string;
  userId:        string;
  user?: {
    id:        string;
    email:     string;
    phone:     string | null;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
}
```

> Admin can only **view** bus owners. There is no admin endpoint to edit or delete them. Bus owners manage their own profiles via `PATCH /api/v1/bus-owner/me`.

---

## 11. API Reference — Bus & Document Management

### List Buses (Admin)

```
GET /api/v1/admin/buses
GET /api/v1/admin/buses?status=PENDING
GET /api/v1/admin/buses?status=APPROVED
GET /api/v1/admin/buses?status=REJECTED
Authorization: Bearer <admin-token>
```

**Query parameters:**

| Param | Type | Required | Values |
|---|---|---|---|
| `status` | string | No | `PENDING` \| `APPROVED` \| `REJECTED` |

**Response `data`:** `BusDto[]`

```typescript
interface BusDto {
  id:                 string;
  registrationNumber: string;
  model:              string;
  year:               number;
  totalSeats:         number;
  seatLayoutJson:     SeatLayoutDto;
  approvalStatus:     ApprovalStatus;  // 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason:    string | null;
  ownerId:            string;
  createdAt:          string;
  updatedAt:          string;
}

interface SeatLayoutDto {
  rows:    number;
  columns: number;
  seats?: Array<{
    seatNumber: string;  // 'A1', 'B3', etc.
    row:        number;
    col:        number;
  }>;
}
```

### Get Single Bus (Admin)

```
GET /api/v1/admin/buses/:id
Authorization: Bearer <admin-token>
```

**Response `data`:** `BusDto`

### List Bus Documents (Admin)

```
GET /api/v1/admin/buses/:id/documents
Authorization: Bearer <admin-token>
```

**Response `data`:** `BusDocumentDto[]`

```typescript
interface BusDocumentDto {
  id:                 string;
  busId:              string;
  documentType:       DocumentType;   // 'RC' | 'INSURANCE' | 'FITNESS' | 'OTHER'
  fileData?:          string;         // base64 string — only present on single-document fetch
  uploadedAt:         string;
  verifiedAt:         string | null;
  verifiedByAdminId:  string | null;
}
```

> `fileData` is **not** returned in the list endpoint. Fetch `/documents/:docId` individually to display the file.

### View Single Document (Admin — via owner endpoint)

```
GET /api/v1/buses/:busId/documents/:docId
Authorization: Bearer <admin-token>
```

> Note: This uses the BusOwner-scoped path. The admin token can call it because the Admin role is additive.  
> `fileData` is a raw base64 string (no data-URI prefix). To display in `<img>` tags:
> ```typescript
> const src = `data:image/png;base64,${doc.fileData}`;
> // or for PDFs:
> const src = `data:application/pdf;base64,${doc.fileData}`;
> ```

### Approve a Bus

```
POST /api/v1/admin/buses/:id/approve
Authorization: Bearer <admin-token>
```

No request body. **Response `data`:** `BusDto` with `approvalStatus: 'APPROVED'`.

### Reject a Bus

```
POST /api/v1/admin/buses/:id/reject
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request body:**
```json
{
  "reason": "Missing fitness certificate. Please upload a valid fitness certificate."
}
```

`reason` is **mandatory** — the request will fail with `400` if omitted or empty.

**Response `data`:** `BusDto` with `approvalStatus: 'REJECTED'` and `rejectionReason` populated.

### Bus Approval Workflow (UI State Machine)

```
PENDING ──► [Approve] ──► APPROVED
        └──► [Reject]  ──► REJECTED ──► (owner edits & resubmits) ──► PENDING
```

**Suggested UI:**
- In the bus detail page, show status badge with colour coding:
  - `PENDING` → yellow badge + "Approve" and "Reject" buttons
  - `APPROVED` → green badge, no action buttons
  - `REJECTED` → red badge + "Re-review" button + display `rejectionReason`
- "Reject" opens a modal with a required textarea for the reason.

---

## 12. API Reference — Conductor Management

> These endpoints use the BusOwner-module path but are accessible with an Admin token.

### List All Conductors

```
GET /api/v1/conductor
Authorization: Bearer <admin-token>
```

**Response `data`:** `ConductorDTO[]`

```typescript
interface ConductorDTO {
  id?:           string;
  firstName?:    string;
  lastName?:     string;
  licenseNumber?: string;
  contactNumber?: string;
  userId?:       string;
  user?: {
    id:        string;
    email:     string;
    phone:     string | null;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
}
```

### Get Conductor by ID

```
GET /api/v1/conductor/:id
Authorization: Bearer <admin-token>
```

### Create Conductor

```
POST /api/v1/conductor
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request body:**
```json
{
  "email":             "nimal.silva@example.com",
  "password":          "Conductor@123",
  "phone":             "+94712345678",
  "firstName":         "Nimal",
  "lastName":          "Silva",
  "licenseNumber":     "B1234567",
  "licenseExpiryDate": "2028-12-31",
  "licenseDoc":        "<base64-encoded-license-image>",
  "contactNumber":     "+94712345678"
}
```

> `licenseDoc` must be a base64-encoded image or PDF. The frontend should read the file and encode it:
> ```typescript
> const toBase64 = (file: File): Promise<string> =>
>   new Promise((res, rej) => {
>     const reader = new FileReader();
>     reader.onload = () => {
>       // Strip the data URI prefix: "data:image/png;base64,..."
>       const base64 = (reader.result as string).split(',')[1];
>       res(base64);
>     };
>     reader.onerror = rej;
>     reader.readAsDataURL(file);
>   });
> ```

**Response `data`:** `ConductorDTO`

### Update Conductor

```
PATCH /api/v1/conductor/:id
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request body** (all fields optional):
```json
{
  "firstName":     "Nimal",
  "lastName":      "Silva",
  "contactNumber": "+94712000001",
  "licenseNumber": "B7654321",
  "licenseExpiryDate": "2030-06-30"
}
```

### Delete Conductor

```
DELETE /api/v1/conductor/:id
Authorization: Bearer <admin-token>
```

**Response `data`:** `null`

---

## 13. API Reference — Customer Management

### List All Customers

```
GET /api/v1/customer
Authorization: Bearer <admin-token>
```

**Response `data`:** `CustomerDTO[]`

```typescript
interface CustomerDTO {
  id?:            string;
  firstName?:     string;
  lastName?:      string;
  contactNumber?: string;
  address?:       string;
  userId?:        string;
  user?: {
    id:         string;
    email:      string;
    phone:      string | null;
    isVerified: boolean;
    createdAt:  string;
    updatedAt:  string;
  };
}
```

### Get Customer by ID

```
GET /api/v1/customer/:id
Authorization: Bearer <admin-token>
```

### Create Customer

```
POST /api/v1/customer
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request body:**
```json
{
  "email":         "sanduni@example.com",
  "password":      "Customer@123",
  "phone":         "+94756789012",
  "firstName":     "Sanduni",
  "lastName":      "Kumari",
  "contactNumber": "+94756789012",
  "address":       "78 Kandy Road, Kurunegala"
}
```

### Update Customer

```
PATCH /api/v1/customer/:id
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request body** (all fields optional):
```json
{
  "firstName":     "Sanduni",
  "lastName":      "Perera",
  "contactNumber": "+94756000001",
  "address":       "New Address, Colombo"
}
```

### Delete Customer

```
DELETE /api/v1/customer/:id
Authorization: Bearer <admin-token>
```

---

## 14. API Reference — Payment Management

### List Payments (Paginated + Filterable)

```
GET /api/v1/admin/payments
GET /api/v1/admin/payments?status=COMPLETED&paymentMethod=CARD&page=1&limit=20
Authorization: Bearer <admin-token>
```

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | `PENDING` \| `COMPLETED` \| `FAILED` \| `REFUNDED` |
| `paymentMethod` | string | No | `CASH` \| `CARD` \| `MOBILE_WALLET` |
| `fromDate` | string | No | Start date filter `YYYY-MM-DD` |
| `toDate` | string | No | End date filter `YYYY-MM-DD` |
| `page` | number | No | Page number, default `1` |
| `limit` | number | No | Items per page, default `20` |

**Response `data`:** `AdminPaymentPageDto`

```typescript
interface AdminPaymentPageDto {
  items:  AdminPaymentDto[];
  total:  number;
  page:   number;
  limit:  number;
  pages:  number;
}

interface AdminPaymentDto {
  id:             string;
  bookingId:      string;
  customerId:     string;
  customerName:   string;          // "Sanduni Kumari"
  amount:         number;          // in LKR
  paymentMethod:  PaymentMethod;
  status:         PaymentStatus;
  transactionRef: string | null;   // payment gateway reference
  paidAt:         string | null;   // ISO datetime
  refundedAt:     string | null;
  createdAt:      string;
}
```

### Get Single Payment

```
GET /api/v1/admin/payments/:id
Authorization: Bearer <admin-token>
```

**Response `data`:** `AdminPaymentDto`

### Revenue Statistics (Dashboard)

See §9 for the full stats endpoint.

---

## 15. API Reference — Coupon Management

### List All Coupons

```
GET /api/v1/admin/coupons
Authorization: Bearer <admin-token>
```

**Response `data`:** `CouponDto[]`

```typescript
interface CouponDto {
  id:            string;
  code:          string;         // Unique code customers enter (e.g. 'SUMMER20')
  description:   string | null;
  discountType:  DiscountType;   // 'PERCENTAGE' | 'FIXED_AMOUNT'
  discountValue: number;         // 20 → 20% or LKR 20 depending on discountType
  minFare:       number | null;  // Minimum total fare to use this coupon
  maxDiscount:   number | null;  // Cap on discount in LKR (PERCENTAGE type only)
  usageLimit:    number | null;  // null = unlimited
  usedCount:     number;         // how many times it has been used
  perUserLimit:  number;         // max uses per customer (default 1)
  validFrom:     string;         // YYYY-MM-DD
  validUntil:    string;         // YYYY-MM-DD
  isActive:      boolean;
  createdAt:     string;
}
```

### Get Coupon by ID

```
GET /api/v1/admin/coupons/:id
Authorization: Bearer <admin-token>
```

### Create Coupon

```
POST /api/v1/admin/coupons
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request body:**
```json
{
  "code":          "SUMMER20",
  "description":   "Summer promotion — 20% off all rides",
  "discountType":  "PERCENTAGE",
  "discountValue": 20,
  "minFare":       300,
  "maxDiscount":   500,
  "usageLimit":    200,
  "perUserLimit":  1,
  "validFrom":     "2026-06-01",
  "validUntil":    "2026-08-31"
}
```

**Fixed amount coupon example:**
```json
{
  "code":          "FLAT100",
  "discountType":  "FIXED_AMOUNT",
  "discountValue": 100,
  "minFare":       400,
  "validFrom":     "2026-05-01",
  "validUntil":    "2026-05-31"
}
```

**Field rules:**
- `code` — unique across the system, uppercase recommended
- `discountValue` — percentage (1–100) for `PERCENTAGE`, fixed LKR amount for `FIXED_AMOUNT`
- `maxDiscount` — only meaningful for `PERCENTAGE` type; caps the actual discount in LKR
- `usageLimit` — omit or set `null` for unlimited
- `perUserLimit` — defaults to `1` if omitted

**Response `data`:** `CouponDto`

### Update Coupon

```
PATCH /api/v1/admin/coupons/:id
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request body** (all fields optional):
```json
{
  "description":  "Updated description",
  "validUntil":   "2026-09-30",
  "usageLimit":   500,
  "isActive":     true
}
```

> **Note:** `code`, `discountType`, and `discountValue` cannot be changed after creation. Create a new coupon instead.

### Deactivate Coupon

```
DELETE /api/v1/admin/coupons/:id
Authorization: Bearer <admin-token>
```

This **soft-deletes** — sets `isActive = false`. The coupon record is retained.

**Response `data`:** `CouponDto` with `isActive: false`

---

## 16. Supplementary Data — Routes & Schedules

> Routes and schedules are owned by bus owners, but the admin may need to display this data when reviewing buses or resolving support issues.

### List Schedules (as BusOwner / Admin)

```
GET /api/v1/schedules?busId=<uuid>&isActive=true
Authorization: Bearer <admin-token>
```

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `busId` | uuid | No | Filter by bus |
| `routeId` | uuid | No | Filter by route |
| `isActive` | boolean | No | `true` or `false` |

**Response `data`:** `ScheduleDto[]`

```typescript
interface ScheduleDto {
  id:            string;
  busId:         string;
  routeId:       string;
  route?: {
    id:                   string;
    origin:               string;
    destination:          string;
    viaStops:             string[];
    distanceKm:           number;
    estimatedDurationMin: number;
    isActive:             boolean;
  };
  departureTime: string;     // 'HH:MM' 24-hour
  operatingDays: number;     // bitmask — see §19
  baseFare:      number;     // LKR
  isActive:      boolean;
  createdAt:     string;
}
```

### Operating Days — decode bitmask

```typescript
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function decodeOperatingDays(bitmask: number): string[] {
  return DAY_NAMES.filter((_, i) => (bitmask >> i) & 1);
}

// Examples:
decodeOperatingDays(127)  // ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
decodeOperatingDays(62)   // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
decodeOperatingDays(96)   // ['Fri', 'Sat']
```

---

## 17. Supplementary Data — Bookings & Seat Maps

### Get Seat Map

```
GET /api/v1/trips/:scheduleId/:date/seats
Authorization: Bearer <admin-token>
```

**Path parameters:**
- `scheduleId` — UUID of the schedule
- `date` — trip date in `YYYY-MM-DD` format

**Response `data`:** `SeatMapDto`

```typescript
interface SeatMapDto {
  scheduleId: string;
  tripDate:   string;
  rows:       number;
  columns:    number;
  seats: Array<{
    seatNumber: string;              // 'A1', 'B3', etc.
    row:        number;              // 1-indexed
    col:        number;              // 1-indexed
    status:     'FREE' | 'BOOKED' | 'MINE';
  }>;
}
```

> In the admin panel, all seats will show as `FREE` or `BOOKED` (never `MINE` since the admin is not a customer).

### Render Seat Grid

```typescript
function buildGrid(seatMap: SeatMapDto): (SeatStatus | null)[][] {
  const grid: (SeatStatus | null)[][] = Array.from(
    { length: seatMap.rows },
    () => Array(seatMap.columns).fill(null),
  );
  seatMap.seats.forEach((s) => {
    grid[s.row - 1][s.col - 1] = s;
  });
  return grid;
}
```

---

## 18. Pagination Pattern

All list endpoints that can return large datasets use this pattern:

**Query params:** `page` (default `1`), `limit` (default `20`)

**Response shape:**
```typescript
interface Page<T> {
  items: T[];   // some endpoints may use 'data' instead of 'items'
  total: number;
  page:  number;
  limit: number;
  pages: number;
}
```

**Recommended frontend component:**

```typescript
// Fetch helper
async function fetchPage<T>(
  url: string,
  page: number,
  limit: number,
  filters: Record<string, string | number | undefined> = {},
): Promise<Page<T>> {
  const params = new URLSearchParams({
    page:  String(page),
    limit: String(limit),
    ...Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ),
  });
  const res = await api.get(`${url}?${params}`);
  return res.data.data;
}

// Usage
const payments = await fetchPage<AdminPaymentDto>(
  '/api/v1/admin/payments',
  currentPage,
  20,
  { status: 'COMPLETED', paymentMethod: 'CARD' },
);
```

---

## 19. Operating Days Bitmask

Schedules store `operatingDays` as a 7-bit integer. Each bit position maps to a day:

| Bit | Value | Day |
|---|---|---|
| 0 | 1 | Sunday |
| 1 | 2 | Monday |
| 2 | 4 | Tuesday |
| 3 | 8 | Wednesday |
| 4 | 16 | Thursday |
| 5 | 32 | Friday |
| 6 | 64 | Saturday |

**Common values:**

| Value | Binary | Days |
|---|---|---|
| `127` | `1111111` | Every day |
| `62` | `0111110` | Mon – Fri |
| `96` | `1100000` | Fri + Sat |
| `65` | `1000001` | Sun + Sat |
| `126` | `1111110` | Mon – Sat |

**Build bitmask from checkbox selection:**

```typescript
function buildBitmask(selectedDays: number[]): number {
  return selectedDays.reduce((acc, bit) => acc | (1 << bit), 0);
}

// selectedDays: array of bit positions (0=Sun, 1=Mon, ..., 6=Sat)
buildBitmask([1, 2, 3, 4, 5])  // Mon–Fri = 62
```

**Decode bitmask for display:**

```typescript
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatOperatingDays(bitmask: number): string {
  const days = DAY_LABELS.filter((_, i) => (bitmask >> i) & 1);
  if (days.length === 7) return 'Daily';
  if (days.length === 0) return 'None';
  return days.join(', ');
}
```

---

## 20. Seat Layout Grid

Buses define a seat layout in `seatLayoutJson`. When creating a bus, the layout can be auto-generated by specifying just `rows` and `columns`, or fully customised with explicit seat definitions.

**Auto-generated layout** (backend derives seats from rows × columns):
```json
{
  "rows": 10,
  "columns": 4
}
```

**Explicit layout** (custom seat numbering):
```json
{
  "rows": 10,
  "columns": 4,
  "seats": [
    { "seatNumber": "A1", "row": 1, "col": 1 },
    { "seatNumber": "A2", "row": 1, "col": 2 },
    { "seatNumber": "A3", "row": 1, "col": 3 },
    { "seatNumber": "A4", "row": 1, "col": 4 }
  ]
}
```

**Standard naming convention:** Row letter (A–J for 10 rows) + column number (1–4).

When **displaying** the seat map in the admin panel (e.g., to see booking density for a trip):
```
        Col 1   Col 2   Col 3   Col 4
Row A  [ A1 ]  [ A2 ]  [ A3 ]  [ A4 ]   ← all BOOKED (dark)
Row B  [ B1 ]  [ B2 ]  [ B3 ]  [ B4 ]   ← B1, B2 BOOKED; B3, B4 FREE (light)
...
```

Colour suggestion:
- `FREE` → `bg-green-100 border-green-300`
- `BOOKED` → `bg-red-100 border-red-300`
- `MINE` → `bg-blue-200 border-blue-400` (not applicable in admin view)

---

## Appendix A — TypeScript Type Definitions (copy-paste ready)

```typescript
// ── Enums ─────────────────────────────────────────────────────────────────────
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type DocumentType   = 'RC' | 'INSURANCE' | 'FITNESS' | 'OTHER';
type BookingStatus  = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'BOARDED';
type PaymentStatus  = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
type PaymentMethod  = 'CASH' | 'CARD' | 'MOBILE_WALLET';
type DiscountType   = 'PERCENTAGE' | 'FIXED_AMOUNT';

// ── Common ────────────────────────────────────────────────────────────────────
interface ApiResponse<T> { success: boolean; message: string; statusCode: number; data: T; }
interface Page<T>        { items: T[]; total: number; page: number; limit: number; pages: number; }

interface UserDTO {
  id: string; email: string; phone: string | null;
  isVerified: boolean; createdAt: string; updatedAt: string;
}

// ── Bus Owner ─────────────────────────────────────────────────────────────────
interface BusOwnerDto {
  id: string; firstName: string; lastName: string;
  contactNumber: string; nicNumber: string; address: string;
  userId: string; user?: UserDTO;
}

// ── Bus & Documents ───────────────────────────────────────────────────────────
interface SeatLayoutDto {
  rows: number; columns: number;
  seats?: Array<{ seatNumber: string; row: number; col: number }>;
}
interface BusDto {
  id: string; registrationNumber: string; model: string;
  year: number; totalSeats: number; seatLayoutJson: SeatLayoutDto;
  approvalStatus: ApprovalStatus; rejectionReason: string | null;
  ownerId: string; createdAt: string; updatedAt: string;
}
interface BusDocumentDto {
  id: string; busId: string; documentType: DocumentType;
  fileData?: string; uploadedAt: string;
  verifiedAt: string | null; verifiedByAdminId: string | null;
}
interface BusAssignmentDto {
  id: string; busId: string; conductorId: string;
  isActive: boolean; assignedAt: string;
}

// ── Conductor ─────────────────────────────────────────────────────────────────
interface ConductorDTO {
  id?: string; firstName?: string; lastName?: string;
  licenseNumber?: string; contactNumber?: string;
  userId?: string; user?: UserDTO;
}

// ── Customer ──────────────────────────────────────────────────────────────────
interface CustomerDTO {
  id?: string; firstName?: string; lastName?: string;
  contactNumber?: string; address?: string;
  userId?: string; user?: UserDTO;
}

// ── Route & Schedule ──────────────────────────────────────────────────────────
interface RouteDto {
  id: string; origin: string; destination: string;
  viaStops: string[]; distanceKm: number;
  estimatedDurationMin: number; ownerId: string;
  isActive: boolean; createdAt: string; updatedAt: string;
}
interface ScheduleDto {
  id: string; busId: string; routeId: string; route?: RouteDto;
  departureTime: string; operatingDays: number;
  baseFare: number; isActive: boolean; createdAt: string;
}

// ── Search ────────────────────────────────────────────────────────────────────
interface SearchResultDto {
  scheduleId: string; busId: string; registrationNumber: string;
  busModel: string; operatorName: string; origin: string;
  destination: string; viaStops: string[];
  distanceKm: number; estimatedDurationMin: number;
  departureTime: string; estimatedArrival: string;
  baseFare: number; totalSeats: number; availableSeats: number;
  operatingDays: number;
}

// ── Booking ───────────────────────────────────────────────────────────────────
interface BookingDto {
  id: string; customerId: string; scheduleId: string;
  tripDate: string; seatNumbers: string[]; totalFare: number;
  discountAmount: number; payableAmount: number;
  couponCode: string | null; status: BookingStatus;
  bookedAt: string; cancelledAt: string | null;
}
interface SeatMapDto {
  scheduleId: string; tripDate: string; rows: number; columns: number;
  seats: Array<{ seatNumber: string; row: number; col: number; status: 'FREE' | 'BOOKED' | 'MINE' }>;
}
interface TicketDto {
  bookingId: string; ticketRef: string; status: BookingStatus;
  customerName: string; origin: string; destination: string;
  viaStops: string[]; departureTime: string; tripDate: string;
  estimatedArrival: string; busRegistration: string; busModel: string;
  seatNumbers: string[]; totalFare: number; discountAmount: number;
  couponCode: string | null; payableAmount: number;
  paymentMethod: PaymentMethod; paymentStatus: PaymentStatus;
  paidAt: string | null; bookedAt: string;
  qrCodePng?: string;  // base64 PNG of QR code
}

// ── Payments ──────────────────────────────────────────────────────────────────
interface PaymentDto {
  id: string; bookingId: string; amount: number;
  paymentMethod: PaymentMethod; status: PaymentStatus;
  transactionRef: string | null; paidAt: string | null;
  refundedAt: string | null; createdAt: string;
}
interface AdminPaymentDto extends PaymentDto {
  customerId: string; customerName: string;
}
interface PaymentStatsDto {
  totalPayments: number; totalRevenue: number;
  totalRefunded: number; netRevenue: number;
  byMethod: Record<PaymentMethod, number>;
  byStatus:  Record<PaymentStatus,  number>;
}

// ── Coupons ───────────────────────────────────────────────────────────────────
interface CouponDto {
  id: string; code: string; description: string | null;
  discountType: DiscountType; discountValue: number;
  minFare: number | null; maxDiscount: number | null;
  usageLimit: number | null; usedCount: number;
  perUserLimit: number; validFrom: string; validUntil: string;
  isActive: boolean; createdAt: string;
}
interface CouponValidationDto {
  code: string; discountType: DiscountType; discountValue: number;
  discountAmount: number; payableAmount: number;
}

// ── Trip Availability ─────────────────────────────────────────────────────────
interface TripAvailabilityDto {
  id: string; scheduleId: string; tripDate: string;
  isAvailable: boolean; updatedAt: string;
}
```

---

## Appendix B — Quick Start Checklist

- [ ] Configure `NEXT_PUBLIC_API_URL` (or equivalent) pointing to the backend
- [ ] Set `withCredentials: true` on the HTTP client so the httpOnly refresh cookie is sent
- [ ] Implement the 401 → refresh → retry interceptor
- [ ] Store only `accessToken` and `user` in local state (never the refresh token)
- [ ] Decode JWT and confirm `roles` includes `"Admin"` before rendering admin routes
- [ ] All admin endpoints return wrapped `ApiResponse<T>` — read `.data.data` for the payload
- [ ] Paginated endpoints: pass `page` and `limit` as query params; read `.data.data.items` (or `.data.data.data`) for the array
- [ ] Bus document `fileData` is raw base64 — prefix with `data:image/png;base64,` for display
- [ ] Conductor `licenseDoc` upload: use `FileReader.readAsDataURL()` and strip the data-URI prefix before sending
