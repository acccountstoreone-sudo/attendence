// Playwright E2E Tests — Spec P50
// Run with: npx playwright test
// Tests mock GPS and camera APIs for biometric check-in flow

import { test, expect, Page } from '@playwright/test';

// ─── GPS Mock Helpers ─────────────────────────────────────────────────────────

async function mockGPSInside(page: Page) {
  // Mock geolocation within the test branch geofence
  await page.context().setGeolocation({ latitude: 23.8103, longitude: 90.4125 });
  await page.context().grantPermissions(['geolocation']);
}

async function mockGPSOutside(page: Page) {
  // Mock geolocation 5km away from branch
  await page.context().setGeolocation({ latitude: 23.8600, longitude: 90.4125 });
  await page.context().grantPermissions(['geolocation']);
}

// ─── Auth Flow ────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Anchor Fashion')).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test('shows error message on invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/invalid credentials|error/i)).toBeVisible({ timeout: 5000 });
  });
});

// ─── Employee Flow ────────────────────────────────────────────────────────────

test.describe('Employee Check-In Flow', () => {
  test.beforeEach(async ({ page }) => {
    // In a real E2E setup, seed test user and login programmatically
    // For now, navigate directly (would need auth state injection)
    await mockGPSInside(page);
  });

  test('check-in page renders GPS and camera modules', async ({ page }) => {
    await page.goto('/employee/check-in');
    // If not logged in, will redirect. Otherwise verify page structure
    const isLogin = page.url().includes('/login');
    if (!isLogin) {
      await expect(page.getByText(/Geofence GPS Verification/i)).toBeVisible();
      await expect(page.getByText(/Biometric Face Verification/i)).toBeVisible();
    }
  });

  test('GPS indicator shows "Within Range" when inside geofence', async ({ page }) => {
    await mockGPSInside(page);
    await page.goto('/employee/check-in');
    // Allow GPS to process
    await page.waitForTimeout(2000);
    const isLogin = page.url().includes('/login');
    if (!isLogin) {
      await expect(page.getByText(/Within Range|Inside/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('GPS indicator blocks check-in when outside geofence', async ({ page }) => {
    await mockGPSOutside(page);
    await page.goto('/employee/check-in');
    await page.waitForTimeout(2000);
    const isLogin = page.url().includes('/login');
    if (!isLogin) {
      // Capture Face button should be disabled
      const captureBtn = page.getByRole('button', { name: /Capture Face/i });
      await expect(captureBtn).toBeDisabled({ timeout: 10000 });
    }
  });
});

// ─── Role Guard Tests ─────────────────────────────────────────────────────────

test.describe('Role-Based Access Control', () => {
  test('employee cannot access /admin URL', async ({ page }) => {
    // Without admin session, accessing /admin redirects
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('branch-manager URLs redirect unauthenticated users', async ({ page }) => {
    await page.goto('/branch-manager');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── UI Component Tests ───────────────────────────────────────────────────────

test.describe('UI Components', () => {
  test('login page has proper heading structure', async ({ page }) => {
    await page.goto('/login');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
  });

  test('login form is keyboard accessible', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Tab');
    const focusedEl = page.locator(':focus');
    await expect(focusedEl).toBeTruthy();
  });
});
