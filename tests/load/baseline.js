/**
 * k6 Baseline Load Test
 *
 * Simulates normal daily traffic pattern.
 * Target: Verify SLA targets under expected load.
 *
 * Run: k6 run tests/load/baseline.js
 * Run with env: k6 run -e BASE_URL=https://staging.agentc2.ai tests/load/baseline.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

const errorRate = new Rate("errors");
const healthLatency = new Trend("health_latency");
const agentsLatency = new Trend("agents_latency");

export const options = {
    stages: [
        { duration: "2m", target: 10 }, // Ramp up to 10 users
        { duration: "5m", target: 10 }, // Stay at 10 users
        { duration: "2m", target: 25 }, // Ramp up to 25 users
        { duration: "5m", target: 25 }, // Stay at 25 users
        { duration: "2m", target: 0 } // Ramp down
    ],
    thresholds: {
        http_req_duration: ["p(50)<200", "p(95)<1000", "p(99)<3000"],
        errors: ["rate<0.01"],
        health_latency: ["p(95)<100"]
    }
};

export default function () {
    // Health check (fast, frequent)
    const healthRes = http.get(`${BASE_URL}/api/health`);
    healthLatency.add(healthRes.timings.duration);
    check(healthRes, {
        "health returns 200": (r) => r.status === 200,
        "health returns ok": (r) => JSON.parse(r.body).status === "ok"
    });
    errorRate.add(healthRes.status !== 200);

    sleep(1);

    // Readiness check
    const readyRes = http.get(`${BASE_URL}/api/health/ready`);
    check(readyRes, {
        "ready returns 200": (r) => r.status === 200
    });
    errorRate.add(readyRes.status !== 200);

    sleep(1);

    // List agents (authenticated — requires session cookie)
    const agentsRes = http.get(`${BASE_URL}/api/agents`, {
        headers: { Cookie: __ENV.SESSION_COOKIE || "" }
    });
    agentsLatency.add(agentsRes.timings.duration);
    check(agentsRes, {
        "agents returns 200 or 401": (r) => r.status === 200 || r.status === 401
    });
    errorRate.add(agentsRes.status >= 500);

    sleep(2);
}
