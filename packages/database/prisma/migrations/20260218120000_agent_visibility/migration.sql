-- CreateEnum
CREATE TYPE "AgentVisibility" AS ENUM ('PRIVATE', 'ORGANIZATION', 'PUBLIC');

-- AlterTable: add visibility column with default
ALTER TABLE "agent" ADD COLUMN "visibility" "AgentVisibility" NOT NULL DEFAULT 'PRIVATE';

-- Backfill: migrate isPublic=true rows to PUBLIC
UPDATE "agent" SET "visibility" = 'PUBLIC' WHERE "isPublic" = true;

-- CreateIndex
CREATE INDEX "agent_visibility_idx" ON "agent"("visibility");

-- NOTE: isPublic column is intentionally kept for backward compatibility.
-- It will be dropped in a future migration after all code is deployed.
