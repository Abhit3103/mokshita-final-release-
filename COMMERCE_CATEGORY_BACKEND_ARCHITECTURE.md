# Mokshita Enterprises — Commerce Category Backend Architecture

> Version: 2.0 (Commerce Edition)
> Stack: Node.js / Express / PostgreSQL / pg (node-postgres)
> Author: Antigravity AI
> Last Updated: 2026-05-17

---

## 1. Overview

The Mokshita Enterprises backend has been evolved from a simple filter-based category system into a **full commerce browsing architecture** — comparable to Amazon, Myntra, and Etsy in structure.

This was a **safe, additive evolution**. No existing tables, columns, APIs, or frontend integrations were broken.

---

## 2. Category Hierarchy

```
Admin Dashboard
      │
      ▼
┌─────────────────────────────┐
│        categories           │
│  id, name, slug             │
│  description                │
│  short_description  ← NEW   │
│  image_url                  │
│  banner_url         ← NEW   │
│  featured                   │
│  display_order      ← NEW   │
│  seo_title          ← NEW   │
│  seo_description    ← NEW   │
│  homepage_visible   ← NEW   │
│  navigation_visible ← NEW   │
│  created_at                 │
│  updated_at         ← NEW   │
└────────────┬────────────────┘
             │ 1 : N
             ▼
┌─────────────────────────────┐
│       subcategories         │
│  id, name, slug             │
│  category_id (FK)           │
│  description                │
│  image_url          ← NEW   │
│  featured           ← NEW   │
│  display_order      ← NEW   │
│  seo_title          ← NEW   │
│  seo_description    ← NEW   │
│  created_at                 │
│  updated_at         ← NEW   │
└────────────┬────────────────┘
             │ 1 : N
             ▼
┌─────────────────────────────┐
│          products           │
│  category_id (FK)           │
│  subcategory_id (FK)        │
│  category (legacy string)   │
│  subcategory (legacy string)│
│  ... all product fields     │
└─────────────────────────────┘
```

---

## 3. Complete API Surface

### 3.1 Public Category APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/categories` | All categories — commerce metadata, subcategories, counts |
| `GET` | `/api/categories/featured` | Featured categories — 3-tier fallback |
| `GET` | `/api/categories/:slug` | Category landing page — banner, SEO, breadcrumbs |
| `GET` | `/api/categories/:slug/products` | Paginated products for a category |
| `GET` | `/api/categories/:slug/subcategories` | Subcategories of a category (nav dropdown) |

### 3.2 Public Subcategory APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/subcategories` | All subcategories — enriched with parent category |
| `GET` | `/api/subcategories/:slug` | Subcategory landing page — parent, SEO, breadcrumbs |
| `GET` | `/api/subcategories/:slug/products` | Paginated products for a subcategory |

### 3.3 Navigation APIs (NEW)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/navigation` | Full desktop nav tree — navigation_visible categories only |
| `GET` | `/api/navigation/homepage` | Homepage cards — homepage_visible categories |
| `GET` | `/api/navigation/mobile` | Mobile-optimized flat nav list |

### 3.4 Admin Category APIs (Enhanced)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/categories` | All categories (admin view — full fields) |
| `POST` | `/api/admin/categories` | Create category (now accepts all commerce fields) |
| `PUT` | `/api/admin/categories/:id` | Update category (all commerce fields) |
| `PUT` | `/api/admin/categories/:id/order` | Update display_order only (drag-and-drop) |
| `PUT` | `/api/admin/categories/reorder` | Bulk reorder `{ items: [{id, display_order}] }` |
| `DELETE` | `/api/admin/categories/:id` | Delete (products moved to Others) |
| `POST` | `/api/admin/subcategories` | Create subcategory (commerce fields) |
| `PUT` | `/api/admin/subcategories/:id` | Update subcategory |
| `DELETE` | `/api/admin/subcategories/:id` | Delete subcategory |
| `PUT` | `/api/admin/products/:id/category` | Reassign product category |

---

## 4. Category Response Structure

