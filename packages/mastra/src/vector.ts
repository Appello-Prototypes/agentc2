import { PgVector } from "@mastra/pg";

// Extend global type for Next.js HMR singleton pattern
declare global {
  var pgVector: PgVector | undefined;
}

/**
 * PgVector singleton for semantic recall and RAG.
 *
 * Uses Supabase PostgreSQL with pgvector extension for
 * vector similarity search operations.
 *
 * Prerequisite: Enable pgvector extension in Supabase SQL Editor:
 * ```sql
 * CREATE EXTENSION IF NOT EXISTS vector;
 * ```
 */
function getPgVector(): PgVector {
  if (!global.pgVector) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined in environment variables");
    }

    global.pgVector = new PgVector({
      id: "mastra-vector",
      connectionString: process.env.DATABASE_URL,
    });
  }

  return global.pgVector;
}

export const vector = getPgVector();
