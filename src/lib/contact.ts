/**
 * RABLO — Contact Link Resolver & Sanitizer
 * Pure functions for resolving, sanitizing, and templating creator inquiry links.
 */

export const ALLOWED_CONTACT_HOSTS = [
  'instagram.com',
  'www.instagram.com',
  'ig.me',
  'wa.me',
  'api.whatsapp.com',
  't.me',
  'm.me',
] as const;

export type AllowedContactHost = typeof ALLOWED_CONTACT_HOSTS[number];

export type ContactType = 'instagram' | 'whatsapp' | 'custom';

export interface ContactContext {
  productName?: string;
  productUrl?: string;
  price?: number | string;
  brandName?: string;
}

export interface ResolvedContact {
  type: ContactType;
  url: string;
  message: string;
  prefillSupported: boolean;
}

export interface ResolveContactArgs {
  product?: {
    id?: string;
    name?: string;
    price?: number;
    product_ig_url?: string | null;
    contact_link?: string | null;
    seller_ig_url?: string | null;
  } | null;
  brandContact?: {
    contact_type?: ContactType;
    link_template?: string;
    message_template?: string | null;
  } | null;
  brand?: {
    name?: string;
    instagram_url?: string;
  } | null;
  sellerName?: string;
  sellerIgUrl?: string | null;
  origin?: string;
}

export const DEFAULT_CONTACT_MESSAGE =
  'Hi {brand_name}! I found "{product_name}" (₹{price}) on Rijlo and I\'m interested. {product_url}';

/**
 * Sanitizes and validates contact links against the strict allow-list.
 * Requirements:
 * - Protocol must be https:
 * - Host must be in ALLOWED_CONTACT_HOSTS
 * - No user credentials (user:pass@)
 * - No custom ports
 * - Max length <= 500 characters
 * - Rejects javascript: and data:
 */
export function sanitizeContactUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 500) return null;

  try {
    const parsed = new URL(trimmed);

    // Protocol must be https
    if (parsed.protocol !== 'https:') return null;

    // No user credentials
    if (parsed.username || parsed.password) return null;

    // No custom port
    if (parsed.port && parsed.port !== '443') return null;

    // Host check
    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_CONTACT_HOSTS.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );

    if (!isAllowed) return null;

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Builds the plain text message body by interpolating placeholders.
 */
export function buildMessage(
  template?: string | null,
  ctx?: ContactContext
): string {
  const tmpl =
    template && template.trim() ? template.trim() : DEFAULT_CONTACT_MESSAGE;

  const brandName = ctx?.brandName?.trim() || 'Creator';
  const productName = ctx?.productName?.trim() || 'this creation';
  const price =
    ctx?.price !== undefined && ctx.price !== null && ctx.price !== ''
      ? String(ctx.price)
      : 'Price on request';
  const productUrl = ctx?.productUrl?.trim() || '';

  return tmpl
    .replace(/\{brand_name\}/gi, brandName)
    .replace(/\{product_name\}/gi, productName)
    .replace(/\{price\}/gi, price)
    .replace(/\{product_url\}/gi, productUrl)
    .trim();
}

/**
 * Determines contact type from host name
 */
export function detectContactType(url: string): ContactType {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === 'wa.me' || hostname === 'api.whatsapp.com') {
      return 'whatsapp';
    }
    if (hostname === 'instagram.com' || hostname === 'www.instagram.com' || hostname === 'ig.me') {
      return 'instagram';
    }
    return 'custom';
  } catch {
    return 'custom';
  }
}

/**
 * Resolves contact target URL and prefilled message.
 * Resolution order:
 * 1. product.product_ig_url / product.contact_link (per-product override)
 * 2. brand_contacts.link_template
 * 3. seller's Instagram profile URL
 */
export function resolveContact(args: ResolveContactArgs): ResolvedContact | null {
  const origin =
    args.origin ||
    (typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://rablo.in');

  const productId = args.product?.id;
  const productUrl = productId ? `${origin}/products/${productId}` : origin;
  const productName = args.product?.name || '';
  const price = args.product?.price;
  const brandName = args.brand?.name || args.sellerName || 'Creator';

  const ctx: ContactContext = {
    productName,
    productUrl,
    price,
    brandName,
  };

  const message = buildMessage(args.brandContact?.message_template, ctx);

  let rawTemplate: string | null = null;
  let type: ContactType = 'instagram';

  // 1. Per-product override: product_ig_url or contact_link
  const productOverride = args.product?.product_ig_url || args.product?.contact_link;
  if (productOverride && productOverride.trim()) {
    const candidate = productOverride.trim().startsWith('http')
      ? productOverride.trim()
      : `https://${productOverride.trim()}`;
    const sanitized = sanitizeContactUrl(candidate);
    if (sanitized) {
      rawTemplate = sanitized;
      type = detectContactType(sanitized);
    }
  }

  // 2. Brand Contact template
  if (!rawTemplate && args.brandContact?.link_template) {
    const candidate = args.brandContact.link_template.trim().startsWith('http')
      ? args.brandContact.link_template.trim()
      : `https://${args.brandContact.link_template.trim()}`;
    rawTemplate = candidate;
    type = args.brandContact.contact_type || detectContactType(candidate);
  }

  // 3. Fallback: Seller / Brand Instagram profile URL
  if (!rawTemplate) {
    const fallbackIg =
      args.brand?.instagram_url ||
      args.product?.seller_ig_url ||
      args.sellerIgUrl ||
      'https://instagram.com/rijlo.in';

    let formatted = fallbackIg.trim();
    if (!formatted.startsWith('http')) {
      const cleanHandle = formatted.replace(/^@/, '');
      formatted = `https://instagram.com/${cleanHandle}`;
    }
    rawTemplate = formatted;
    type = 'instagram';
  }

  // Interpolate placeholders into the URL template
  let finalUrl = rawTemplate
    .replace(/\{brand_name\}/gi, encodeURIComponent(brandName))
    .replace(/\{product_name\}/gi, encodeURIComponent(productName))
    .replace(/\{price\}/gi, encodeURIComponent(price !== undefined ? String(price) : ''))
    .replace(/\{product_url\}/gi, encodeURIComponent(productUrl))
    .replace(/\{message\}/gi, encodeURIComponent(message));

  // WhatsApp prefill auto-append if {message} wasn't present in template
  const isWhatsApp = type === 'whatsapp' || detectContactType(finalUrl) === 'whatsapp';
  if (isWhatsApp) {
    type = 'whatsapp';
    try {
      const parsed = new URL(finalUrl);
      if (!parsed.searchParams.has('text')) {
        parsed.searchParams.set('text', message);
        finalUrl = parsed.toString();
      }
    } catch {}
  }

  const sanitized = sanitizeContactUrl(finalUrl);
  if (!sanitized) {
    return null;
  }

  return {
    type,
    url: sanitized,
    message,
    prefillSupported: isWhatsApp,
  };
}

/**
 * Returns human-friendly button label text for the resolved contact type
 */
export function getContactButtonLabel(type?: ContactType): string {
  switch (type) {
    case 'whatsapp':
      return 'Chat on WhatsApp';
    case 'instagram':
      return 'Contact on Instagram';
    case 'custom':
    default:
      return 'Contact creator';
  }
}

