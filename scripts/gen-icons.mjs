import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync(new URL('../public', import.meta.url), { recursive: true });

// Bola de tênis sobre fundo verde de quadra
function svg(size, pad) {
  const c = size / 2;
  const r = (size / 2) - pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#3B2A8C"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="#F5DF3D"/>
  <path d="M ${c - r} ${c} A ${r * 1.35} ${r * 1.35} 0 0 1 ${c + r} ${c}" fill="none" stroke="#3B2A8C" stroke-width="${size * 0.045}" opacity="0.9"/>
  <path d="M ${c - r} ${c} A ${r * 1.35} ${r * 1.35} 0 0 0 ${c + r} ${c}" fill="none" stroke="#3B2A8C" stroke-width="${size * 0.045}" opacity="0.9"/>
</svg>`;
}

async function make(size, name, pad) {
  const out = new URL(`../public/${name}`, import.meta.url);
  await sharp(Buffer.from(svg(size, pad))).png().toFile(out.pathname);
  console.log('gerado', name);
}

await make(192, 'icon-192.png', 14);
await make(512, 'icon-512.png', 38);
await make(512, 'icon-maskable.png', 70); // safe zone para maskable
await make(180, 'apple-touch-icon.png', 0);
