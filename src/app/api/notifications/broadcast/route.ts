import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { dispatchToBranchStaff, dispatchToBranchManagers } from '@/lib/notification-service';
import { z } from 'zod';

const broadcastSchema = z.object({
  title: z.string().min(2),
  message: z.string().min(2),
  branch_id: z.string().uuid().or(z.literal('all')).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = broadcastSchema.parse(body);

    let targetBranchId = payload.branch_id;

    // Branch Managers can ONLY broadcast to their own branch
    if (user.role === 'branch_manager') {
      if (!user.branch_id) {
        throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
      }
      targetBranchId = user.branch_id;
    }

    // 1. Dispatch to all staff (employees)
    const staffCount = await dispatchToBranchStaff({
      branchId: targetBranchId === 'all' ? null : targetBranchId,
      title: payload.title,
      message: payload.message,
      type: 'system',
      actionUrl: '/employee/announcements',
      sendEmail: true,
      includeManagers: false,
    });

    // 2. Dispatch to branch managers
    const mgrCount = await dispatchToBranchManagers({
      branchId: targetBranchId === 'all' ? null : targetBranchId,
      title: payload.title,
      message: payload.message,
      type: 'system',
      actionUrl: '/branch-manager/announcements',
      sendEmail: true,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          staffCount,
          mgrCount,
          total: staffCount + mgrCount,
        },
        message: `Broadcast successfully dispatched to ${staffCount + mgrCount} users.`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
