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
      { label: 'My Account', href: '/account' },
    ],
    sellers: [
      { label: 'Become a Creator', href: '/seller' },
      { label: 'Creator Dashboard', href: '/seller' },
      { label: 'List Your Creations', href: '/seller/upload' },
    ],
    platform: [
      { label: 'Admin Moderation', href: '/admin' },
      { label: 'FAQ', href: '/#faq' },
      { label: 'Our Story', href: '/#story' },
    ],
  },
} as const;

export const ADMIN_EMAIL = 'sumitkatiyar783@gmail.com';
