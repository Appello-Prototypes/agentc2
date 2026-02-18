-- CreateTable
CREATE TABLE "change_log" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entitySlug" TEXT,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "summary" TEXT,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "change_log_entityType_entityId_idx" ON "change_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "change_log_entityId_version_idx" ON "change_log"("entityId", "version");

-- CreateIndex
CREATE INDEX "change_log_createdAt_idx" ON "change_log"("createdAt");
