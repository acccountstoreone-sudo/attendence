import { z } from 'zod';

/**
 * Centralized Zod validation schemas (Spec P34).
 * All API routes import from this module to ensure consistent, type-safe input validation.
 */

// ─── Authentication ────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ─── Attendance ────────────────────────────────────────────────────────────────

export const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  photo_url: z.string().optional(),
  face_descriptor: z.array(z.number()).optional(),
  check_in_method: z.enum(['biometric', 'gps', 'manual']).default('biometric'),
  device_info: z.string().optional(),
});

export const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().max(500).optional(),
});

export const manualCorrectionSchema = z.object({
  attendance_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  correction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  type: z.enum(['check_in', 'check_out']),
  requested_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

export const correctionReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  review_note: z.string().max(500).optional(),
});

// ─── Employee Management ───────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  full_name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(['employee', 'branch_manager', 'admin']),
  branch_id: z.string().uuid().optional().nullable(),
  employee_id: z.string().max(20).optional().nullable(),
  password: z.string().min(8).max(72),
  department: z.string().max(50).optional().nullable(),
  designation: z.string().max(50).optional().nullable(),
});

export const updateEmployeeSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(['employee', 'branch_manager', 'admin']).optional(),
  branch_id: z.string().uuid().optional().nullable(),
  employee_id: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
  department: z.string().max(50).optional().nullable(),
  designation: z.string().max(50).optional().nullable(),
});

// ─── Branch Management ─────────────────────────────────────────────────────────

export const createBranchSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(50).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  geofence_radius_meters: z.number().min(10).max(1000).default(100),
  is_active: z.boolean().default(true),
});

export const updateBranchSchema = createBranchSchema.partial();

// ─── Notifications ─────────────────────────────────────────────────────────────

export const createNotificationSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(2).max(150),
  message: z.string().min(2).max(1000),
  type: z.enum(['info', 'warning', 'alert', 'success']).default('info'),
  link_url: z.string().url().optional().nullable(),
});

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reportQuerySchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2035),
  branch_id: z.string().uuid().optional(),
  format: z.enum(['json', 'excel', 'pdf']).default('json'),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type ManualCorrectionInput = z.infer<typeof manualCorrectionSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
