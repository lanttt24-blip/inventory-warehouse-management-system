const { withTransaction } = require('../config/db');
const { badRequest, notFound, conflict, positiveInt } = require('../utils/errors');
const { audit } = require('./audit');

/* ---------- helpers (all take a connection that is inside a transaction) ---------- */

async function requireActiveProduct(conn, productId) {
  const [[p]] = await conn.query('SELECT product_id, name, is_active FROM products WHERE product_id = ?', [productId]);
  if (!p) throw notFound(`Product ${productId} does not exist.`);
  if (!p.is_active) throw badRequest(`Product "${p.name}" is deactivated and cannot be used in new transactions.`);
  return p;
}

async function requireActiveWarehouse(conn, warehouseId) {
  const [[w]] = await conn.query('SELECT warehouse_id, name, is_active FROM warehouses WHERE warehouse_id = ?', [warehouseId]);
  if (!w) throw notFound(`Warehouse ${warehouseId} does not exist.`);
  if (!w.is_active) throw badRequest(`Warehouse "${w.name}" is inactive.`);
  return w;
}

async function createTransaction(conn, type, reference, note, userId) {
  const [r] = await conn.query(
    'INSERT INTO stock_transactions (transaction_type, reference, note, created_by) VALUES (?,?,?,?)',
    [type, reference || null, note || null, userId]
  );
  return r.insertId;
}

async function addMovement(conn, txId, productId, warehouseId, delta, userId) {
  await conn.query(
    'INSERT INTO stock_movements (transaction_id, product_id, warehouse_id, quantity_delta, created_by) VALUES (?,?,?,?,?)',
    [txId, productId, warehouseId, delta, userId]
  );
}

async function increaseStock(conn, productId, warehouseId, qty) {
  await conn.query(
    `INSERT INTO stock_balances (product_id, warehouse_id, quantity) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [productId, warehouseId, qty]
  );
}

/** Atomic conditional update: succeeds only if enough stock remains (BR-03, TC-12). */
async function decreaseStock(conn, productId, warehouseId, qty, productName) {
  const [r] = await conn.query(
    'UPDATE stock_balances SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ? AND quantity >= ?',
    [qty, productId, warehouseId, qty]
  );
  if (r.affectedRows === 0) {
    const [[b]] = await conn.query(
      'SELECT quantity FROM stock_balances WHERE product_id = ? AND warehouse_id = ?', [productId, warehouseId]
    );
    throw conflict(`Not enough stock for "${productName}". Available: ${b ? b.quantity : 0}, requested: ${qty}.`);
  }
}

function cleanItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest('Add at least one product line.');
  const seen = new Set();
  return items.map((it) => {
    const productId = Number(it.product_id);
    if (!Number.isInteger(productId)) throw badRequest('Each line needs a product.');
    if (seen.has(productId)) throw badRequest('A product can appear only once per transaction.');
    seen.add(productId);
    return { productId, quantity: positiveInt(it.quantity) };
  });
}

/* ---------- Receive stock (FR-06, FR-07) ---------- */

async function receiveStock(user, { warehouse_id, po_id, note, items }) {
  const lines = cleanItems(items);
  return withTransaction(async (conn) => {
    await requireActiveWarehouse(conn, warehouse_id);

    let po = null;
    let poLines = [];
    if (po_id) {
      [[po]] = await conn.query('SELECT po_id, status FROM purchase_orders WHERE po_id = ? FOR UPDATE', [po_id]);
      if (!po) throw notFound(`Purchase order ${po_id} does not exist.`);
      if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
        throw badRequest(`Purchase order #${po_id} is ${po.status} and cannot receive goods. It must be APPROVED or PARTIALLY_RECEIVED.`);
      }
      [poLines] = await conn.query('SELECT * FROM purchase_order_lines WHERE po_id = ? FOR UPDATE', [po_id]);
    }

    const txId = await createTransaction(conn, 'RECEIPT', po_id ? `PO-${po_id}` : 'DIRECT', note, user.userId);

    for (const { productId, quantity } of lines) {
      const product = await requireActiveProduct(conn, productId);
      if (po) {
        const line = poLines.find((l) => l.product_id === productId);
        if (!line) throw badRequest(`"${product.name}" is not on purchase order #${po_id}.`);
        const outstanding = line.ordered_qty - line.received_qty;
        if (quantity > outstanding) {
          throw badRequest(`"${product.name}": only ${outstanding} still outstanding on the order, but ${quantity} was entered.`);
        }
        await conn.query('UPDATE purchase_order_lines SET received_qty = received_qty + ? WHERE line_id = ?', [quantity, line.line_id]);
        line.received_qty += quantity;
      }
      await increaseStock(conn, productId, warehouse_id, quantity);
      await addMovement(conn, txId, productId, warehouse_id, quantity, user.userId);
    }

    let poStatus = null;
    if (po) {
      const complete = poLines.every((l) => l.received_qty >= l.ordered_qty);
      poStatus = complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      await conn.query('UPDATE purchase_orders SET status = ? WHERE po_id = ?', [poStatus, po_id]);
    }
    await audit(conn, user.userId, 'RECEIVE_STOCK', 'stock_transaction', txId, { warehouse_id, po_id: po_id || null, lines });
    return { transactionId: txId, reference: po_id ? `PO-${po_id}` : 'DIRECT', purchaseOrderStatus: poStatus };
  });
}

