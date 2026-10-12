function errorHandler(err, req, res, _next) {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with this unique value already exists (for example a duplicate SKU or email).' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'A referenced record does not exist.' });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'This record is in use and cannot be removed. Deactivate it instead.' });
  }
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
}
module.exports = errorHandler;
