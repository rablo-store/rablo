import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function securityHeaders() {
  return {
    name: 'cumid-security-headers',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        try {
          const root = fileURLToPath(dir);
          const file = join(root, '_headers');
          const template = await readFile(file, 'utf8');
          // Clean up any residual __SCRIPT_HASHES__ token safely
          const updated = template.replace(/\s*__SCRIPT_HASHES__\s*/g, ' ');
          await writeFile(file, updated);
        } catch {
          // Ignore if _headers not found
        }
      },
    },
  };
}