/* ---------- Issue stock (FR-08) ---------- */

async function issueStock(user, { warehouse_id, reason, items }) {
  if (!reason || !String(reason).trim()) throw badRequest('Enter a reason or reference for this issue.');
  const lines = cleanItems(items);
  return withTransaction(async (conn) => {
    await requireActiveWarehouse(conn, warehouse_id);
    const txId = await createTransaction(conn, 'ISSUE', null, String(reason).trim(), user.userId);
    for (const { productId, quantity } of lines) {
      const product = await requireActiveProduct(conn, productId);
      await decreaseStock(conn, productId, warehouse_id, quantity, product.name);
      await addMovement(conn, txId, productId, warehouse_id, -quantity, user.userId);
    }
    await audit(conn, user.userId, 'ISSUE_STOCK', 'stock_transaction', txId, { warehouse_id, lines });
    return { transactionId: txId };
  });
}

/* ---------- Transfer (FR-09, BR-04) ---------- */

async function transferStock(user, { from_warehouse_id, to_warehouse_id, note, items }) {
  if (Number(from_warehouse_id) === Number(to_warehouse_id)) {
    throw badRequest('Source and destination warehouses must be different.');
  }
  const lines = cleanItems(items);
  return withTransaction(async (conn) => {
    await requireActiveWarehouse(conn, from_warehouse_id);
    await requireActiveWarehouse(conn, to_warehouse_id);
    const txId = await createTransaction(conn, 'TRANSFER', `WH${from_warehouse_id}->WH${to_warehouse_id}`, note, user.userId);
    for (const { productId, quantity } of lines) {
      const product = await requireActiveProduct(conn, productId);
      await decreaseStock(conn, productId, from_warehouse_id, quantity, product.name);
      await addMovement(conn, txId, productId, from_warehouse_id, -quantity, user.userId);
      await increaseStock(conn, productId, to_warehouse_id, quantity);
      await addMovement(conn, txId, productId, to_warehouse_id, quantity, user.userId);
    }
    await audit(conn, user.userId, 'TRANSFER_STOCK', 'stock_transaction', txId, { from_warehouse_id, to_warehouse_id, lines });
    return { transactionId: txId };
  });
}

/* ---------- Stocktake adjustment (FR-10, BR-06) ---------- */

async function adjustStock(user, { warehouse_id, product_id, counted_quantity, reason }) {
  if (!reason || !String(reason).trim()) throw badRequest('A reason is required for every adjustment.');
  const counted = Number(counted_quantity);
  if (!Number.isInteger(counted) || counted < 0) throw badRequest('Counted quantity must be zero or a positive whole number.');
  return withTransaction(async (conn) => {
    await requireActiveWarehouse(conn, warehouse_id);
    await requireActiveProduct(conn, product_id);
    const [[bal]] = await conn.query(
      'SELECT quantity FROM stock_balances WHERE product_id = ? AND warehouse_id = ? FOR UPDATE', [product_id, warehouse_id]
    );
    const current = bal ? bal.quantity : 0;
    const delta = counted - current;
    if (delta === 0) throw badRequest('The counted quantity matches the system quantity. No adjustment needed.');
    const txId = await createTransaction(conn, 'ADJUSTMENT', 'STOCKTAKE', String(reason).trim(), user.userId);
    if (bal) {
      await conn.query('UPDATE stock_balances SET quantity = ? WHERE product_id = ? AND warehouse_id = ?', [counted, product_id, warehouse_id]);
    } else {
      await conn.query('INSERT INTO stock_balances (product_id, warehouse_id, quantity) VALUES (?,?,?)', [product_id, warehouse_id, counted]);
    }
    await addMovement(conn, txId, product_id, warehouse_id, delta, user.userId);
    await audit(conn, user.userId, 'ADJUST_STOCK', 'stock_transaction', txId, { warehouse_id, product_id, previous: current, counted, reason });
    return { transactionId: txId, previousQuantity: current, newQuantity: counted, delta };
  });
}

module.exports = { receiveStock, issueStock, transferStock, adjustStock };
