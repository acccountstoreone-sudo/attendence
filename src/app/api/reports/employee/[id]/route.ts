import { NextRequest, NextResponse } from 'next/server';
import { GET as getDutySummary } from './duty-summary/route';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Delegate directly to the comprehensive duty-summary logic to ensure 100% consistency across all report APIs
  return getDutySummary(request, context);
}
