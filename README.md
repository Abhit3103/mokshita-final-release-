# Mokshita Enterprises — Backend API

Production-ready REST API built with **Node.js**, **Express.js**, and **PostgreSQL**.

---

## Architecture Overview

```
server.js                    # Entry point — starts Express + validates DB
src/
├── app.js                   # Express app config (CORS, helmet, rate limiter, routes)
├── config/
│   ├── db.js                # PostgreSQL connection pool (pg)
│   └── migrate.js           # Idempotent schema migration script
├── routes/                  # Route definitions + validation chains
│   ├── auth.routes.js
│   ├── product.routes.js
│   ├── cart.routes.js
│   ├── order.routes.js
│   └── admin.routes.js
├── controllers/             # Request/response handlers
│   ├── auth.controller.js
│   ├── product.controller.js
│   ├── cart.controller.js
│   ├── order.controller.js
│   └── admin.controller.js
├── middlewares/
│   ├── auth.middleware.js       # JWT verification → req.user
│   ├── admin.middleware.js      # Role check → req.user.role === 'admin'
│   ├── validate.middleware.js   # express-validator error formatter
│   └── errorHandler.middleware.js  # Global error handler
└── utils/
    ├── jwt.util.js          # Token signing
    └── helpers.util.js      # generateOrderNumber, slugify, asyncHandler
```

---

## API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint             | Auth         | Description                |
|--------|----------------------|--------------|----------------------------|
| POST   | `/register`          | Public       | Create new customer account |
| POST   | `/login`             | Public       | Authenticate, get JWT token |
| GET    | `/me`                | JWT Required | Get current user profile    |
| PUT    | `/profile`           | JWT Required | Update address/phone        |

### Products (`/api/products`)
| Method | Endpoint             | Auth         | Description                |
|--------|----------------------|--------------|----------------------------|
| GET    | `/`                  | Public       | List products (filterable) |
| GET    | `/:slug`             | Public       | Get single product          |
| POST   | `/`                  | Admin JWT    | Create product              |
| PUT    | `/:id`               | Admin JWT    | Update product              |
| DELETE | `/:id`               | Admin JWT    | Delete product              |

**GET `/api/products` Query Parameters:**
- `category`, `min_price`, `max_price`, `in_stock=true`
- `sort` (created_at|price|name|stock), `order` (asc|desc)
- `page`, `limit`

### Cart (`/api/cart`)
| Method | Endpoint             | Auth         | Description                |
|--------|----------------------|--------------|----------------------------|
| GET    | `/`                  | JWT Required | Fetch cart with totals      |
| POST   | `/`                  | JWT Required | Add item to cart            |
| PUT    | `/item/:id`          | JWT Required | Update item quantity        |
| DELETE | `/item/:id`          | JWT Required | Remove item from cart       |
| POST   | `/sync`              | JWT Required | Merge guest cart on login   |

### Orders (`/api/orders`)
| Method | Endpoint             | Auth         | Description                |
|--------|----------------------|--------------|----------------------------|
| POST   | `/checkout`          | Optional JWT | Place an order (guest OK)  |
| GET    | `/my-orders`         | JWT Required | Get user's order history    |

### Admin Orders (`/api/admin/orders`)
| Method | Endpoint                    | Auth       | Description              |
|--------|-----------------------------|------------|--------------------------|
| GET    | `/`                         | Admin JWT  | List all orders           |
| PUT    | `/:id/status`               | Admin JWT  | Update order status       |
| PUT    | `/:id/tracking`             | Admin JWT  | Update tracking note      |

---

## Local Setup

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 14

### 1. Clone and install

```bash
git clone <repo-url>
cd mokshita-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

### 3. Create the database

```sql
-- Connect to PostgreSQL and run:
CREATE DATABASE mokshita_db;
```

### 4. Run migrations

```bash
npm run migrate
```

### 5. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3000`.

**Health check:** `GET http://localhost:3000/health`

---

## Creating the First Admin User

After running migrations, manually promote a registered user to admin via psql:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-admin@email.com';
```

---

## VPS Deployment (Hostinger — Ubuntu)

### 1. Server Setup

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Verify installs
node -v && npm -v && psql --version
```

### 2. Configure PostgreSQL

```bash
sudo -u postgres psql

# Inside psql:
CREATE DATABASE mokshita_db;
CREATE USER mokshita_user WITH ENCRYPTED PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE mokshita_db TO mokshita_user;
\q
```

### 3. Upload & Configure the App

```bash
# Create app directory
mkdir -p /var/www/mokshita-api
cd /var/www/mokshita-api

# Upload your code (from local machine):
# scp -r ./mokshita-backend/* root@your-vps-ip:/var/www/mokshita-api/

# Install dependencies (production only)
npm install --omit=dev

# Create and configure .env
nano .env
# Fill in all values from .env.example
# Set NODE_ENV=production

# Run migrations
npm run migrate
```

### 4. Process Management with PM2

```bash
sudo npm install -g pm2

# Start the API
pm2 start server.js --name "mokshita-api" --env production

# Enable auto-restart on reboot
pm2 startup
pm2 save
```

**Useful PM2 commands:**
```bash
pm2 logs mokshita-api       # View live logs
pm2 restart mokshita-api    # Restart after updates
pm2 status                  # Check process health
```

### 5. Nginx Reverse Proxy

```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/mokshita-api
```

Paste this Nginx configuration:

```nginx
server {
    listen 80;
    server_name api.mokshita-enterprises.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/mokshita-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.mokshita-enterprises.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Environment Variables Reference

| Variable              | Description                                | Example                        |
|-----------------------|--------------------------------------------|--------------------------------|
| `PORT`                | Server port                                | `3000`                         |
| `NODE_ENV`            | Environment                                | `production`                   |
| `DB_HOST`             | PostgreSQL host                            | `localhost`                    |
| `DB_PORT`             | PostgreSQL port                            | `5432`                         |
| `DB_NAME`             | Database name                              | `mokshita_db`                  |
| `DB_USER`             | Database user                              | `mokshita_user`                |
| `DB_PASSWORD`         | Database password                          | `strong_password`              |
| `JWT_SECRET`          | JWT signing secret (min 32 chars)          | `random-256-bit-string`        |
| `JWT_EXPIRES_IN`      | Token expiry                               | `7d`                           |
| `ALLOWED_ORIGINS`     | Comma-separated CORS origins               | `https://mokshita-enterprises.com` |
| `RATE_LIMIT_WINDOW_MS`| Rate limit window in ms                    | `900000`                       |
| `RATE_LIMIT_MAX`      | Max requests per window                    | `100`                          |

---

## Security Features

- **Helmet.js** — sets 15 security-related HTTP headers
- **CORS** — origin whitelist enforced
- **Rate Limiting** — global (100 req/15min) + strict auth (20 req/15min)
- **bcrypt** — password hashing with cost factor 12
- **JWT** — short-lived signed tokens
- **Parameterized Queries** — prevents SQL injection
- **Server-side Price Validation** — frontend prices are never trusted
- **Atomic Transactions** — stock deduction + order creation are ACID-safe

---

## Assumptions Made

1. **Shipping:** Flat ₹80 fee; free above ₹999 subtotal.
2. **Guest Checkout:** Allowed without authentication (`user_id = NULL` in orders table).
3. **Slug auto-generation:** If `slug` is not provided when creating a product, it is auto-generated from the `name`.
4. **Admin promotion:** Done manually via SQL — no public admin registration endpoint (security best practice).
5. **Payment:** Only `COD` (Cash on Delivery) supported for now. Payment gateway integration can be added in Phase 2.
