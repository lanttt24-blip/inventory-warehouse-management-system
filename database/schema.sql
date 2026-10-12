-- IWMS schema (MySQL 8+)
CREATE DATABASE IF NOT EXISTS iwms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iwms;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs, stock_movements, stock_transactions, purchase_order_lines,
  purchase_orders, stock_balances, products, categories, suppliers, warehouses, users, roles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE products (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category_id INT,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CHECK (reorder_level >= 0),
  CHECK (unit_cost >= 0),
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  INDEX idx_products_name (name)
);

CREATE TABLE warehouses (
  warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(200),
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE suppliers (
  supplier_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(120),
  phone VARCHAR(30),
  address VARCHAR(255),
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE stock_balances (
  stock_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (quantity >= 0),
  UNIQUE KEY uq_product_warehouse (product_id, warehouse_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id)
);

CREATE TABLE purchase_orders (
  po_id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  status ENUM('DRAFT','SUBMITTED','APPROVED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  expected_date DATE,
  note VARCHAR(255),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_po_status (status)
);

CREATE TABLE purchase_order_lines (
  line_id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  product_id INT NOT NULL,
  ordered_qty INT NOT NULL,
  received_qty INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  CHECK (ordered_qty > 0),
  CHECK (received_qty >= 0),
  FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE stock_transactions (
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type ENUM('RECEIPT','ISSUE','TRANSFER','ADJUSTMENT') NOT NULL,
  reference VARCHAR(100),
  note VARCHAR(255),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_tx_date (created_at)
);

CREATE TABLE stock_movements (
  movement_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  quantity_delta INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (quantity_delta <> 0),
  FOREIGN KEY (transaction_id) REFERENCES stock_transactions(transaction_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_mv_date (created_at),
  INDEX idx_mv_wh (warehouse_id)
);

CREATE TABLE audit_logs (
  audit_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(60),
  entity_id VARCHAR(60),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
