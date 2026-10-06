/* eslint-disable no-console */
/**
 * capture_screenshots.js — automated screenshots for the educator guides.
 *
 * Serves the production build (./build) on http://127.0.0.1:5174/orbarch-edu with an
 * SPA fallback, drives headless Chrome through puppeteer-core and writes PNGs to
 * public/educators/screenshots/<lang>/<name>.png for each language.
 *
 * How to run (puppeteer-core is NOT a repo dependency; install it in a temp dir):
 *   npm run build                                  # fresh ./build first
 *   mkdir -p /tmp/shots && cd /tmp/shots && npm init -y && npm i puppeteer-core
 *   PUPPETEER_DIR=/tmp/shots node <repo>/scripts/educators/capture_screenshots.js
 *
 * Env vars:
 *   PUPPETEER_DIR  dir whose node_modules holds puppeteer-core (or put it in NODE_PATH)
 *   CHROME_PATH    Chrome executable (default: /Applications/Google Chrome.app/... on macOS)
 *   LANGS          comma list to restrict languages, e.g. LANGS=sv (default en,sv,el)
 *   ONLY           comma list of capture names to restrict, e.g. ONLY=hub,matb-run
 *   PORT           static server port (default 5174)
 *   RESULT_JSON    optional path to write a JSON summary of produced/failed captures
 *
 * The script is cwd-independent: the repo root is resolved from __dirname.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
if (process.env.PUPPETEER_DIR) {
  const extra = path.join(process.env.PUPPETEER_DIR, 'node_modules');
  process.env.NODE_PATH = [extra, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require('module').Module._initPaths();
}
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  console.error('puppeteer-core not found. Install it in a temp dir and set PUPPETEER_DIR (see header).');
  process.exit(1);
}

const BUILD = path.join(REPO, 'build');
const OUT_ROOT = path.join(REPO, 'public', 'educators', 'screenshots');
const PREFIX = '/orbarch-edu';
const PORT = Number(process.env.PORT) || 5174;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LANGS = (process.env.LANGS || 'en,sv,el').split(',');
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json',
  '.txt': 'text/plain', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (!urlPath.startsWith(PREFIX)) { res.writeHead(302, { Location: PREFIX + '/' }); return res.end(); }
    let rel = urlPath.slice(PREFIX.length) || '/';
    let file = path.join(BUILD, rel);
    if (!file.startsWith(BUILD)) { res.writeHead(403); return res.end(); }
    let stat = null;
    try { stat = fs.statSync(file); } catch (e) { /* missing */ }
    if (!stat || stat.isDirectory()) file = path.join(BUILD, 'index.html');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (route, lang) => `http://127.0.0.1:${PORT}${PREFIX}${route}?lng=${lang}`;

function loadLabels(lang) {
  const t = require(path.join(REPO, 'src', 'locales', lang, 'translation.json'));
  const g = (p) => p.split('.').reduce((o, k) => (o ? o[k] : undefined), t);
  return {
    presets: g('mainMenu.presets'), custom: g('mainMenu.customMode'), scoreboard: g('mainMenu.scoreboard'),
    ready: g('instructionsOverlay.ready'), gameOver: g('gameOver.title'),
    rtStart: g('reactionTest.startTest'), rtResults: g('reactionTest.results'),
    nbStart: g('nbackTest.startTest'), nbResults: g('nbackTest.results'),
    loadScenario: g('blueprint.loadScenario'), showMap: g('modelLab.showMap'),
  };
}

// --- in-page helpers -------------------------------------------------------
async function clickButton(page, label, { exact = false } = {}) {
  const ok = await page.evaluate((label, exact) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const btns = Array.from(document.querySelectorAll('button'));
    let el = btns.find((b) => norm(b.textContent) === norm(label));
    if (!el && !exact) el = btns.find((b) => norm(b.textContent).includes(norm(label)));
    if (!el && !exact) {
      const low = norm(label).toLowerCase();
      el = btns.find((b) => norm(b.textContent).toLowerCase().includes(low));
    }
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, label, exact);
  if (!ok) throw new Error(`button not found: "${label}"`);
}

async function waitForText(page, text, maxMs, pollMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const found = await page.evaluate((text) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const needle = norm(text);
      const els = document.querySelectorAll('h1,h2,h3,h4,div,span,p');
      for (const el of els) if (el.children.length === 0 && norm(el.textContent).includes(needle)) return true;
      return norm(document.body.innerText).includes(needle);
    }, text);
    if (found) return true;
    await sleep(pollMs);
  }
  return false;
}

