import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeEmployeeDutySummary } from '@/lib/dutyEngine';

// ─── Mock Dependencies for Manual Correction API Route ───────────────────────

const mockUserRef: {
  current: {
    id: string;
    email: string;
    role: 'admin' | 'branch_manager' | 'employee';
    branch_id: string | null;
    full_name: string;
    is_active: boolean;
  } | null;
} = { current: null };

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    requireRole: vi.fn(async (allowed: string[]) => {
      if (!mockUserRef.current) throw new Error('UNAUTHENTICATED: Please sign in.');
      if (!allowed.includes(mockUserRef.current.role)) {
        throw new Error(`FORBIDDEN: Requires ${allowed.join(', ')}`);
      }
      return mockUserRef.current;
    }),
  };
});

vi.mock('@/lib/notification-service', () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}));

// Track all inserts, updates, deletes made against supabase mock
interface DbLog {
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload?: unknown;
  id?: string;
}

const dbOps: DbLog[] = [];
const mockDbState: {
  employeeProfile: Record<string, unknown> | null;
  branchInfo: Record<string, unknown> | null;
  existingRecordsByDate: Record<string, Record<string, unknown>>;
  existingRecordById: Record<string, Record<string, unknown>>;
  simulateTriggerOverwriteStatus?: string | null;
} = {
  employeeProfile: null,
  branchInfo: null,
  existingRecordsByDate: {},
  existingRecordById: {},
  simulateTriggerOverwriteStatus: null,
};

