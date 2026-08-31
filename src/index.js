require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const organizationRoutes = require('./routes/organizations');
const projectRoutes = require('./routes/projects');
const expenseRoutes = require('./routes/expenses');
const advanceRoutes = require('./routes/advances');
const teamMemberRoutes = require('./routes/teamMembers');
const operationalHeadRoutes = require('./routes/operationalHeads');
const paymentsLedgerRoutes = require('./routes/paymentsLedger');
const settlementRoutes = require('./routes/settlements');
const siteLogRoutes = require('./routes/siteLogs');

const app = express();

// Standard security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

// Backstop against abuse/scraping on top of the tighter per-route limiter on
// login — generous enough that a dashboard's normal burst of parallel GET
// calls on page load never trips it.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Simple check to confirm the server is alive — visit http://localhost:5000/health in a browser
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ASEMS backend is running' });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/organizations', organizationRoutes);
app.use('/projects', projectRoutes);
app.use('/expenses', expenseRoutes);
app.use('/advances', advanceRoutes);
app.use('/team-members', teamMemberRoutes);
app.use('/operational-heads', operationalHeadRoutes);
app.use('/payments-ledger', paymentsLedgerRoutes);
app.use('/settlements', settlementRoutes);
app.use('/site-logs', siteLogRoutes);

// Centralized error handler — catches anything a route didn't handle itself
// (bad multipart data, unexpected DB errors) instead of leaking a stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ASEMS backend listening on http://localhost:${PORT}`);
});
