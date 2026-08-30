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

// Admin can create any role. Operations can only create site_supervisor accounts
// (they manage field staff day to day, but shouldn't be able to create other
// admin/operations/accountant logins).
router.post('/', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const { name, mobile, password, role, email } = parsed.data;

  if (req.user.role === 'operations' && role !== 'site_supervisor') {
    return res.status(403).json({ error: 'Operations can only create Site Supervisor accounts' });
  }

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

// Operations also needs this to pick a supervisor when creating a project.
router.get('/', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const where = req.query.role ? { role: req.query.role } : {};
  const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json({ users: users.map(toSafeUser) });
});

module.exports = router;