function createMockSupabase() {
  return {
    from: vi.fn((table: string) => {
      let currentOp: 'select' | 'insert' | 'update' | 'delete' = 'select';
      let pendingPayload: Record<string, unknown> | null = null;
      const filters: Record<string, unknown> = {};

      const chain: Record<string, unknown> = {
        select: vi.fn(() => chain),
        insert: vi.fn((payload: Record<string, unknown>) => {
          currentOp = 'insert';
          pendingPayload = payload;
          dbOps.push({ table, op: 'insert', payload });
          return chain;
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          currentOp = 'update';
          pendingPayload = payload;
          dbOps.push({ table, op: 'update', payload });
          return chain;
        }),
        delete: vi.fn(() => {
          currentOp = 'delete';
          return chain;
        }),
        eq: vi.fn((col: string, val: unknown) => {
          filters[col] = val;
          if (currentOp === 'delete') {
            dbOps.push({ table, op: 'delete', id: String(val) });
          }
          return chain;
        }),
        gte: vi.fn((col: string, val: unknown) => {
          filters[`gte:${col}`] = val;
          return chain;
        }),
        lte: vi.fn((col: string, val: unknown) => {
          filters[`lte:${col}`] = val;
          return chain;
        }),
        order: vi.fn(() => {
          // For attendance_records day existence lookup
          if (table === 'attendance_records' && filters['gte:check_in_time']) {
            const gteIso = String(filters['gte:check_in_time']);
            const dhakaDate = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Dhaka',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date(gteIso));
            const found = mockDbState.existingRecordsByDate[dhakaDate];
            return Promise.resolve({ data: found ? [found] : [], error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
        limit: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => {
          if (table === 'company_profile') {
            return { data: { default_work_end_time: '18:00:00' }, error: null };
          }
          if (table === 'branch_settings') {
            return { data: { work_end_time: '18:00:00', overtime_after_minutes: 30 }, error: null };
          }
          if (table === 'branches') {
            return { data: mockDbState.branchInfo, error: null };
          }
          return { data: null, error: null };
        }),
        single: vi.fn(async () => {
          if (table === 'profiles') {
            return { data: mockDbState.employeeProfile, error: mockDbState.employeeProfile ? null : { message: 'Not found' } };
          }
          if (table === 'attendance_records') {
            if (currentOp === 'select') {
              const rec = mockDbState.existingRecordById[String(filters['id'])];
              return { data: rec || null, error: rec ? null : { message: 'Not found' } };
            }
            if (currentOp === 'insert') {
              const id = `new-rec-${dbOps.length}`;
              const status = mockDbState.simulateTriggerOverwriteStatus || pendingPayload?.status || 'present';
              return { data: { id, ...pendingPayload, status }, error: null };
            }
            if (currentOp === 'update') {
              return { data: { id: filters['id'] || 'updated-id', ...pendingPayload }, error: null };
            }
          }
          return { data: null, error: null };
        }),
        then: (resolve: (val: { data: null; error: null }) => void) => {
          resolve({ data: null, error: null });
        },
      };

      return chain;
    }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => createMockSupabase()),
}));

// ─── Tests for Manual Correction & Bulk Upsert API ───────────────────────────

const EMP_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_A = '22222222-2222-4222-8222-222222222222';
const BRANCH_B = '33333333-3333-4333-8333-333333333333';
const REC_ID = '44444444-4444-4444-8444-444444444444';

describe('/api/attendance/manual-correction', () => {
  beforeEach(() => {
    dbOps.length = 0;
    mockDbState.existingRecordsByDate = {};
    mockDbState.existingRecordById = {};
    mockDbState.simulateTriggerOverwriteStatus = null;
    mockDbState.employeeProfile = {
      id: EMP_ID,
      full_name: 'Karim Ahmed',
      branch_id: BRANCH_A,
      role: 'employee',
    };
    mockDbState.branchInfo = {
      id: BRANCH_A,
      name: 'Mirpur Flagship',
      latitude: 23.8223,
      longitude: 90.3654,
    };
    mockUserRef.current = {
      id: '99999999-9999-4999-8999-999999999999',
      email: 'admin@anchorfashion.com',
      role: 'admin',
      branch_id: null,
      full_name: 'HQ Admin',
      is_active: true,
    };
  });

  it('creates 4 missing attendance days in bulk with branch coordinates and audit logs', async () => {
    const { POST } = await import('@/app/api/attendance/manual-correction/route');

    const req = new Request('http://localhost:3000/api/attendance/manual-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'upsert_days',
        employee_id: EMP_ID,
        dates: ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'],
        check_in_time: '09:00',
        check_out_time: '18:00',
        status: 'present',
        reason: 'App issue — employee was present for 4 days',
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.created).toHaveLength(4);
    expect(json.data.updated).toHaveLength(0);
    expect(json.data.total_affected).toBe(4);

    const inserts = dbOps.filter((o) => o.table === 'attendance_records' && o.op === 'insert');
    expect(inserts).toHaveLength(4);
    const firstPayload = inserts[0].payload as Record<string, unknown>;
    expect(firstPayload.check_in_lat).toBe(23.8223);
    expect(firstPayload.check_in_lng).toBe(90.3654);
    expect(firstPayload.is_manual_override).toBe(true);
    expect(firstPayload.approval_status).toBe('approved');
    expect(firstPayload.override_reason).toBe('App issue — employee was present for 4 days');

    // Audit logs must use valid schema columns (actor_id, action='MANUAL_OVERRIDE', new_value)
    const audits = dbOps.filter((o) => o.table === 'audit_logs' && o.op === 'insert');
    expect(audits).toHaveLength(4);
    const auditPayload = audits[0].payload as Record<string, unknown>;
    expect(auditPayload.actor_id).toBe(mockUserRef.current?.id);
    expect(auditPayload.action).toBe('MANUAL_OVERRIDE');
    expect(auditPayload.new_value).toBeDefined();
  });

  it('re-applies status on update if DB insert trigger overwrote manual status', async () => {
    mockDbState.simulateTriggerOverwriteStatus = 'late';
    const { POST } = await import('@/app/api/attendance/manual-correction/route');

    const req = new Request('http://localhost:3000/api/attendance/manual-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'upsert_days',
        employee_id: EMP_ID,
        dates: ['2026-11-18'],
        check_in_time: '10:00',
        check_out_time: '18:00',
        status: 'present',
        reason: 'Excused late arrival due to app glitch',
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(201);
    const updates = dbOps.filter((o) => o.table === 'attendance_records' && o.op === 'update');
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect((updates[0].payload as Record<string, unknown>).status).toBe('present');
  });

  it('skips existing days when overwrite_existing is false', async () => {
    mockDbState.existingRecordsByDate['2026-11-19'] = {
      id: REC_ID,
      employee_id: EMP_ID,
      branch_id: BRANCH_A,
      check_in_time: '2026-11-19T03:00:00.000Z',
      check_out_time: '2026-11-19T12:00:00.000Z',
      status: 'present',
    };

    const { POST } = await import('@/app/api/attendance/manual-correction/route');
    const req = new Request('http://localhost:3000/api/attendance/manual-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'upsert_days',
        employee_id: EMP_ID,
        dates: ['2026-11-18', '2026-11-19'],
        check_in_time: '09:00',
        check_out_time: '18:00',
        status: 'present',
        overwrite_existing: false,
        reason: 'Fill missing days only',
      }),
    });

    const res = await POST(req as never);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.created).toHaveLength(1);
    expect(json.data.skipped).toHaveLength(1);
    expect(json.data.skipped[0].date).toBe('2026-11-19');
  });

  it('blocks branch_manager from editing attendance of another branch', async () => {
    mockUserRef.current = {
      id: '88888888-8888-4888-8888-888888888888',
      email: 'bm@anchorfashion.com',
      role: 'branch_manager',
      branch_id: BRANCH_B,
      full_name: 'Branch Manager B',
      is_active: true,
    };

    const { POST } = await import('@/app/api/attendance/manual-correction/route');
    const req = new Request('http://localhost:3000/api/attendance/manual-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'upsert_days',
        employee_id: EMP_ID,
        dates: ['2026-11-18'],
        check_in_time: '09:00',
        check_out_time: '18:00',
        status: 'present',
        reason: 'Attempt cross-branch edit',
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(403);
  });

  it('edits an existing record including absent status and approves it', async () => {
    mockDbState.existingRecordById[REC_ID] = {
      id: REC_ID,
      employee_id: EMP_ID,
      branch_id: BRANCH_A,
      check_in_time: '2026-11-18T04:00:00.000Z',
      check_out_time: null,
      status: 'late',
      approval_status: 'pending',
      overtime_minutes: 0,
    };

    const { POST } = await import('@/app/api/attendance/manual-correction/route');
    const req = new Request('http://localhost:3000/api/attendance/manual-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        record_id: REC_ID,
        check_in_time: '2026-11-18T03:00:00.000Z',
        check_out_time: '2026-11-18T12:00:00.000Z',
        status: 'present',
        reason: 'Verified on-time arrival via CCTV',
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('present');
    expect(json.data.approval_status).toBe('approved');
    expect(json.data.override_reason).toBe('Verified on-time arrival via CCTV');
  });

  it('allows admin to delete a record and blocks branch_manager from deleting', async () => {
    mockDbState.existingRecordById[REC_ID] = {
      id: REC_ID,
      employee_id: EMP_ID,
      branch_id: BRANCH_A,
      check_in_time: '2026-11-18T03:00:00.000Z',
      check_out_time: null,
      status: 'present',
    };

    const { DELETE } = await import('@/app/api/attendance/manual-correction/route');

    // Admin succeeds
    const adminReq = new Request(
      `http://localhost:3000/api/attendance/manual-correction?record_id=${REC_ID}&reason=Duplicate`,
      { method: 'DELETE' }
    );
    const adminRes = await DELETE(adminReq as never);
    expect(adminRes.status).toBe(200);

    // Branch manager blocked
    mockUserRef.current = {
      id: '88888888-8888-4888-8888-888888888888',
      email: 'bm@anchorfashion.com',
      role: 'branch_manager',
      branch_id: BRANCH_A,
      full_name: 'Branch Manager A',
      is_active: true,
    };
    const bmReq = new Request(
      `http://localhost:3000/api/attendance/manual-correction?record_id=${REC_ID}`,
      { method: 'DELETE' }
    );
    const bmRes = await DELETE(bmReq as never);
    expect(bmRes.status).toBe(403);
  });
});

// ─── Tests for Duty Engine Manual Override & Exact Counting ──────────────────

describe('computeEmployeeDutySummary — manual override & accurate counts', () => {
  it('respects explicit manual override status and counts each day exactly once', async () => {
    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };

    const result = await computeEmployeeDutySummary(fakeSupabase as never, EMP_ID, 11, 2026, {
      profile: {
        id: EMP_ID,
        full_name: 'Karim Ahmed',
        branch_id: BRANCH_A,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      companyProfile: {
        default_work_start_time: '09:00:00',
        default_work_end_time: '18:00:00',
      },
      branch: { name: 'Mirpur Flagship', code: 'MIR-01' },
      branchSettings: {
        work_start_time: '09:00:00',
        work_end_time: '18:00:00',
        late_grace_minutes: 15,
        overtime_after_minutes: 30,
        half_day_hours: 4.0,
        weekly_off_days: [5],
      },
      salarySettings: null,
      holidays: [],
      leaves: [],
      taskLogs: [],
      attendanceRecords: [
        // Day 1: Normal present day (09:00 - 18:00 BD time)
        {
          id: 'rec-1',
          employee_id: EMP_ID,
          branch_id: BRANCH_A,
          check_in_time: '2026-11-01T03:00:00.000Z',
          check_out_time: '2026-11-01T12:00:00.000Z',
          status: 'present',
          is_manual_override: false,
          override_reason: null,
          overtime_minutes: 0,
        },
        // Day 2: Manual override explicitly marked Present even though check-in is 10:00 AM
        {
          id: 'rec-2',
          employee_id: EMP_ID,
          branch_id: BRANCH_A,
          check_in_time: '2026-11-02T04:00:00.000Z',
          check_out_time: '2026-11-02T12:00:00.000Z',
          status: 'present',
          is_manual_override: true,
          override_reason: 'App issue — verified present at 9 AM',
          approval_status: 'approved',
          overtime_minutes: 0,
        },
        // Day 3: Normal late day (10:00 - 18:00 BD time, no override_reason)
        {
          id: 'rec-3',
          employee_id: EMP_ID,
          branch_id: BRANCH_A,
          check_in_time: '2026-11-03T04:00:00.000Z',
          check_out_time: '2026-11-03T12:00:00.000Z',
          status: 'late',
          is_manual_override: false,
          override_reason: null,
          overtime_minutes: 0,
        },
      ],
    });

    // No double counting: exactly 2 present days (Day 1 + Day 2), 1 late day (Day 3)
    expect(result.summary.total_present_days).toBe(2);
    expect(result.summary.total_late_days).toBe(1);
    expect(result.summary.total_late_minutes).toBe(60);

    const day2 = result.daily_breakdown.find((d) => d.date === '2026-11-02');
    expect(day2?.status).toBe('present');
    expect(day2?.late_minutes).toBe(0);
    expect(day2?.record_id).toBe('rec-2');
    expect(day2?.is_manual_override).toBe(true);
    expect(day2?.override_reason).toBe('App issue — verified present at 9 AM');
    expect(day2?.notes).toContain('Manual Edit:');
  });
});

