/**
 * Generates QR PNGs for the workshop tools in EN/SV/EL into ./qr.
 * Run:  npm i qrcode --no-save  &&  node docs/workshop/materials/gen-qr.js
 * (qrcode is only needed locally to regenerate the images.)
 */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const outDir = path.join(__dirname, 'qr');
fs.mkdirSync(outDir, { recursive: true });

const BASE = 'https://magkosm.github.io/orbarch-edu';
const LANGS = ['en', 'sv', 'el'];
const TOOLS = [
  ['reaction-default', '/reaction-default'],
  ['matb-2min', '/2min'],
  ['condition-lab', '/condition-lab'],
  ['simulator', '/simulator'],
  ['blueprint', '/blueprint'],
  ['model-lab', '/model-lab'],
  ['hub', '/']
];

(async () => {
  for (const lang of LANGS) {
    for (const [key, p] of TOOLS) {
      const url = `${BASE}${p}?lng=${lang}`;
      const file = path.join(outDir, `${key}-${lang}.png`);
      await QRCode.toFile(file, url, { width: 600, margin: 2, errorCorrectionLevel: 'M' });
      console.log('wrote', path.relative(process.cwd(), file));
    }
  }
})();
