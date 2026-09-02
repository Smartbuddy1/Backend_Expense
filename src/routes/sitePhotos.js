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
    const allowed = ['image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const photoSchema = z.object({
  description: z.string().optional(),
});

// GET photos for a specific project
router.get('/:projectId/photos', requireAuth, async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role === 'site_supervisor' && project.supervisorId !== req.user.id) {
    return res.status(403).json({ error: 'You do not have permission to view this project\'s photos' });
  }

  const photos = await prisma.sitePhoto.findMany({
    where: { projectId: req.params.projectId },
    include: { supervisor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ photos });
});

// A site supervisor uploads a photo for their own project; Admin/Operations
// can also log one on a supervisor's behalf, same pattern as expenses/advances.
router.post('/:projectId/photos', requireAuth, requireRole('site_supervisor', 'admin', 'operations'), upload.single('photo'), async (req, res) => {
  const parsed = photoSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No photo file provided' });
  }

  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  let supervisorId = req.user.id;
  if (req.user.role === 'site_supervisor') {
    if (project.supervisorId !== req.user.id) {
      return res.status(403).json({ error: 'You are not the supervisor assigned to this project' });
    }
  } else {
    if (!project.supervisorId) {
      return res.status(409).json({ error: 'This project has no supervisor assigned yet to log the photo against' });
    }
    supervisorId = project.supervisorId;
  }

  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const imageUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'site-photos', baseUrl);

  const photo = await prisma.sitePhoto.create({
    data: {
      projectId: req.params.projectId,
      supervisorId,
      imageUrl,
      description: parsed.data.description,
    },
    include: { supervisor: { select: { id: true, name: true } } },
  });

  res.status(201).json({ photo });
});

module.exports = router;
