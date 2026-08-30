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
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  const head = await prisma.operationalHead.create({ data: parsed.data });
  res.status(201).json({ operationalHead: head });
});

router.get('/', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const heads = await prisma.operationalHead.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ operationalHeads: heads });
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  const head = await prisma.operationalHead.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ operationalHead: head });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await prisma.operationalHead.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

module.exports = router;
