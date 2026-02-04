-- CreateTable
CREATE TABLE `bim_model` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sourceSystem` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `workspaceId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bim_model_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bim_model_version` (
    `id` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `version` INT NOT NULL DEFAULT 1,
    `status` ENUM('QUEUED', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `sourceFormat` VARCHAR(191) NOT NULL,
    `sourceUri` TEXT NULL,
    `sourceKey` TEXT NULL,
    `checksum` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bim_model_version_modelId_version_key`(`modelId`, `version`),
    INDEX `bim_model_version_modelId_idx`(`modelId`),
    INDEX `bim_model_version_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bim_element` (
    `id` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `elementGuid` VARCHAR(191) NOT NULL,
    `name` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `family` VARCHAR(191) NULL,
    `system` VARCHAR(191) NULL,
    `level` VARCHAR(191) NULL,
    `phase` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `properties` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bim_element_versionId_elementGuid_key`(`versionId`, `elementGuid`),
    INDEX `bim_element_versionId_idx`(`versionId`),
    INDEX `bim_element_category_idx`(`category`),
    INDEX `bim_element_system_idx`(`system`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bim_geometry_summary` (
    `id` VARCHAR(191) NOT NULL,
    `elementId` VARCHAR(191) NOT NULL,
    `bboxMin` JSON NULL,
    `bboxMax` JSON NULL,
    `centroid` JSON NULL,
    `length` DOUBLE NULL,
    `area` DOUBLE NULL,
    `volume` DOUBLE NULL,
    `units` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bim_geometry_summary_elementId_key`(`elementId`),
    INDEX `bim_geometry_summary_elementId_idx`(`elementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bim_element_property` (
    `id` VARCHAR(191) NOT NULL,
    `elementId` VARCHAR(191) NOT NULL,
    `group` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `valueString` TEXT NULL,
    `valueNumber` DOUBLE NULL,
    `valueBoolean` BOOLEAN NULL,
    `unit` VARCHAR(191) NULL,
    `rawValue` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bim_element_property_elementId_idx`(`elementId`),
    INDEX `bim_element_property_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bim_takeoff` (
    `id` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NULL,
    `query` JSON NULL,
    `result` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bim_takeoff_versionId_idx`(`versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bim_clash` (
    `id` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `query` JSON NULL,
    `result` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bim_clash_versionId_idx`(`versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bim_diff_summary` (
    `id` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NULL,
    `fromVersionId` VARCHAR(191) NOT NULL,
    `toVersionId` VARCHAR(191) NOT NULL,
    `summary` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bim_diff_summary_fromVersionId_idx`(`fromVersionId`),
    INDEX `bim_diff_summary_toVersionId_idx`(`toVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bim_model` ADD CONSTRAINT `bim_model_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_model_version` ADD CONSTRAINT `bim_model_version_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `bim_model`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_element` ADD CONSTRAINT `bim_element_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `bim_model_version`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_geometry_summary` ADD CONSTRAINT `bim_geometry_summary_elementId_fkey` FOREIGN KEY (`elementId`) REFERENCES `bim_element`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_element_property` ADD CONSTRAINT `bim_element_property_elementId_fkey` FOREIGN KEY (`elementId`) REFERENCES `bim_element`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_takeoff` ADD CONSTRAINT `bim_takeoff_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `bim_model`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_takeoff` ADD CONSTRAINT `bim_takeoff_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `bim_model_version`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_clash` ADD CONSTRAINT `bim_clash_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `bim_model`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_clash` ADD CONSTRAINT `bim_clash_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `bim_model_version`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_diff_summary` ADD CONSTRAINT `bim_diff_summary_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `bim_model`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_diff_summary` ADD CONSTRAINT `bim_diff_summary_fromVersionId_fkey` FOREIGN KEY (`fromVersionId`) REFERENCES `bim_model_version`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bim_diff_summary` ADD CONSTRAINT `bim_diff_summary_toVersionId_fkey` FOREIGN KEY (`toVersionId`) REFERENCES `bim_model_version`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
