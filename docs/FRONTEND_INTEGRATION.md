# Frontend Integration Guide — SL Bus Backend

This document describes the contract between the SL Bus backend (NestJS)
and a React + TypeScript frontend, and the recommended way to wire up
fetching, auth, and response handling so every screen handles success
and errors the same way.

Audience: frontend developers integrating against this API.

---

## 1. Base URL & global setup

- Default base URL: `http://localhost:4000` (port from backend `.env`).
- All resource endpoints are mounted under `/api/v1/*`.
- The auth endpoints are under `/auth/*` (no `api/v1` prefix).
- Swagger UI: `GET /api/v1/swagger-ui` — useful for exploring the live schema.
- Throttling: 100 requests / 60s globally; login is stricter (10 / 60s).
  Treat HTTP **429** as a transient error and retry with backoff.
- CORS: the backend currently does not enable CORS in `main.ts`. If the
  frontend is on a different origin, ask the backend team to enable
  `app.enableCors({ origin: <frontend>, credentials: true })`. The
  `credentials: true` flag is required for the refresh-token cookie.

Recommended environment in your frontend project:

```env
# .env
VITE_API_BASE_URL=http://localhost:4000
```

---

## 2. The response envelope

Every JSON response (success or error) coming out of this API has the
same top-level shape. This is enforced server-side by
`ResponseInterceptor` (success) and `GlobalHttpExceptionFilter` (error),
so the frontend should never see anything else.

### 2.1 Success

```ts
type ApiSuccess<T> = {
  success: true;
  message: string;
  statusCode: number;     // HTTP status — always present on success
  data: T;                // the actual payload (object, array, or page)
};
```

Example (`GET /api/v1/admin/coupons`):

```json
{
  "success": true,
  "message": "Coupons fetched successfully",
  "statusCode": 200,
  "data": [ { "id": "...", "code": "WELCOME10" } ]
}
```

### 2.2 Error

```ts
type ApiError = {
  success: false;
  message: string;
  statusCode: number;     // HTTP status (4xx / 5xx)
};
```

Example (`POST /auth/login` with bad creds):

```json
{
  "success": false,
  "message": "Invalid username or password",
  "statusCode": 401
}
```

There is **no `errors` array, no `error` field, no nested error object.**
Validation failures (when `class-validator` rejects a body) come back
with `message: "Validation failed"` and the same envelope.

### 2.3 Paginated payloads

Paginated list endpoints embed a page object as `data`. The shape is
always:

```ts
type PageResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};
```

So a paginated call looks like
`ApiSuccess<PageResponse<T>>` — i.e. `response.data.items` is the row
array. Endpoints currently using this shape:

- `GET /api/v1/admin/bus-owners`
- `GET /api/v1/admin/payments`
- `GET /api/v1/search/buses`

Other list endpoints (e.g. `GET /api/v1/admin/coupons`,
`GET /api/v1/admin/buses`, `GET /api/v1/conductor`,
`GET /api/v1/customer`, `GET /api/v1/routes`,
`GET /api/v1/schedules`, `GET /api/v1/bookings`) currently return
plain arrays as `data: T[]` (no pagination wrapper).

**Important:** treat the page wrapper as `items`, never `data`. The
outer envelope already uses `data` as the wrapper key; using `data`
again on the page would shadow it (`response.data.data`).

---

## 3. Authentication model

- **Access token**: short-lived JWT, returned in the **JSON body** of
  `POST /auth/login` and `POST /auth/refresh`. Frontend stores it in
  memory (or a state container). Sent on every request as
  `Authorization: Bearer <token>`.
- **Refresh token**: long-lived JWT, set as an `httpOnly` cookie scoped
  to `/auth/refresh`. The browser sends it automatically — the
  frontend never reads it.
- **Logout**: `POST /auth/logout` clears the cookie.

### 3.1 Login response

```ts
type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    phone: string;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
};
```

Wrapped: `ApiSuccess<LoginResponse>`.

### 3.2 Roles

JWT claims include `roles: string[]` (e.g. `["Admin"]`, `["BusOwner"]`,
`["Conductor"]`, `["Customer"]`). The frontend can decode the JWT for
display/routing purposes, but **must not** trust roles for authorization
decisions — those are enforced server-side by `RolesGuard`.

