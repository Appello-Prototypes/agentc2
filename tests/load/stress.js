/**
 * k6 Stress Test
 *
 * Gradually increases load until the system breaks.
 * Target: Identify breaking point and bottlenecks.
 *
 * Run: k6 run tests/load/stress.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const errorRate = new Rate("errors");
const responseTime = new Trend("response_time");

export const options = {
    stages: [
        { duration: "2m", target: 10 },
        { duration: "3m", target: 50 },
        { duration: "3m", target: 100 },
        { duration: "3m", target: 200 },
        { duration: "3m", target: 300 },
        { duration: "3m", target: 500 },
        { duration: "2m", target: 0 }
    ],
    thresholds: {
        errors: ["rate<0.10"]
    }
};

export default function () {
    const res = http.get(`${BASE_URL}/api/health`);
    responseTime.add(res.timings.duration);
    check(res, { "status ok": (r) => r.status === 200 });
    errorRate.add(res.status !== 200);

    if (Math.random() < 0.3) {
        const readyRes = http.get(`${BASE_URL}/api/health/ready`);
        responseTime.add(readyRes.timings.duration);
        errorRate.add(readyRes.status !== 200);
    }

    sleep(0.2 + Math.random() * 0.8);
}
