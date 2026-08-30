-- CreateTable
CREATE TABLE `organizations` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contact_person` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `site` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `organization_id` CHAR(36) NULL,
    `supervisor_id` CHAR(36) NULL,
    `budget` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('planned', 'active', 'on_hold', 'completed') NOT NULL DEFAULT 'planned',
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `projects_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_categories` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `expense_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `submitted_by` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NULL,
    `description` TEXT NOT NULL,
    `vendor_name` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `receipt_url` VARCHAR(191) NULL,
    `status` ENUM('submitted', 'ops_approved', 'ops_rejected', 'accounts_paid') NOT NULL DEFAULT 'submitted',
    `ops_approved_by` CHAR(36) NULL,
    `ops_approved_at` DATETIME(3) NULL,
    `ops_remarks` TEXT NULL,
    `paid_by` CHAR(36) NULL,
    `paid_at` DATETIME(3) NULL,
    `payment_ref` VARCHAR(191) NULL,
    `submitted_via` VARCHAR(191) NOT NULL DEFAULT 'app',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expenses_project_id_idx`(`project_id`),
    INDEX `expenses_submitted_by_idx`(`submitted_by`),
    INDEX `expenses_status_idx`(`status`),
    INDEX `expenses_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `advances` (
    `id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `requested_by` CHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `purpose` TEXT NULL,
    `status` ENUM('requested', 'approved', 'rejected', 'disbursed') NOT NULL DEFAULT 'requested',
    `approved_by` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `advances_project_id_idx`(`project_id`),
    INDEX `advances_requested_by_idx`(`requested_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_supervisor_id_fkey` FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_ops_approved_by_fkey` FOREIGN KEY (`ops_approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_paid_by_fkey` FOREIGN KEY (`paid_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advances` ADD CONSTRAINT `advances_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advances` ADD CONSTRAINT `advances_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advances` ADD CONSTRAINT `advances_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