---

## 4. Recommended frontend wiring

This section gives a copy-pasteable foundation. It uses **axios** (well
suited for interceptors) and **TanStack Query** (good defaults for
caching/loading states), but the same pattern works with `fetch`.

```bash
npm i axios @tanstack/react-query
```

### 4.1 Shared types

```ts
// src/api/types.ts
export type ApiSuccess<T> = {
  success: true;
  message: string;
  statusCode: number;
  data: T;
};

export type ApiError = {
  success: false;
  message: string;
  statusCode: number;
};

export type PageResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export class ApiException extends Error {
  readonly statusCode: number;
  readonly isNetwork: boolean;

  constructor(message: string, statusCode: number, isNetwork = false) {
    super(message);
    this.statusCode = statusCode;
    this.isNetwork = isNetwork;
  }
}
```

### 4.2 Axios client + interceptors

```ts
// src/api/client.ts
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { ApiError, ApiException, ApiSuccess } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  // required so the refresh-token cookie is sent on /auth/refresh
  withCredentials: true,
});

// ── Attach bearer token ────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Refresh-on-401 with single-flight queue ────────────────────────
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<ApiSuccess<{ accessToken: string }>>(
        `${BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((res) => {
        const token = res.data.data.accessToken;
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config;
    const status = error.response?.status;

    // Try to refresh once on 401, then retry the original request.
    if (
      status === 401 &&
      original &&
      !(original as { _retried?: boolean })._retried &&
      !original.url?.includes('/auth/')
    ) {
      (original as { _retried?: boolean })._retried = true;
      try {
        const token = await refreshAccessToken();
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      } catch {
        setAccessToken(null);
        // bubble up so the app can route to /login
      }
    }

    // Normalise every error into ApiException.
    if (error.response?.data && 'success' in error.response.data) {
      const body = error.response.data;
      throw new ApiException(body.message, body.statusCode);
    }

    // Network error / no response.
    throw new ApiException(
      error.message || 'Network error',
      status ?? 0,
      true,
    );
  },
);

// ── Generic helpers — they unwrap the envelope for you. ────────────
const unwrap = <T>(res: AxiosResponse<ApiSuccess<T>>): T => res.data.data;

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    apiClient.get<ApiSuccess<T>>(url, { params }).then(unwrap),

  post: <T, B = unknown>(url: string, body?: B) =>
    apiClient.post<ApiSuccess<T>>(url, body).then(unwrap),

  patch: <T, B = unknown>(url: string, body?: B) =>
    apiClient.patch<ApiSuccess<T>>(url, body).then(unwrap),

  put: <T, B = unknown>(url: string, body?: B) =>
    apiClient.put<ApiSuccess<T>>(url, body).then(unwrap),

  delete: <T = void>(url: string) =>
    apiClient.delete<ApiSuccess<T>>(url).then(unwrap),
};
```

After this setup, every call site receives **`data`** directly — never
the envelope. Errors are always an `ApiException` with `statusCode` and
a human-readable `message`.

### 4.3 Typed endpoint wrappers

Group by feature so the screens stay clean:

```ts
// src/api/auth.ts
import { api, setAccessToken } from './client';

export type LoginInput = { username: string; password: string };

export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    phone: string;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export const login = async (input: LoginInput) => {
  const result = await api.post<LoginResponse>('/auth/login', input);
  setAccessToken(result.accessToken);
  return result;
};

export const logout = async () => {
  await api.post<null>('/auth/logout');
  setAccessToken(null);
};
```

```ts
// src/api/admin.ts
import { api } from './client';
import type { PageResponse } from './types';

