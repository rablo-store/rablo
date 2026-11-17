/**
 * RIJLO — Central Site Configuration
 * Instagram Marketing & Discovery Catalog Platform
 */

export const SITE = {
  name: 'Rijlo',
  tagline: 'Discover. Save. DM. Shop via Instagram.',
  description: 'Rijlo is the discovery catalog for Instagram sellers. Browse handmade, unique products from insta-preneurs and connect directly via Instagram DMs.',
  canonicalUrl: 'https://rijlo.store',
  market: 'India',
  currency: 'INR',
  currencySymbol: '₹',

  // Admin
  adminEmail: 'sumitkatiyar783@gmail.com',

  // Navigation
  navLinks: [
    { label: 'Discover', href: '/catalog' },
    { label: 'Creators', href: '/creators' },
    { label: 'Categories', href: '/categories' },
  ],

  // Footer Navigation
  footerLinks: {
    discover: [
      { label: 'All Products', href: '/catalog' },
      { label: 'Explore Creators', href: '/creators' },
      { label: 'Shop by Category', href: '/categories' },
      { label: 'Your Lead Cart', href: '/cart' },
    ],
    creators: [
      { label: 'Become a Creator', href: '/seller' },
      { label: 'Sign in / Account', href: '/account' },
    ],
    sellerCreators: [
      { label: 'Creator Dashboard', href: '/seller' },
      { label: 'List a Product', href: '/seller/upload' },
      { label: 'Sign in / Account', href: '/account' },
    ],
    platform: [
      { label: 'Our Story', href: '/our-story' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
} as const;

export const ADMIN_EMAIL = 'sumitkatiyar783@gmail.com';

/**
 * Official Rablo Instagram Handle for seller verification DMs (e.g. 'rablo.in' or 'rijlo.store')
 * Empty placeholder until configured. When empty, the "Send us a DM" option is disabled.
 */
export const RABLO_INSTAGRAM_HANDLE = 'rijlo.store';
