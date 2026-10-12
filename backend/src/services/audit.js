/** Write an audit record using the given connection (so it joins the caller's transaction). */
async function audit(conn, userId, action, entityType, entityId, metadata = {}) {
  await conn.query(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) VALUES (?,?,?,?,?)',
    [userId, action, entityType, String(entityId ?? ''), JSON.stringify(metadata)]
  );
}
module.exports = { audit };
