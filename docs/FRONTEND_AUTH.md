# Frontend Auth Guide — SL Bus Backend

A focused companion to `FRONTEND_INTEGRATION.md`. This document covers
**only authentication**: login, logout, register, and the access /
refresh token lifecycle.

---

## 1. The model in one minute

- **Access token** — short-lived JWT (default 15 minutes). Returned in
  the JSON body of `POST /auth/login` and `POST /auth/refresh`. The
  frontend stores it in memory and sends it on every protected request
  as `Authorization: Bearer <token>`.
- **Refresh token** — longer-lived JWT (default 7 days). Stored as an
  `httpOnly` cookie named `refresh_token`, scoped to `Path=/auth/refresh`.
  The browser sends it automatically when the frontend calls the
  refresh endpoint. **The frontend never reads or stores it.**
- **Logout** — `POST /auth/logout` clears the refresh cookie. The
  frontend should also drop the in-memory access token at the same time.

Why this split? The access token is held in JS memory so XSS can't
persist it across reloads. The refresh token is `httpOnly` so XSS can't
read it. The narrow cookie path means the browser only sends it to
`/auth/refresh`, not to every API call.

---

## 2. Endpoints

All endpoints are under `/auth/*` (note: **no** `/api/v1` prefix).
All responses follow the global envelope from
`FRONTEND_INTEGRATION.md` — i.e. `{ success, message, statusCode, data }`.

### `POST /auth/login`

```ts
// Request body
type LoginRequest = {
  username: string; // email OR phone
  password: string;
};

// data on success (HTTP 200)
type LoginResponseData = {
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

Side effect: sets `refresh_token` cookie (httpOnly, `Path=/auth/refresh`,
`SameSite=Strict`, `Secure` in production).

Throttling: **10 requests / 60 seconds** per IP. Treat HTTP 429 as
"slow down, try again in a moment."

Errors:
- 401 — `{ message: "Invalid username or password" }`
- 429 — too many login attempts.

### `POST /auth/refresh`

No request body — the refresh cookie is sent automatically.

```ts
// data on success (HTTP 200)
type RefreshResponseData = {
  accessToken: string;
};
```

Side effect: rotates the refresh cookie (a new one is set, the old one
implicitly invalidated by virtue of being overwritten).

Errors:
- 401 — `{ message: "Refresh token not found" | "Invalid or expired refresh token" | "User not found" }`.
  The frontend's reaction in all three cases is the same: drop the
  in-memory access token and route the user to `/login`.

### `POST /auth/logout`

No request body. Returns HTTP 200 with `data: null`. Clears the refresh
cookie. The frontend should also clear its in-memory access token
regardless of the response.

### `POST /auth/register`

```ts
// Request body — same shape as login
type RegisterRequest = {
  username: string; // becomes the user's email
  password: string;
};

// data on success (HTTP 201) — no token
type RegisterResponseData = {
  id: string;
  email: string;
  phone: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};
