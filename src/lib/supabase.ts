/**
 * RABLO — Supabase Client & Auth Layer
 * Single admin email, ban checking, role detection.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_ANON_KEY) || '';

export const ADMIN_EMAIL = 'sumitkatiyar783@gmail.com';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-id')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : null;



export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export type UserRole = 'admin' | 'seller' | 'user';

export interface RabloProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  instagram_url: string;
  is_banned: boolean;
  is_seller: boolean;
  role: UserRole;
}

/** Fetch the current user's profile from the profiles table */
export async function getCurrentProfile(): Promise<RabloProfile | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !data) {
      // Profile may not exist yet (trigger hasn't run), return fallback
      return {
        id: session.user.id,
        email: session.user.email || '',
        full_name: session.user.user_metadata?.full_name || '',
        avatar_url: session.user.user_metadata?.avatar_url || '',
        instagram_url: '',
        is_banned: false,
        is_seller: false,
        role: isAdminEmail(session.user.email) ? 'admin' : 'user',
      };
    }

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name || '',
      avatar_url: data.avatar_url || '',
      instagram_url: data.instagram_url || '',
      is_banned: data.is_banned || false,
      is_seller: data.is_seller || false,
      role: isAdminEmail(data.email) ? 'admin' : (data.is_seller ? 'seller' : 'user'),
    };
  } catch {
    return null;
  }
}

/** Check if a user is banned */
export async function checkBanStatus(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('is_banned')
      .eq('id', userId)
      .maybeSingle();
    return data?.is_banned === true;
  } catch {
    return false;
  }
}

/** Complete sign out: clears client storage, Supabase auth session, and SSR cookies */
export async function signOutUser(redirectTo: string = '/account?signed_out=1'): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
  } catch {}

  // Thoroughly clear localStorage auth keys
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.includes('auth') || k.includes('token') || k.includes('supabase'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}

  // Thoroughly clear sessionStorage
  try {
    sessionStorage.clear();
  } catch {}

  // Expire cookies on client side
  try {
    document.cookie.split(';').forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name.startsWith('sb-') || name.includes('auth') || name.includes('token')) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    });
  } catch {}

  // Call the server signout endpoint to clear SSR cookies and redirect
  window.location.href = `/auth/signout?next=${encodeURIComponent(redirectTo)}`;
}

