const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordPaymentEntry } = require('./paymentsLedger');

const router = express.Router();

const createSchema = z.object({
  projectId: z.string().min(1),
  supervisorId: z.string().min(1),
  totalAdvanceGiven: z.coerce.number(),
  totalApprovedExpenses: z.coerce.number(),
  supervisorRemark: z.string().optional(),
});

// Accounts initiates a settlement once a project wraps up — the running
// advance-vs-spend numbers can be pulled from GET /projects/:id/wallet first.
router.post('/', requireAuth, requireRole('admin', 'accountant'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  const { projectId, supervisorId, totalAdvanceGiven, totalApprovedExpenses, supervisorRemark } = parsed.data;
  const difference = totalAdvanceGiven - totalApprovedExpenses;

  const settlement = await prisma.settlement.create({
    data: {
      projectId,
      supervisorId,
      totalAdvanceGiven,
      totalApprovedExpenses,
      difference: Math.abs(difference),
      settlementType: difference > 0 ? 'refund_due' : 'additional_payable',
      supervisorRemark,
    },
  });
  res.status(201).json({ settlement });
});

router.get('/', requireAuth, requireRole('admin', 'operations', 'accountant'), async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : {};
  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, code: true } },
      supervisor: { select: { id: true, name: true, mobile: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ settlements });
});

// Closes the settlement out and logs the resulting payment/refund in the ledger.
router.patch('/:id/settle', requireAuth, requireRole('admin', 'accountant'), async (req, res) => {
  const { paymentMode, refNumber, accountsRemark } = req.body || {};
  const settlement = await prisma.settlement.findUnique({
    where: { id: req.params.id },
    include: { project: true, supervisor: true },
  });
  if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
  if (settlement.status === 'settled') return res.status(409).json({ error: 'Already settled' });

  const updated = await prisma.settlement.update({
    where: { id: req.params.id },
    data: { status: 'settled', completedDate: new Date(), accountsRemark: accountsRemark || null },
  });

  await recordPaymentEntry({
    type: settlement.settlementType === 'refund_due' ? 'Settlement Refund Received' : 'Settlement Payment',
    projectId: settlement.projectId,
    paidTo: settlement.settlementType === 'refund_due' ? 'Company Account' : settlement.supervisor.name,
    amount: settlement.difference,
    paymentMode: paymentMode || null,
    refNumber: refNumber || null,
    category: 'Project Settlement',
    notes: accountsRemark || null,
  });

  res.json({ settlement: updated });
});

module.exports = router;
