const router = require('express').Router();
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { wrap } = require('../utils/errors');

router.use(authenticate);

// Stock balances by product and warehouse (FR-11)
router.get('/stock', wrap(async (req, res) => {
  const { warehouse_id, search } = req.query;
  const where = ['p.is_active = 1']; const params = [];
  if (warehouse_id) { where.push('b.warehouse_id = ?'); params.push(warehouse_id); }
  if (search) { where.push('(p.sku LIKE ? OR p.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const [rows] = await pool.query(
    `SELECT b.stock_id, p.product_id, p.sku, p.name, p.unit, p.reorder_level, p.unit_cost,
            w.warehouse_id, w.name AS warehouse_name, b.quantity, b.updated_at
     FROM stock_balances b JOIN products p ON p.product_id = b.product_id JOIN warehouses w ON w.warehouse_id = b.warehouse_id
     WHERE ${where.join(' AND ')} ORDER BY p.name, w.name`, params
  );
  res.json(rows);
}));

router.get('/warehouses/:id/stock', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.product_id, p.sku, p.name, p.unit, b.quantity FROM stock_balances b
     JOIN products p ON p.product_id = b.product_id WHERE b.warehouse_id = ? ORDER BY p.name`, [req.params.id]
  );
  res.json(rows);
}));

// Dashboard numbers
router.get('/summary', wrap(async (req, res) => {
  const [[counts]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM products WHERE is_active = 1) AS products,
            (SELECT COUNT(*) FROM warehouses WHERE is_active = 1) AS warehouses,
            (SELECT COUNT(*) FROM purchase_orders WHERE status IN ('SUBMITTED','APPROVED','PARTIALLY_RECEIVED')) AS open_orders,
            (SELECT COALESCE(SUM(b.quantity * p.unit_cost),0) FROM stock_balances b JOIN products p ON p.product_id = b.product_id) AS stock_value`
  );
  const [[low]] = await pool.query(
    `SELECT COUNT(*) AS low_stock FROM (
       SELECT p.product_id FROM products p LEFT JOIN stock_balances b ON b.product_id = p.product_id
       WHERE p.is_active = 1 GROUP BY p.product_id, p.reorder_level HAVING COALESCE(SUM(b.quantity),0) < p.reorder_level
     ) t`
  );
  res.json({ ...counts, ...low });
}));

const REPORT_ROLES = ['Warehouse Manager'];

// Low-stock: total on hand below reorder level (FR-13)
router.get('/reports/low-stock', authorize(...REPORT_ROLES), wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.product_id, p.sku, p.name, p.unit, p.reorder_level, COALESCE(SUM(b.quantity),0) AS total_stock
     FROM products p LEFT JOIN stock_balances b ON b.product_id = p.product_id
     WHERE p.is_active = 1 GROUP BY p.product_id HAVING total_stock < p.reorder_level
     ORDER BY (p.reorder_level - total_stock) DESC`
  );
  res.json(rows);
}));

// Movement history with filters (FR-12)
router.get('/reports/movements', authorize(...REPORT_ROLES), wrap(async (req, res) => {
  const { from, to, warehouse_id, product_id, type } = req.query;
  const where = []; const params = [];
  if (from) { where.push('m.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('m.created_at <= ?'); params.push(`${to} 23:59:59`); }
  if (warehouse_id) { where.push('m.warehouse_id = ?'); params.push(warehouse_id); }
  if (product_id) { where.push('m.product_id = ?'); params.push(product_id); }
  if (type) { where.push('t.transaction_type = ?'); params.push(type); }
  const [rows] = await pool.query(
    `SELECT m.movement_id, m.created_at, t.transaction_type, t.reference, t.note, m.quantity_delta,
            p.sku, p.name AS product_name, w.name AS warehouse_name, u.full_name AS created_by_name
     FROM stock_movements m
     JOIN stock_transactions t ON t.transaction_id = m.transaction_id
     JOIN products p ON p.product_id = m.product_id
     JOIN warehouses w ON w.warehouse_id = m.warehouse_id
     JOIN users u ON u.user_id = m.created_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY m.movement_id DESC LIMIT 500`, params
  );
  res.json(rows);
}));

module.exports = router;
