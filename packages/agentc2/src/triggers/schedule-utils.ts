import { CronExpressionParser } from "cron-parser";

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
