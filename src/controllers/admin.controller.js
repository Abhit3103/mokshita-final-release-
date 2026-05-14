'use strict';

const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers.util');

// ─── GET /api/admin/orders ─────────────────────────────────────────────────────
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 30 } = req.query;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) {
    const validStatuses = ['received', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${validStatuses.join(', ')}` });
    }
    conditions.push(`o.status = $${idx++}`);
    params.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [ordersResult, countResult] = await Promise.all([
    pool.query(
      `SELECT o.id, o.order_number, o.customer_name, o.email, o.phone,
              o.address_line, o.city, o.state, o.pincode,
              o.payment_method, o.subtotal, o.shipping_cost, o.total,
              o.status, o.tracking_note, o.created_at, o.shipped_at, o.delivered_at,
              json_agg(
                json_build_object(
                  'product_id', oi.product_id,
                  'product_name', p.name,
                  'quantity', oi.quantity,
                  'price_at_time', oi.price_at_time
                )
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       ${whereClause}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    ),
    pool.query(`SELECT COUNT(*) FROM orders o ${whereClause}`, params),
  ]);

  return res.json({
    success: true,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
    orders: ordersResult.rows,
  });
});

// ─── PUT /api/admin/orders/:id/status ─────────────────────────────────────────
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['received', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${validStatuses.join(', ')}` });
  }

  // Automatically set timestamps when status changes
  let extraFields = '';
  if (status === 'shipped') extraFields = ', shipped_at = NOW()';
  if (status === 'delivered') extraFields = ', delivered_at = NOW()';

  const result = await pool.query(
    `UPDATE orders SET status = $1 ${extraFields} WHERE id = $2
     RETURNING id, order_number, status, shipped_at, delivered_at`,
    [status, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  return res.json({ success: true, message: `Order status updated to "${status}".`, order: result.rows[0] });
});

// ─── PUT /api/admin/orders/:id/tracking ───────────────────────────────────────
const updateTrackingNote = asyncHandler(async (req, res) => {
  const { tracking_note } = req.body;

  if (!tracking_note || tracking_note.trim() === '') {
    return res.status(400).json({ success: false, message: 'tracking_note is required.' });
  }

  const result = await pool.query(
    `UPDATE orders SET tracking_note = $1 WHERE id = $2
     RETURNING id, order_number, tracking_note`,
    [tracking_note.trim(), req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  return res.json({ success: true, message: 'Tracking note updated.', order: result.rows[0] });
});

module.exports = { getAllOrders, updateOrderStatus, updateTrackingNote };
