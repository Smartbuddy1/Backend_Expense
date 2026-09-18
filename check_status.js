const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStatus() {
  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(expenses.map(e => ({ id: e.id, status: e.status })));
}

checkStatus().catch(console.error).finally(() => prisma.$disconnect());
