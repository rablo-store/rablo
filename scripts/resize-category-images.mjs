import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const categoriesDir = path.resolve('public/categories');
const rawDir = path.resolve('raw_categories');

if (!fs.existsSync(rawDir)) {
  fs.mkdirSync(rawDir, { recursive: true });
}

const files = fs.readdirSync(categoriesDir).filter((f) => f.endsWith('.webp'));

console.log(`Found ${files.length} category WebP images to process.\n`);
console.log('File Name | Original Dimensions | Original Size | New Dimensions | New Size | Reduction');
console.log('---|---|---|---|---|---');

for (const file of files) {
  const currentPath = path.join(categoriesDir, file);
  const rawPath = path.join(rawDir, file);

  // If raw backup does not exist yet, backup current original
  if (!fs.existsSync(rawPath)) {
    fs.copyFileSync(currentPath, rawPath);
  }

  // Always read from the raw/original backup so resizing is idempotent
  const inputBuffer = fs.readFileSync(rawPath);
  const originalMeta = await sharp(inputBuffer).metadata();
  const originalSize = inputBuffer.length;

  // Resize to 480x480 square WebP at quality ~80
  const outputBuffer = await sharp(inputBuffer)
    .resize(480, 480, {
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: 80 })
    .toBuffer();

  fs.writeFileSync(currentPath, outputBuffer);

  const newMeta = await sharp(outputBuffer).metadata();
  const newSize = outputBuffer.length;
  const reductionPct = (((originalSize - newSize) / originalSize) * 100).toFixed(1);

  console.log(
    `${file} | ${originalMeta.width}x${originalMeta.height} | ${(originalSize / 1024).toFixed(1)} KiB | ${newMeta.width}x${newMeta.height} | ${(newSize / 1024).toFixed(1)} KiB | -${reductionPct}%`
  );
}

console.log('\nCategory image resizing complete.');

