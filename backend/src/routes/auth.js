const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimitMap = new Map();
const { pool } = require('../config/db');
const { wrap, AppError, badRequest } = require('../utils/errors');
const { authenticate } = require('../middleware/auth');

// Minimal in-memory login rate limit: 10 attempts / 15 min per IP (security design 3.11)
function loginLimiter(req, res, next) {
  const now = Date.now();
  const entry = (rateLimitMap.get(req.ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (entry.length >= 10) return next(new AppError(429, 'Too many login attempts. Try again in 15 minutes.'));
  entry.push(now);
  rateLimitMap.set(req.ip, entry);
  next();
}

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw badRequest('Enter your email and password.');
  const [[u]] = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.email = ?`, [email]
  );
  // Same generic message for unknown user / wrong password / inactive (UC-01 alternative flow)
  const ok = u && u.is_active && (await bcrypt.compare(password, u.password_hash));
  if (!ok) throw new AppError(401, 'Incorrect email or password.');
  const payload = { userId: u.user_id, role: u.role_name, name: u.full_name };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.json({ token, user: { id: u.user_id, name: u.full_name, email: u.email, role: u.role_name } });
}));

router.get('/me', authenticate, wrap(async (req, res) => {
  res.json({ user: { id: req.user.userId, name: req.user.name, role: req.user.role } });
}));

module.exports = router;
