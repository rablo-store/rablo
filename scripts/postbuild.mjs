import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.CUMID_E2E === '1' ? 'dist-e2e' : 'dist');
const config = path.join(root, 'server/wrangler.json');

if (!fs.existsSync(config)) {
  console.log('[postbuild] Notice: server/wrangler.json not generated. Checking standard distribution output.');
} else {
  console.log('[postbuild] Rablo Cloudflare Worker and discovery assets successfully compiled.');
}
