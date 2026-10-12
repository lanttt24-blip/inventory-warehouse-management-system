# Deployment guide

Order: **database → backend → frontend**.

## 1. MySQL in the cloud
Use any hosted MySQL (Railway, Aiven, TiDB Cloud...). Check each provider's current free plan.
Note the host, port, user, password and database name. If the provider requires SSL, set `DB_SSL=true`.

Create the tables and demo data **from your own computer** (put the cloud values in `backend/.env`):
```bash
cd backend && npm install && npm run db:init
```
(Or import `database/iwms.sql` — see "Database dump" below.)

## 2. Backend on Render
- New → Web Service → pick this repo
- Root Directory: `backend`  ·  Build: `npm install`  ·  Start: `npm start`
- Environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, `JWT_SECRET`, `FRONTEND_URL` (the Vercel URL, add after step 3)
- Test: open `https://<your-api>.onrender.com/health` → `{"ok":true}`

The free Render service sleeps when idle; the first request can take up to a minute.

## 3. Frontend on Vercel
- Add New → Project → pick this repo, Root Directory: `frontend`
- Environment variable: `VITE_API_URL` = the Render URL (no trailing slash)
- Deploy, then put the Vercel URL into `FRONTEND_URL` on Render (CORS) and redeploy the backend.

## Database dump (.sql) for submission
After `npm run db:init`:
```bash
mysqldump -u root -p --databases iwms > database/iwms.sql
```
Test it by importing into an empty database before submitting.
