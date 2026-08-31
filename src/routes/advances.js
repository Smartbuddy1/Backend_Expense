const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordPaymentEntry } = require('./paymentsLedger');

const router = express.Router();

const requestSchema = z.object({
  projectId: z.string().min(1),
  amount: z.coerce.number().positive(),
  purpose: z.string().optional(),
});

// A site supervisor requests their own advance; Admin/Operations can also log a
// requisition on a supervisor's behalf (e.g. a phoned-in urgent cash need) — same
// as how expenses can be logged for a supervisor — recorded against that
// project's assigned supervisor, still landing in "requested" pending approval.
router.post('/', requireAuth, requireRole('site_supervisor', 'admin', 'operations'), async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const { projectId } = parsed.data;

  let requestedById = req.user.id;
  if (req.user.role === 'site_supervisor') {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.supervisorId !== req.user.id) {
      return res.status(403).json({ error: 'You are not the supervisor assigned to this project' });
    }
  } else {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.supervisorId) {
      return res.status(409).json({ error: 'This project has no supervisor assigned yet to log the requisition against' });
    }
    requestedById = project.supervisorId;
  }

  const advance = await prisma.advance.create({
    data: { ...parsed.data, requestedById },
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
      projectId: parsed.data.projectId,
      amount: parsed.data.amount,
      purpose: parsed.data.purpose,
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
  const body = req.body || {};
  const advance = await prisma.advance.findUnique({
    where: { id: req.params.id },
    include: { project: true, requestedBy: true },
  });
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  if (advance.status !== 'approved') {
    return res.status(409).json({ error: 'Only an Operations-approved advance can be disbursed' });
  }
  const updated = await prisma.advance.update({
    where: { id: req.params.id },
    data: { status: 'disbursed' },
  });

  await recordPaymentEntry({
    type: 'Site Advance Disbursal',
    projectId: advance.projectId,
    paidTo: body.paidTo || advance.requestedBy?.name || 'Site Supervisor',
    amount: Number(advance.amount),
    paymentMode: body.paymentMode || null,
    refNumber: body.refNumber || null,
    category: 'Site Advance',
    notes: body.notes || `Advance disbursal for ${advance.project?.name || 'project'}`,
    companyBankAccountId: body.companyBankAccountId || null,
  });

  res.json({ advance: updated });
});

module.exports = router;
