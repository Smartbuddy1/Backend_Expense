const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const createProjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  site: z.string().optional(),
  location: z.string().optional(),
  organizationId: z.string().optional(),
  supervisorId: z.string().optional(),
  budget: z.number().nonnegative().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(['planned', 'active', 'on_hold', 'completed']).optional(),
});

// Admin + Operations manage projects; Accounts and Supervisors only read.
router.post('/', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const { startDate, endDate, ...rest } = parsed.data;

  const existing = await prisma.project.findUnique({ where: { code: rest.code } });
  if (existing) {
    return res.status(409).json({ error: 'A project with this code already exists' });
  }

  const project = await prisma.project.create({
    data: {
      ...rest,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    },
  });
  res.status(201).json({ project });
});

// A site supervisor only sees the projects assigned to them; everyone else sees all.
router.get('/', requireAuth, async (req, res) => {
  const where = req.user.role === 'site_supervisor' ? { supervisorId: req.user.id } : {};
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: { organization: true, supervisor: { select: { id: true, name: true, mobile: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.project.count({ where }),
  ]);

  res.json({ projects, total, page, pageSize });
});

router.get('/:id', requireAuth, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { organization: true, supervisor: { select: { id: true, name: true, mobile: true } } },
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'site_supervisor' && project.supervisorId !== req.user.id) {
    return res.status(403).json({ error: 'You do not have permission to view this project' });
  }
  res.json({ project });
});

router.patch('/:id', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const { startDate, endDate, ...rest } = parsed.data;

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    },
  });
  res.json({ project });
});

// Wallet balance = disbursed advances minus approved/paid expenses, for this project's supervisor.
router.get('/:id/wallet', requireAuth, async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'site_supervisor' && project.supervisorId !== req.user.id) {
    return res.status(403).json({ error: 'You do not have permission to view this project\'s wallet' });
  }

  const [advanceTotal, expenseTotal] = await Promise.all([
    prisma.advance.aggregate({
      where: { projectId: project.id, status: 'disbursed' },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { projectId: project.id, status: { in: ['ops_approved', 'accounts_paid'] } },
      _sum: { amount: true },
    }),
  ]);

  const totalAdvance = Number(advanceTotal._sum.amount || 0);
  const totalSpent = Number(expenseTotal._sum.amount || 0);

  res.json({ totalAdvance, totalSpent, balance: totalAdvance - totalSpent });
});

// Refuses to delete a project that already has real financial history —
// expenses/advances/payments must never silently disappear.
router.delete('/:id', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const [expenseCount, advanceCount] = await Promise.all([
    prisma.expense.count({ where: { projectId: req.params.id } }),
    prisma.advance.count({ where: { projectId: req.params.id } }),
  ]);
  if (expenseCount > 0 || advanceCount > 0) {
    return res.status(409).json({ error: 'This project has expenses or advances recorded against it and cannot be deleted. Mark it as completed or on hold instead.' });
  }
  await prisma.projectTeamAssignment.deleteMany({ where: { projectId: req.params.id } });
  await prisma.projectMilestone.deleteMany({ where: { projectId: req.params.id } });
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// --- Team assignment ---
router.post('/:id/team', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const { teamMemberId } = req.body || {};
  if (!teamMemberId) return res.status(400).json({ error: 'teamMemberId is required' });
  const assignment = await prisma.projectTeamAssignment.upsert({
    where: { projectId_teamMemberId: { projectId: req.params.id, teamMemberId } },
    update: {},
    create: { projectId: req.params.id, teamMemberId },
  });
  res.status(201).json({ assignment });
});

router.delete('/:id/team/:teamMemberId', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  await prisma.projectTeamAssignment.delete({
    where: { projectId_teamMemberId: { projectId: req.params.id, teamMemberId: req.params.teamMemberId } },
  }).catch(() => {});
  res.status(204).end();
});

// --- Milestones ---
router.post('/:id/milestones', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const { title, targetDate } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const milestone = await prisma.projectMilestone.create({
    data: { projectId: req.params.id, title, targetDate: targetDate ? new Date(targetDate) : undefined },
  });
  res.status(201).json({ milestone });
});

router.patch('/:id/milestones/:milestoneId', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const { status } = req.body || {};
  const milestone = await prisma.projectMilestone.update({
    where: { id: req.params.milestoneId },
    data: { status },
  });
  res.json({ milestone });
});

// --- Fund release (Budget Management) ---
router.patch('/:id/release-fund', requireAuth, requireRole('admin', 'accountant'), async (req, res) => {
  const body = req.body || {};
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'A positive amount is required' });

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const updated = await prisma.project.update({
    where: { id: req.params.id },
    data: { fundsReleased: { increment: amount } },
  });

  await prisma.paymentLedgerEntry.create({
    data: {
      type: 'Project Fund Release',
      projectId: project.id,
      paidTo: `${project.name} Site Account`,
      amount,
      paymentMode: body.paymentMode || null,
      refNumber: body.refNumber || null,
      category: 'Project Fund Allocation',
      notes: body.notes || null,
      companyBankAccountId: body.companyBankAccountId || null,
    },
  });

  res.json({ project: updated });
});

module.exports = router;
