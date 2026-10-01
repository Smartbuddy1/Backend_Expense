const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toSafeUser } = require('../utils/userHelpers');
const logger = require('../utils/logger');

const router = express.Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(10),
  password: z.string().min(6),
  role: z.enum(['admin', 'operations', 'accountant', 'site_supervisor']),
  email: z.string().email().optional(),
});

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

// Update a user
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  mobile: z.string().min(10).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

router.patch('/:id', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Validation failed for PATCH /users/:id. Body:', req.body);
    console.error('Zod errors:', parsed.error.issues);
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Operations restriction: can only edit site_supervisor
  if (req.user.role === 'operations' && user.role !== 'site_supervisor') {
    return res.status(403).json({ error: 'Operations can only edit Site Supervisor accounts' });
  }

  const { password, ...restData } = parsed.data;
  let updateData = { ...restData };

  if (password) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can update passwords' });
    }
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
  });

  res.json({ user: toSafeUser(updatedUser) });
});

// Delete a user
router.delete('/:id', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Operations restriction: can only delete site_supervisor
  if (req.user.role === 'operations' && user.role !== 'site_supervisor') {
    return res.status(403).json({ error: 'Operations can only delete Site Supervisor accounts' });
  }

  try {
    // Cascade-delete or nullify all related records to allow force deletion of user

    // 1. Delete records where user is the required author/owner
    await prisma.expense.deleteMany({ where: { submittedById: req.params.id } });
    await prisma.advance.deleteMany({ where: { requestedById: req.params.id } });
    await prisma.siteLog.deleteMany({ where: { supervisorId: req.params.id } });
    await prisma.sitePhoto.deleteMany({ where: { supervisorId: req.params.id } });
    await prisma.settlement.deleteMany({ where: { supervisorId: req.params.id } });

    // 2. Nullify references where user is an approver or assignee
    await prisma.expense.updateMany({
      where: { opsApprovedById: req.params.id },
      data: { opsApprovedById: null },
    });
    await prisma.expense.updateMany({
      where: { paidById: req.params.id },
      data: { paidById: null },
    });
    await prisma.advance.updateMany({
      where: { approvedById: req.params.id },
      data: { approvedById: null },
    });
    await prisma.project.updateMany({
      where: { supervisorId: req.params.id },
      data: { supervisorId: null },
    });

    // 3. Delete OperationalHead linking to this user (if any)
    await prisma.operationalHead.deleteMany({ where: { userId: req.params.id } });

    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    logger.error('Error deleting user: %O', err);
    res
      .status(500)
      .json({ error: 'Could not delete user. They might have other active dependencies.' });
  }
});

module.exports = router;
