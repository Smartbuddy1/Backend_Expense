// Creates one test user per role so every dashboard can be logged into
// before the real "admin creates a user" flow is used for anything but
// testing. Run with: node prisma/seed.js
const bcrypt = require('bcrypt');
const prisma = require('../src/db');

const TEST_USERS = [
  { name: 'Test Admin', mobile: '9999999999', role: 'admin' },
  { name: 'Test Operations', mobile: '9999999998', role: 'operations' },
  { name: 'Test Accountant', mobile: '9999999997', role: 'accountant' },
  { name: 'Test Supervisor', mobile: '9999999996', role: 'site_supervisor' },
];
const TEST_PASSWORD = 'test1234';

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const u of TEST_USERS) {
    await prisma.user.upsert({
      where: { mobile: u.mobile },
      update: { passwordHash },
      create: { ...u, passwordHash },
    });
  }

  console.log('Seeded test users (all use password "test1234"):');
  TEST_USERS.forEach((u) => console.log(`  ${u.role.padEnd(16)} mobile: ${u.mobile}`));
  console.log('Change or remove these before real use.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
