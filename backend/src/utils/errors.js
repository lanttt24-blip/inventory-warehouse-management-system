class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const badRequest = (m) => new AppError(400, m);
const notFound = (m) => new AppError(404, m);
const conflict = (m) => new AppError(409, m);

/** Wrap async route handlers so thrown errors reach the error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Positive integer check used for quantities (BR-02). */
function positiveInt(value, label = 'Quantity') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${label} must be a whole number greater than zero.`);
  return n;
}

module.exports = { AppError, badRequest, notFound, conflict, wrap, positiveInt };
