import type { APIRoute } from 'astro';
import { SITE } from '../config/site';

export const GET: APIRoute = async () => {
  const staticRoutes = [
    '',
    '/catalog',
    '/seller',
    '/account',
  ];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticRoutes
  .map(
    (url) => `  <url>
    <loc>${SITE.canonicalUrl}${url}</loc>
    <changefreq>${url === '' || url === '/catalog' ? 'daily' : 'monthly'}</changefreq>
    <priority>${url === '' ? '1.0' : '0.8'}</priority>
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
