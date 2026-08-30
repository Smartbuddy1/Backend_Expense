const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const requestSchema = z.object({
  projectId: z.string().min(1),
  amount: z.coerce.number().positive(),
  purpose: z.string().optional(),
});

router.post('/', requireAuth, requireRole('site_supervisor'), async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const advance = await prisma.advance.create({
    data: { ...parsed.data, requestedById: req.user.id },
  });
  res.status(201).json({ advance });
});

const transferSchema = z.object({
  projectId: z.string().min(1),
  supervisorId: z.string().min(1),
  amount: z.coerce.number().positive(),
  purpose: z.string().optional(),
});

// Admin/Operations directly hand a supervisor cash on the spot (skips the
// request step since whoever is making the call is already authorizing it) —
// created straight into "approved", still needs Accounts to actually disburse it.
router.post('/transfer', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const advance = await prisma.advance.create({
    data: {
      ...parsed.data,
      requestedById: parsed.data.supervisorId,
      status: 'approved',
      approvedById: req.user.id,
      approvedAt: new Date(),
    },
  });
  res.status(201).json({ advance });
});

router.get('/', requireAuth, async (req, res) => {
  const where = {
    ...(req.user.role === 'site_supervisor' ? { requestedById: req.user.id } : {}),
    ...(req.query.projectId ? { projectId: req.query.projectId } : {}),
    ...(req.query.status ? { status: req.query.status } : {}),
  };
  const advances = await prisma.advance.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, code: true } },
      requestedBy: { select: { id: true, name: true, mobile: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ advances });
});

router.patch('/:id/approve', requireAuth, requireRole('operations', 'admin'), async (req, res) => {
  const advance = await prisma.advance.findUnique({ where: { id: req.params.id } });
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  if (advance.status !== 'requested') {
    return res.status(409).json({ error: `Cannot approve an advance with status "${advance.status}"` });
  }
  const updated = await prisma.advance.update({
    where: { id: req.params.id },
    data: { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
  });
  res.json({ advance: updated });
});

router.patch('/:id/reject', requireAuth, requireRole('operations', 'admin'), async (req, res) => {
  const advance = await prisma.advance.findUnique({ where: { id: req.params.id } });
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  if (advance.status !== 'requested') {
    return res.status(409).json({ error: `Cannot reject an advance with status "${advance.status}"` });
  }
  const updated = await prisma.advance.update({
    where: { id: req.params.id },
    data: { status: 'rejected', approvedById: req.user.id, approvedAt: new Date() },
  });
  res.json({ advance: updated });
});

router.patch('/:id/disburse', requireAuth, requireRole('accountant', 'admin'), async (req, res) => {
  const advance = await prisma.advance.findUnique({ where: { id: req.params.id } });
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  if (advance.status !== 'approved') {
    return res.status(409).json({ error: 'Only an Operations-approved advance can be disbursed' });
  }
  const updated = await prisma.advance.update({
    where: { id: req.params.id },
    data: { status: 'disbursed' },
  });
  res.json({ advance: updated });
});

module.exports = router;