### `GET /api/categories/:slug`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Handwoven Textiles",
    "slug": "handwoven-textiles",
    "description": "Long description...",
    "short_description": "Artisan-crafted fabrics from India",
    "image_url": "https://...",
    "banner_url": "https://...",
    "featured": true,
    "display_order": 10,
    "seo_title": "Handwoven Textiles | Mokshita Enterprises",
    "seo_description": "Browse handwoven textiles...",
    "homepage_visible": true,
    "navigation_visible": true,
    "product_count": 42,
    "total_products": 42,
    "featured_count": 8,
    "created_at": "2026-05-01T...",
    "updated_at": "2026-05-17T...",
    "subcategories": [
      {
        "id": "uuid",
        "name": "Sarees",
        "slug": "sarees",
        "description": "...",
        "image_url": "https://...",
        "featured": true,
        "display_order": 5,
        "seo_title": null,
        "seo_description": null
      }
    ],
    "seo": {
      "title": "Handwoven Textiles | Mokshita Enterprises",
      "description": "Browse handwoven textiles...",
      "og_image": "https://..."
    },
    "breadcrumbs": [
      { "label": "Shop", "href": "/shop" },
      { "label": "Handwoven Textiles", "href": "/shop/handwoven-textiles" }
    ]
  }
}
```

### `GET /api/subcategories/:slug`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Sarees",
    "slug": "sarees",
    "description": "...",
    "image_url": "https://...",
    "featured": true,
    "display_order": 5,
    "seo_title": null,
    "seo_description": null,
    "product_count": 12,
    "category": {
      "id": "uuid",
      "name": "Handwoven Textiles",
      "slug": "handwoven-textiles",
      "image_url": "...",
      "banner_url": "..."
    },
    "seo": {
      "title": "Handwoven Textiles → Sarees | Mokshita Enterprises",
      "description": "Browse Sarees at Mokshita Enterprises...",
      "og_image": null
    },
    "breadcrumbs": [
      { "label": "Shop", "href": "/shop" },
      { "label": "Handwoven Textiles", "href": "/shop/handwoven-textiles" },
      { "label": "Sarees", "href": "/shop/handwoven-textiles/sarees" }
    ]
  }
}
```

---

## 5. Navigation API Response Structure

### `GET /api/navigation`

```json
{
  "success": true,
  "total": 6,
  "data": [
    {
      "id": "uuid",
      "name": "Handwoven Textiles",
      "slug": "handwoven-textiles",
      "image_url": "...",
      "banner_url": "...",
      "display_order": 10,
      "product_count": 42,
      "subcategories": [
        { "id": "uuid", "name": "Sarees", "slug": "sarees", "image_url": null, "featured": true, "display_order": 5 }
      ]
    }
  ]
}
```

### `GET /api/navigation/homepage`

```json
{
  "success": true,
  "total": 8,
  "data": [
    {
      "id": "uuid",
      "name": "Handwoven Textiles",
      "slug": "handwoven-textiles",
      "short_description": "Artisan-crafted fabrics from India",
      "image_url": "...",
      "banner_url": "...",
      "featured": true,
      "display_order": 10,
      "product_count": 42
    }
  ]
}
```

---

## 6. Admin Control Flow

```
Admin Dashboard
      │
      ├── POST /api/admin/categories
      │     └── Create with: name, slug, image_url, banner_url,
      │                      short_description, seo_*, homepage_visible,
      │                      navigation_visible, display_order, featured
      │
      ├── PUT /api/admin/categories/:id
      │     └── Edit any field including commerce metadata
      │
      ├── PUT /api/admin/categories/reorder
      │     └── Bulk update display_order for drag-and-drop ordering
      │
      ├── PUT /api/admin/categories/:id/order
      │     └── Single category ordering update
      │
      ├── POST/PUT /api/admin/subcategories
      │     └── Create/edit subcategories with: image_url, featured,
      │                                          display_order, seo_*
      │
      └── PUT /api/admin/products/:id/category
            └── Reassign product to different category/subcategory
```

---

## 7. Storefront Flow

