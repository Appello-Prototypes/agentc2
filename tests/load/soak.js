/**
 * k6 Soak Test (24-hour endurance)
 *
 * Sustained load for 24 hours to detect:
 * - Memory leaks
 * - Connection leaks
 * - Latency degradation
 * - Disk usage growth
 *
 * Run: k6 run tests/load/soak.js
 * Note: Run against staging only. Monitor server metrics during test.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const errorRate = new Rate("errors");
const responseTime = new Trend("response_time");
const requestCount = new Counter("total_requests");

export const options = {
    stages: [
        { duration: "5m", target: 15 }, // Ramp up
        { duration: "23h50m", target: 15 }, // Sustain for ~24 hours
        { duration: "5m", target: 0 } // Ramp down
    ],
    thresholds: {
        http_req_duration: ["p(95)<2000"],
        errors: ["rate<0.01"]
    }
};

export default function () {
    const healthRes = http.get(`${BASE_URL}/api/health`);
    responseTime.add(healthRes.timings.duration);
    requestCount.add(1);
    check(healthRes, {
        "health ok": (r) => r.status === 200,
        "response < 500ms": (r) => r.timings.duration < 500
    });
    errorRate.add(healthRes.status !== 200);

    sleep(2);

    if (Math.random() < 0.2) {
        const readyRes = http.get(`${BASE_URL}/api/health/ready`);
        responseTime.add(readyRes.timings.duration);
        requestCount.add(1);
        check(readyRes, { "ready ok": (r) => r.status === 200 });
        errorRate.add(readyRes.status !== 200);
    }

    sleep(3 + Math.random() * 2);
}
