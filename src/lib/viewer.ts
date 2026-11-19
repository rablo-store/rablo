/**
 * RIJLO — Viewer Role Source of Truth
 * Resolves current viewer role: 'loading' | 'guest' | 'user' | 'seller' | 'admin'
 * and brand status: 'Pending' | 'Approved' | 'Rejected' | null.
 * 
 * Rules:
 * - Guest: not logged in
 * - User: logged in, no brand, not admin (cannot list products)
 * - Seller: logged in with a brand in any status (Pending, Approved, Rejected) or profile.is_seller = true
 * - Admin: sumitkatiyar783@gmail.com (isAdminEmail)
 * 
 * Features:
 * - In-memory cache shared across Header, Mobile Drawer, and Footer.
 * - Reactive subscription via useViewer() hook.
 * - Cache invalidation on sign-in, sign-out, or auth state change.
 * - Safe defaults: never throws; on error, defaults to 'user' (seller-only items hidden).
 */

import { useState, useEffect } from 'react';
import { isAdminEmail } from './auth-constants';
import type { RabloProfile } from './supabase';
import type { Brand } from './brands';
import type { InitialAuth } from './server-auth';

export type ViewerRole = 'loading' | 'guest' | 'user' | 'seller' | 'admin';
export type BrandStatus = 'Pending' | 'Approved' | 'Rejected' | null;

export function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes('sb-');
}

export interface Viewer {
  role: ViewerRole;
  brandStatus: BrandStatus;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isSeller: boolean;
  isAdmin: boolean;
  hasBrand: boolean;
  brandName?: string | null;
}

export const LOADING_VIEWER: Viewer = {
  role: 'loading',
  brandStatus: null,
  userId: null,
  email: null,
  fullName: null,
  avatarUrl: null,
  isSeller: false,
  isAdmin: false,
  hasBrand: false,
};

export const GUEST_VIEWER: Viewer = {
  role: 'guest',
  brandStatus: null,
  userId: null,
  email: null,
  fullName: null,
  avatarUrl: null,
  isSeller: false,
  isAdmin: false,
  hasBrand: false,
};

/**
 * Returns true if the viewer is authorized to see "List a Product" entry points.
 * Explicitly false while role is 'loading'.
 */
export function canListProducts(viewer: Viewer | null | undefined): boolean {
  if (!viewer) return false;
  return viewer.role === 'seller' || viewer.role === 'admin';
}

/**
 * Returns true if the viewer is authorized to see Admin links.
 */
export function canSeeAdminLink(viewer: Viewer | null | undefined): boolean {
  if (!viewer) return false;
  return viewer.role === 'admin';
}

// Module-level cache & listeners
let cachedViewer: Viewer | null = null;
let inflightPromise: Promise<Viewer> | null = null;
const listeners = new Set<(viewer: Viewer) => void>();

function notifyListeners(viewer: Viewer) {
  cachedViewer = viewer;
  listeners.forEach((listener) => {
    try {
      listener(viewer);
    } catch (err) {
      console.warn('Rijlo: viewer listener error:', err);
    }
  });
}

/**
 * Clears the module-level viewer cache.
 */
export function clearViewerCache() {
  cachedViewer = null;
  inflightPromise = null;
}

/**
 * Synchronously derives a Viewer object from server-side InitialAuth if present.
 */
export function getViewerFromInitialAuth(initialAuth?: InitialAuth | null): Viewer | null {
  if (!initialAuth) return null;
  if (!initialAuth.isLoggedIn) return GUEST_VIEWER;

  if (initialAuth.isAdmin) {
    return {
      role: 'admin',
      brandStatus: null,
      userId: null,
      email: initialAuth.userEmail,
      fullName: initialAuth.fullName,
      avatarUrl: initialAuth.avatarUrl ?? null,
      isSeller: true,
      isAdmin: true,
      hasBrand: false,
    };
  }

  if (initialAuth.isSeller) {
    return {
      role: 'seller',
      brandStatus: null,
      userId: null,
      email: initialAuth.userEmail,
      fullName: initialAuth.fullName,
      avatarUrl: initialAuth.avatarUrl ?? null,
      isSeller: true,
      isAdmin: false,
      hasBrand: true,
    };
  }

  return {
    role: 'user',
    brandStatus: null,
    userId: null,
    email: initialAuth.userEmail,
    fullName: initialAuth.fullName,
    avatarUrl: initialAuth.avatarUrl ?? null,
    isSeller: false,
    isAdmin: false,
    hasBrand: false,
  };
}

/**
 * Resolves the current Viewer from Supabase session, brands, and profiles.
 * Safe default: never throws. On any error, defaults to 'user' with seller-only items hidden.
 */
