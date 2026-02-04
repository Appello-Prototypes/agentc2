import { PostgresStore } from "@mastra/pg";

// Extend global type for Next.js HMR singleton pattern
declare global {
    var pgStore: PostgresStore | undefined;
}

/**
 * PostgreSQL storage singleton for Mastra.
 * Uses global singleton pattern to prevent duplicate connections during Next.js HMR.
 */
function getPgStore(): PostgresStore {
    if (!global.pgStore) {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL is not defined in environment variables");
        }

        global.pgStore = new PostgresStore({
            id: "mastra-storage",
            connectionString: process.env.DATABASE_URL,
            schemaName: "public"
        });
    }

    return global.pgStore;
}

function createStorageProxy(): PostgresStore {
    return new Proxy({} as PostgresStore, {
        get(_target, prop) {
            const store = getPgStore();
            const value = store[prop as keyof PostgresStore];
            return typeof value === "function" ? value.bind(store) : value;
        }
    });
}

export const storage = createStorageProxy();
