import { defineMiddleware, sequence } from 'astro:middleware';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'sumitkatiyar783@gmail.com';

/**
 * RABLO Auth Middleware
 * - Protects /admin routes: only sumitkatiyar783@gmail.com
 * - Protects /seller routes: authenticated + not banned
 * - Checks ban status on all protected routes
 */
const authenticate = defineMiddleware(async (context, next) => {
  try {
    const { pathname } = context.url;

    const isAdminRoute = pathname.startsWith('/admin');
    const isSellerRoute = pathname.startsWith('/seller');

    // Only protect admin and seller routes at the middleware level
    if (!isAdminRoute && !isSellerRoute) {
      return next();
    }

    // Skip during prerendering
    if (context.isPrerendered) {
      return next();
    }

    // Resolve Supabase credentials
    const supabaseUrl =
      import.meta.env.PUBLIC_SUPABASE_URL ||
      (context.locals as any)?.runtime?.env?.PUBLIC_SUPABASE_URL ||
      (typeof process !== 'undefined' ? process.env?.PUBLIC_SUPABASE_URL : '') ||
      '';

    const supabaseAnonKey =
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
      (context.locals as any)?.runtime?.env?.PUBLIC_SUPABASE_ANON_KEY ||
      (typeof process !== 'undefined' ? process.env?.PUBLIC_SUPABASE_ANON_KEY : '') ||
      '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return context.redirect(`/account?redirect=${encodeURIComponent(pathname)}`);
    }

    // Initialize Supabase SSR client
    const supabase: SupabaseClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return parseCookieHeader(context.request.headers.get('Cookie') ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            context.cookies.set(name, value, options);
          });
        },
      },
    });

    // Verify the active session
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    // No session → redirect to login
    if (!user) {
      return context.redirect(`/account?redirect=${encodeURIComponent(pathname)}`);
    }

    const userEmail = (user.email ?? '').trim().toLowerCase();

    // Check ban status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_banned')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_banned === true) {
      // Revoke session for banned users
      await supabase.auth.signOut();
      return new Response(
        `<!DOCTYPE html><html><head><title>Banned | rablo</title><style>body{background:#0a0a0f;color:#fca5a5;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif;text-align:center;}.ban-box{max-width:400px;padding:3rem;border:1px solid rgba(239,68,68,0.3);border-radius:16px;background:rgba(239,68,68,0.08);}h1{font-size:1.5rem;margin-bottom:1rem;}p{font-size:0.875rem;color:#9ca3af;}</style></head><body><div class="ban-box"><h1>⛔ Account Banned</h1><p>Your account has been permanently suspended from rablo. If you believe this is an error, please contact the administrator.</p></div></body></html>`,
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Admin route protection: only the admin email
    if (isAdminRoute && userEmail !== ADMIN_EMAIL) {
      return context.redirect('/');
    }

    // Attach user and client to locals
    if (context.locals) {
      (context.locals as any).user = user;
      (context.locals as any).supabase = supabase;
    }

    return next();
  } catch (err) {
    console.error('Rablo middleware auth error:', err);
    return next();
  }
});

const securityHeaders = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.isPrerendered) return response;

  const headers = new Headers(response.headers);
  const { pathname } = context.url;

  const isPrivateRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/auth');

  if (isPrivateRoute) {
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');

  return new Response(response.body, { status: response.status, headers });
});

export const onRequest = sequence(securityHeaders, authenticate);
