/**
 * k6 Spike Test
 *
 * Simulates a sudden 10x traffic spike (viral moment, marketing campaign).
 * Target: System recovers gracefully, no data loss.
 *
 * Run: k6 run tests/load/spike.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const errorRate = new Rate("errors");

export const options = {
    stages: [
        { duration: "1m", target: 10 }, // Normal load
        { duration: "30s", target: 100 }, // Spike to 10x
        { duration: "3m", target: 100 }, // Sustain spike
        { duration: "30s", target: 10 }, // Drop back
        { duration: "2m", target: 10 }, // Recovery period
        { duration: "1m", target: 0 } // Ramp down
    ],
    thresholds: {
        http_req_duration: ["p(95)<3000"],
        errors: ["rate<0.05"]
    }
};

export default function () {
    const healthRes = http.get(`${BASE_URL}/api/health`);
    check(healthRes, { "health ok": (r) => r.status === 200 });
    errorRate.add(healthRes.status !== 200);

    sleep(0.5);

    const readyRes = http.get(`${BASE_URL}/api/health/ready`);
    check(readyRes, { "ready ok": (r) => r.status === 200 });
    errorRate.add(readyRes.status !== 200);

    sleep(0.5);
}
