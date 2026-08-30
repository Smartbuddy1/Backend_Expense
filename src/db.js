const { PrismaClient } = require('@prisma/client');

// One shared Prisma client for the whole app — don't create a new one per request.
const prisma = new PrismaClient();

module.exports = prisma;
