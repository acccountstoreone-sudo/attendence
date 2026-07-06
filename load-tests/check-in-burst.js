import http from 'k6/http';
import { check, sleep } from 'k6';

// Load testing k6 script — Spec P52
// Run with: k6 run load-tests/check-in-burst.js

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 concurrent users
    { duration: '1m', target: 100 }, // Spike to 100 users (simulating 9:00 AM rush)
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const BRANCH_ID = 'test-branch-uuid';

export default function () {
  // Simulate checking the dashboard
  const resDashboard = http.get(`${BASE_URL}/api/attendance/today`);
  
  // Simulate GPS verification
  const payloadGps = JSON.stringify({
    latitude: 23.8103,
    longitude: 90.4125,
    branch_id: BRANCH_ID,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      // In a real test, you'd pass a mocked session cookie or JWT here
      // 'Authorization': 'Bearer test-token'
    },
  };

  const resGps = http.post(`${BASE_URL}/api/attendance/verify-location`, payloadGps, params);
  
  check(resGps, {
    'GPS verify status is 200 or 401 (auth block)': (r) => r.status === 200 || r.status === 401,
  });

  sleep(Math.random() * 2); // Random wait between 0s and 2s
}
