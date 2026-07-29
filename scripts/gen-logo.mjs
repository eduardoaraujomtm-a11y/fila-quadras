import sharp from 'sharp';

const SRC = '/Users/dudababi/Desktop/fila-quadras/public/LOGO OFICIAL 100 ANOS.ai.png';
const OUT = '/Users/dudababi/Desktop/fila-quadras/public/logo-lira.png';

// 1) recorta as bordas brancas
const trimmed = await sharp(SRC).trim({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { data, info } = trimmed;
const { width, height, channels } = info;

// 2) branco (fundo) -> transparente
for (let i = 0; i < data.length; i += channels) {
  if (data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242) data[i + 3] = 0;
}

// 3) reescreve como PNG transparente, largura máx 1000px
await sharp(data, { raw: { width, height, channels } })
  .resize({ width: 1000, withoutEnlargement: true })
  .png()
  .toFile(OUT);

console.log('logo gerada:', OUT, `(${width}x${height} recortado)`);
