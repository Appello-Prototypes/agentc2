/**
 * PM2 log transport configuration for production log aggregation.
 *
 * PM2 captures stdout/stderr automatically. Since pino already outputs
 * structured JSON in production, the logs are aggregation-ready.
 *
 * For shipping to Grafana Loki, Logtail, or Datadog:
 *   - Option A: Use pino-loki transport (pino → Loki direct)
 *   - Option B: Use Promtail/Vector/Fluentd to tail PM2 log files
 *   - Option C: Use Logtail's pino transport for managed ingestion
 *
 * Environment variables:
 *   LOG_TRANSPORT=loki|logtail|datadog
 *   LOKI_URL=http://loki:3100
 *   LOGTAIL_SOURCE_TOKEN=...
 */

interface LogTransportTarget {
    target: string;
    options: Record<string, unknown>;
    level: string;
}

export function getLogTransportTargets(): LogTransportTarget[] {
    const targets: LogTransportTarget[] = [];
    const transport = process.env.LOG_TRANSPORT;

    if (transport === "loki" && process.env.LOKI_URL) {
        targets.push({
            target: "pino-loki",
            options: {
                host: process.env.LOKI_URL,
                labels: {
                    app: "agentc2",
                    environment: process.env.NODE_ENV || "production"
                },
                batching: true,
                interval: 5
            },
            level: process.env.LOG_LEVEL || "info"
        });
    }

    if (transport === "logtail" && process.env.LOGTAIL_SOURCE_TOKEN) {
        targets.push({
            target: "@logtail/pino",
            options: {
                sourceToken: process.env.LOGTAIL_SOURCE_TOKEN
            },
            level: process.env.LOG_LEVEL || "info"
        });
    }

    return targets;
}

/**
 * PM2 ecosystem log configuration.
 * Add to ecosystem.config.js for structured log file management:
 *
 * {
 *   log_type: "json",
 *   out_file: "/var/log/pm2/agent-out.log",
 *   error_file: "/var/log/pm2/agent-error.log",
 *   merge_logs: true,
 *   log_date_format: "YYYY-MM-DD HH:mm:ss Z",
 * }
 */
export const PM2_LOG_CONFIG = {
    log_type: "json",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z"
};
