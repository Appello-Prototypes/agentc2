import { describe, it, expect } from "vitest";
import { getNextRunAt, getNextRunTimes } from "../../apps/agent/src/lib/schedule-utils";

describe("schedule-utils", () => {
    it("calculates next run time", () => {
        const fromDate = new Date("2026-01-01T00:00:00Z");
        const nextRun = getNextRunAt("*/5 * * * *", "UTC", fromDate);
        expect(nextRun.getTime()).toBeGreaterThan(fromDate.getTime());
    });

    it("returns multiple preview times", () => {
        const fromDate = new Date("2026-01-01T00:00:00Z");
        const runs = getNextRunTimes("*/5 * * * *", "UTC", 3, fromDate);
        expect(runs).toHaveLength(3);
        expect(runs[1].getTime()).toBeGreaterThan(runs[0].getTime());
    });
});