export async function getViewer(forceRefresh = false): Promise<Viewer> {
  if (cachedViewer && !forceRefresh) {
    return cachedViewer;
  }

  // Fast guest exit: visitors with no sb- cookie are always guests
  if (typeof window !== 'undefined' && !hasSessionCookie()) {
    cachedViewer = GUEST_VIEWER;
    return GUEST_VIEWER;
  }

  if (inflightPromise && !forceRefresh) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const { supabase, isSupabaseConfigured, getCurrentProfile } = await import('./supabase');
      if (!isSupabaseConfigured || !supabase) {
        const fallback = GUEST_VIEWER;
        cachedViewer = fallback;
        return fallback;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        cachedViewer = GUEST_VIEWER;
        return GUEST_VIEWER;
      }

      const user = session.user;
      const email = user.email || '';
      const isAdmin = isAdminEmail(email);

      // Admin role
      if (isAdmin) {
        let brand: Brand | null = null;
        try {
          const { getMyBrand } = await import('./brands');
          brand = await getMyBrand();
        } catch {}

        const adminViewer: Viewer = {
          role: 'admin',
          brandStatus: brand?.approval_status ?? null,
          userId: user.id,
          email,
          fullName: user.user_metadata?.full_name || 'Admin',
          avatarUrl: user.user_metadata?.avatar_url || null,
          isSeller: true,
          isAdmin: true,
          hasBrand: Boolean(brand),
          brandName: brand?.name ?? null,
        };
        cachedViewer = adminViewer;
        return adminViewer;
      }

      // Non-admin user: check brand ownership and profile is_seller status
      let brand: Brand | null = null;
      let profile: RabloProfile | null = null;

      try {
        const { getMyBrand } = await import('./brands');
        const [b, p] = await Promise.all([
          getMyBrand(),
          getCurrentProfile(),
        ]);
        brand = b;
        profile = p;
      } catch (fetchErr) {
        console.warn('Rijlo: error fetching viewer brand/profile:', fetchErr);
      }

      const hasBrand = Boolean(brand);
      const isSeller = hasBrand || Boolean(profile?.is_seller);
      const brandStatus: BrandStatus = brand?.approval_status ?? null;

      const role: ViewerRole = isSeller ? 'seller' : 'user';

      const viewer: Viewer = {
        role,
        brandStatus,
        userId: user.id,
        email,
        fullName: profile?.full_name || user.user_metadata?.full_name || email.split('@')[0],
        avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || null,
        isSeller,
        isAdmin: false,
        hasBrand,
        brandName: brand?.name ?? null,
      };

      cachedViewer = viewer;
      return viewer;
    } catch (err) {
      console.warn('Rijlo: getViewer unexpected exception, falling back to safe user:', err);
      const safeFallback: Viewer = {
        role: 'user',
        brandStatus: null,
        userId: null,
        email: null,
        fullName: null,
        avatarUrl: null,
        isSeller: false,
        isAdmin: false,
        hasBrand: false,
      };
      cachedViewer = safeFallback;
      return safeFallback;
    } finally {
      inflightPromise = null;
    }
  })();

  const result = await inflightPromise;
  notifyListeners(result);
  return result;
}

// Supabase auth change listener to keep viewer cache fresh
let authListenerAttached = false;
export async function initViewerAuthListener() {
  if (authListenerAttached || typeof window === 'undefined') return;
  authListenerAttached = true;
  try {
    const { supabase, isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured && supabase) {
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          clearViewerCache();
          notifyListeners(GUEST_VIEWER);
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          clearViewerCache();
          await getViewer(true);
        }
      });
    }
  } catch {}
}

// Only attach listener eagerly if visitor has an active session cookie
if (typeof window !== 'undefined' && hasSessionCookie()) {
  initViewerAuthListener();
}

/**
 * React hook for consuming the current Viewer.
 * Seller-only items remain hidden while role is 'loading'.
 */
export function useViewer(initial?: Viewer | null): Viewer {
  const [viewer, setViewer] = useState<Viewer>(() => {
    if (initial) return initial;
    if (cachedViewer) return cachedViewer;
    if (typeof window !== 'undefined' && !hasSessionCookie()) return GUEST_VIEWER;
    return LOADING_VIEWER;
  });

  useEffect(() => {
    let isMounted = true;

    const handleUpdate = (updated: Viewer) => {
      if (isMounted) {
        setViewer(updated);
      }
    };

    listeners.add(handleUpdate);

    // If cache already has a resolved viewer, sync immediately
    if (cachedViewer && cachedViewer.role !== 'loading') {
      setViewer(cachedViewer);
    } else if (hasSessionCookie()) {
      getViewer().then((v) => {
        if (isMounted) setViewer(v);
      });
    } else {
      cachedViewer = GUEST_VIEWER;
      setViewer(GUEST_VIEWER);
    }

    return () => {
      isMounted = false;
      listeners.delete(handleUpdate);
    };
  }, []);

  return viewer;
}

