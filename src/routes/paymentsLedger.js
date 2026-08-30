const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const schema = z.object({
  type: z.string().min(1),
  projectId: z.string().optional(),
  paidTo: z.string().optional(),
  amount: z.coerce.number().positive(),
  paymentMode: z.string().optional(),
  refNumber: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  companyBankAccountId: z.string().optional(),
});

// Used both for manual entries and by other routes (fund release, settlements) recording a payment.
async function recordPaymentEntry(data) {
  return prisma.paymentLedgerEntry.create({ data });
}

router.post('/', requireAuth, requireRole('admin', 'accountant'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  const entry = await recordPaymentEntry(parsed.data);
  res.status(201).json({ entry });
});

router.get('/', requireAuth, requireRole('admin', 'operations', 'accountant'), async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  const entries = await prisma.paymentLedgerEntry.findMany({
    where,
    include: { project: { select: { id: true, name: true, code: true } }, companyBankAccount: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ entries });
});

router.get('/bank-accounts', requireAuth, requireRole('admin', 'operations', 'accountant'), async (req, res) => {
  const accounts = await prisma.companyBankAccount.findMany();
  res.json({ accounts });
});

module.exports = router;
module.exports.recordPaymentEntry = recordPaymentEntry;
