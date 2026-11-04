/**
 * RABLO — Instagram Account Normalization & Ownership Validation
 * Enforces that one Instagram account can only be used by one email address.
 */

import { supabase, isSupabaseConfigured } from './supabase';

/** Normalizes any Instagram URL or handle into a clean lowercase username (without @ or slashes) */
export function normalizeInstagramUsername(input?: string | null): string {
  if (!input) return '';
  let s = input.trim().toLowerCase();
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/\/+$/, '');

  // Match URL pattern: https://instagram.com/username
  const urlMatch = s.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
  if (urlMatch && urlMatch[1]) {
    const handle = urlMatch[1].replace(/^@/, '');
    if (['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts'].includes(handle)) {
      return '';
    }
    return handle;
  }

  // Match raw handle or @handle
  const clean = s.replace(/^@/, '');
  const handleMatch = clean.match(/^[a-z0-9._]+$/);
  return handleMatch ? clean : '';
}

/** Formats an Instagram URL into canonical https://instagram.com/username format */
export function canonicalizeInstagramUrl(input?: string | null): string {
  const handle = normalizeInstagramUsername(input);
  if (!handle) return input?.trim() || '';
  return `https://instagram.com/${handle}`;
}

/** Masks email for privacy (e.g. j***e@gmail.com) */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'another user';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

/**
 * Validates that an Instagram account is not already registered or used by another email.
 * One Instagram account can only be linked to one email address.
 */
export async function validateInstagramOwnership(
  instagramInput: string,
  currentUserId?: string,
  currentUserEmail?: string
): Promise<{ isAvailable: boolean; conflictEmail?: string; error?: string; normalizedHandle?: string }> {
  const targetHandle = normalizeInstagramUsername(instagramInput);

  if (!targetHandle) {
    return {
      isAvailable: false,
      error: 'Please enter a valid Instagram profile URL or handle (e.g. @your_handle or https://instagram.com/your_handle).',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { isAvailable: true, normalizedHandle: targetHandle };
  }

  try {
    const normalizedUserEmail = currentUserEmail?.trim().toLowerCase();

    // 1. Check all profiles with an instagram_url
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, instagram_url')
      .not('instagram_url', 'is', null);

    if (profileErr) {
      console.warn('Rablo: Error querying profiles for instagram validation:', profileErr);
    }

    if (profiles && profiles.length > 0) {
      for (const p of profiles) {
        // Skip current user's profile by ID or email
        if (currentUserId && p.id === currentUserId) continue;
        if (normalizedUserEmail && p.email && p.email.toLowerCase() === normalizedUserEmail) continue;

        const pHandle = normalizeInstagramUsername(p.instagram_url);
        if (pHandle && pHandle === targetHandle) {
          const masked = p.email ? maskEmail(p.email) : 'another account';
          return {
            isAvailable: false,
            conflictEmail: p.email,
            normalizedHandle: targetHandle,
            error: `This Instagram account (@${targetHandle}) is already linked to ${masked}. Each Instagram account can only be used by one email address.`,
          };
        }
      }
    }

    // 2. Defensively check products to prevent using an Instagram URL linked to another seller
    const { data: products } = await supabase
      .from('products')
      .select('seller_id, seller_ig_url, seller:profiles(email)')
      .not('seller_ig_url', 'is', null)
      .limit(200);

    if (products && products.length > 0) {
      for (const prod of products) {
        if (currentUserId && prod.seller_id === currentUserId) continue;

        const prodHandle = normalizeInstagramUsername(prod.seller_ig_url);
        if (prodHandle && prodHandle === targetHandle) {
          const sellerEmail = (prod.seller as any)?.email;
          if (normalizedUserEmail && sellerEmail && sellerEmail.toLowerCase() === normalizedUserEmail) {
            continue;
          }
          const masked = sellerEmail ? maskEmail(sellerEmail) : 'another seller';
          return {
            isAvailable: false,
            conflictEmail: sellerEmail,
            normalizedHandle: targetHandle,
            error: `This Instagram account (@${targetHandle}) is already linked to another email (${masked}). Each Instagram account can only be used by one email address.`,
          };
        }
      }
    }

    return { isAvailable: true, normalizedHandle: targetHandle };
  } catch (err: any) {
    console.error('Rablo: validateInstagramOwnership exception:', err);
    return { isAvailable: true, normalizedHandle: targetHandle };
  }
}
