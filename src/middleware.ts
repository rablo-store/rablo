import { defineMiddleware, sequence } from 'astro:middleware';
import { ADMIN_EMAIL } from './lib/supabase';
import { resolveServerAuth } from './lib/server-auth';

/**
 * RIJLO Auth Middleware
 * - Resolves Supabase user session on the server for all requests
 * - Populates context.locals.user, context.locals.profile, context.locals.initialAuth, context.locals.supabase
 * - Protects /admin routes: only sumitkatiyar783@gmail.com
 * - Protects /seller routes: authenticated + not banned
 * - Checks ban status on protected and authenticated routes
 */
const authenticate = defineMiddleware(async (context, next) => {
  try {
    const { pathname } = context.url;

    // Skip during prerendering
    if (context.isPrerendered) {
      return next();
    }

    const isAdminRoute = pathname.startsWith('/admin');
    const isSellerRoute = pathname.startsWith('/seller');

    // Resolve Supabase user session from cookies on the server
    const authResult = await resolveServerAuth(
      context.request,
      context.cookies
    );

    // Attach resolved auth state to context.locals for pages and components (BaseLayout, Header, etc.)
    if (context.locals) {
      context.locals.user = authResult.user;
      context.locals.profile = authResult.profile;
      context.locals.initialAuth = authResult.initialAuth;
      context.locals.supabase = authResult.supabase;
    }

    const user = authResult.user;
    const profile = authResult.profile;

    // Route Protection: Admin & Seller routes require authentication
    if (isAdminRoute || isSellerRoute) {
      // No active session → redirect to login with return path
      if (!user) {
        return context.redirect(`/account?redirect=${encodeURIComponent(pathname)}`);
      }

      // Check ban status
      if (profile?.is_banned === true) {
        if (authResult.supabase) {
          await authResult.supabase.auth.signOut().catch(() => {});
        }
        return new Response(
          `<!DOCTYPE html><html><head><title>Banned | Rijlo</title><style>body{background:#0a0a0f;color:#fca5a5;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif;text-align:center;}.ban-box{max-width:400px;padding:3rem;border:1px solid rgba(239,68,68,0.3);border-radius:16px;background:rgba(239,68,68,0.08);}h1{font-size:1.5rem;margin-bottom:1rem;}p{font-size:0.875rem;color:#9ca3af;}</style></head><body><div class="ban-box"><h1>⛔ Account Banned</h1><p>Your account has been permanently suspended from Rijlo. If you believe this is an error, please contact the administrator.</p></div></body></html>`,
          { status: 403, headers: { 'Content-Type': 'text/html' } }
        );
      }

      // Admin route protection: only the admin email
      const userEmail = (user.email ?? '').trim().toLowerCase();
      if (isAdminRoute && userEmail !== ADMIN_EMAIL.trim().toLowerCase()) {
        return context.redirect('/');
      }
    }

    return next();
  } catch (err) {
    console.error('Rijlo middleware auth error:', err);
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
