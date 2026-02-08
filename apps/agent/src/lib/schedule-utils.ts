import { CronExpressionParser } from "cron-parser";

const MAX_PREVIEW_COUNT = 50;

export function assertValidTimezone(timezone: string) {
    try {
        Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    } catch {
        throw new Error("Invalid timezone");
    }
}

export function parseCronExpression(cronExpr: string, timezone: string, currentDate?: Date) {
    assertValidTimezone(timezone);
    return CronExpressionParser.parse(cronExpr, {
        tz: timezone,
        currentDate: currentDate ?? new Date()
    });
}

export function getNextRunAt(cronExpr: string, timezone: string, fromDate?: Date) {
    const interval = parseCronExpression(cronExpr, timezone, fromDate);
    return interval.next().toDate();
}

export function getNextRunTimes(
    cronExpr: string,
    timezone: string,
    count: number,
    fromDate?: Date
) {
    const interval = parseCronExpression(cronExpr, timezone, fromDate);
    const safeCount = Math.min(Math.max(count, 1), MAX_PREVIEW_COUNT);
    const runs: Date[] = [];

    for (let i = 0; i < safeCount; i += 1) {
        runs.push(interval.next().toDate());
    }

    return runs;
}
