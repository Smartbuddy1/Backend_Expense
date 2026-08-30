const express = require('express');
const multer = require('multer');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadToS3 } = require('../utils/s3');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const createExpenseSchema = z.object({
  projectId: z.string().min(1),
  categoryId: z.string().optional(),
  description: z.string().min(1),
  vendorName: z.string().optional(),
  amount: z.coerce.number().positive(),
});

// The core money-moving action: a site supervisor submits an expense with a bill
// photo. Admin/Operations can also log one on a supervisor's behalf (e.g. a
// phoned-in field expense) — it's then recorded against that project's assigned
// supervisor, not the admin/ops user themselves.
router.post('/', requireAuth, requireRole('site_supervisor', 'admin', 'operations'), upload.single('receipt'), async (req, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const { projectId, categoryId, description, vendorName, amount } = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  let submittedById = req.user.id;
  if (req.user.role === 'site_supervisor') {
    if (project.supervisorId !== req.user.id) {
      return res.status(403).json({ error: 'You are not the supervisor assigned to this project' });
    }
  } else {
    if (!project.supervisorId) {
      return res.status(409).json({ error: 'This project has no supervisor assigned yet to log the expense against' });
    }
    submittedById = project.supervisorId;
  }

  let receiptUrl = null;
  if (req.file) {
    receiptUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'expenses');
  }

  const expense = await prisma.expense.create({
    data: {
      projectId,
      submittedById,
      categoryId: categoryId || undefined,
      description,
      vendorName,
      amount,
      receiptUrl,
      submittedVia: req.user.role === 'site_supervisor' ? 'app' : 'logged_by_ops',
    },
  });
  res.status(201).json({ expense });
});

// Site supervisors see only their own; everyone else sees all, filterable.
router.get('/', requireAuth, async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);

  const where = {
    ...(req.user.role === 'site_supervisor' ? { submittedById: req.user.id } : {}),
    ...(req.query.projectId ? { projectId: req.query.projectId } : {}),
    ...(req.query.status ? { status: req.query.status } : {}),
  };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        submittedBy: { select: { id: true, name: true, mobile: true } },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({ expenses, total, page, pageSize });
});

router.patch('/:id/approve', requireAuth, requireRole('operations', 'admin'), async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  if (expense.status !== 'submitted') {
    return res.status(409).json({ error: `Cannot approve an expense with status "${expense.status}"` });
  }

  const updated = await prisma.expense.update({
    where: { id: req.params.id },
    data: { status: 'ops_approved', opsApprovedById: req.user.id, opsApprovedAt: new Date() },
  });
  res.json({ expense: updated });
});

// Operations rejects a freshly submitted claim; Accounts sends an already
// ops-approved one back for correction (e.g. a GST/bill mismatch found at
// verification) — both land in the same ops_rejected state.
router.patch('/:id/reject', requireAuth, requireRole('operations', 'admin', 'accountant'), async (req, res) => {
  const { remarks } = req.body || {};
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  const allowedFrom = req.user.role === 'accountant' ? ['ops_approved'] : ['submitted'];
  if (!allowedFrom.includes(expense.status)) {
    return res.status(409).json({ error: `Cannot reject an expense with status "${expense.status}"` });
  }

  const updated = await prisma.expense.update({
    where: { id: req.params.id },
    data: {
      status: 'ops_rejected',
      opsApprovedById: req.user.id,
      opsApprovedAt: new Date(),
      opsRemarks: remarks || null,
    },
  });
  res.json({ expense: updated });
});

router.patch('/:id/pay', requireAuth, requireRole('accountant', 'admin'), async (req, res) => {
  const { paymentRef } = req.body || {};
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  if (expense.status !== 'ops_approved') {
    return res.status(409).json({ error: 'Only an Operations-approved expense can be marked paid' });
  }

  const updated = await prisma.expense.update({
    where: { id: req.params.id },
    data: { status: 'accounts_paid', paidById: req.user.id, paidAt: new Date(), paymentRef: paymentRef || null },
  });
  res.json({ expense: updated });
});

module.exports = router;