export type BusOwner = {
  id: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  nicNumber: string;
  address: string;
  user?: {
    id: string;
    email: string;
    phone: string;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type BusOwnerListParams = {
  search?: string;
  email?: string;
  contactNumber?: string;
  isActive?: boolean;
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
};

export const listBusOwners = (params: BusOwnerListParams = {}) =>
  api.get<PageResponse<BusOwner>>('/api/v1/admin/bus-owners', params);
```

### 4.4 Using it with TanStack Query

```ts
// src/features/admin/useBusOwners.ts
import { useQuery } from '@tanstack/react-query';
import { listBusOwners, BusOwnerListParams } from '../../api/admin';

export const useBusOwners = (params: BusOwnerListParams) =>
  useQuery({
    queryKey: ['bus-owners', params],
    queryFn: () => listBusOwners(params),
    keepPreviousData: true,
  });
```

```tsx
// src/features/admin/BusOwnerList.tsx
import { useBusOwners } from './useBusOwners';

export const BusOwnerList = () => {
  const { data, isLoading, error } = useBusOwners({ page: 1, limit: 20 });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={(error as Error).message} />;
  if (!data) return null;

  return (
    <div>
      <p>Total: {data.total}</p>
      <ul>
        {data.items.map((owner) => (
          <li key={owner.id}>
            {owner.firstName} {owner.lastName} — {owner.user?.email}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

Notice:
- `data` is the unwrapped page object (`{ items, total, page, limit, pages }`).
- We read rows from `data.items`, not `data.data`.
- Errors are an `ApiException` with `.message` and `.statusCode`.

### 4.5 Mutations + form errors

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiException } from '../../api/client';

type CreateCouponInput = { code: string; discountPercent: number };
type Coupon = { id: string; code: string; discountPercent: number };

export const useCreateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCouponInput) =>
      api.post<Coupon, CreateCouponInput>('/api/v1/admin/coupons', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
};

// in the component
const { mutateAsync, isPending } = useCreateCoupon();
try {
  await mutateAsync({ code: 'WELCOME10', discountPercent: 10 });
  toast.success('Coupon created');
} catch (err) {
  if (err instanceof ApiException) {
    if (err.statusCode === 409) {
      // duplicate code — show next to the field
      setFieldError('code', err.message);
    } else {
      toast.error(err.message);
    }
  }
}
```

---

## 5. Status code → UX mapping

The backend uses standard HTTP status codes; map them in one place.

| Status | Meaning                       | Recommended UX                                                |
|--------|-------------------------------|---------------------------------------------------------------|
| 200    | OK (read / update)            | Render data.                                                  |
| 201    | Created                       | Show success toast, navigate / append to list.                |
| 400    | Validation / bad input        | Show inline form errors (`message` is the summary).           |
| 401    | Not logged in / token expired | Interceptor refreshes once; if that fails → route to /login.  |
| 403    | Logged in but missing role    | Show "You don't have access" page; do not retry.              |
| 404    | Resource not found            | Show empty/404 state.                                         |
| 409    | Conflict (duplicate, etc.)    | Show the message inline next to the conflicting field.        |
| 422    | Unprocessable (state error)   | Show toast with `message`.                                    |
| 429    | Throttled                     | Toast "Too many requests, try again in a moment." Backoff.    |
| 5xx    | Server error                  | Generic error toast + Sentry/log capture; don't surface stack. |

Centralised helper:

```ts
// src/api/errors.ts
import { ApiException } from './client';

export const formatApiError = (err: unknown): string => {
  if (err instanceof ApiException) {
    if (err.statusCode === 429) return 'Too many requests. Please wait a moment.';
    if (err.statusCode >= 500) return 'Something went wrong. Please try again.';
    return err.message;
  }
  return 'Unexpected error.';
};
```

---

## 6. File-handling notes

- Bus document upload (`POST /api/v1/buses/:id/documents`) accepts
  base64-encoded content in JSON; there is no `multipart/form-data`
  endpoint at the moment. Convert files via `FileReader` before send.

---

## 7. Quick reference — the contract in one paragraph

Every response is JSON of the form
`{ success, message, statusCode, ... }`. On success there is a `data`
field; on error there isn't. Lists may be a plain `T[]` or a paginated
`{ items: T[], total, page, limit, pages }` — never `{ data: T[] }`.
Auth uses a bearer access token (in JSON body) plus an httpOnly refresh
cookie scoped to `/auth/refresh`. The frontend should set up axios with
`withCredentials: true`, attach the bearer token via a request
interceptor, refresh once on 401 via a single-flight promise, and
normalise every failure into an `ApiException(message, statusCode)`
that screens render through one shared `formatApiError` helper.
