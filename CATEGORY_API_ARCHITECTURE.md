# Category & Subcategory API Architecture
**Mokshita Enterprises Backend — Step 1: Dynamic Category System**

---

## Overview

This document covers the complete category-driven product catalog API. All routes are **read-only and public** — no authentication required for the storefront to consume them.

---

## Database Relationships

```
categories
  ├── id, name, slug, description, image_url
  └── subcategories (category_id → FK)
        ├── id, name, slug, description
        └── products (subcategory_id → FK)
              └── id, name, slug, price, stock, image_url, ...
```

Every product row carries **two category references**:

| Field             | Type     | Purpose                                        |
|------------------|----------|------------------------------------------------|
| `category`        | TEXT     | Legacy string — kept for backward compatibility |
| `category_id`     | UUID FK  | Normalized relational link to `categories`     |
| `subcategory`     | TEXT     | Legacy string — kept for backward compatibility |
| `subcategory_id`  | UUID FK  | Normalized relational link to `subcategories`  |

**Live Data State:**
- **6 Categories:** Paintings, Marble Decor, Wooden Items, Crochet, Textile, Zardozi
- **11 Subcategories:** Watercolour, Pichwai, Ornaments, Accessories, Dolls & Animals, Keyrings, Inlay Work, Decorative, Idols, Novelties, Pouches & Bags
- **20/22 products** fully linked to both `category_id` and `subcategory_id`

---

## API Reference

### Base URL
```
http://localhost:3000/api
```

---

### 1. `GET /api/categories`

Returns all categories with product counts and nested subcategory lists in a single query.

**Example:** `GET /api/categories`

**Response:**
```json
{
  "success": true,
  "total": 6,
  "data": [
    {
      "id": "7be46a91-...",
      "name": "Zardozi",
      "slug": "zardozi",
      "description": "Traditional metallic embroidery on rich fabrics",
      "image_url": null,
      "product_count": 9,
      "subcategories": [
        { "id": "...", "name": "Ornaments",   "slug": "ornaments",   "description": "..." },
        { "id": "...", "name": "Accessories", "slug": "accessories", "description": "..." }
      ]
    }
  ]
}
```

**Frontend use:** Navigation menu, homepage category grid, shop landing page.

---

### 2. `GET /api/categories/:slug`

Returns a single category's full detail including its subcategories and product count.

