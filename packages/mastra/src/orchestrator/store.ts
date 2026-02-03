import { Pool, PoolConfig } from "pg";

// Extend global type for Next.js HMR singleton pattern
declare global {
    var goalPool: Pool | undefined;
}

/**
 * Determine SSL configuration based on environment
 *
 * SSL is enabled when:
 * - DATABASE_SSL=true (explicit)
 * - Connection string contains "supabase" (legacy support)
 * - Connection string contains "sslmode=require"
 */
function getSslConfig(): PoolConfig["ssl"] {
    const connectionString = process.env.DATABASE_URL || "";

    // Explicit SSL environment variable
    if (process.env.DATABASE_SSL === "true") {
        return { rejectUnauthorized: false };
    }

    // Explicit disable
    if (process.env.DATABASE_SSL === "false") {
        return undefined;
    }

    // Auto-detect from connection string
    if (
        connectionString.includes("supabase") ||
        connectionString.includes("sslmode=require") ||
        connectionString.includes("sslmode=verify")
    ) {
        return { rejectUnauthorized: false };
    }

    return undefined;
}

/**
 * Get PostgreSQL pool for goal queries
 *
 * Pool configuration:
 * - max: 10 connections (prevents connection exhaustion)
 * - idleTimeoutMillis: 30 seconds
 * - connectionTimeoutMillis: 10 seconds
 */
function getPool(): Pool {
    if (!global.goalPool) {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL is not defined in environment variables");
        }
        global.goalPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: getSslConfig(),
            // Connection pool limits to prevent exhaustion
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        });
    }
    return global.goalPool;
}

export interface Goal {
    id: string;
    userId: string;
    threadId: string;
    title: string;
    description: string;
    status: "queued" | "running" | "completed" | "failed";
    priority: number;
    progress: number;
    currentStep?: string;
    result?: unknown;
    score?: GoalScore;
    error?: string;
    inngestRunId?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    updatedAt?: Date;
}

export interface GoalScore {
    relevancy: number;
    completeness: number;
    overall: number;
    passed: boolean;
}

export class GoalStore {
    private pool: Pool;

    constructor() {
        this.pool = getPool();
    }

    async create(
        userId: string,
        input: {
            title: string;
            description: string;
            priority?: number;
        }
    ): Promise<Goal> {
        const threadId = `goal_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Goal description is stored in the goals table itself
        // The orchestrator agent will use memory through its own memory configuration

        const result = await this.pool.query(
            `
            INSERT INTO goals (user_id, thread_id, title, description, priority)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `,
            [userId, threadId, input.title, input.description, input.priority || 0]
        );

        return this.mapRow(result.rows[0]);
    }

    async getById(goalId: string): Promise<Goal | null> {
        const result = await this.pool.query(`SELECT * FROM goals WHERE id = $1`, [goalId]);
        return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    }

    async getForUser(userId: string): Promise<Goal[]> {
        const result = await this.pool.query(
            `SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows.map((row) => this.mapRow(row));
    }

    async updateStatus(
        goalId: string,
        status: Goal["status"],
        data?: Partial<Goal>
    ): Promise<void> {
        const updates: string[] = ["status = $2", "updated_at = NOW()"];
        const values: unknown[] = [goalId, status];
        let paramIndex = 3;

        if (status === "running") {
            updates.push("started_at = COALESCE(started_at, NOW())");
        } else if (status === "completed" || status === "failed") {
            updates.push("completed_at = NOW()");
        }

        if (data?.progress !== undefined) {
            updates.push(`progress = $${paramIndex++}`);
            values.push(data.progress);
        }
        if (data?.currentStep !== undefined) {
            updates.push(`current_step = $${paramIndex++}`);
            values.push(data.currentStep);
        }
        if (data?.result !== undefined) {
            updates.push(`result = $${paramIndex++}`);
            values.push(JSON.stringify(data.result));
        }
        if (data?.score !== undefined) {
            updates.push(`score = $${paramIndex++}`);
            values.push(JSON.stringify(data.score));
        }
        if (data?.error !== undefined) {
            updates.push(`error = $${paramIndex++}`);
            values.push(data.error);
        }
        if (data?.inngestRunId !== undefined) {
            updates.push(`inngest_run_id = $${paramIndex++}`);
            values.push(data.inngestRunId);
        }

        await this.pool.query(`UPDATE goals SET ${updates.join(", ")} WHERE id = $1`, values);
    }

    async delete(goalId: string): Promise<void> {
        await this.pool.query(`DELETE FROM goals WHERE id = $1`, [goalId]);
    }

    private mapRow(row: Record<string, unknown>): Goal {
        return {
            id: row.id as string,
            userId: row.user_id as string,
            threadId: row.thread_id as string,
            title: row.title as string,
            description: row.description as string,
            status: row.status as Goal["status"],
            priority: row.priority as number,
            progress: row.progress as number,
            currentStep: row.current_step as string | undefined,
            result: row.result as unknown,
            score: row.score as GoalScore | undefined,
            error: row.error as string | undefined,
            inngestRunId: row.inngest_run_id as string | undefined,
            createdAt: row.created_at as Date,
            startedAt: row.started_at as Date | undefined,
            completedAt: row.completed_at as Date | undefined,
            updatedAt: row.updated_at as Date | undefined
        };
    }
}

export const goalStore = new GoalStore();