```
User visits storefront
      │
      ├── Homepage
      │     └── GET /api/navigation/homepage    → Category cards
      │     └── GET /api/categories/featured    → Featured spotlights
      │
      ├── Desktop Navigation
      │     └── GET /api/navigation             → Full category tree with subcategories
      │
      ├── Mobile Navigation
      │     └── GET /api/navigation/mobile      → Flat accordion list
      │
      ├── Category Landing Page (/shop/:categorySlug)
      │     └── GET /api/categories/:slug       → Banner, SEO, subcategory list
      │     └── GET /api/categories/:slug/products → Product grid (paginated)
      │
      └── Subcategory Page (/shop/:categorySlug/:subcategorySlug)
            └── GET /api/subcategories/:slug         → Header + breadcrumbs
            └── GET /api/subcategories/:slug/products → Product grid (paginated)
```

---

## 8. SEO Structure

Every category/subcategory endpoint returns a `seo` object:

```json
{
  "seo": {
    "title": "Category Name | Mokshita Enterprises",
    "description": "Up to 160 chars of description text",
    "og_image": "banner_url or image_url, whichever is set"
  }
}
```

**Priority chain for title:** `seo_title` field → `name` field
**Priority chain for description:** `seo_description` → `description` → generated fallback
**Priority chain for og_image:** `banner_url` → `image_url` → `null`

---

## 9. Ordering & Display Logic

### Category ordering (admin-controlled)

Categories are ordered by: `display_order DESC → name ASC`

- `display_order = 0` (default) → existing categories unaffected
- Higher `display_order` → appears first
- **Others** category always forced to last position
- Admin sets `display_order` via UI or `PUT /api/admin/categories/reorder`

### Subcategory ordering

Within each category: `display_order DESC → name ASC`
Each subcategory has independent `display_order` relative to its parent.

---

## 10. Featured Category System (3-Tier Fallback)

```
Tier 1 (Best):
  featured=true AND homepage_visible=true AND has featured products
  → Ordered by display_order DESC, then featured_count DESC

Tier 2 (Fallback):
  featured=true AND has active products
  → Ordered by display_order DESC, then total_products DESC

Tier 3 (Absolute Fallback):
  Any category with active products
  → Ordered by total_products DESC

Response includes:
  "is_fallback": true/false
  "tier": 1 | 2 | 3    ← NEW diagnostic field
```

---

## 11. Visibility Controls

| Field | Default | Effect |
|-------|---------|--------|
| `homepage_visible` | `true` | Controls `/api/navigation/homepage` |
| `navigation_visible` | `true` | Controls `/api/navigation` and `/api/navigation/mobile` |
| `featured` | `false` | Controls `/api/categories/featured` (Tier 1) |

> Setting `homepage_visible=false` removes a category from homepage cards without deleting it.
> Setting `navigation_visible=false` hides a category from all nav menus.

---

## 12. Breadcrumb System

All category and subcategory product responses include breadcrumbs:

```
Category products → [ Shop, Category ]
Subcategory products → [ Shop, Category, Subcategory ]
```

Breadcrumb format: `{ label: string, href: string }`

Frontend maps these directly to `<Breadcrumb>` components or `<nav aria-label="breadcrumb">` elements.

---

## 13. Commerce URL Support

| Frontend URL | Backend API |
|-------------|------------|
| `/shop` | `GET /api/categories` |
| `/shop/:categorySlug` | `GET /api/categories/:slug` + `GET /api/categories/:slug/products` |
| `/shop/:categorySlug/:subcategorySlug` | `GET /api/subcategories/:slug` + `GET /api/subcategories/:slug/products` |

**Slug uniqueness guarantees:**
- Category slugs: unique across all categories (DB UNIQUE constraint)
- Subcategory slugs: unique within parent category (`UNIQUE(category_id, slug)`)
- Slug validation on create + update with 409 conflict errors

---

## 14. Backward Compatibility

| Item | Preserved |
|------|-----------|
| `products.category` (string) | ✅ Synced on every category name update |
| `products.subcategory` (string) | ✅ Synced on reassignment |
| `GET /api/categories` response shape | ✅ Additive — new fields appended |
| `GET /api/categories/:slug` response | ✅ Additive only |
| `GET /api/categories/featured` `is_fallback` flag | ✅ Preserved |
| `products.category_name_legacy` | ✅ Returned in all product listings |
| Existing cart / checkout / order APIs | ✅ Untouched |
| Upload system | ✅ Untouched |
| Auth system | ✅ Untouched |