```

**Important:** registration does **not** log the user in and does
**not** return any token. After a successful register, redirect the
user to the login screen (or call `login` with the same credentials
yourself).

Errors:
- 400 — `{ message: "User with this email or phone already exists" }`.

---

## 3. JWT payload

The access token is a standard JWT. After base64-decoding the middle
segment you get:

```ts
type AccessTokenPayload = {
  sub: string;       // user id (UUID)
  email: string;
  roles: string[];   // e.g. ["Admin"], ["BusOwner"], ["Customer"], ["Conductor"]
  iat: number;
  exp: number;       // unix seconds
};
```

You can decode the JWT for **display / routing** purposes (e.g. show
admin nav items only when `roles.includes('Admin')`). **Never rely on
the decoded payload for security** — `RolesGuard` on the backend is
the source of truth and will return 403 if a role is missing.

---

## 4. Required CORS / cookie setup

Because the refresh cookie has to traverse origins (frontend on one
domain, backend on another), both sides need the right config.

**Frontend (axios)**
```ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // required so the cookie is sent
});
```

**Backend (in `src/main.ts`)**
```ts
app.enableCors({
  origin: 'https://your-frontend.example.com', // not '*'
  credentials: true,
});
```

If `withCredentials` is missing on the frontend OR `origin` is `*` /
`credentials: false` on the backend, the browser will silently drop the
refresh cookie and `/auth/refresh` will return 401 forever. The backend
currently does not enable CORS — coordinate with the backend team to
turn it on with the exact frontend origin before testing on different
hosts.

In production, also ensure the frontend is served over **HTTPS** —
the cookie is set with `Secure`, so it won't be sent on plain http.

---

## 5. Recommended implementation

This builds on the axios client from `FRONTEND_INTEGRATION.md §4.2`.
The key pieces are: an in-memory token store, an axios request
interceptor, and a single-flight refresh on 401.

### 5.1 In-memory access-token store

```ts
// src/auth/tokenStore.ts
let accessToken: string | null = null;
const subscribers = new Set<(token: string | null) => void>();

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
    subscribers.forEach((fn) => fn(token));
  },
  subscribe: (fn: (token: string | null) => void) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};
```

Why in-memory and not `localStorage`? `localStorage` is readable by any
script that runs on the page, so a single XSS bug leaks every user's
access token. Memory storage means the token dies on tab close — which
is fine, because the refresh cookie can mint a new one transparently
on the next load (see §5.4 "boot sequence").

### 5.2 Login / logout / register actions

```ts
// src/auth/actions.ts
import { api } from '../api/client';
import { tokenStore } from './tokenStore';

type User = {
  id: string;
  email: string;
  phone: string;
  isVerified: boolean;
};

type LoginInput = { username: string; password: string };

export const login = async (input: LoginInput) => {
  const result = await api.post<{ accessToken: string; user: User }>(
    '/auth/login',
    input,
  );
  tokenStore.set(result.accessToken);
  return result.user;
};

export const logout = async () => {
  try {
    await api.post<null>('/auth/logout');
  } finally {
    // Clear locally even if the network call fails — the user's intent
    // was to log out, and the in-memory token is the only thing the
    // browser actually trusts.
    tokenStore.set(null);
  }
};

export const register = (input: LoginInput) =>
  api.post<User>('/auth/register', input);
```

### 5.3 Bearer header + single-flight refresh on 401

This is the core of the auth wiring. Every request automatically gets
the bearer header, and any 401 from a non-auth endpoint triggers one
refresh attempt that all concurrent failed requests share.

```ts
// src/api/client.ts (auth-relevant excerpt)
import axios, { AxiosError } from 'axios';
import { tokenStore } from '../auth/tokenStore';
import { ApiException, ApiSuccess } from './types';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Attach bearer token on every request.
apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: many 401s in flight at once produce ONE refresh.
let refreshPromise: Promise<string> | null = null;

