/**
 * RIJLO — Server-Side Auth Resolution Layer
 * Resolves Supabase user sessions and profiles from cookies during SSR
 * to eliminate Flash of Unauthenticated State (hydration flicker).
 */

import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ADMIN_EMAIL, type RabloProfile } from './supabase';

export interface InitialAuth {
  isLoggedIn: boolean;
  userEmail: string | null;
  isAdmin: boolean;
  fullName: string | null;
  avatarUrl?: string | null;
  isSeller?: boolean;
}

export interface ResolvedServerAuth {
  user: User | null;
  profile: RabloProfile | null;
  initialAuth: InitialAuth;
  supabase: SupabaseClient | null;
}

/**
 * Extracts raw auth token value from Cookie header, handling:
 * - Single cookie: sb-<ref>-auth-token=<val>
 * - Chunked cookies: sb-<ref>-auth-token.0=<val>, sb-<ref>-auth-token.1=<val>, etc.
 */
export function extractAuthCookieValue(cookieHeader: string): string | null {
  if (!cookieHeader) return null;

  // 1. Single cookie
  const singleMatch = cookieHeader.match(/sb-[^=]+-auth-token=(?:base64-)?([^;]+)/);
  if (singleMatch) {
    return singleMatch[1];
  }

  // 2. Chunked cookies: sb-*-auth-token.0, .1, etc.
  const chunks: string[] = [];
  let idx = 0;
  while (true) {
    const chunkRegex = new RegExp(`sb-[^=]+-auth-token\\.${idx}=(?:base64-)?([^;]+)`);
    const chunkMatch = cookieHeader.match(chunkRegex);
    if (!chunkMatch) break;
    chunks.push(chunkMatch[1]);
    idx++;
  }

  if (chunks.length > 0) {
    return chunks.join('');
  }

  return null;
}

/**
 * Resiliently parses cookie payload to extract user info without blocking on network.
 */
export function parseAuthCookiePayload(rawVal: string): {
  id?: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
} | null {
  try {
    let cleanVal = rawVal.trim();
    if (cleanVal.startsWith('base64-')) {
      cleanVal = cleanVal.slice(7);
    }
    let decoded = '';
    try {
      decoded = Buffer.from(decodeURIComponent(cleanVal), 'base64url').toString('utf8');
    } catch {
      decoded = Buffer.from(decodeURIComponent(cleanVal), 'base64').toString('utf8');
    }

    const parsed = JSON.parse(decoded);

    // Case 1: Direct user object inside session payload
    if (parsed?.user?.email) {
      return {
        id: parsed.user.id,
        email: parsed.user.email,
        fullName: parsed.user.user_metadata?.full_name || parsed.user.user_metadata?.name || null,
        avatarUrl: parsed.user.user_metadata?.avatar_url || null,
      };
    }

    // Case 2: Array of [access_token, refresh_token]
    const token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
    if (typeof token === 'string' && token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
        const jwtPayload = JSON.parse(payloadStr);
        if (jwtPayload?.email) {
          return {
            id: jwtPayload.sub,
            email: jwtPayload.email,
            fullName: jwtPayload.user_metadata?.full_name || jwtPayload.user_metadata?.name || null,
            avatarUrl: jwtPayload.user_metadata?.avatar_url || null,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves authentication state on the server from the request cookies.
 */
export async function resolveServerAuth(
  request: Request,
  cookies?: {
    set: (name: string, value: string, options?: any) => void;
  }
): Promise<ResolvedServerAuth> {
  const cookieHeader = request.headers.get('Cookie') ?? '';
  const rawCookieVal = extractAuthCookieValue(cookieHeader);

  // Default guest auth state
  const guestResult: ResolvedServerAuth = {
    user: null,
    profile: null,
    initialAuth: {
      isLoggedIn: false,
      userEmail: null,
      isAdmin: false,
      fullName: null,
      avatarUrl: null,
      isSeller: false,
    },
    supabase: null,
  };

  if (!rawCookieVal) {
    return guestResult;
  }

  // Resolve Supabase credentials safely across Node.js, Vite, and Cloudflare Workers
  let cfEnv: Record<string, string | undefined> = {};
  try {
    const cf = await import('cloudflare:workers');
    if (cf?.env) cfEnv = cf.env;
  } catch {}

  const supabaseUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
    cfEnv?.PUBLIC_SUPABASE_URL ||
    (typeof process !== 'undefined' ? process.env?.PUBLIC_SUPABASE_URL : '') ||
    '';

  const supabaseAnonKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_ANON_KEY) ||
    cfEnv?.PUBLIC_SUPABASE_ANON_KEY ||
    (typeof process !== 'undefined' ? process.env?.PUBLIC_SUPABASE_ANON_KEY : '') ||
    '';

  let supabase: SupabaseClient | null = null;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return parseCookieHeader(cookieHeader);
          },
          setAll(cookiesToSet) {
            if (cookies) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookies.set(name, value, options);
              });
            }
          },
        },
      });
    } catch (err) {
      console.warn('Failed to initialize server Supabase client:', err);
    }
  }

  let user: User | null = null;
  if (supabase) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      user = userData?.user ?? null;
    } catch {}
  }

  // Fallback to cookie decoding if getUser failed (e.g. offline, mock test, or network delay)
  const fallback = parseAuthCookiePayload(rawCookieVal);
  if (!user && fallback?.email) {
    user = {
      id: fallback.id || 'usr-temp',
      email: fallback.email,
      app_metadata: {},
      user_metadata: {
        full_name: fallback.fullName || '',
        avatar_url: fallback.avatarUrl || '',
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User;
  }

  if (!user) {
    return guestResult;
  }

  const email = (user.email ?? '').trim().toLowerCase();
  const isAdmin = email === ADMIN_EMAIL.trim().toLowerCase();

  // Attempt to fetch user profile
  let profile: RabloProfile | null = null;
  if (supabase && user.id) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        profile = {
          id: data.id,
          email: data.email || email,
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
          instagram_url: data.instagram_url || '',
          is_banned: data.is_banned || false,
          is_seller: data.is_seller || false,
          role: isAdmin ? 'admin' : (data.is_seller ? 'seller' : 'user'),
        };
      }
    } catch {}
  }

  const fullName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    fallback?.fullName ||
    null;

  const avatarUrl =
    profile?.avatar_url ||
    user.user_metadata?.avatar_url ||
    fallback?.avatarUrl ||
    null;

  const isSeller = profile?.is_seller === true;

  return {
    user,
    profile,
    initialAuth: {
      isLoggedIn: true,
      userEmail: email,
      isAdmin,
      fullName,
      avatarUrl,
      isSeller,
    },
    supabase,
  };
}
