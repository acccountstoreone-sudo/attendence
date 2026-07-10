import { describe, it, expect } from 'vitest';
import { calculateDistance } from '@/lib/geo';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { enqueueOfflineAction, getOfflineQueue, markActionSynced } from '@/lib/offline-queue';
import {
  checkInSchema,
  checkOutSchema,
  createEmployeeSchema,
  createBranchSchema,
} from '@/lib/validations';

/**
 * Unit Tests — Spec P48
 * Run with: npx vitest run
 */

// ─── Geo / Haversine Tests ────────────────────────────────────────────────────

describe('calculateDistance (Haversine)', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(calculateDistance(23.8103, 90.4125, 23.8103, 90.4125)).toBeLessThan(1);
  });

  it('calculates ~111km for 1° latitude change', () => {
    const d = calculateDistance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('returns symmetric results', () => {
    const d1 = calculateDistance(23.8103, 90.4125, 23.8200, 90.4200);
    const d2 = calculateDistance(23.8200, 90.4200, 23.8103, 90.4125);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.01);
  });

  it('calculates realistic store-to-street distance in Dhaka', () => {
    // Mirpur 10 to Mirpur 11 ≈ ~1km
    const dist = calculateDistance(23.8223, 90.3654, 23.8313, 90.3654);
    expect(dist).toBeGreaterThan(900);
    expect(dist).toBeLessThan(1100);
  });

  it('correctly identifies within-geofence check-in (100m radius)', () => {
    const branchLat = 23.8103;
    const branchLon = 90.4125;
    // ~30m away — should be within 100m geofence
    const employeeLat = 23.8106;
    const employeeLon = 90.4125;
    const dist = calculateDistance(employeeLat, employeeLon, branchLat, branchLon);
    expect(dist).toBeLessThan(100);
  });

  it('correctly identifies outside-geofence check-in attempt', () => {
    const branchLat = 23.8103;
    const branchLon = 90.4125;
    // ~500m away — should be outside 100m geofence
    const employeeLat = 23.8150;
    const employeeLon = 90.4125;
    const dist = calculateDistance(employeeLat, employeeLon, branchLat, branchLon);
    expect(dist).toBeGreaterThan(100);
  });
});

// ─── Rate Limiter Tests ───────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const result = checkRateLimit('test_user_1', { maxRequests: 3, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
  });

  it('blocks after exceeding limit', () => {
    const identifier = `test_user_${Date.now()}`;
    const config = { maxRequests: 2, windowSeconds: 60 };
    checkRateLimit(identifier, config);
    checkRateLimit(identifier, config);
    const third = checkRateLimit(identifier, config);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('allows different identifiers independently', () => {
    const config = { maxRequests: 1, windowSeconds: 60 };
    const r1 = checkRateLimit(`user_a_${Date.now()}`, config);
    const r2 = checkRateLimit(`user_b_${Date.now()}`, config);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });
});

// ─── Validation Schema Tests ──────────────────────────────────────────────────

describe('checkInSchema', () => {
  it('accepts valid GPS coordinates', () => {
    expect(() =>
      checkInSchema.parse({ latitude: 23.8103, longitude: 90.4125 })
    ).not.toThrow();
  });

  it('rejects coordinates out of range', () => {
    expect(() =>
      checkInSchema.parse({ latitude: 95, longitude: 90.4125 })
    ).toThrow();
  });

  it('rejects missing coordinates', () => {
    expect(() => checkInSchema.parse({ latitude: 23.8103 })).toThrow();
  });
});

describe('createEmployeeSchema', () => {
  it('accepts a valid employee payload', () => {
    expect(() =>
      createEmployeeSchema.parse({
        full_name: 'Rina Akter',
        email: 'rina@anchorfashion.com',
        role: 'employee',
        password: 'SecurePass123',
      })
    ).not.toThrow();
  });

  it('rejects weak password (< 8 chars)', () => {
    expect(() =>
      createEmployeeSchema.parse({
        full_name: 'Test',
        email: 'test@test.com',
        role: 'employee',
        password: '123',
      })
    ).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      createEmployeeSchema.parse({
        full_name: 'Test',
        email: 'not-an-email',
        role: 'employee',
        password: 'ValidPass123',
      })
    ).toThrow();
  });

  it('rejects invalid role', () => {
    expect(() =>
      createEmployeeSchema.parse({
        full_name: 'Test',
        email: 'test@test.com',
        role: 'superuser',
        password: 'ValidPass123',
      })
    ).toThrow();
  });
});

describe('createBranchSchema', () => {
  it('accepts a valid branch payload', () => {
    expect(() =>
      createBranchSchema.parse({ name: 'Mirpur Branch', code: 'AF-MIR-01' })
    ).not.toThrow();
  });

  it('rejects lowercase branch code', () => {
    expect(() =>
      createBranchSchema.parse({ name: 'Test Branch', code: 'af-mir-01' })
    ).toThrow();
  });

  it('rejects geofence radius below minimum', () => {
    expect(() =>
      createBranchSchema.parse({
        name: 'Test', code: 'AF-01', geofence_radius_meters: 5
      })
    ).toThrow();
  });
});

// ─── Offline Queue Tests ──────────────────────────────────────────────────────

describe('offlineQueue', () => {
  it('enqueues a check-in action and retrieves it', () => {
    // Clear existing queue
    localStorage.setItem('anchor_fashion_offline_queue', '[]');

    const id = enqueueOfflineAction({
      type: 'check_in',
      latitude: 23.8103,
      longitude: 90.4125,
    });

    const queue = getOfflineQueue();
    const action = queue.find((a) => a.id === id);
    expect(action).toBeDefined();
    expect(action?.type).toBe('check_in');
    expect(action?.synced).toBe(false);
  });

  it('marks an action as synced and removes it', () => {
    localStorage.setItem('anchor_fashion_offline_queue', '[]');
    const id = enqueueOfflineAction({ type: 'check_out', latitude: 23.8103, longitude: 90.4125 });
    markActionSynced(id);
    const queue = getOfflineQueue();
    expect(queue.find((a) => a.id === id)).toBeUndefined();
  });
});

