import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.CUMID_E2E === '1' ? 'dist-e2e' : 'dist');
const config = path.join(root, 'server/wrangler.json');

if (fs.existsSync(config)) {
  try {
    const raw = fs.readFileSync(config, 'utf8');
    const parsed = JSON.parse(raw);

    // Guarantee that all dynamic and SSR routes are routed to the Worker
    const requiredWorkerRoutes = [
      '/api/*',
      '/admin',
      '/admin/*',
      '/seller',
      '/seller/*',
      '/account',
      '/account/*',
      '/cart',
      '/cart/*',
      '/products/*',
      '/auth/*',
    ];

    parsed.assets = parsed.assets || {};
    parsed.assets.run_worker_first = requiredWorkerRoutes;
    parsed.assets.not_found_handling = 'none';

    fs.writeFileSync(config, JSON.stringify(parsed, null, 2), 'utf8');
    console.log('[postbuild] Synchronized dist/server/wrangler.json with complete SSR routes and fallback handling.');
  } catch (err) {
    console.warn('[postbuild] Warning patching wrangler.json:', err);
  }
  console.log('[postbuild] Rablo Cloudflare Worker and discovery assets successfully compiled.');
} else {
  console.log('[postbuild] Notice: server/wrangler.json not generated. Checking standard distribution output.');
}
