import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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

    // If unauthenticated user tries to access any protected route, redirect to /login
    if (!user) {
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
