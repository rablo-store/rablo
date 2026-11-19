/**
 * RABLO — Home Page Constants & Limits
 * Extracted so client islands can use limit numbers without importing home.ts (which pulls in Supabase).
 */

export const HOME_LIMITS = {
  banners: 8,
  trendingProducts: 12,
  newArrivals: 8,
  trendingCreators: 8,
  trendingCategories: 4,
  allProductsPageSize: 8,
  allProductsMax: 48,
} as const;

