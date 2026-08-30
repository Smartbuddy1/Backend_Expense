const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const orgSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

router.post('/', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const org = await prisma.organization.create({ data: parsed.data });
  res.status(201).json({ organization: org });
});

router.get('/', requireAuth, async (req, res) => {
  const organizations = await prisma.organization.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ organizations });
});

router.patch('/:id', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const parsed = orgSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  const org = await prisma.organization.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ organization: org });
});

// Refuses to delete an organization with projects against it, same reasoning as
// project deletion — a client record shouldn't vanish out from under real projects.
router.delete('/:id', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const projectCount = await prisma.project.count({ where: { organizationId: req.params.id } });
  if (projectCount > 0) {
    return res.status(409).json({ error: 'This organization has projects linked to it and cannot be deleted.' });
  }
  await prisma.organization.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

module.exports = router;
