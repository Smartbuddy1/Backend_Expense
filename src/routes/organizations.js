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

module.exports = router;
