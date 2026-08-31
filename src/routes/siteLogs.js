const express = require('express');
const { z } = require('zod');

const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const schema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  workSummary: z.string().optional(),
  laborCount: z.coerce.number().optional(),
  issues: z.string().optional(),
});

// A site supervisor logs their own day; Admin/Operations can also log a site
// update on a supervisor's behalf (e.g. during a progress review call) — same
// as expenses/advances, recorded against that project's assigned supervisor.
router.post('/', requireAuth, requireRole('site_supervisor', 'admin', 'operations'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });

  let supervisorId = req.user.id;
  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'site_supervisor') {
    if (project.supervisorId !== req.user.id) {
      return res.status(403).json({ error: 'You are not the supervisor assigned to this project' });
    }
  } else {
    if (!project.supervisorId) {
      return res.status(409).json({ error: 'This project has no supervisor assigned yet to log against' });
    }
    supervisorId = project.supervisorId;
  }

  const log = await prisma.siteLog.create({
    data: { ...parsed.data, supervisorId },
  });
  res.status(201).json({ siteLog: log });
});

router.get('/', requireAuth, async (req, res) => {
  const where = {
    ...(req.user.role === 'site_supervisor' ? { supervisorId: req.user.id } : {}),
    ...(req.query.projectId ? { projectId: req.query.projectId } : {}),
  };
  const logs = await prisma.siteLog.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, code: true } },
      supervisor: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });
  res.json({ siteLogs: logs });
});

router.patch('/:id/verify', requireAuth, requireRole('admin', 'operations'), async (req, res) => {
  const log = await prisma.siteLog.update({ where: { id: req.params.id }, data: { verified: true, status: 'verified' } });
  res.json({ siteLog: log });
});

module.exports = router;
