require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
const origins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({ origin: origins }));
app.use(express.json());

app.get('/', (req, res) => res.json({ name: 'IWMS API', status: 'running' }));
app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/masterData'));
app.use('/api', require('./routes/operations'));
app.use('/api', require('./routes/reports'));

app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`IWMS API listening on port ${PORT}`));
}
module.exports = app;