const findRedStimulus = () => {
  const divs = document.querySelectorAll('div');
  for (const d of divs) {
    const cs = getComputedStyle(d);
    if (cs.backgroundColor === 'rgb(255, 0, 0)') {
      const r = d.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }
  return null;
};

// --- capture plan -----------------------------------------------------------
function plan(L) {
  const overlayPair = (base, route, settleAfter) => ([
    { name: `${base}-overlay`, route, steps: [{ settle: 3000 }] },
    { name: base, route, steps: [{ settle: 3000 }, { click: L.ready }, { settle: settleAfter }] },
  ]);
  return [
    { name: 'hub', route: '/', steps: [{ settle: 2000 }] },
    { name: 'hub-presets', route: '/', steps: [{ settle: 2000 }, { click: L.presets }, { settle: 1000 }] },
    { name: 'hub-custom', route: '/', steps: [{ settle: 2000 }, { click: L.custom }, { settle: 1000 }] },
    { name: 'hub-history', route: '/', steps: [{ settle: 2000 }, { click: L.scoreboard }, { settle: 1000 }] },
    ...overlayPair('training-monitoring', '/monitoring', 6000),
    ...overlayPair('training-tracking', '/tracking', 6000),
    ...overlayPair('training-comms', '/comms', 6000),
    ...overlayPair('training-resource', '/resource', 6000),
    { name: 'matb-overlay', route: '/2min', steps: [{ settle: 3000 }] },
    { name: 'matb-run', route: '/2min', steps: [{ settle: 3000 }, { click: L.ready }, { settle: 10000 }] },
    { name: 'matb-end', route: '/2min', steps: [{ settle: 3000 }, { click: L.ready }, { waitText: L.gameOver, max: 150000 }, { settle: 2000 }] },
    { name: 'reaction-start', route: '/reaction-default', steps: [{ settle: 2000 }] },
    { name: 'reaction-run', route: '/reaction-default', steps: [{ settle: 2000 }, { click: L.rtStart }, { waitStimulus: 15000 }] },
    { name: 'reaction-results', route: '/reaction-default', steps: [{ settle: 2000 }, { click: L.rtStart }, { autoRespond: { until: L.rtResults, max: 120000 } }, { settle: 1000 }] },
    { name: 'reaction-config', route: '/reaction', steps: [{ settle: 2000 }] },
    { name: 'nback-config', route: '/nback', steps: [{ settle: 2000 }] },
    { name: 'nback-start', route: '/nbackdefault', steps: [{ settle: 2000 }] },
    { name: 'nback-run', route: '/nbackdefault', steps: [{ settle: 2000 }, { click: L.nbStart }, { settle: 8000 }] },
    { name: 'nback-results', route: '/nbackdefault', steps: [{ settle: 2000 }, { click: L.nbStart }, { waitText: L.nbResults, max: 120000 }, { settle: 1000 }] },
    { name: 'condition-lab', route: '/condition-lab', steps: [{ settle: 2000 }] },
    { name: 'condition-lab-result', route: '/condition-lab', steps: [{ settle: 2000 }, { typeNumbers: ['9000', '8100'] }, { settle: 1000 }] },
    { name: 'simulator', route: '/simulator', steps: [{ settle: 2000 }] },
    { name: 'blueprint', route: '/blueprint', steps: [{ settle: 2000 }] },
    { name: 'blueprint-scenario', route: '/blueprint', steps: [{ settle: 2000 }, { click: L.loadScenario }, { settle: 1000 }] },
    { name: 'model-lab', route: '/model-lab', steps: [{ settle: 2000 }] },
    { name: 'model-lab-map', route: '/model-lab', steps: [{ settle: 2000 }, { click: L.showMap }, { settle: 1000 }] },
    // phone
    { name: 'hub-phone', route: '/', phone: 'portrait', steps: [{ settle: 2000 }] },
    { name: 'condition-lab-phone', route: '/condition-lab', phone: 'portrait', steps: [{ settle: 2000 }] },
    { name: 'blueprint-phone', route: '/blueprint', phone: 'portrait', steps: [{ settle: 2000 }] },
    { name: 'reaction-start-phone', route: '/reaction-default', phone: 'portrait', steps: [{ settle: 2000 }] },
    { name: 'matb-run-phone', route: '/2min', phone: 'landscape', steps: [{ settle: 3000 }, { click: L.ready }, { settle: 10000 }] },
  ];
}

async function runStep(page, step, log) {
  if (step.settle) { await sleep(step.settle); return; }
  if (step.click) { await clickButton(page, step.click); log(`clicked "${step.click}"`); return; }
  if (step.waitText) {
    const ok = await waitForText(page, step.waitText, step.max);
    if (!ok) throw new Error(`text "${step.waitText}" not found within ${step.max}ms`);
    log(`text "${step.waitText}" appeared`); return;
  }
  if (step.waitStimulus) {
    const start = Date.now(); let found = false;
    while (Date.now() - start < step.waitStimulus) {
      if (await page.evaluate(findRedStimulus)) { found = true; break; }
      await sleep(50);
    }
    log(found ? 'red stimulus visible' : 'WARN: red stimulus not seen within timeout, capturing anyway');
    return;
  }
  if (step.autoRespond) {
    // Realistic responder: when the red dot appears wait ~220 ms (a human-like RT),
    // click its centre once, then wait for it to disappear before polling again.
    const { until, max } = step.autoRespond;
    const start = Date.now(); let clicks = 0; let lastCheck = 0;
    while (Date.now() - start < max) {
      const pos = await page.evaluate(findRedStimulus);
      if (pos) {
        await sleep(220);
        if (await page.evaluate(findRedStimulus)) {
          await page.mouse.click(pos.x, pos.y); clicks++;
        }
        const gone = Date.now();
        while (Date.now() - gone < 5000 && (await page.evaluate(findRedStimulus))) await sleep(40);
        continue;
      }
      if (Date.now() - lastCheck > 1000) {
        lastCheck = Date.now();
        if (await waitForText(page, until, 1, 1)) { log(`results heading appeared after ${clicks} responses`); return; }
      }
      await sleep(40);
    }
    throw new Error(`results heading "${until}" not found within ${max}ms (${clicks} responses)`);
  }
  if (step.typeNumbers) {
    const handles = await page.$$('input[type="number"]');
    if (handles.length < step.typeNumbers.length) throw new Error(`expected ${step.typeNumbers.length} number inputs, found ${handles.length}`);
    for (let i = 0; i < step.typeNumbers.length; i++) {
      await handles[i].click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await handles[i].type(step.typeNumbers[i], { delay: 20 });
    }
    log(`typed ${step.typeNumbers.join(', ')}`); return;
  }
  throw new Error(`unknown step ${JSON.stringify(step)}`);
}

async function main() {
  if (!fs.existsSync(path.join(BUILD, 'index.html'))) { console.error(`no build at ${BUILD} — run \`npm run build\` first`); process.exit(1); }
  const server = await startServer();
  console.log(`static server on http://127.0.0.1:${PORT}${PREFIX}/ -> ${BUILD}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none'],
  });
  const produced = []; const failed = [];
  try {
    for (const lang of LANGS) {
      const L = loadLabels(lang);
      const outDir = path.join(OUT_ROOT, lang);
      fs.mkdirSync(outDir, { recursive: true });
      const context = await browser.createBrowserContext();
      console.log(`\n===== ${lang} =====`);
      for (const cap of plan(L)) {
        if (ONLY && !ONLY.has(cap.name)) continue;
        const tag = `[${lang}/${cap.name}]`;
        const log = (m) => console.log(`${tag} ${m}`);
        const page = await context.newPage();
        page.on('pageerror', (e) => log(`pageerror: ${e.message}`));
        try {
          if (cap.phone === 'portrait') await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
          else if (cap.phone === 'landscape') await page.setViewport({ width: 812, height: 375, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
          else await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
          await page.goto(url(cap.route, lang), { waitUntil: 'networkidle0', timeout: 60000 });
          log(`loaded ${cap.route}`);
          for (const step of cap.steps) await runStep(page, step, log);
          const file = path.join(outDir, `${cap.name}.png`);
          await page.screenshot({ path: file });
          const size = fs.statSync(file).size;
          produced.push({ lang, name: cap.name, file, size });
          log(`saved (${size} bytes)`);
        } catch (e) {
          failed.push({ lang, name: cap.name, reason: e.message });
          log(`FAILED: ${e.message}`);
          try { await page.screenshot({ path: path.join(outDir, `${cap.name}.png`) }); log('saved best-effort screenshot'); } catch (_) { /* ignore */ }
        } finally {
          await page.close().catch(() => {});
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('\n===== PRODUCED =====');
  console.log('lang  size      file');
  for (const p of produced) console.log(`${p.lang.padEnd(5)} ${String(p.size).padStart(8)}  ${path.relative(REPO, p.file)}`);
  console.log(`\n===== FAILED (${failed.length}) =====`);
  for (const f of failed) console.log(`${f.lang}/${f.name}: ${f.reason}`);
  if (process.env.RESULT_JSON) fs.writeFileSync(process.env.RESULT_JSON, JSON.stringify({ produced, failed }, null, 2));
}

main().catch((e) => { console.error('fatal', e); process.exit(1); });
