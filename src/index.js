require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Simple check to confirm the server is alive — visit http://localhost:5000/health in a browser
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ASEMS backend is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ASEMS backend listening on http://localhost:${PORT}`);
});
