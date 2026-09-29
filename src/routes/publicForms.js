const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadToS3 } = require('../utils/s3');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type. Only standard images and PDF receipts are allowed.'));
    }
    cb(null, true);
  },
});

// Schema for the public form submission
const publicFormSchema = z.object({
  id: z.string().optional(),
  submitterName: z.string(),
  role: z.string().optional(),
  category: z.string(),
  site: z.string(),
  amount: z.coerce.number().positive().finite(),
  paidTo: z.string(),
  paymentMode: z.string().optional(),
  description: z.string().optional(),
  receiptName: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  receipt: z.preprocess(v => v === 'true' || v === true, z.boolean().optional()),
  gpsLocation: z.string().optional().nullable(),
  gpsAddress: z.string().optional().nullable(),
  submittedVia: z.string().optional()
});

const formSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20, // 20 submissions per IP per hour
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: 'Too many form submissions from this IP. Please try again later.' },
});

// POST /api/public-forms - Submit a new public expense (NO AUTH REQUIRED)
router.post('/', formSubmitLimiter, upload.single('receiptFile'), async (req, res) => {
  try {
    const parsed = publicFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const data = parsed.data;
    let receiptUrl = data.receiptUrl || null;

    if (req.file) {
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      receiptUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'public-forms', baseUrl);
    }

    const submission = await prisma.publicFormSubmission.create({
      data: {
        submitterName: data.submitterName,
        role: data.role,
        category: data.category,
        site: data.site,
        amount: data.amount,
        paidTo: data.paidTo,
        paymentMode: data.paymentMode || null,
        description: data.description || null,
        receiptName: data.receiptName || null,
        receiptUrl: receiptUrl,
        receipt: data.receipt || (!!req.file),
        gpsLocation: data.gpsLocation || null,
        gpsAddress: data.gpsAddress || null,
        submittedVia: data.submittedVia || 'Public Expense Form',
      }
    });

    res.status(201).json({ submission });
  } catch (error) {
    console.error('Error creating public form submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public-forms - Fetch all submissions (AUTH REQUIRED - Admin/Accountant/Ops)
router.get('/', requireAuth, requireRole('admin', 'accountant', 'operations'), async (req, res) => {
  try {
    const submissions = await prisma.publicFormSubmission.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching public form submissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/public-forms/:id/approve - Approve a submission
router.patch('/:id/approve', requireAuth, requireRole('admin', 'accountant', 'operations'), async (req, res) => {
  try {
    const { id } = req.params;
    const submission = await prisma.publicFormSubmission.update({
      where: { id },
      data: { status: 'Approved' }
    });
    res.json({ submission });
  } catch (error) {
    console.error('Error approving public form submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/public-forms/:id - Delete a submission
router.delete('/:id', requireAuth, requireRole('admin', 'accountant', 'operations'), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.publicFormSubmission.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting public form submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