const refresh = (): Promise<string> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post<ApiSuccess<{ accessToken: string }>>(
      `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then((res) => {
      const token = res.data.data.accessToken;
      tokenStore.set(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ message: string; statusCode: number }>) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.includes('/auth/');

    if (
      status === 401 &&
      original &&
      !isAuthEndpoint &&
      !(original as { _retried?: boolean })._retried
    ) {
      (original as { _retried?: boolean })._retried = true;
      try {
        const token = await refresh();
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      } catch {
        tokenStore.set(null);
        // fall through and let the error reach the UI; AuthGate will
        // notice the cleared token and route to /login.
      }
    }

    const body = error.response?.data;
    if (body && 'message' in body && 'statusCode' in body) {
      throw new ApiException(body.message, body.statusCode);
    }
    throw new ApiException(error.message || 'Network error', status ?? 0, true);
  },
);
```

Two important points:

- `isAuthEndpoint` skips refresh on calls to `/auth/login`,
  `/auth/refresh`, `/auth/logout`. This prevents an infinite loop where
  a failing refresh triggers another refresh.
- `_retried` ensures we only retry **once** per request.

### 5.4 Boot sequence — silent re-login after reload

The access token lives in memory, so a page reload loses it. But the
refresh cookie survives. On app boot, try a refresh once; if it
succeeds the user is back in without seeing the login screen.

```tsx
// src/auth/AuthBootstrap.tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { tokenStore } from './tokenStore';

export const AuthBootstrap = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .post<{ accessToken: string }>('/auth/refresh')
      .then((res) => {
        if (!cancelled) tokenStore.set(res.accessToken);
      })
      .catch(() => {
        // No / expired refresh cookie — user just isn't logged in.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <FullPageSpinner />;
  return <>{children}</>;
};
```

Mount `<AuthBootstrap>` at the top of your app so every page renders
with a known auth state.

### 5.5 Route guards

```tsx
// src/auth/RequireAuth.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthToken } from './useAuthToken';

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthToken();
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};
```

```ts
// src/auth/useAuthToken.ts
import { useEffect, useState } from 'react';
import { tokenStore } from './tokenStore';

export const useAuthToken = () => {
  const [token, setToken] = useState(tokenStore.get());
  useEffect(() => tokenStore.subscribe(setToken), []);
  return token;
};
```

For role-gated routes, decode the JWT and check `roles` (display only —
the server will enforce):

```ts
// src/auth/decode.ts
export const decodeToken = (token: string) => {
  const [, payload] = token.split('.');
  if (!payload) return null;
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
    sub: string;
    email: string;
    roles: string[];
    exp: number;
  };
};
```

```tsx
// src/auth/RequireRole.tsx
import { Navigate } from 'react-router-dom';
import { useAuthToken } from './useAuthToken';
import { decodeToken } from './decode';

export const RequireRole = ({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) => {
  const token = useAuthToken();
  const payload = token ? decodeToken(token) : null;
  if (!payload) return <Navigate to="/login" replace />;
  if (!payload.roles.includes(role)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
};
```

---

## 6. Common gotchas

- **Calling refresh manually before requests is unnecessary.** The
  response interceptor handles 401 → refresh → retry transparently.
  Adding pre-emptive timers usually causes more problems than it solves.
- **Don't store the access token in localStorage / sessionStorage.**
  See §5.1.
- **Don't try to read the refresh cookie from JS.** It's `httpOnly` —
  the browser hides it from `document.cookie` on purpose.
- **CORS without `credentials: true` will silently drop cookies.** The
  refresh flow looks like it works on `localhost` but fails on a
  different domain because the browser never sends the cookie.
- **The backend uses `path=/auth/refresh` for the cookie.** That means
  only requests to that exact path send the cookie. If you proxy
  `/auth` through Next.js / Vite, make sure the path is preserved.
- **Logout might fail with 401 if the access token is already expired.**
  That's fine — clear the token locally anyway (the `finally` block in
  §5.2 already does this).
- **Throttling on login is 10/min per IP.** Show a friendly "too many
  attempts" message on HTTP 429 instead of a generic error.

---

## 7. Test checklist

When you've wired everything up, verify:

- [ ] Login → access token is in memory, `/api/v1/admin/...` calls
      succeed.
- [ ] Reload the page → app bootstraps via `/auth/refresh`, user stays
      signed in.
- [ ] Wait > 15 min, click anything → 401 → silent refresh → request
      retried → succeeds. (You can simulate by setting
      `ACCESS_TOKEN_EXPIRATION=10s` in the backend `.env`.)
- [ ] Fire 5 requests at once that all 401 → only ONE call to
      `/auth/refresh` goes out (DevTools > Network).
- [ ] Logout → access token is cleared, `/auth/refresh` returns 401,
      protected pages redirect to `/login`.
- [ ] Register → does NOT log in; user lands on the login screen.
- [ ] Bad password → 401, user stays on login screen with the message.
- [ ] Hammer login 11 times → 429, friendly message shown.
