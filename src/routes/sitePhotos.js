const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'asems-photos';

// Middleware to ensure user is logged in
const authMiddleware = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: No user ID provided' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid user' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during auth' });
  }
};

// GET photos for a specific project
router.get('/:projectId/photos', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const photos = await prisma.sitePhoto.findMany({
      where: { projectId },
      include: {
        supervisor: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ photos });
  } catch (error) {
    console.error('Error fetching site photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST a new photo
router.post('/:projectId/photos', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { description } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Ensure user is a supervisor (or admin)
    if (req.user.role !== 'site_supervisor' && req.user.role !== 'admin' && req.user.role !== 'operations') {
      return res.status(403).json({ error: 'Forbidden: Only supervisors and admins can upload photos' });
    }

    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `site-photos/${projectId}/${uuidv4()}.${fileExtension}`;

    // Upload to S3
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const imageUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${fileName}`;

    // Create DB record
    const photo = await prisma.sitePhoto.create({
      data: {
        projectId,
        supervisorId: req.user.id,
        imageUrl,
        description
      },
      include: {
        supervisor: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json({ message: 'Photo uploaded successfully', photo });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

module.exports = router;
