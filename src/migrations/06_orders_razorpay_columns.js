'use strict';

/**
 * Migration 06: Orders — Razorpay Payment Columns
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds the missing Razorpay-related columns to the `orders` table required by
 * order.controller.js and payment.controller.js.
 *
 * Columns added (all nullable — COD orders never populate them):
 *   razorpay_order_id   TEXT  — Razorpay order ID ("order_XXXX")
 *   razorpay_payment_id TEXT  — Razorpay payment ID after capture
 *   razorpay_signature  TEXT  — HMAC signature verified on /payments/verify
 *
 * Also ensures the `status` column accepts the Razorpay lifecycle values
 * ('pending_payment', 'payment_failed') in addition to the existing COD values
 * by replacing any hard VARCHAR CHECK constraint with a permissive TEXT column.
 *
 * SAFE:       All ADD COLUMN statements use IF NOT EXISTS — zero risk to
 *             existing data or COD orders.
 * IDEMPOTENT: Safe to re-run multiple times with no side-effects.
 * NON-BREAKING: Does NOT drop, rename, or reset any existing column/table/row.
 *
 * Run: node src/migrations/06_orders_razorpay_columns.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

const SQL = `
-- ─── 1. ADD MISSING RAZORPAY COLUMNS (idempotent) ────────────────────────────

-- Razorpay order ID returned from razorpay.orders.create()
-- Stored immediately after checkout for RAZORPAY method orders.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id   TEXT;

-- Razorpay payment ID received after the user completes payment in the modal.
-- Stored when /api/payments/verify succeeds.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- HMAC-SHA256 signature from Razorpay, verified server-side before marking paid.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_signature  TEXT;

-- ─── 2. EXTEND STATUS COLUMN TO ACCEPT RAZORPAY LIFECYCLE VALUES ─────────────
-- If the status column has a CHECK constraint that only allows COD values
-- (e.g. 'received', 'shipped', 'delivered', 'cancelled') we need to allow
-- 'pending_payment' and 'payment_failed' as well.
--
-- Strategy: Drop the old constraint if it exists (by its conventional name),
-- then add a new, broader constraint. Both steps are guarded so they are
-- no-ops if already in the correct state.

-- Drop the old constraint if it still exists (ignore error if it doesn't)
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
EXCEPTION WHEN others THEN
  NULL; -- constraint didn't exist -- safe to continue
END;
$$;

-- Add the permissive constraint (covers COD + Razorpay lifecycle values)
DO $$
BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'pending_payment',
      'received',
      'payment_failed',
      'processing',
      'shipped',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'refunded'
    ));
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists with this name -- safe to continue
END;
$$;

-- ─── 3. PERFORMANCE INDEXES ───────────────────────────────────────────────────

-- Fast lookup by Razorpay order ID (used by webhook handler and verify endpoint)
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON orders(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- Fast lookup by Razorpay payment ID (used by webhook fallback)
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id
  ON orders(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- Fast lookup of pending-payment orders (for timeout/cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Migration 06: Orders — Razorpay Payment Columns...');
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('✅ Migration 06 completed successfully.');
    console.log('   Added to orders: razorpay_order_id, razorpay_payment_id, razorpay_signature');
    console.log('   Updated status CHECK constraint to include pending_payment, payment_failed, refunded');
    console.log('   Added 3 performance indexes on razorpay_order_id, razorpay_payment_id, status');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 06 failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
