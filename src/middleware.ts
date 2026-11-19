import { defineMiddleware, sequence } from 'astro:middleware';
import { ADMIN_EMAIL } from './lib/supabase';
import { resolveServerAuth } from './lib/server-auth';
import { createEdgeCacheKey, getEdgeCache } from './lib/edge-cache';

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
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api');

  const cookieHeader = context.request.headers.get('cookie') || '';
  const hasAuth = cookieHeader.includes('sb-') || context.request.headers.has('authorization');

  if (isPrivateRoute || hasAuth) {
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Vary', 'Cookie, Authorization, Accept-Encoding');
    if (isPrivateRoute) {
      headers.set('X-Robots-Tag', 'noindex, nofollow');
    }
  }

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');

  return new Response(response.body, { status: response.status, headers });
});

const edgeCache = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/catalog' ||
    pathname === '/categories' ||
    pathname === '/creators';

  // For non-public routes: if they are HTML pages, mark as BYPASS
  if (!isPublicRoute) {
    const isHtmlRoute = !pathname.includes('.') || pathname.endsWith('.html');
    if (isHtmlRoute) {
      const response = await next();
      const headers = new Headers(response.headers);
      headers.set('X-Edge-Cache', 'BYPASS');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return next();
  }

  const isGet = context.request.method === 'GET';
  const cookieHeader = context.request.headers.get('cookie') || '';
  const hasAuth = cookieHeader.includes('sb-') || context.request.headers.has('authorization');

  // Condition 1: Skipped upfront if authenticated or non-GET
  if (hasAuth || !isGet) {
    const response = await next();
    const headers = new Headers(response.headers);
    headers.set('X-Edge-Cache', 'BYPASS');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const cache = getEdgeCache();
  const cacheKey = createEdgeCacheKey(context.request.url);

  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Edge-Cache', 'HIT');
      headers.delete('Server-Timing');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    }

    const startTime = performance.now();
    const response = await next();
    const durationMs = Math.round(performance.now() - startTime);

    const cacheControl = response.headers.get('Cache-Control') || '';
    const isNoStore = cacheControl.includes('no-store') || cacheControl.includes('private');
    const isPublicCacheable = response.status === 200 && cacheControl.includes('public') && !isNoStore;

    const headers = new Headers(response.headers);

    if (isPublicCacheable) {
      headers.set('X-Edge-Cache', 'MISS');
      const pageTimings = response.headers.get('Server-Timing');
      const serverTiming = pageTimings ? `${pageTimings}, app;dur=${durationMs}` : `app;dur=${durationMs}`;
      headers.set('Server-Timing', serverTiming);

      const clonedForCache = response.clone();
      const responseToReturn = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

      // Store in cache without Server-Timing so cached responses don't retain the old generation duration
      const cacheHeaders = new Headers(headers);
      cacheHeaders.delete('Server-Timing');
      const responseToCache = new Response(clonedForCache.body, {
        status: response.status,
        statusText: response.statusText,
        headers: cacheHeaders,
      });

      const cfContext = (context.locals as any)?.cfContext;
      const waitUntil = typeof cfContext?.waitUntil === 'function' ? cfContext.waitUntil.bind(cfContext) : undefined;
      if (waitUntil) {
        waitUntil(cache.put(cacheKey, responseToCache));
      } else {
        await cache.put(cacheKey, responseToCache).catch((err) => {
          console.warn('Rijlo edge cache put failed:', err);
        });
      }

      return responseToReturn;
    } else {
      // Skipped because response has no-store, private, non-200, etc.
      headers.set('X-Edge-Cache', 'BYPASS');
      headers.delete('Server-Timing');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  } catch (err) {
    console.error('Rijlo edge cache error:', err);
    return next();
  }
});

export const onRequest = sequence(securityHeaders, edgeCache, authenticate);
