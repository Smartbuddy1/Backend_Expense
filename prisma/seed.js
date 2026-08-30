// Creates one test user per role, the expense category taxonomy, and a
// sample project (assigned to the test supervisor) so the full
// submit -> approve -> pay flow can be tried end to end.
// Run with: node prisma/seed.js
const bcrypt = require('bcrypt');
const prisma = require('../src/db');

const TEST_USERS = [
  { name: 'Test Admin', mobile: '9999999999', role: 'admin' },
  { name: 'Test Operations', mobile: '9999999998', role: 'operations' },
  { name: 'Test Accountant', mobile: '9999999997', role: 'accountant' },
  { name: 'Test Supervisor', mobile: '9999999996', role: 'site_supervisor' },
];
const TEST_PASSWORD = 'test1234';

const EXPENSE_CATEGORIES = [
  'Purchase/Materials',
  'Labour & Contractors',
  'Transport & Logistics',
  'Lodging & Hotel',
  'Travel & Conveyance',
  'Daily Allowance & Food',
  'Miscellaneous & Emergency',
];

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const users = {};
  for (const u of TEST_USERS) {
    users[u.role] = await prisma.user.upsert({
      where: { mobile: u.mobile },
      update: { passwordHash },
      create: { ...u, passwordHash },
    });
  }

  for (const name of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Sample Municipal Corporation',
      contactPerson: 'Test Contact',
      phone: '9000000000',
    },
  });

  const project = await prisma.project.upsert({
    where: { code: 'DEMO-P1' },
    update: {},
    create: {
      code: 'DEMO-P1',
      name: 'Demo Site Installation',
      site: 'Demo Site',
      organizationId: org.id,
      supervisorId: users.site_supervisor.id,
      budget: 100000,
      status: 'active',
    },
  });

  console.log('Seeded test users (all use password "test1234"):');
  TEST_USERS.forEach((u) => console.log(`  ${u.role.padEnd(16)} mobile: ${u.mobile}`));
  console.log(`Seeded ${EXPENSE_CATEGORIES.length} expense categories.`);
  console.log(`Seeded sample project "${project.name}" (${project.code}), assigned to Test Supervisor.`);
  console.log('Change or remove these before real use.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
