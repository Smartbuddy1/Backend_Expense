const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 5 attempts per 15 minutes per IP — see docs/06-security.md §1
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: 'Too many login attempts. Try again later.' },
});

const loginSchema = z.object({
  mobile: z.string().min(10),
  password: z.string().min(1),
});

function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// Matches the shape every module's AuthContext.jsx already calls: POST /auth/login {mobile, password}
router.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'mobile and password are required' });
  }
  const { mobile, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { mobile } });
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Invalid mobile number or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid mobile number or password' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ token, user: toSafeUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: toSafeUser(user) });
});

module.exports = router;
