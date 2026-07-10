/**
 * In-Memory Sliding Window Rate Limiter (Spec P24).
 * Protects Anchor Fashion API endpoints against DDoS, brute-force login attempts,
 * and excessive geofence polling.
 */

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitTracker>();

// Clean up expired buckets periodically
setInterval(() => {
  const now = Date.now();
  store.forEach((val, key) => {
    if (now > val.resetTime) {
      store.delete(key);
    }
  });
}, 60000);

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export const RATE_LIMIT_CONFIGS = {
  GENERAL_API: { maxRequests: 60, windowSeconds: 60 },      // 60 req / min per IP
  AUTH_LOGIN: { maxRequests: 5, windowSeconds: 900 },       // 5 attempts / 15 mins per IP
  BIOMETRIC_CHECKIN: { maxRequests: 10, windowSeconds: 300 }, // 10 check-in attempts / 5 mins
};

/**
 * Checks if the request exceeds the rate limit.
 * @returns true if allowed, false if exceeded.
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const now = Date.now();
  const key = `${identifier}_${config.windowSeconds}`;
  const tracker = store.get(key);

  if (!tracker || now > tracker.resetTime) {
    store.set(key, {
      count: 1,
      resetTime: now + config.windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetInSeconds: config.windowSeconds,
    };
  }

  if (tracker.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((tracker.resetTime - now) / 1000),
    };
  }

  tracker.count += 1;
  store.set(key, tracker);

  return {
    allowed: true,
    remaining: config.maxRequests - tracker.count,
    resetInSeconds: Math.ceil((tracker.resetTime - now) / 1000),
  };
}

