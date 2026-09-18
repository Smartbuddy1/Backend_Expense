const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Schema for the public form submission (matches the shape sent by PublicExpenseForm.jsx)
const publicFormSchema = z.object({
  id: z.string().optional(), // In case the frontend generated one, though we'll use our own UUID for DB PK
  submitterName: z.string(),
  role: z.string().optional(),
  category: z.string(),
  site: z.string(),
  amount: z.coerce.number().positive(),
  paidTo: z.string(),
  paymentMode: z.string().optional(),
  description: z.string().optional(),
  receiptName: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  receipt: z.boolean().optional(),
  gpsLocation: z.string().optional().nullable(),
  gpsAddress: z.string().optional().nullable(),
  submittedVia: z.string().optional()
});

// POST /api/public-forms - Submit a new public expense (NO AUTH REQUIRED)
router.post('/', async (req, res) => {
  try {
    const parsed = publicFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const data = parsed.data;

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
        receiptUrl: data.receiptUrl || null,
        receipt: data.receipt || false,
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
