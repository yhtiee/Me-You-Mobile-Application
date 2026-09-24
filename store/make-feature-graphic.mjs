/**
 * Renders store/feature-graphic.html to store/play/feature-graphic.png.
 *
 *   npm i -D puppeteer-core sharp && node store/make-feature-graphic.mjs
 *
 * Play's rules: 1024×500, PNG or JPEG, under 15MB. Chrome does the rendering so
 * the graphic uses the app's own fonts, and sharp re-encodes the screenshot —
 * Chrome's PNGs are several times larger than they need to be.
 *
 * Set CHROME_PATH if Chrome isn't in one of the usual places.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, 'play/feature-graphic.png');

function findChrome() {
  return [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p));
}

const executablePath = findChrome();
if (!executablePath) throw new Error('No Chrome found. Set CHROME_PATH.');

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(root, 'feature-graphic.html')).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  const shot = await page.screenshot({ type: 'png' });
  await sharp(shot).png({ compressionLevel: 9 }).toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`feature graphic: ${meta.width}x${meta.height} ${meta.space} -> ${out}`);
} finally {
  await browser.close();
}
