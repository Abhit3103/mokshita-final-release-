# CORS Setup — Mokshita API

## Overview

Cross-origin access is configured in **`src/config/cors.config.js`** and applied in **`src/app.js`**. The `cors` package is already installed (`^2.8.5`).

Browser clients (storefront on port **3001**, admin dashboard on Vite ports) call the API on **`http://localhost:3000`**. CORS headers are required for `fetch` / `axios` from a different origin.

## Allowed origins

### Development (`NODE_ENV` ≠ `production`)

These origins are **always** allowed, plus any entry in `ALLOWED_ORIGINS`:

| Origin | Typical use |
|--------|-------------|
| `http://localhost:3001` | Storefront / static dev server |
| `http://127.0.0.1:3001` | Same (IP form) |
| `http://localhost:5173` | Vite admin dashboard (default) |
| `http://127.0.0.1:5173` | Vite (IP form) |
| `http://localhost:5174` | Alternate Vite port |
| `http://localhost:5500` | Live Server / legacy static |
| `http://127.0.0.1:5500` | Live Server (IP form) |

### Production (`NODE_ENV=production`)

**Only** origins listed in `ALLOWED_ORIGINS` are allowed. No dev defaults.

Example `.env`:

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://mokshita.com,https://www.mokshita.com,https://admin.mokshita.com
```

There is **no** `origin: '*'` wildcard. Unknown origins receive a 403 CORS error.

## Environment variable

| Variable | Description |
|----------|-------------|
| `ALLOWED_ORIGINS` | Comma-separated list of full origins (`scheme://host:port`) |

Restart the API after changing `.env`.

## Supported methods & headers

**Methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`

**Request headers:**

- `Content-Type` — JSON and `multipart/form-data` uploads
- `Authorization` — JWT (`Bearer` token)
- `Accept`, `Origin`, `X-Requested-With`

**Credentials:** `credentials: true` — cookies / `Authorization` on cross-origin requests (frontend must use `withCredentials: true` if sending cookies; axios interceptor already sets `Authorization` from `localStorage`).

**Preflight:** `OPTIONS` returns `204` with `Access-Control-Max-Age` (10 min dev, 24 h production).

## Upload compatibility

- `POST /api/upload` uses `multipart/form-data` with `Authorization` header.
- CORS allows `Content-Type` and `Authorization` on preflight.
- Static files: `GET /uploads/...` is same-origin to the API; cross-origin **images** in `<img src>` use Helmet `crossOriginResourcePolicy: cross-origin` so the storefront on `:3001` can display images from `:3000`.

## JWT / admin dashboard

- Admin login: `POST /api/auth/login` — CORS applies like any route.
- Protected routes: send `Authorization: Bearer <token>`; CORS does not block this header when origin is allowed.
- Admin dashboard (`test-dashboard-mok`) should set `VITE_API_URL=http://localhost:3000/api` and run on an allowed origin (5173 or 3001).

## Production strategy

1. Set `NODE_ENV=production` on the API host.
2. Set `ALLOWED_ORIGINS` to your real site URLs only.
3. Deploy API at e.g. `https://api.mokshita.com` — the API origin itself does not need to be in the list (only **browser** frontends do).
4. Point storefront/admin env to the production API URL.
5. On startup, if `ALLOWED_ORIGINS` is empty in production, a warning is logged.

Optional future split (same env var):

```env
ALLOWED_ORIGINS=https://mokshita.com,https://www.mokshita.com,https://admin.mokshita.com
```

## Troubleshooting

### Browser: “CORS policy blocked”

1. Check the **exact** origin in DevTools → Network (e.g. `http://127.0.0.1:3001` vs `http://localhost:3001` — both are listed in dev).
2. Restart the API after editing `.env`.
3. In production, confirm the origin is in `ALLOWED_ORIGINS`.

### OPTIONS preflight fails

- Ensure the client does not send custom headers outside the allowed list.
- Verify the API is reachable at `http://localhost:3000`.

### Upload works in Postman but not browser

- Postman does not enforce CORS. Confirm `Authorization` and `Content-Type` are allowed and origin is in the list.

### Images from `/uploads` do not show on storefront

- API must be running and URL must use the API host (e.g. `http://localhost:3000/uploads/...`).
- Helmet CORP is set to `cross-origin` for this case.

### Quick test (terminal)

```bash
# Preflight
curl -i -X OPTIONS "http://localhost:3000/api/products" \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: GET"

# GET with origin
curl -i "http://localhost:3000/api/products" \
  -H "Origin: http://localhost:3001"
```

Expect `Access-Control-Allow-Origin: http://localhost:3001` and `Access-Control-Allow-Credentials: true`.

## Files

| File | Role |
|------|------|
| `src/config/cors.config.js` | Origin lists, middleware factory |
| `src/app.js` | Applies CORS + Helmet CORP |
| `.env` / `.env.example` | `ALLOWED_ORIGINS` |
