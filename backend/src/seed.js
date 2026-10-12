/**
 * Creates tables (from database/schema.sql) and demo data.
 * Usage: npm run db:init   (reads .env; WARNING: drops and recreates all tables)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'Demo@1234';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true,
  });
  const dbName = process.env.DB_NAME || 'iwms';

  let schema = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
  // Cloud databases often have a fixed database name: replace the name used in the file.
  schema = schema.replace(/CREATE DATABASE IF NOT EXISTS iwms[^;]*;/, `CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`).replace(/USE iwms;/, `USE \`${dbName}\`;`);
  await conn.query(schema);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await conn.query("INSERT INTO roles (role_name) VALUES ('Administrator'),('Warehouse Manager'),('Warehouse Staff'),('Purchasing Staff')");
  await conn.query(
    `INSERT INTO users (role_id, full_name, email, password_hash) VALUES
     (1,'Demo Administrator','admin@iwms.demo',?),
     (2,'Demo Warehouse Manager','manager@iwms.demo',?),
     (3,'Demo Warehouse Staff','staff@iwms.demo',?),
     (4,'Demo Purchasing Staff','purchasing@iwms.demo',?)`, [hash, hash, hash, hash]);

  await conn.query("INSERT INTO categories (category_name, description) VALUES ('Electronics','Devices and accessories'),('Office supplies','Paper, pens, folders'),('Packaging','Boxes, tape, wrap')");
  await conn.query(
    `INSERT INTO warehouses (name, location) VALUES ('Main Warehouse','District 7, Ho Chi Minh City'),('Branch Warehouse','Thu Duc, Ho Chi Minh City')`);
  await conn.query(
    `INSERT INTO suppliers (name, email, phone, address) VALUES
     ('Sao Mai Trading','sales@saomai.example','0901000001','Ho Chi Minh City'),
     ('An Phat Supplies','contact@anphat.example','0901000002','Binh Duong')`);
  await conn.query(
    `INSERT INTO products (sku, name, category_id, unit, unit_cost, reorder_level) VALUES
     ('ELE-001','Wireless mouse',1,'pcs',150000,20),
     ('ELE-002','USB-C cable 1m',1,'pcs',45000,50),
     ('OFF-001','A4 paper ream',2,'ream',70000,100),
     ('OFF-002','Ballpoint pen blue',2,'box',30000,30),
     ('PKG-001','Carton box 40x30',3,'pcs',12000,200)`);
  await conn.query(
    `INSERT INTO stock_balances (product_id, warehouse_id, quantity) VALUES
     (1,1,35),(2,1,80),(3,1,60),(4,1,45),(5,1,500),(1,2,10),(3,2,40)`);
  // Opening movements so the ledger matches the opening balances
  await conn.query("INSERT INTO stock_transactions (transaction_type, reference, note, created_by) VALUES ('ADJUSTMENT','OPENING','Opening balance (demo data)',1)");
  await conn.query(
    `INSERT INTO stock_movements (transaction_id, product_id, warehouse_id, quantity_delta, created_by) VALUES
     (1,1,1,35,1),(1,2,1,80,1),(1,3,1,60,1),(1,4,1,45,1),(1,5,1,500,1),(1,1,2,10,1),(1,3,2,40,1)`);

  console.log('Database ready. Demo password for all users:', DEMO_PASSWORD);
  await conn.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
