/**
 * RIJLO — Auth Constants & Lightweight Helpers
 * Separated from supabase.ts so modules can check admin status without pulling
 * in @supabase/ssr and client dependencies.
 */

export const ADMIN_EMAIL = 'sumitkatiyar783@gmail.com';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

