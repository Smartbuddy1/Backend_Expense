# ASEMS — Backend

The backend API for ASEMS (Aarya Site Expense Management System). Node.js + Express + Prisma + MySQL.

**This repo is the backend only.** The frontend lives in a separate repo: [Frontend_Expense](https://github.com/Smartbuddy1/Frontend_Expense) — that repo's [`docs/`](https://github.com/Smartbuddy1/Frontend_Expense/tree/main/docs) folder is the shared documentation for both repos. Start with:

- [docs/09-local-setup.md](https://github.com/Smartbuddy1/Frontend_Expense/blob/main/docs/09-local-setup.md) — full local setup (XAMPP, both repos, env files, seed data)
- [docs/04-backend-plan.md](https://github.com/Smartbuddy1/Frontend_Expense/blob/main/docs/04-backend-plan.md) — what's built, what's next, phase by phase
- [docs/05-database-schema.md](https://github.com/Smartbuddy1/Frontend_Expense/blob/main/docs/05-database-schema.md) — the database design
- [docs/06-security.md](https://github.com/Smartbuddy1/Frontend_Expense/blob/main/docs/06-security.md) — auth, RBAC, secrets

## Quick start

```
npm install
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET, see docs/09-local-setup.md
npx prisma migrate dev
node prisma/seed.js       # creates one test login per role, password "test1234"
npm run dev                # http://localhost:5000 — check /health
```

## Structure

```
src/
  index.js         Express app entry point
  db.js             shared Prisma client
  middleware/       auth.js — requireAuth / requireRole
  routes/           auth.js, users.js
prisma/
  schema.prisma     database models
  migrations/
  seed.js           creates one test user per role
```

## Contributing

Branching, commit conventions, and the PR process are shared with the frontend repo — see [docs/02-git-workflow.md](https://github.com/Smartbuddy1/Frontend_Expense/blob/main/docs/02-git-workflow.md). Short version: branch off `develop` as `feature/backend-<task>`, open your PR into `develop`, get one review, squash-merge.
