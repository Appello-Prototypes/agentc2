import { Client } from "pg";

async function clearMastraTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to database");

    await client.query("TRUNCATE mastra_messages, mastra_threads, mastra_resources CASCADE");
    console.log("Cleared Mastra tables successfully");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

clearMastraTables();
