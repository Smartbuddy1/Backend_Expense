-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'operations', 'accountant', 'site_supervisor');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('planned', 'active', 'on_hold', 'completed');

-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('on_track', 'at_risk', 'delayed');

-- CreateEnum
CREATE TYPE "SettlementType" AS ENUM ('refund_due', 'additional_payable');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'settled');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('submitted', 'ops_approved', 'ops_rejected', 'accounts_paid');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('requested', 'approved', 'rejected', 'disbursed');

-- CreateTable
CREATE TABLE "users" (
    "id" CHAR(36) NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_heads" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36),
    "name" TEXT NOT NULL,
    "department" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT,
    "experience" TEXT,
    "employee_id" TEXT,
    "specialization" TEXT,
    "responsibilities" JSONB,
    "joined_date" TIMESTAMP(3),
    "total_budget_authorisation" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_heads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" CHAR(36) NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "skills" JSONB,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" CHAR(36) NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" CHAR(36) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "site" TEXT,
    "location" TEXT,
    "category" TEXT,
    "toilets_count" INTEGER,
    "organization_id" CHAR(36),
    "supervisor_id" CHAR(36),
    "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "funds_released" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "ProjectStatus" NOT NULL DEFAULT 'planned',
    "health" "ProjectHealth" NOT NULL DEFAULT 'on_track',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" CHAR(36) NOT NULL,
    "project_id" CHAR(36) NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "target_date" TIMESTAMP(3),

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_team_assignments" (
    "project_id" CHAR(36) NOT NULL,
    "team_member_id" CHAR(36) NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_team_assignments_pkey" PRIMARY KEY ("project_id","team_member_id")
);

-- CreateTable
CREATE TABLE "site_logs" (
    "id" CHAR(36) NOT NULL,
    "project_id" CHAR(36) NOT NULL,
    "supervisor_id" CHAR(36) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "work_summary" TEXT,
    "labor_count" INTEGER,
    "issues" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_bank_accounts" (
    "id" CHAR(36) NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL DEFAULT 'bank',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "company_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments_ledger" (
    "id" CHAR(36) NOT NULL,
    "type" TEXT NOT NULL,
    "project_id" CHAR(36),
    "paid_to" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_mode" TEXT,
    "ref_number" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "company_bank_account_id" CHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" CHAR(36) NOT NULL,
    "project_id" CHAR(36) NOT NULL,
    "supervisor_id" CHAR(36) NOT NULL,
    "completed_date" TIMESTAMP(3),
    "total_advance_given" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_approved_expenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "settlement_type" "SettlementType" NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'pending',
    "supervisor_remark" TEXT,
    "accounts_remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" CHAR(36) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" CHAR(36) NOT NULL,
    "project_id" CHAR(36) NOT NULL,
    "submitted_by" CHAR(36) NOT NULL,
    "category_id" CHAR(36),
    "description" TEXT NOT NULL,
    "vendor_name" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "receipt_url" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'submitted',
    "ops_approved_by" CHAR(36),
    "ops_approved_at" TIMESTAMP(3),
    "ops_remarks" TEXT,
    "paid_by" CHAR(36),
    "paid_at" TIMESTAMP(3),
    "payment_ref" TEXT,
    "submitted_via" TEXT NOT NULL DEFAULT 'app',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advances" (
    "id" CHAR(36) NOT NULL,
    "project_id" CHAR(36) NOT NULL,
    "requested_by" CHAR(36) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "purpose" TEXT,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'requested',
    "approved_by" CHAR(36),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_photos" (
    "id" CHAR(36) NOT NULL,
    "project_id" CHAR(36) NOT NULL,
    "supervisor_id" CHAR(36) NOT NULL,
    "image_url" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "operational_heads_user_id_key" ON "operational_heads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_idx" ON "project_milestones"("project_id");

-- CreateIndex
CREATE INDEX "site_logs_project_id_idx" ON "site_logs"("project_id");

-- CreateIndex
CREATE INDEX "payments_ledger_project_id_idx" ON "payments_ledger"("project_id");

-- CreateIndex
CREATE INDEX "settlements_project_id_idx" ON "settlements"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "expenses_project_id_idx" ON "expenses"("project_id");

-- CreateIndex
CREATE INDEX "expenses_submitted_by_idx" ON "expenses"("submitted_by");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_created_at_idx" ON "expenses"("created_at");

-- CreateIndex
CREATE INDEX "advances_project_id_idx" ON "advances"("project_id");

-- CreateIndex
CREATE INDEX "advances_requested_by_idx" ON "advances"("requested_by");

-- CreateIndex
CREATE INDEX "site_photos_project_id_idx" ON "site_photos"("project_id");

-- AddForeignKey
ALTER TABLE "operational_heads" ADD CONSTRAINT "operational_heads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_team_assignments" ADD CONSTRAINT "project_team_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_team_assignments" ADD CONSTRAINT "project_team_assignments_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_logs" ADD CONSTRAINT "site_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_logs" ADD CONSTRAINT "site_logs_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments_ledger" ADD CONSTRAINT "payments_ledger_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments_ledger" ADD CONSTRAINT "payments_ledger_company_bank_account_id_fkey" FOREIGN KEY ("company_bank_account_id") REFERENCES "company_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_ops_approved_by_fkey" FOREIGN KEY ("ops_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
