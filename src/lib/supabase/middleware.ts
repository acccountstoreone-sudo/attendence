import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Allow static files, Next.js internal requests, and public routes without running edge network queries right away if possible
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/models') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/~offline')
  ) {
    return supabaseResponse;
  }

  // Enforce API Rate Limiting (Spec P24)
  if (pathname.startsWith('/api/')) {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    let limitResult;

    if (pathname.startsWith('/api/auth/')) {
      limitResult = checkRateLimit(`auth_${ip}`, RATE_LIMIT_CONFIGS.AUTH_LOGIN);
    } else if (pathname.startsWith('/api/attendance/check-in') || pathname.startsWith('/api/attendance/check-out')) {
      limitResult = checkRateLimit(`checkin_${ip}`, RATE_LIMIT_CONFIGS.BIOMETRIC_CHECKIN);
    } else {
      limitResult = checkRateLimit(`general_${ip}`, RATE_LIMIT_CONFIGS.GENERAL_API);
    }

    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'RATE_LIMIT', message: 'Too many requests from this IP. Please wait before trying again.' },
          timestamp: new Date().toISOString(),
        },
        { status: 429, headers: { 'Retry-After': String(limitResult.resetInSeconds) } }
      );
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    // IMPORTANT: Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Allow public routes
    if (
      pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/branches')
    ) {
      // If authenticated user tries to access /login, redirect to their role dashboard
      if (user && pathname === '/login') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .single();

        if (profile && (profile.is_active || profile.role === 'admin')) {
          if (profile.role === 'admin') return NextResponse.redirect(new URL('/admin', request.url));
          if (profile.role === 'branch_manager') return NextResponse.redirect(new URL('/branch-manager', request.url));
          return NextResponse.redirect(new URL('/employee', request.url));
        }
      }
      return supabaseResponse;
    }

    // If unauthenticated user tries to access any protected route, handle cleanly
    if (!user) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please provide valid credentials.' },
            timestamp: new Date().toISOString(),
          },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Enforce Role-Based Route Isolation (Spec P18)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.is_active === false && profile.role !== 'admin')) {
      // Account deactivated or missing profile -> force logout / login redirect
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'account_deactivated');
      return NextResponse.redirect(loginUrl);
    }

    // Role Guard for /admin/*
    if (pathname.startsWith('/admin') && profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Role Guard for /branch-manager/*
    if (pathname.startsWith('/branch-manager') && profile.role !== 'branch_manager' && profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Role Guard for /employee/*
    if (pathname.startsWith('/employee') && profile.role !== 'employee' && profile.role !== 'branch_manager' && profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    return supabaseResponse;
  } catch (err) {
    console.error('Edge middleware auth check error:', err);
    // If Supabase edge query flakes or throws, redirect unauthenticated access cleanly instead of crashing with 500 error
    if (!pathname.startsWith('/login') && !pathname.startsWith('/register') && !pathname.startsWith('/api/')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'session_error');
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }
}

