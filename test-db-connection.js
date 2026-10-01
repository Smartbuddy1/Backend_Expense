const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user
  .findMany()
  .then((users) =>
    console.log(users.map((u) => ({ mobile: u.mobile, pwh: u.passwordHash, role: u.role })))
  )
  .catch(console.error)
  .finally(() => prisma.$disconnect());
