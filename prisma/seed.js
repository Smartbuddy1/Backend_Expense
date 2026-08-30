// Creates one test Admin user so login can be tried before a real
// admin-only "create user" endpoint exists. Run with: node prisma/seed.js
const bcrypt = require('bcrypt');
const prisma = require('../src/db');

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { mobile: '9999999999' },
    update: {},
    create: {
      name: 'Test Admin',
      mobile: '9999999999',
      passwordHash,
      role: 'admin',
    },
  });

  console.log('Seeded admin user:', { mobile: admin.mobile, role: admin.role });
  console.log('Login with mobile "9999999999" and password "admin123" (change/remove this before real use).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
