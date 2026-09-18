const jwt = require('jsonwebtoken');

const prisma = require('../db');

// Reads "Authorization: Bearer <token>", verifies it, and attaches the decoded
// { id, role } payload to req.user. Every route that needs a logged-in user goes
// through this first.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'User is inactive or deleted' });
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Use after requireAuth: requireRole('admin', 'operations') only lets those roles through.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
