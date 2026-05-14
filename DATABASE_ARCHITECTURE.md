# Mokshita Enterprises - Database Architecture

This document outlines the expanded, production-ready PostgreSQL relational schema for the Mokshita Enterprises platform. The schema has been systematically designed to normalize all imported CSV and CMS data while maintaining strict backwards compatibility with the existing Express APIs and frontend integrations.

## 🏗️ Core Architecture Overview

The system architecture follows a structured separation of domains:
1. **Users & Auth:** Handles customers and admin privileges.
2. **E-Commerce Core:** Products, Categories, Carts, and Orders.
3. **Travel & Experiences:** Dedicated travel packages table decoupled from physical products.
4. **CMS & Content:** A dynamic `site_content` table to store brand statistics, quotes, and copy.

---

## 📊 Relational Schema Details

### 1. E-Commerce Domain

#### `categories` & `subcategories`
Normalizes the previous flat `category` strings into relational tables.
- **`categories`**: `id`, `name`, `slug`, `description`, `image_url`
- **`subcategories`**: `id`, `category_id` (FK), `name`, `slug`
- *Migration note:* Products are linked via `category_id` safely, while the old `category` string column remains untouched to prevent breaking existing frontend rendering code.

#### `products`
The core catalog table, heavily expanded from the imported CSVs.
- **Base Fields:** `id`, `name`, `slug`, `price`, `stock`, `description`, `image_url`, `created_at`
- **New Expansions:**
  - `category_id`, `subcategory_id` (FKs to proper taxonomy)
  - `sku`, `material`, `region`, `dimensions` (Granular item specs)
  - `compare_price` (For UI sales/discounts)
  - `featured`, `status` (For admin toggling)
  - `short_description`, `artisan_story`, `care_instructions` (For rich product pages)
  - `tags` (Stringified tags, though a relational pivot table also exists if needed)

#### `product_images` (New)
Prepares the platform for multi-image product galleries.
- `id`, `product_id` (FK), `image_url`, `alt_text`, `display_order`

#### `carts` & `cart_items`
Handles shopping carts, optimized for the frontend's local-storage-to-DB syncing logic.
- **`carts`**: `id`, `user_id` (FK, UNIQUE)
- **`cart_items`**: `id`, `cart_id` (FK), `product_id` (FK), `quantity`
- *Migration note:* To support orphaned carts from the CSV dump, "ghost users" were provisioned.

#### `orders` & `order_items`
Snapshot-based storage for checkout safety.
- **`orders`**: Stores final `subtotal`, `shipping_cost`, `total`, customer details, and `status` (`received`, `shipped`, `delivered`, `cancelled`).
- **`order_items`**: Stores `price_at_time` ensuring that historic orders aren't affected by future product price changes.

---

### 2. Travel Domain

#### `travel_packages` (New)
Travel packages have fundamentally different data needs (durations, itineraries, no physical stock) than handicrafts. They are now completely segregated from the `products` table.
- **Fields:** `id`, `name`, `slug`, `duration`, `location`, `price`, `description`, `image_url`, `featured`, `status`
- **`highlights`**: A `JSONB` array of strings (e.g., ["Sunrise Taj Mahal visit", "Agra Fort guided exploration"]). JSONB makes fetching ordered itinerary bullet points highly efficient.

---

### 3. Content Management System (CMS)

#### `site_content` (New)
Avoids hardcoding textual brand copy into the frontend repository (`mokhsita_data.md`).
- **Fields:** `id`, `section_key` (UNIQUE), `content` (JSONB)
- **Usage Example:** `section_key = 'founder_quote'` stores `{ "quote": "...", "author": "Riya Mehta" }`. The frontend can fetch `/api/content` and dynamically render these blocks.

#### `leads`
Stores form submissions from the contact/custom-order pages.
- **Fields:** `id`, `name`, `email`, `phone`, `interest`, `item`, `message`, `status` (default: 'NEW').

---

## 🚀 Migration Strategy & Safe Expansion

To transition the legacy setup into this normalized structure without breaking the application, the following strategy was strictly adhered to:

1. **Additive Schema Mutations:** We used `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to enrich `products` with CSV data without dropping existing columns.
2. **Preserved APIs:** The existing product, cart, auth, and admin controllers were completely left alone.
3. **Decoupled Expansion:** New entities (Categories, Travel, Content) received entirely new API files (`travel.controller.js`, `content.routes.js`, etc.) and were registered non-destructively in `app.js`.
4. **Data Syncing:** The `seed-travel-content.js` parsed the Markdown data dump and safely inserted it using `ON CONFLICT DO NOTHING / DO UPDATE` constraints. Existing `products` were automatically mapped to the new `categories` table IDs based on string matching.

## 🛣️ Future Roadmap

With the database now fully scalable, the frontend (`mokhsita-org`) and Admin Dashboard can be upgraded to:
1. Fetch from `/api/content` to populate the homepage instead of hardcoded HTML.
2. Fetch from `/api/travel-packages` for the Tours page.
3. Extend the React Admin Dashboard to have CRUD interfaces for `site_content` and `travel_packages`.
