const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const schema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

router.post('/', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  const member = await prisma.teamMember.create({ data: parsed.data });
  res.status(201).json({ teamMember: member });
});

router.get('/', requireAuth, async (req, res) => {
  const members = await prisma.teamMember.findMany({
    include: { assignments: { include: { project: { select: { id: true, name: true, code: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ teamMembers: members });
});

router.patch('/:id', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  const member = await prisma.teamMember.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ teamMember: member });
});

router.delete('/:id', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  await prisma.projectTeamAssignment.deleteMany({ where: { teamMemberId: req.params.id } });
  await prisma.teamMember.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

module.exports = router;
