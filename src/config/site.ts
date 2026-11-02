/**
 * RABLO — Central Site Configuration
 * Instagram Marketing & Discovery Catalog Platform
 */

export const SITE = {
  name: 'Rablo',
  tagline: 'Discover. Save. DM. Shop via Instagram.',
  description: 'Rablo is the discovery catalog for Instagram sellers. Browse handmade, unique products from insta-preneurs and connect directly via Instagram DMs.',
  canonicalUrl: 'https://rablo.store',
  market: 'India',
  currency: 'INR',
  currencySymbol: '₹',

  // Admin
  adminEmail: 'sumitkatiyar783@gmail.com',

  // Navigation
  navLinks: [
    { label: 'Shop', href: '/#shop' },
    { label: 'Our Story', href: '/#story' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Sell on Rablo', href: '/seller' },
  ],

  // Footer Navigation
  footerLinks: {
    discover: [
      { label: 'Shop Catalog', href: '/#shop' },
      { label: 'Our Story', href: '/#story' },
      { label: 'FAQ', href: '/#faq' },
      { label: 'Saved Lead Cart', href: '/cart' },
      { label: 'My Account', href: '/account' },
    ],
    sellers: [
      { label: 'Sell on Rablo', href: '/seller' },
      { label: 'Seller Dashboard', href: '/seller' },
      { label: 'Upload Product', href: '/seller/upload' },
    ],
    platform: [
      { label: 'Admin Portal', href: '/admin' },
    ],
  },
} as const;

export const ADMIN_EMAIL = 'sumitkatiyar783@gmail.com';
