# Inventory & Warehouse Management System (IWMS)

Software Engineering project, University of Economics and Finance (UEF).
Web application that tracks products, warehouses, suppliers, purchase orders and every stock movement (receipt, issue, transfer, stocktake adjustment).

**Stack:** React (Vite) · Node.js + Express · MySQL

## Team
| Name | Student ID |
|---|---|
| Nguyễn Thị Khánh Băng | 245071817 |
| Trần Thị Tố Lan | 245155955 |
| Nguyễn Khánh Gia Huy | 245150397 |
| Nguyễn Hoàng Thiên Văn | 245162545 |
| Nguyễn Duy Khánh | 245169928 |

## Features
- Login with JWT, bcrypt password hashing, role-based access (Administrator, Warehouse Manager, Warehouse Staff, Purchasing Staff)
- CRUD: products, categories, suppliers, warehouses, users (deactivate instead of delete)
- Purchase orders with status flow: Draft → Submitted → Approved → Partially received → Received (or Cancelled)
- Receive, issue and transfer stock; every change runs in one database transaction with an append-only movement ledger
- Issues and transfers are rejected when stock is insufficient (atomic conditional update, safe under concurrent requests)
- Stocktake adjustments with required reason; audit log
- Dashboard, stock levels, low-stock report, movement history (filters + CSV export)

## Project structure
```
database/schema.sql     MySQL tables
backend/src             Express API (routes → services → database)
frontend/src            React app (pages, components)
```

## Run locally
Requirements: Node.js 18+ and MySQL 8+.

```bash
# 1. Backend
cd backend
cp .env.example .env        # then edit DB_PASSWORD and JWT_SECRET
npm install
npm run db:init             # creates the tables and demo data (drops existing tables!)
npm run dev                 # API on http://localhost:3000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:3000
npm install
npm run dev                 # app on http://localhost:5173
```

### Demo accounts (password for all: `Demo@1234`)
| Role | Email |
|---|---|
| Administrator | admin@iwms.demo |
| Warehouse Manager | manager@iwms.demo |
| Warehouse Staff | staff@iwms.demo |
| Purchasing Staff | purchasing@iwms.demo |

## Permissions
| Action | Roles |
|---|---|
| Manage products, warehouses, users | Administrator |
| Manage suppliers, create purchase orders | Purchasing Staff (and Administrator) |
| Approve purchase orders, stock adjustments, reports | Warehouse Manager (and Administrator) |
| Receive / issue / transfer stock | Warehouse Staff, Warehouse Manager (and Administrator) |
| View products, stock, suppliers, orders | Any logged-in user |

## Deployment
See `DEPLOY.md`.

## API overview
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/login | Log in |
| GET/POST/PATCH | /api/products, /api/warehouses, /api/suppliers | Master data |
| GET/POST | /api/purchase-orders, PATCH /api/purchase-orders/:id/status | Purchase orders |
| POST | /api/receipts, /api/issues, /api/transfers, /api/stock-adjustments | Stock operations |
| GET | /api/stock, /api/warehouses/:id/stock | Stock levels |
| GET | /api/reports/low-stock, /api/reports/movements | Reports |
