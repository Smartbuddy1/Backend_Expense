const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const schema = z.object({
  name: z.string().min(1),
  department: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  location: z.string().optional(),
  experience: z.string().optional(),
  employeeId: z.string().optional(),
  specialization: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  totalBudgetAuthorisation: z.coerce.number().optional(),
  userId: z.string().optional(),
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  const head = await prisma.operationalHead.create({ data: parsed.data });
  res.status(201).json({ operationalHead: head });
});

router.get('/', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const heads = await prisma.operationalHead.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ operationalHeads: heads });
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  const head = await prisma.operationalHead.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json({ operationalHead: head });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const head = await prisma.operationalHead.findUnique({ where: { id: req.params.id } });
  if (!head) {
    return res.status(404).json({ error: 'Operational Head not found' });
  }

  // Find linked user login
  let targetUserId = head.userId;
  if (!targetUserId && head.phone) {
    const cleanPhone = head.phone.replace(/\D/g, '').slice(-10);
    const matchedUser = await prisma.user.findFirst({
      where: { mobile: cleanPhone, role: 'operations' },
    });
    if (matchedUser) {
      targetUserId = matchedUser.id;
    }
  }

  // Delete the OperationalHead record
  await prisma.operationalHead.delete({ where: { id: req.params.id } });

  // Delete the linked User login account so they cannot log in
  if (targetUserId) {
    try {
      await prisma.expense.updateMany({
        where: { opsApprovedById: targetUserId },
        data: { opsApprovedById: null },
      });
      await prisma.advance.updateMany({
        where: { approvedById: targetUserId },
        data: { approvedById: null },
      });
      await prisma.user.delete({ where: { id: targetUserId } });
    } catch (e) {
      console.error('Could not delete associated user for operational head:', e);
    }
  }

  res.status(204).end();
});

module.exports = router;
