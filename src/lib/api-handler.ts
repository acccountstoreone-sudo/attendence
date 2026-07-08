import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * Standardized API Route Wrapper (Spec P24).
 * Intercepts Zod validation failures, Supabase auth/query errors, and custom errors,
 * returning a unified JSON structure with precise HTTP status codes.
 */
export async function withApiHandler<T>(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<T>,
  _options?: { requiredRole?: string[]; rateLimitKey?: string }
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    const data = await handler(req);
    return NextResponse.json(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const timestamp = new Date().toISOString();

    // 1. Zod Input Validation Failure (HTTP 400)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters or payload structure.',
            details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
          timestamp,
        },
        { status: 400 }
      );
    }

    // 2. Custom Auth / Permission Errors (HTTP 401 / 403)
    const errMsg = error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unexpected server error occurred.';
    
    if (errMsg.startsWith('UNAUTHENTICATED')) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'UNAUTHORIZED', message: errMsg.replace('UNAUTHENTICATED: ', '') },
          timestamp,
        },
        { status: 401 }
      );
    }

    if (errMsg.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'FORBIDDEN', message: errMsg.replace('FORBIDDEN: ', '') },
          timestamp,
        },
        { status: 403 }
      );
    }

    if (errMsg.startsWith('RATE_LIMIT_EXCEEDED')) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' },
          timestamp,
        },
        { status: 429 }
      );
    }

    // 3. Database / Generic Server Errors (HTTP 500)
    console.error('[API Error Handler]:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: errMsg,
        },
        timestamp,
      },
      { status: 500 }
    );
  }
}
