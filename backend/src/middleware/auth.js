const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(401, 'Please log in to continue.'));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new AppError(401, 'Your session has expired. Please log in again.'));
  }
}

/** Allow only the listed roles. Administrator is always allowed. */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'Please log in to continue.'));
  if (req.user.role === 'Administrator' || roles.includes(req.user.role)) return next();
  next(new AppError(403, 'Your role is not allowed to perform this action.'));
};

module.exports = { authenticate, authorize };
