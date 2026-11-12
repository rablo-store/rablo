import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SHOWCASE_BRANDS } from '../lib/brands';
import { isDemoDataEnabled } from '../lib/products';

export const GET: APIRoute = async () => {
  const staticRoutes = [
    '',
    '/catalog',
    '/creators',
    '/seller',
    '/account',
  ];

  let brandRoutes: string[] = [];
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from('brands')
        .select('slug')
        .eq('approval_status', 'Approved');

      if (data && data.length > 0) {
        brandRoutes = data.map((b) => `/creators/${b.slug}`);
      }
    } catch {}
  }

  if (brandRoutes.length === 0 && isDemoDataEnabled()) {
    brandRoutes = SHOWCASE_BRANDS.map((b) => `/creators/${b.slug}`);
  }

  const allUrls = [...staticRoutes, ...brandRoutes];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (url) => `  <url>
    <loc>${SITE.canonicalUrl}${url}</loc>
    <changefreq>${url === '' || url === '/catalog' || url === '/creators' ? 'daily' : 'monthly'}</changefreq>
    <priority>${url === '' ? '1.0' : url.startsWith('/creators/') ? '0.7' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemapXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
