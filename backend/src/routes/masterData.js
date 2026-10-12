const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { wrap, badRequest, notFound } = require('../utils/errors');

router.use(authenticate);

const required = (obj, fields) => {
  for (const f of fields) if (obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === '') throw badRequest(`${f.replace(/_/g, ' ')} is required.`);
};
const nonNegInt = (v, label) => { const n = Number(v); if (!Number.isInteger(n) || n < 0) throw badRequest(`${label} must be zero or more.`); return n; };
const nonNegNum = (v, label) => { const n = Number(v); if (Number.isNaN(n) || n < 0) throw badRequest(`${label} cannot be negative.`); return n; };

/* ---------- Categories ---------- */
router.get('/categories', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY category_name');
  res.json(rows);
}));
router.post('/categories', authorize(), wrap(async (req, res) => {
  required(req.body, ['category_name']);
  const [r] = await pool.query('INSERT INTO categories (category_name, description) VALUES (?,?)', [req.body.category_name.trim(), req.body.description || null]);
  res.status(201).json({ category_id: r.insertId });
}));

/* ---------- Products ---------- */
router.get('/products', wrap(async (req, res) => {
  const { search, category_id, include_inactive } = req.query;
  const where = []; const params = [];
  if (include_inactive !== 'true') where.push('p.is_active = 1');
  if (search) { where.push('(p.sku LIKE ? OR p.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (category_id) { where.push('p.category_id = ?'); params.push(category_id); }
  const [rows] = await pool.query(
    `SELECT p.*, c.category_name, COALESCE(SUM(b.quantity),0) AS total_stock
     FROM products p LEFT JOIN categories c ON c.category_id = p.category_id
     LEFT JOIN stock_balances b ON b.product_id = p.product_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY p.product_id ORDER BY p.name`, params
  );
  res.json(rows);
}));
router.post('/products', authorize(), wrap(async (req, res) => {
  const b = req.body;
  required(b, ['sku', 'name']);
  const [r] = await pool.query(
    'INSERT INTO products (sku, name, category_id, unit, unit_cost, reorder_level) VALUES (?,?,?,?,?,?)',
    [b.sku.trim(), b.name.trim(), b.category_id || null, b.unit || 'pcs', nonNegNum(b.unit_cost ?? 0, 'Unit cost'), nonNegInt(b.reorder_level ?? 0, 'Reorder level')]
  );
  res.status(201).json({ product_id: r.insertId });
}));
router.patch('/products/:id', authorize(), wrap(async (req, res) => {
  const b = req.body; const sets = []; const params = [];
  if (b.sku !== undefined) { required(b, ['sku']); sets.push('sku = ?'); params.push(b.sku.trim()); }
  if (b.name !== undefined) { required(b, ['name']); sets.push('name = ?'); params.push(b.name.trim()); }
  if (b.category_id !== undefined) { sets.push('category_id = ?'); params.push(b.category_id || null); }
  if (b.unit !== undefined) { sets.push('unit = ?'); params.push(b.unit); }
  if (b.unit_cost !== undefined) { sets.push('unit_cost = ?'); params.push(nonNegNum(b.unit_cost, 'Unit cost')); }
  if (b.reorder_level !== undefined) { sets.push('reorder_level = ?'); params.push(nonNegInt(b.reorder_level, 'Reorder level')); }
  if (b.is_active !== undefined) { sets.push('is_active = ?'); params.push(b.is_active ? 1 : 0); }
  if (!sets.length) throw badRequest('Nothing to update.');
  const [r] = await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE product_id = ?`, [...params, req.params.id]);
  if (!r.affectedRows) throw notFound('Product not found.');
  res.json({ ok: true });
}));

/* ---------- Warehouses ---------- */
router.get('/warehouses', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM warehouses ORDER BY name');
  res.json(rows);
}));
router.post('/warehouses', authorize(), wrap(async (req, res) => {
  required(req.body, ['name']);
  const [r] = await pool.query('INSERT INTO warehouses (name, location) VALUES (?,?)', [req.body.name.trim(), req.body.location || null]);
  res.status(201).json({ warehouse_id: r.insertId });
}));
router.patch('/warehouses/:id', authorize(), wrap(async (req, res) => {
  const b = req.body; const sets = []; const params = [];
  if (b.name !== undefined) { required(b, ['name']); sets.push('name = ?'); params.push(b.name.trim()); }
  if (b.location !== undefined) { sets.push('location = ?'); params.push(b.location); }
  if (b.is_active !== undefined) { sets.push('is_active = ?'); params.push(b.is_active ? 1 : 0); }
  if (!sets.length) throw badRequest('Nothing to update.');
  const [r] = await pool.query(`UPDATE warehouses SET ${sets.join(', ')} WHERE warehouse_id = ?`, [...params, req.params.id]);
  if (!r.affectedRows) throw notFound('Warehouse not found.');
  res.json({ ok: true });
}));

/* ---------- Suppliers ---------- */
router.get('/suppliers', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name');
  res.json(rows);
}));
router.post('/suppliers', authorize('Purchasing Staff'), wrap(async (req, res) => {
  required(req.body, ['name']);
  const b = req.body;
  const [r] = await pool.query('INSERT INTO suppliers (name, email, phone, address) VALUES (?,?,?,?)', [b.name.trim(), b.email || null, b.phone || null, b.address || null]);
  res.status(201).json({ supplier_id: r.insertId });
}));
router.patch('/suppliers/:id', authorize('Purchasing Staff'), wrap(async (req, res) => {
  const b = req.body; const sets = []; const params = [];
  for (const f of ['name', 'email', 'phone', 'address']) if (b[f] !== undefined) { sets.push(`${f} = ?`); params.push(b[f]); }
  if (b.is_active !== undefined) { sets.push('is_active = ?'); params.push(b.is_active ? 1 : 0); }
  if (!sets.length) throw badRequest('Nothing to update.');
  const [r] = await pool.query(`UPDATE suppliers SET ${sets.join(', ')} WHERE supplier_id = ?`, [...params, req.params.id]);
  if (!r.affectedRows) throw notFound('Supplier not found.');
  res.json({ ok: true });
}));

/* ---------- Users (Administrator only) ---------- */
router.get('/roles', authorize(), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM roles ORDER BY role_id');
  res.json(rows);
}));
router.get('/users', authorize(), wrap(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT u.user_id, u.full_name, u.email, u.is_active, r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id ORDER BY u.user_id'
  );
  res.json(rows);
}));
router.post('/users', authorize(), wrap(async (req, res) => {
  const b = req.body;
  required(b, ['full_name', 'email', 'password', 'role_id']);
  if (String(b.password).length < 8) throw badRequest('Password must be at least 8 characters.');
  const hash = await bcrypt.hash(b.password, 10);
  const [r] = await pool.query('INSERT INTO users (role_id, full_name, email, password_hash) VALUES (?,?,?,?)', [b.role_id, b.full_name.trim(), b.email.trim(), hash]);
  res.status(201).json({ user_id: r.insertId });
}));
router.patch('/users/:id', authorize(), wrap(async (req, res) => {
  const b = req.body; const sets = []; const params = [];
  if (b.role_id !== undefined) { sets.push('role_id = ?'); params.push(b.role_id); }
  if (b.is_active !== undefined) {
    if (Number(req.params.id) === req.user.userId && !b.is_active) throw badRequest('You cannot deactivate your own account.');
    sets.push('is_active = ?'); params.push(b.is_active ? 1 : 0);
  }
  if (!sets.length) throw badRequest('Nothing to update.');
  const [r] = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`, [...params, req.params.id]);
  if (!r.affectedRows) throw notFound('User not found.');
  res.json({ ok: true });
}));

module.exports = router;