**Example:** `GET /api/categories/zardozi`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "7be46a91-...",
    "name": "Zardozi",
    "slug": "zardozi",
    "description": "...",
    "product_count": 9,
    "subcategories": [...]
  }
}
```

**Frontend use:** Category page header, breadcrumb data, sidebar filter population.

---

### 3. `GET /api/categories/:slug/products`

**Core route.** Returns paginated, filterable, sortable products for a category. Supports optional subcategory drilling.

**Example:** `GET /api/categories/zardozi/products?page=1&limit=12&subcategory=ornaments&sort=price&order=asc`

**Query Parameters:**

| Param         | Type    | Default      | Description                                        |
|--------------|---------|--------------|----------------------------------------------------|
| `page`        | int     | `1`          | Pagination page number                             |
| `limit`       | int     | `12`         | Items per page (max 100)                           |
| `sort`        | string  | `created_at` | `created_at` · `price` · `name` · `stock`         |
| `order`       | string  | `desc`       | `asc` or `desc`                                    |
| `subcategory` | string  | —            | Filter by subcategory slug                         |
| `featured`    | boolean | —            | `true` to show featured products only              |
| `in_stock`    | boolean | —            | `true` to exclude out-of-stock items               |
| `min_price`   | number  | —            | Minimum price filter                               |
| `max_price`   | number  | —            | Maximum price filter                               |

**Response:**
```json
{
  "success": true,
  "category": { "id": "...", "name": "Zardozi", "slug": "zardozi", "description": "...", "image_url": null },
  "total": 8,
  "page": 1,
  "limit": 12,
  "total_pages": 1,
  "products": [
    {
      "id": "...",
      "name": "Zardozi Halloween",
      "slug": "zardozi-halloween",
      "sku": "ME020",
      "price": "360.00",
      "compare_price": null,
      "stock": 10,
      "description": null,
      "short_description": null,
      "image_url": null,
      "material": "Thread Work",
      "region": "India",
      "featured": false,
      "status": "active",
      "category_name_legacy": "Zardozi",
      "subcategory_name_legacy": "Ornaments",
      "category":    { "id": "...", "name": "Zardozi",   "slug": "zardozi"   },
      "subcategory": { "id": "...", "name": "Ornaments", "slug": "ornaments" }
    }
  ]
}
```

**Frontend use:** Shop category pages, product grid rendering, infinite scroll, filter sidebar.

---

### 4. `GET /api/subcategories`

Returns all 11 subcategories with their parent category and product count.

**Example:** `GET /api/subcategories`

**Response:**
```json
{
  "success": true,
  "total": 11,
  "data": [
    {
      "id": "...",
      "name": "Dolls & Animals",
      "slug": "dolls-animals",
      "description": "Crochet dolls, turtles and figures",
      "product_count": 2,
      "category": { "id": "...", "name": "Crochet", "slug": "crochet" }
    }
  ]
}
```

**Frontend use:** Sub-navigation menus, breadcrumbs, filter sidebar population.

---

### 5. `GET /api/subcategories/:slug/products`

Returns paginated products within a specific subcategory, including full parent category context.

**Example:** `GET /api/subcategories/ornaments/products?sort=price&order=asc`

Supports the same query parameters as route #3 (`sort`, `order`, `page`, `limit`, `featured`, `in_stock`, `min_price`, `max_price`).

**Response:**
```json
{
  "success": true,
  "subcategory": {
    "id": "...",
    "name": "Ornaments",
    "slug": "ornaments",
    "description": "...",
    "category": { "id": "...", "name": "Zardozi", "slug": "zardozi" }
  },
  "total": 8,
  "page": 1,
  "limit": 12,
  "total_pages": 1,
  "products": [...]
}
```

---

## Architecture Decisions

### Why keep both `category` (text) and `category_id` (FK)?
Existing frontend and admin code filters by the raw string (`WHERE category = 'Zardozi'`). Removing it would break live functionality. Both fields coexist — the FK is used by all **new** APIs; the text field is preserved for **legacy** compatibility.

### Why `JSONB` aggregation for subcategories in category responses?
A single SQL query with `json_agg(DISTINCT ...)` fetches the category and all its subcategories in one database round-trip. This avoids N+1 query patterns.

### Why are products enriched with both `category_name_legacy` and a `category` object?
This gives the frontend a graceful migration path. Old code reads `product.category_name_legacy`; new components use the structured `product.category.slug` for clean URL routing.

### Why is the `subcategories` route registered before `/:slug` in Express?
Express matches routes in registration order. The literal path `/subcategories` must be registered before `/:slug` to prevent Express from treating `subcategories` as a slug parameter value.

---

## Files Created / Modified

| File | Action |
|------|--------|
| `src/controllers/category.controller.js` | Rewritten — 5 handlers with enriched JOINs |
| `src/routes/category.routes.js` | Rewritten — all category + combined subcategory routes |
| `src/routes/subcategory.routes.js` | New — standalone `/api/subcategories` mount |
| `src/seeds/seed-subcategories.js` | New — seeds 11 subcategories and links 20 products |
| `src/app.js` | Updated — registers `/api/subcategories`, expands CORS |

---

## Clean URL Routing (Frontend Reference)

| Frontend URL | API Call |
|---|---|
| `/shop` | `GET /api/categories` |
| `/shop/zardozi` | `GET /api/categories/zardozi/products` |
| `/shop/zardozi/ornaments` | `GET /api/categories/zardozi/products?subcategory=ornaments` |
| `/product/marble-tortoise` | `GET /api/products/marble-tortoise` |

---

## Future Admin Integration

When the admin dashboard is extended to manage categories, these routes can be added under `/api/admin/`:

- `POST /api/admin/categories` → Create category
- `PUT  /api/admin/categories/:id` → Update name / description / image
- `POST /api/admin/subcategories` → Create subcategory under a parent
- `PUT  /api/admin/products/:id/category` → Re-assign product to a different category