---

## 15. Performance Optimizations

### Indexes Added (Migration 03)

| Index | Purpose |
|-------|---------|
| `idx_categories_display_order` | Fast ORDER BY display_order |
| `idx_categories_homepage_visible` | Fast homepage filter |
| `idx_categories_navigation_visible` | Fast nav filter |
| `idx_categories_featured_order` | Featured + ordering combo |
| `idx_subcategories_category_featured` | Featured subcategory lookups |
| `idx_subcategories_display_order` | Ordered subcategory listings |

### Query Patterns

- **Parallel execution:** Count + products queries run with `Promise.all()` in all paginated endpoints
- **No N+1:** All subcategory data fetched via `json_agg` inside the category query
- **Lightweight nav:** Navigation endpoints exclude products entirely — just metadata
- **DISTINCT counts:** Use `COUNT(DISTINCT p.id)` to prevent double-counting from JOINs

---

## 16. Fallback & Error Handling

| Scenario | Handling |
|----------|---------|
| Category slug not found | `404` + `{ success: false, message: "Category X not found." }` |
| Subcategory slug not found | `404` + clear message |
| Subcategory not in category | `404` with context message |
| Empty category (no products) | Returns category with `product_count: 0`, empty `products: []` |
| Empty subcategory | Returns subcategory with `product_count: 0` |
| Category with no image | `image_url: null` — frontend falls back to placeholder |
| Category with no banner | `banner_url: null` — frontend falls back to solid color or image |
| Featured with no data | 3-tier fallback chain automatically engaged |
| Delete category | Products auto-moved to Others, subcategories cascade-deleted |

---

## 17. Migration History

| Migration | File | What It Does |
|-----------|------|-------------|
| 01 | `01_schema_expansion.js` | Creates categories, subcategories, product_images, tags, travel_packages, site_content tables |
| 02 | `02_category_layer.js` | Adds `categories.featured`, seeds Others, migrates uncategorized products |
| 03 | `03_commerce_category_schema.js` | **NEW** — Adds all commerce browsing fields to categories + subcategories. 6 performance indexes. |

---

## 18. Scalability Considerations

1. **Admin-controlled ordering** means zero code changes needed to rearrange storefront — just a DB update.
2. **Navigation endpoints** are designed to be cached at CDN/edge level — static-like responses.
3. **Subcategory image_url + featured** allows progressive enhancement of subcategory pages without schema changes.
4. **display_order** supports up to `2,147,483,647` (INT max) — no re-ordering gaps issue.
5. **SEO override fields** (`seo_title`, `seo_description`) decouple marketing copy from operational names.
6. **homepage_visible / navigation_visible** decouple display logic from active/inactive status — a category can be active for product browsing but hidden from the homepage.

---

## 19. Files Changed / Created

| File | Action |
|------|--------|
| `src/migrations/03_commerce_category_schema.js` | ✅ CREATED |
| `src/controllers/category.controller.js` | ✅ UPDATED (enriched, new endpoints added) |
| `src/controllers/adminCategory.controller.js` | ✅ UPDATED (all commerce fields, reorder API) |
| `src/controllers/navigation.controller.js` | ✅ CREATED |
| `src/routes/category.routes.js` | ✅ UPDATED (new subcategories endpoint) |
| `src/routes/subcategory.routes.js` | ✅ UPDATED (new /:slug detail endpoint) |
| `src/routes/admin.routes.js` | ✅ UPDATED (reorder, validation) |
| `src/routes/navigation.routes.js` | ✅ CREATED |
| `src/app.js` | ✅ UPDATED (navigation route registered) |
| `COMMERCE_CATEGORY_BACKEND_PROGRESS.md` | ✅ CREATED |
| `COMMERCE_CATEGORY_BACKEND_ARCHITECTURE.md` | ✅ CREATED |
