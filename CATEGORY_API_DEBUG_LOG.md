# Category API Debug Log
**Date**: 2026-05-17
**Issue**: `GET /api/categories` and related endpoints crashing with HTTP 500.

## 1. Root Cause
The 500 error was caused by a specific PostgreSQL syntax constraint violated during the commerce backend evolution. 

**Error Message:**
`in an aggregate with DISTINCT, ORDER BY expressions must appear in argument list`

**Explanation:**
During the schema evolution, a new `display_order` column was added to subcategories, and `ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC` was added inside the `json_agg` function to correctly sequence subcategories in the frontend UI.
However, because the primary category query included a `LEFT JOIN products p`, the subcategory join `LEFT JOIN subcategories sc` resulted in duplicated subcategory rows. To deduplicate them, `DISTINCT` was used inside `json_agg`.
In PostgreSQL, when you use `DISTINCT` inside an aggregate function like `json_agg`, any columns used in the `ORDER BY` clause *must* also exist in the `DISTINCT` expression exactly as they are. Because `jsonb_build_object` was the distinct expression, it did not match the order by columns, triggering a crash.

## 2. Affected Endpoints
This bug affected all endpoints that fetched subcategories alongside a joined products list:
- `GET /api/categories` (Public Commerce API)
- `GET /api/categories/:slug` (Landing Page API)
- `GET /api/navigation` (Desktop Nav API)
- `GET /api/admin/categories` (Admin Dashboard)
- `GET /api/categories/featured` (Homepage Featured API)

## 3. The Fix Applied
Instead of relying on `json_agg(DISTINCT ...)` alongside `LEFT JOIN subcategories` in the main queries, the architecture was modified to use an **isolated subquery** inside the `SELECT` clause.

**Old Breaking Code:**
```sql
COALESCE(
  json_agg(
    DISTINCT jsonb_build_object(
      'id',            sc.id,
      'name',          sc.name,
      'slug',          sc.slug,
      'display_order', COALESCE(sc.display_order, 0)
    )
    ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC
  ) FILTER (WHERE sc.id IS NOT NULL),
  '[]'::json
) AS subcategories
```
*(Combined with `LEFT JOIN subcategories sc ON sc.category_id = c.id`)*

**New Stable Code:**
```sql
(
  SELECT COALESCE(
    json_agg(
      jsonb_build_object(
        'id',            sc.id,
        'name',          sc.name,
        'slug',          sc.slug,
        'display_order', COALESCE(sc.display_order, 0)
      )
      ORDER BY COALESCE(sc.display_order, 0) DESC, sc.name ASC
    ),
    '[]'::json
  )
  FROM subcategories sc WHERE sc.category_id = c.id
) AS subcategories
```
*(The `LEFT JOIN subcategories` was removed from the main query)*

## 4. Why This Fix Is Safe & Optimal
1. **No DISTINCT needed**: By isolating the subcategories fetch into a subquery that joins directly on `c.id`, the query no longer cross-multiplies with products. This eliminates the need for `DISTINCT` entirely.
2. **Preserves Ordering**: The `ORDER BY` now works perfectly inside `json_agg`, maintaining the admin-controlled `display_order` without crashing.
3. **No N+1 Queries**: The subquery executes efficiently alongside the primary query execution plan without triggering application-side N+1 loops.
4. **Compatibility Maintained**: The returned JSON structure is identically matched to what the frontend and admin dashboard expect.

## 5. Compatibility Checks Passed
- ✅ **Frontend Storefront**: Verified successful fetch of categories without triggering the local fallback system. Subcategories render in correct sorted order.
- ✅ **Admin Dashboard**: `GET /api/admin/categories` works perfectly.
- ✅ **Featured System**: The 3-tier fallback logic in `getFeaturedCategories` safely utilizes the new subquery pattern.
- ✅ **Products Integration**: Category-level `product_count` and `total_products` remain completely accurate because the `LEFT JOIN products` remains perfectly untouched.

## 6. Performance Considerations
Removing `LEFT JOIN subcategories` from the main query shrinks the size of the intermediate join table memory footprint (especially for categories with hundreds of products and dozens of subcategories). The database no longer has to deduplicate massive JSON structures, leading to faster execution times.

The backend categories endpoints are now fully stable, commerce-ready, and optimized for safe frontend consumption.
