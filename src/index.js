require('dotenv').config();
const os = require('os');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const logger = require('./utils/logger');
const { swaggerUi, specs } = require('./swagger');

// Custom middleware to sanitize incoming data
const clean = (data) => {
  if (typeof data === 'string') return xss(data);
  if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      data[key] = clean(data[key]);
    }
  }
  return data;
};
const xssMiddleware = (req, res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  if (req.params) req.params = clean(req.params);
  next();
};

// Express 5 natively forwards async route errors to the global error handler —
// no express-async-errors package needed (that package only supports Express 4).
function getLanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

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
const publicFormRoutes = require('./routes/publicForms');

const app = express();
app.set('trust proxy', 1);

// Standard security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Always allow any localhost / 127.0.0.1 port (dev convenience)
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow any device on the local network (192.168.x.x) for development
    if (/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow the specific AWS EC2 instance IP
    if (/^https?:\/\/3\.111\.236\.204(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow production domains directly to prevent .env misconfiguration issues
    if (/^https?:\/\/(www\.)?aaryainnovtech\.com$/.test(origin)) return callback(null, true);
    // Allow origins explicitly listed in FRONTEND_URL env var
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(xssMiddleware);

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

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

// Locally-stored receipt photos (the S3 fallback in utils/s3.js) — helmet's
// default same-origin resource policy would otherwise block the frontend
// (a different origin) from loading these as <img> sources.
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

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
app.use('/public-forms', publicFormRoutes);

// Centralized error handler — catches anything a route didn't handle itself
// (bad multipart data, unexpected DB errors) instead of leaking a stack trace.
app.use((err, req, res, next) => {
  // Handle Zod Validation Errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
  }

  // Handle Prisma Database Conflicts (e.g. Unique Constraint Failed)
  if (err.code === 'P2002') {
    const target = err.meta?.target ? err.meta.target.join(', ') : 'field';
    return res.status(409).json({
      error: 'Data Conflict',
      message: `A record with this ${target} already exists.`
    });
  }

  // Handle Prisma Record Not Found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  // Fallback for everything else
  logger.error('Unhandled Server Error: %O', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces
app.listen(PORT, HOST, () => {
  const lanIP = getLanIP();
  logger.info(`ASEMS backend listening on http://localhost:${PORT}`);
  logger.info(`ASEMS backend also accessible on http://${lanIP}:${PORT}`);
});
