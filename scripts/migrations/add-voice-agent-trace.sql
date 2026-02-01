-- Create voice_agent_trace table for voice agent observability
-- Run this migration manually: psql $DATABASE_URL -f scripts/migrations/add-voice-agent-trace.sql

CREATE TABLE IF NOT EXISTS "voice_agent_trace" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "model" JSONB NOT NULL,
    "availableTools" TEXT[],
    "toolCalls" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "tokens" JSONB,
    "scores" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_agent_trace_pkey" PRIMARY KEY ("id")
);

-- Create unique index on traceId
CREATE UNIQUE INDEX IF NOT EXISTS "voice_agent_trace_traceId_key" ON "voice_agent_trace"("traceId");

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "voice_agent_trace_timestamp_idx" ON "voice_agent_trace"("timestamp");
CREATE INDEX IF NOT EXISTS "voice_agent_trace_createdAt_idx" ON "voice_agent_trace"("createdAt");
