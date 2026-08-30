const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(10),
  password: z.string().min(6),
  role: z.enum(['admin', 'operations', 'accountant', 'site_supervisor']),
  email: z.string().email().optional(),
});

function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// Admin-only: this is how every non-admin user account gets created — it replaces the
// password fields that Admin's Create*Modal components already collect client-side but
// currently send nowhere (see docs/03-frontend-status.md).
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const { name, mobile, password, role, email } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) {
    return res.status(409).json({ error: 'A user with this mobile number already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, mobile, email, passwordHash, role },
  });

  res.status(201).json({ user: toSafeUser(user) });
});

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ users: users.map(toSafeUser) });
});

module.exports = router;
