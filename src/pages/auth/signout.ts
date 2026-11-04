import type { APIRoute } from 'astro';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';

export const prerender = false;

export const ALL: APIRoute = async (context) => {
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

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Rablo: Error during SSR signout:', e);
    }
  }

  // Defensively purge all auth-related cookies
  try {
    const cookieHeader = context.request.headers.get('Cookie') || '';
    const cookies = parseCookieHeader(cookieHeader);
    Object.keys(cookies).forEach((name) => {
      if (name.startsWith('sb-') || name.includes('auth') || name.includes('token')) {
        context.cookies.delete(name, { path: '/' });
      }
    });
  } catch {}

  // If request expects JSON, return confirmation
  const acceptHeader = context.request.headers.get('accept') || '';
  if (acceptHeader.includes('application/json')) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return context.redirect('/account?signed_out=1');
};
