/**
 * RABLO — useContactAction Hook & Action Handler
 * Unified contact resolution and dispatch for "Contact / Chat / DM" actions.
 * - At click time, checks supabase.auth.getSession().
 * - If logged out: opens AuthModal via openInstagramAuthModal.
 * - If logged in: fetches brand contact, resolves templated URL & message,
 *   copies message to clipboard for Instagram, and opens the link in a new tab.
 */

import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { openInstagramAuthModal } from '../components/islands/AuthModal';
import {
  resolveContact,
  sanitizeContactUrl,
  getContactButtonLabel,
  type ResolvedContact,
} from './contact';
import { getBrandContact, type Brand } from './brands';
import type { Product } from './products';
import { getSafeInquiryUrl } from './instagram';

export interface ContactActionParams {
  product?: Product | null;
  brand?: Brand | null;
  sellerName?: string;
  sellerIgUrl?: string | null;
  fallbackUrl?: string | null;
  onToast?: (message: string) => void;
}

export interface ContactActionResult {
  success: boolean;
  status: 'auth_required' | 'opened' | 'error';
  url?: string;
  contact?: ResolvedContact | null;
  error?: string;
}

/**
 * Pure async action handler callable from anywhere
 */
export async function executeContactAction(
  params: ContactActionParams
): Promise<ContactActionResult> {
  const {
    product,
    brand,
    sellerName,
    sellerIgUrl,
    fallbackUrl,
    onToast,
  } = params;

  let session = null;
  if (isSupabaseConfigured && supabase) {
    try {
      const res = await supabase.auth.getSession();
      session = res.data.session;
    } catch (err) {
      console.warn('Rablo: Session check failed during contact action:', err);
    }
  }

  const creatorName =
    brand?.name ||
    product?.seller?.full_name ||
    sellerName ||
    'Verified Creator';

  // If logged out: trigger AuthModal with resolved or sanitized URL
  if (!session?.user) {
    const rawTarget =
      fallbackUrl ||
      product?.contact_link ||
      product?.product_ig_url ||
      product?.seller_ig_url ||
      sellerIgUrl ||
      brand?.instagram_url ||
      'https://instagram.com/rablo.in';

    const cleanTarget =
      sanitizeContactUrl(rawTarget) ||
      getSafeInquiryUrl(rawTarget) ||
      'https://instagram.com';

    openInstagramAuthModal({
      targetUrl: cleanTarget,
      creatorName,
      productName: product?.name,
    });

    return {
      success: false,
      status: 'auth_required',
      url: cleanTarget,
    };
  }

  // If logged in: fetch brand contact if brand_id exists
  try {
    const brandId = product?.brand_id || brand?.id;
    let brandContact = null;
    if (brandId) {
      try {
        brandContact = await getBrandContact(brandId);
      } catch {}
    }

    const resolved = resolveContact({
      product,
      brand,
      brandContact,
      sellerName,
      sellerIgUrl: fallbackUrl || sellerIgUrl,
    });

    if (!resolved) {
      const rawFallback = fallbackUrl || product?.seller_ig_url || 'https://instagram.com';
      const safe = sanitizeContactUrl(rawFallback) || 'https://instagram.com';
      window.open(safe, '_blank', 'noopener,noreferrer');
      return { success: true, status: 'opened', url: safe };
    }

    // Instagram cannot reliably prefill DMs from links: copy message to clipboard
    if (resolved.type === 'instagram' && resolved.message) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(resolved.message);
          const toastMsg = 'Message copied — paste it in the chat';
          onToast?.(toastMsg);
          window.dispatchEvent(
            new CustomEvent('rablo:toast', { detail: { message: toastMsg } })
          );
        }
      } catch (clipErr) {
        console.warn('Rablo: Clipboard copy notification warning:', clipErr);
      }
    }

    window.open(resolved.url, '_blank', 'noopener,noreferrer');

    return {
      success: true,
      status: 'opened',
      url: resolved.url,
      contact: resolved,
    };
  } catch (err: any) {
    console.error('Rablo: Failed to execute contact action:', err);
    return {
      success: false,
      status: 'error',
      error: err?.message || 'Failed to open contact chat',
    };
  }
}

/**
 * React hook wrapper for contact buttons
 */
export function useContactAction() {
  const [loading, setLoading] = useState(false);

  const handleContact = useCallback(
    async (params: ContactActionParams) => {
      setLoading(true);
      try {
        return await executeContactAction(params);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    handleContact,
    loading,
    getContactButtonLabel,
  };
}
