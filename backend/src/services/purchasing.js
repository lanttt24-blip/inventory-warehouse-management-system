const { pool, withTransaction } = require('../config/db');
const { badRequest, notFound, positiveInt } = require('../utils/errors');
const { audit } = require('./audit');

/** Allowed manual transitions (BR-08). PARTIALLY_RECEIVED / RECEIVED are set only by receiving. */
const TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  PARTIALLY_RECEIVED: [],
  RECEIVED: [],
  CANCELLED: [],
};

async function createPurchaseOrder(user, { supplier_id, expected_date, note, items }) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest('Add at least one product line.');
  const seen = new Set();
  const lines = items.map((it) => {
    const productId = Number(it.product_id);
    if (!Number.isInteger(productId)) throw badRequest('Each line needs a product.');
    if (seen.has(productId)) throw badRequest('A product can appear only once per order.');
    seen.add(productId);
    const cost = it.unit_cost === undefined || it.unit_cost === '' ? null : Number(it.unit_cost);
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) throw badRequest('Unit cost cannot be negative.');
    return { productId, quantity: positiveInt(it.quantity, 'Ordered quantity'), cost };
  });

  return withTransaction(async (conn) => {
    const [[s]] = await conn.query('SELECT supplier_id, is_active FROM suppliers WHERE supplier_id = ?', [supplier_id]);
    if (!s) throw notFound('Supplier does not exist.');
    if (!s.is_active) throw badRequest('This supplier is inactive.');
    const [r] = await conn.query(
      'INSERT INTO purchase_orders (supplier_id, expected_date, note, created_by) VALUES (?,?,?,?)',
      [supplier_id, expected_date || null, note || null, user.userId]
    );
    for (const l of lines) {
      const [[p]] = await conn.query('SELECT product_id, unit_cost, is_active, name FROM products WHERE product_id = ?', [l.productId]);
      if (!p) throw notFound(`Product ${l.productId} does not exist.`);
      if (!p.is_active) throw badRequest(`Product "${p.name}" is deactivated.`);
      await conn.query(
        'INSERT INTO purchase_order_lines (po_id, product_id, ordered_qty, unit_cost) VALUES (?,?,?,?)',
        [r.insertId, l.productId, l.quantity, l.cost ?? p.unit_cost]
      );
    }
    await audit(conn, user.userId, 'CREATE_PO', 'purchase_order', r.insertId, { supplier_id, lines });
    return { poId: r.insertId };
  });
}

async function listPurchaseOrders({ status }) {
  const params = [];
  let where = '';
  if (status) { where = 'WHERE po.status = ?'; params.push(status); }
  const [rows] = await pool.query(
    `SELECT po.po_id, po.status, po.expected_date, po.created_at, s.name AS supplier_name, u.full_name AS created_by_name,
            COALESCE(SUM(l.ordered_qty),0) AS total_ordered, COALESCE(SUM(l.received_qty),0) AS total_received,
            COALESCE(SUM(l.ordered_qty * l.unit_cost),0) AS total_value
     FROM purchase_orders po
     JOIN suppliers s ON s.supplier_id = po.supplier_id
     JOIN users u ON u.user_id = po.created_by
     LEFT JOIN purchase_order_lines l ON l.po_id = po.po_id
     ${where}
     GROUP BY po.po_id ORDER BY po.po_id DESC`, params
  );
  return rows;
}

async function getPurchaseOrder(id) {
  const [[po]] = await pool.query(
    `SELECT po.*, s.name AS supplier_name FROM purchase_orders po JOIN suppliers s ON s.supplier_id = po.supplier_id WHERE po.po_id = ?`, [id]
  );
  if (!po) throw notFound('Purchase order not found.');
  const [lines] = await pool.query(
    `SELECT l.*, p.sku, p.name, p.unit FROM purchase_order_lines l JOIN products p ON p.product_id = l.product_id WHERE l.po_id = ?`, [id]
  );
  return { ...po, lines };
}

async function changeStatus(user, id, newStatus) {
  return withTransaction(async (conn) => {
    const [[po]] = await conn.query('SELECT po_id, status FROM purchase_orders WHERE po_id = ? FOR UPDATE', [id]);
    if (!po) throw notFound('Purchase order not found.');
    if (!(TRANSITIONS[po.status] || []).includes(newStatus)) {
      throw badRequest(`An order that is ${po.status} cannot change to ${newStatus}.`);
    }
    await conn.query('UPDATE purchase_orders SET status = ? WHERE po_id = ?', [newStatus, id]);
    await audit(conn, user.userId, 'PO_STATUS', 'purchase_order', id, { from: po.status, to: newStatus });
    return { poId: id, status: newStatus };
  });
}

module.exports = { createPurchaseOrder, listPurchaseOrders, getPurchaseOrder, changeStatus, TRANSITIONS };
