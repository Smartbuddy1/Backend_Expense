const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const exps = await prisma.expense.findMany({ where: { status: 'ops_approved' }});
  console.log('Ops Approved Expenses:', exps.length);
  if (exps.length > 0) {
    const expense = exps[0];
    console.log('Trying to record payment for expense:', expense.id);
    try {
      const data = {
        type: 'Expense Reimbursement',
        projectId: expense.projectId,
        paidTo: expense.vendorName || 'Site Vendor',
        amount: Number(expense.amount),
        paymentMode: null,
        refNumber: null,
        category: 'Expense Reimbursement',
        notes: 'Verified claim ' + expense.id,
      };
      await prisma.paymentLedgerEntry.create({ data });
      console.log('Payment ledger entry created successfully');
    } catch (err) {
      console.error('Error creating payment ledger entry:', err.message);
    }
  }
}

test().finally(() => prisma.$disconnect());
