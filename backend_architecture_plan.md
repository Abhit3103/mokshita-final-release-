# Mokshita Enterprises - Backend Architecture Migration Plan

This document outlines the complete architectural extraction and refactoring plan to move the tightly coupled frontend logic and Supabase dependency into a scalable, production-ready Node.js backend hosted on a Hostinger VPS.

## 1. Backend API Design

All direct Supabase queries and business logic will be moved behind these RESTful endpoints:

### Auth & Users (`/api/auth`)
* `POST /api/auth/register` - Create new user.
* `POST /api/auth/login` - Authenticate, returns JWT.
* `GET /api/auth/me` - Get current user profile (Requires Auth JWT).
* `PUT /api/auth/profile` - Update user address/phone data.

### Products (`/api/products`)
* `GET /api/products` - Fetch all products (public).
* `GET /api/products/:slug` - Fetch single product (public).
* `POST /api/products` - Add new product (Requires Admin JWT).
* `PUT /api/products/:id` - Update product (Requires Admin JWT).
* `DELETE /api/products/:id` - Delete product (Requires Admin JWT).

### Cart (`/api/cart`)
*(Requires Auth JWT or Guest Session ID)*
* `GET /api/cart` - Fetch cart items & total count.
* `POST /api/cart` - Add item to cart.
* `PUT /api/cart/item/:id` - Update quantity.
* `DELETE /api/cart/item/:id` - Remove item.
* `POST /api/cart/sync` - Merge localStorage guest cart into user cart upon login.

### Orders & Checkout (`/api/orders`)
* `POST /api/orders/checkout` - Create order. Server validates prices, calculates subtotal, applies rate limits, and processes anti-spam checks.
* `GET /api/orders/my-orders` - Fetch orders for the logged-in user.

### Admin Operations (`/api/admin/orders`)
*(Requires Admin JWT)*
* `GET /api/admin/orders` - Fetch all orders.
* `PUT /api/admin/orders/:id/status` - Update status (`received`, `shipped`, `delivered`, `cancelled`).
* `PUT /api/admin/orders/:id/tracking` - Add/update `tracking_note`.

---

## 2. Database Schema Design (PostgreSQL)

Move away from JSONB where possible to maintain referential integrity.

* **`users`**: `id` (UUID, PK), `email` (Unique), `password_hash`, `role` (customer/admin), `full_name`, `phone`, `address_line`, `city`, `state`, `pincode`, `country`, `created_at`.
* **`products`**: `id` (UUID, PK), `slug` (Unique), `name`, `price`, `category`, `stock`, `description`, `image_url`, `created_at`.
* **`carts`**: `id` (UUID, PK), `user_id` (FK).
* **`cart_items`**: `id` (UUID, PK), `cart_id` (FK), `product_id` (FK), `quantity`.
* **`orders`**: `id` (UUID, PK), `user_id` (FK), `order_number` (Unique), `customer_name`, `email`, `phone`, `address_line`, `city`, `state`, `pincode`, `payment_method`, `subtotal`, `shipping_cost`, `total`, `status`, `tracking_note`, `shipped_at`, `delivered_at`, `created_at`.
* **`order_items`**: `id` (UUID, PK), `order_id` (FK), `product_id` (FK), `quantity`, `price_at_time`.

---

## 3. Authentication System (JWT-Based)

* **Flow**: User logs in -> Server verifies hash -> Server returns JWT.
* **Storage**: Frontend stores JWT in `localStorage` or `HttpOnly` cookies.
* **Protection**: `authenticateToken` middleware verifies the JWT. `isAdmin` middleware restricts `/api/admin/*` routes.

---

## 4. Code Refactoring Plan

### What leaves the Frontend:
* **Supabase Client**: Delete `@supabase/supabase-js` imports and `window.supabaseClient`.
* **Pricing Math**: Remove price calculation logic from `cart.js`. The backend defines the true price.
* **Spam/Rate Limiting**: Remove 60-second limit from localStorage.
* **Timestamps**: Remove `new Date().toISOString()` from `admin_orders.js`.

### What moves to the Backend:
* **Cart Merging**: Backend UPSERTs local cart data on login.
* **Checkout Validation**: Validating true DB prices, creating the order number, and generating relations.
* **Auth State**: Password hashing, token generation, role verification.

### What remains in the Frontend:
* **UI State Management**: DOM manipulation, toasts, cart badges, modals.
* **Guest Cart**: `mokshita_cart` in localStorage for unauthenticated users.
* **API Calls**: Replaced with standard `fetch()` or `axios`.

---

## 5. Folder Structure (Node.js + Express)

```text
backend-service/
├── server.js              # Entry point & Express setup
├── .env                   # DB credentials, JWT secret, Port
├── src/
│   ├── config/            # Database connection
│   ├── middlewares/       # auth.middleware.js, admin.middleware.js
│   ├── routes/            # auth.routes.js, product.routes.js, order.routes.js
│   ├── controllers/       # Req/Res handlers
│   ├── services/          # Business logic & math
│   └── models/            # Schema definitions
```

---

## 6. Frontend Integration Plan

Define a global API utility in the frontend:

```javascript
const API_BASE_URL = 'https://api.mokshita-enterprises.com';

async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });

    if (!response.ok) throw new Error(await response.text());
    return response.json();
}
```

---

## 7. Deployment Plan (VPS - Hostinger)

1. **Environment Setup (Ubuntu Server)**
   * Install Node.js & NPM via NodeSource.
   * Install PostgreSQL (`postgresql postgresql-contrib`).
   * Setup `.env` file securely.
2. **Process Management (PM2)**
   * Install PM2: `sudo npm install -g pm2`
   * Run server: `pm2 start server.js --name "mokshita-api"`
   * Enable auto-restart: `pm2 startup && pm2 save`
3. **Reverse Proxy (Nginx) & SSL**
   * Install Nginx (`sudo apt install nginx`).
   * Proxy `api.yourdomain.com` (port 80/443) to Node app (port 3000).
   * Secure with Let's Encrypt: `sudo certbot --nginx -d api.yourdomain.com`
