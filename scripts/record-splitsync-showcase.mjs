#!/usr/bin/env node
/**
 * Screen Studio-grade 1920x1080 60fps Showcase Recorder for SplitSync-AI.
 *
 * Combines:
 *  - Option A: Live 1920x1080 Dark Studio Canvas (#090D16) with smooth 650ms bezel morphs
 *    (Desktop 1440x900 -> Tablet 1024x768 -> Phone 390x844 -> Desktop 1440x900)
 *  - Option B: Direct CDP Emulation.setDeviceMetricsOverride responsive breakpoint check
 *  - Deterministic animation-stepped CDP frame capture piped into FFmpeg (H.264, CRF 17, 60fps)
 *  - Injected app rig: #__demo-cursor, .__demo-ripple, __cameraZoom/__cameraReset, #__demo-caption
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.env.SPLITSYNC_URL || 'http://localhost:3000';
const STUDIO_URL = `${BASE_URL}/__studio`;
const OUTPUT_DIR = path.join(ROOT, 'demos');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'splitsync-full-showcase.mp4');
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;
const FRAME_MS = 1000 / FPS;
const DRY_RUN = process.argv.includes('--dry-run');

const DEVICE_PROFILES = {
  desktop: {
    id: 'desktop',
    width: 1440,
    height: 900,
    scale: 0.92,
    radius: '18px',
    mobile: false,
    badge: 'DESKTOP · 1440×900 · NAV RAIL',
  },
  tablet: {
    id: 'tablet',
    width: 1024,
    height: 768,
    scale: 1.04,
    radius: '26px',
    mobile: true,
    badge: 'TABLET · 1024×768 · ADAPTIVE',
  },
  phone: {
    id: 'phone',
    width: 390,
    height: 844,
    scale: 0.97,
    radius: '38px',
    mobile: true,
    badge: 'PHONE · 390×844 · BOTTOM NAV',
  },
};

function findBinary(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    const probe = spawnSync('where', [candidate], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim()) {
      return probe.stdout.trim().split(/\r?\n/)[0].trim();
    }
  }
  return null;
}

function findFfmpeg() {
  const localApp = process.env.LOCALAPPDATA || '';
  return findBinary([
    process.env.FFMPEG_BIN,
    'ffmpeg',
    path.join(localApp, 'Cypress', 'Cache', '12.9.0', 'Cypress', 'resources', 'app', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
  ]);
}

function findFfprobe() {
  const localApp = process.env.LOCALAPPDATA || '';
  return findBinary([
    process.env.FFPROBE_BIN,
    'ffprobe',
    path.join(localApp, 'Programs', 'Recordly', 'resources', 'app.asar.unpacked', 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe'),
  ]);
}

function findChromiumExecutable() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const msPlaywright = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(msPlaywright)) {
    const dirs = fs.readdirSync(msPlaywright).filter(d => d.startsWith('chromium-')).sort().reverse();
    for (const dir of dirs) {
      const exe = path.join(msPlaywright, dir, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return undefined;
}

function buildStudioHtml() {
  const d = DEVICE_PROFILES.desktop;
  const displayW = Math.round(d.width * d.scale);
  const displayH = Math.round(d.height * d.scale);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SplitSync AI — Screen Studio Stage</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
      background:
        radial-gradient(1200px 720px at 20% 10%, rgba(15, 103, 254, 0.22), transparent 62%),
        radial-gradient(960px 640px at 85% 90%, rgba(72, 179, 169, 0.16), transparent 65%),
        #090D16;
      font-family: 'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    #platform-badge {
      position: fixed;
      top: 22px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 18px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.28);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.38);
      backdrop-filter: blur(12px);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #E2E8F0;
      transition: all 350ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    #platform-badge .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #0F67FE;
      box-shadow: 0 0 12px rgba(15, 103, 254, 0.9);
    }
    #stage-center {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 66px 40px 74px;
    }
    #device-bezel {
      position: relative;
      width: ${displayW}px;
      height: ${displayH}px;
      border-radius: ${d.radius};
      background: #090E1D;
      border: 2px solid rgba(148, 163, 184, 0.28);
      box-shadow:
        0 32px 85px rgba(0, 0, 0, 0.65),
        0 0 0 1px rgba(255, 255, 255, 0.06) inset;
      overflow: hidden;
      transition: all 650ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    #device-bezel[data-device="phone"] {
      border-width: 6px;
      border-color: #1E293B;
      box-shadow:
        0 36px 95px rgba(0, 0, 0, 0.78),
        0 0 0 1px rgba(148, 163, 184, 0.28);
    }
    #device-bezel[data-device="tablet"] {
      border-width: 5px;
      border-color: #1E293B;
    }
    #frame-scaler {
      width: ${d.width}px;
      height: ${d.height}px;
      transform: scale(${d.scale});
      transform-origin: top left;
      transition: all 650ms cubic-bezier(0.22, 1, 0.36, 1);
      overflow: hidden;
    }
    #app-frame {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: #090E1D;
    }
    #__demo-caption {
      position: fixed;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 60;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 11px 22px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.90);
      border: 1px solid rgba(96, 165, 250, 0.35);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.48);
      backdrop-filter: blur(12px);
      font-size: 16px;
      font-weight: 700;
      color: #F8FAFC;
      letter-spacing: -0.01em;
      white-space: nowrap;
      transition: opacity 260ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    #__demo-caption .act-pill {
      padding: 3px 10px;
      border-radius: 999px;
      background: linear-gradient(135deg, #0F67FE, #38BDF8);
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div id="platform-badge"><span class="dot"></span><span id="platform-badge-text">${d.badge}</span></div>
  <div id="stage-center">
    <div id="device-bezel" data-device="desktop">
      <div id="frame-scaler">
        <iframe id="app-frame" src="${BASE_URL}/#login" title="SplitSync AI App"></iframe>
      </div>
    </div>
  </div>
  <div id="__demo-caption">
    <span class="act-pill" id="cap-act">Act 1</span>
    <span id="cap-text">SplitSync AI — Authentication &amp; Core Home Shell</span>
  </div>
</body>
</html>`;
}

async function ensureServerHealthy() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function verifyCdpResponsiveProfiles(browser) {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg);
  const results = [];
  for (const profile of [DEVICE_PROFILES.desktop, DEVICE_PROFILES.tablet, DEVICE_PROFILES.phone]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: profile.width,
      height: profile.height,
      deviceScaleFactor: 2,
      mobile: profile.mobile,
    });
    await pg.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle' });
    await pg.evaluate(() => {
      if (typeof window.enterStaticPreview === 'function') window.enterStaticPreview();
      if (typeof window.pinAppend === 'function') {
        '1234'.split('').forEach(d => window.pinAppend(d));
      }
    });
    await pg.waitForTimeout(200);
    const metrics = await pg.evaluate(() => ({
      innerWidth: window.innerWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      navRailVisible: getComputedStyle(document.querySelector('.nav-rail')).display !== 'none',
      bottomNavVisible: getComputedStyle(document.querySelector('.bottom-nav')).display !== 'none',
    }));
    results.push({ device: profile.id, ...metrics });
  }
  await ctx.close();
  return results;
}

class VideoEncoderPipe {
  constructor(ffmpegBin, outFile) {
    this.ffmpegBin = ffmpegBin;
    this.outFile = outFile;
    this.totalFrames = 0;
    this.stderrChunks = [];
  }

  start() {
    if (DRY_RUN) return;
    fs.mkdirSync(path.dirname(this.outFile), { recursive: true });
    this.proc = spawn(this.ffmpegBin, [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-framerate', String(FPS),
      '-i', '-',
      '-vf', `scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '17',
      '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-movflags', '+faststart',
      this.outFile,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    this.proc.stderr.on('data', chunk => this.stderrChunks.push(chunk));
    this.exitPromise = new Promise((resolve, reject) => {
      this.proc.on('error', reject);
      this.proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}:\n${Buffer.concat(this.stderrChunks).toString('utf8').slice(-1500)}`));
      });
    });
  }

  async writeFrame(buf, repeat = 1) {
    if (DRY_RUN) return;
    for (let i = 0; i < repeat; i += 1) {
      this.totalFrames += 1;
      if (!this.proc.stdin.write(buf)) {
        await new Promise(resolve => this.proc.stdin.once('drain', resolve));
      }
    }
  }

  async finish() {
    if (DRY_RUN) return 0;
    this.proc.stdin.end();
    await this.exitPromise;
    return this.totalFrames;
  }
}

class StudioDirector {
  constructor(page, cdp, encoder) {
    this.page = page;
    this.cdp = cdp;
    this.encoder = encoder;
    this.cursorPos = { x: 720, y: 450 };
  }

  async captureJpeg() {
    if (DRY_RUN) return Buffer.alloc(0);
    const { data } = await this.cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 94,
      fromSurface: true,
    });
    return Buffer.from(data, 'base64');
  }

  async holdStaticMs(ms) {
    if (DRY_RUN) { await this.page.waitForTimeout(16); return; }
    const frames = Math.max(1, Math.round((ms / 1000) * FPS));
    const buf = await this.captureJpeg();
    await this.encoder.writeFrame(buf, frames);
  }

  async stepAnimationsMs(ms, stride = 1) {
    if (DRY_RUN) { await this.page.waitForTimeout(24); return; }
    const totalFrames = Math.max(1, Math.round((ms / 1000) * FPS));
    await this.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await this.page.evaluate(() => {
      const pauseAll = doc => {
        if (!doc) return;
        for (const anim of doc.getAnimations({ subtree: true })) {
          try { anim.pause(); } catch {}
        }
      };
      pauseAll(document);
      const iframe = document.getElementById('app-frame');
      pauseAll(iframe?.contentDocument);
    });
    for (let i = 0; i < totalFrames; i += stride) {
      const repeat = Math.min(stride, totalFrames - i);
      const dt = FRAME_MS * repeat;
      await this.page.evaluate(stepDt => {
        const stepAll = doc => {
          if (!doc) return;
          for (const anim of doc.getAnimations({ subtree: true })) {
            try {
              const cur = Number(anim.currentTime) || 0;
              anim.currentTime = cur + stepDt;
            } catch {}
          }
        };
        stepAll(document);
        const iframe = document.getElementById('app-frame');
        stepAll(iframe?.contentDocument);
        return new Promise(r => requestAnimationFrame(r));
      }, dt);
      const buf = await this.captureJpeg();
      await this.encoder.writeFrame(buf, repeat);
    }
    await this.page.evaluate(() => {
      const finishAll = doc => {
        if (!doc) return;
        for (const anim of doc.getAnimations({ subtree: true })) {
          try { anim.finish(); } catch { try { anim.play(); } catch {} }
        }
      };
      finishAll(document);
      const iframe = document.getElementById('app-frame');
      finishAll(iframe?.contentDocument);
    });
  }

  async holdLiveMs(ms, intervalFrames = 3) {
    if (DRY_RUN) { await this.page.waitForTimeout(Math.min(ms, 180)); return; }
    const totalFrames = Math.max(1, Math.round((ms / 1000) * FPS));
    for (let i = 0; i < totalFrames; i += intervalFrames) {
      const repeat = Math.min(intervalFrames, totalFrames - i);
      await this.page.waitForTimeout(FRAME_MS * repeat);
      const buf = await this.captureJpeg();
      await this.encoder.writeFrame(buf, repeat);
    }
  }

  async setCaption(actLabel, text) {
    await this.page.evaluate(({ a, t }) => {
      document.getElementById('cap-act').textContent = a;
      document.getElementById('cap-text').textContent = t;
    }, { a: actLabel, t: text });
  }

  async injectAppRig() {
    const cx = this.cursorPos.x;
    const cy = this.cursorPos.y;
    await this.page.evaluate(({ initX, initY }) => {
      const iframe = document.getElementById('app-frame');
      const doc = iframe?.contentDocument;
      const win = iframe?.contentWindow;
      if (!doc || !win) return;

      // Keep demo alerts out of screenshot overlays unless needed
      if (!doc.getElementById('__demo-rig-style')) {
        const style = doc.createElement('style');
        style.id = '__demo-rig-style';
        style.textContent = `
          html {
            transition: transform 650ms cubic-bezier(0.22, 1, 0.36, 1) !important;
            will-change: transform;
          }
          #__demo-cursor {
            position: fixed;
            left: 0;
            top: 0;
            width: 30px;
            height: 30px;
            z-index: 2147483647;
            pointer-events: none;
            transform: translate3d(${initX}px, ${initY}px, 0);
            transition: transform 340ms cubic-bezier(0.22, 1, 0.36, 1);
            filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45));
          }
          .__demo-ripple {
            position: fixed;
            width: 40px;
            height: 40px;
            margin-left: -20px;
            margin-top: -20px;
            border-radius: 50%;
            border: 3px solid #38BDF8;
            background: rgba(15, 103, 254, 0.22);
            box-shadow: 0 0 18px rgba(56, 189, 248, 0.72);
            pointer-events: none;
            z-index: 2147483646;
            animation: __demoRippleAnim 450ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
          @keyframes __demoRippleAnim {
            0% { transform: scale(0.25); opacity: 0.95; }
            100% { transform: scale(1.75); opacity: 0; }
          }
        `;
        doc.head.appendChild(style);
      }

      if (!doc.getElementById('__demo-cursor')) {
        const cur = doc.createElement('div');
        cur.id = '__demo-cursor';
        cur.innerHTML = `<svg viewBox="0 0 28 28" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 2.5L5.5 22.8L10.4 17.8L14.1 25.5L17.3 23.9L13.6 16.3L20.8 16.3L5.5 2.5Z"
            fill="#0B0F19" stroke="#FFFFFF" stroke-width="2.1" stroke-linejoin="round"/>
        </svg>`;
        doc.body.appendChild(cur);
      }

      win.__demoMoveCursor = (x, y) => {
        const cur = doc.getElementById('__demo-cursor');
        if (!cur) return;
        void cur.offsetWidth;
        cur.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      };

      win.__demoRipple = (x, y) => {
        const r = doc.createElement('div');
        r.className = '__demo-ripple';
        r.style.left = `${x}px`;
        r.style.top = `${y}px`;
        doc.body.appendChild(r);
        setTimeout(() => r.remove(), 500);
      };

      win.__cameraZoom = (selector, scale = 1.4) => {
        const el = typeof selector === 'string' ? doc.querySelector(selector) : selector;
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;
        const html = doc.documentElement;
        void html.offsetWidth;
        html.style.transformOrigin = `${originX}px ${originY}px`;
        html.style.transform = `scale(${scale})`;
        return true;
      };

      win.__cameraReset = () => {
        const html = doc.documentElement;
        void html.offsetWidth;
        html.style.transform = 'scale(1)';
      };
    }, { initX: cx, initY: cy });
  }

  async resolveSelector(selector) {
    const pt = await this.page.evaluate(sel => {
      const iframe = document.getElementById('app-frame');
      const doc = iframe?.contentDocument;
      if (!doc) return null;
      let el = null;
      const textMatch = sel.match(/^(.*):has-text\((['"])(.*?)\2\)$/);
      if (textMatch) {
        const base = textMatch[1] || '*';
        const needle = textMatch[3];
        el = [...doc.querySelectorAll(base)].find(node => (node.textContent || '').includes(needle));
      } else {
        el = doc.querySelector(sel);
      }
      if (!el) return null;
      el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      return {
        found: true,
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
      };
    }, selector);
    if (!pt?.found) throw new Error(`Selector not found in app-frame: ${selector}`);
    return pt;
  }

  async waitForAppSelector(selector, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        return await this.resolveSelector(selector);
      } catch {
        await this.page.waitForTimeout(80);
      }
    }
    throw new Error(`Timed out waiting for selector in app-frame: ${selector}`);
  }

  async waitForAppFn(fnBody, arg = null, timeoutMs = 15000) {
    await this.page.waitForFunction(({ body, payload }) => {
      const iframe = document.getElementById('app-frame');
      const doc = iframe?.contentDocument;
      const win = iframe?.contentWindow;
      if (!doc || !win) return false;
      const fn = new Function('doc', 'win', 'arg', body);
      return Boolean(fn(doc, win, payload));
    }, { body: fnBody, payload: arg }, { timeout: timeoutMs });
  }

  async moveCursorTo(selector, holdAfterMs = 140) {
    await this.injectAppRig();
    const pt = await this.waitForAppSelector(selector);
    this.cursorPos = { x: pt.x, y: pt.y };
    await this.page.evaluate(({ x, y }) => {
      const win = document.getElementById('app-frame')?.contentWindow;
      win?.__demoMoveCursor?.(x, y);
    }, pt);
    await this.stepAnimationsMs(340, 2);
    if (holdAfterMs > 0) await this.holdStaticMs(holdAfterMs);
    return pt;
  }

  async clickSelector(selector, { postMs = 260, ripple = true, animateApp = false } = {}) {
    await this.injectAppRig();
    const pt = await this.waitForAppSelector(selector);
    this.cursorPos = { x: pt.x, y: pt.y };
    await this.page.evaluate(({ x, y }) => {
      const win = document.getElementById('app-frame')?.contentWindow;
      win?.__demoMoveCursor?.(x, y);
    }, pt);
    await this.stepAnimationsMs(340, 2);

    await this.page.evaluate(({ sel, x, y, showRipple }) => {
      const iframe = document.getElementById('app-frame');
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (showRipple) win?.__demoRipple?.(x, y);
      let el = null;
      const textMatch = sel.match(/^(.*):has-text\((['"])(.*?)\2\)$/);
      if (textMatch) {
        const base = textMatch[1] || '*';
        const needle = textMatch[3];
        el = [...doc.querySelectorAll(base)].find(node => (node.textContent || '').includes(needle));
      } else {
        el = doc.querySelector(sel);
      }
      el?.click();
    }, { sel: selector, x: pt.x, y: pt.y, showRipple: ripple });

    if (ripple) {
      await this.stepAnimationsMs(450, 2);
    }
    await this.injectAppRig();
    if (postMs > 0) {
      if (animateApp) await this.holdLiveMs(postMs);
      else await this.holdStaticMs(postMs);
    }
  }

  async typeInto(selector, text, { submitEnter = false, clearFirst = true } = {}) {
    await this.clickSelector(selector, { postMs: 120 });
    const frame = this.page.frameLocator('#app-frame');
    const loc = frame.locator(selector).first();
    await loc.focus();
    const inputType = await loc.evaluate(el => (el.getAttribute('type') || '').toLowerCase()).catch(() => '');
    if (clearFirst) {
      await loc.fill('');
    }
    if (inputType === 'number') {
      // Chromium <input type="number"> discards selectionStart during live render(), which reverses pressSequentially;
      // stepping prefix strings via fill() preserves natural left-to-right animated typing and triggers oninput cleanly.
      let typed = '';
      for (const ch of text) {
        typed += ch;
        if (typed.endsWith('.')) continue;
        await loc.fill(typed);
        await this.page.waitForTimeout(16);
        const buf = await this.captureJpeg();
        await this.encoder.writeFrame(buf, 2);
      }
    } else {
      for (const ch of text) {
        await loc.pressSequentially(ch, { delay: 0 });
        await this.page.waitForTimeout(16);
        const buf = await this.captureJpeg();
        await this.encoder.writeFrame(buf, 2);
      }
    }
    if (submitEnter) {
      await loc.press('Enter');
    }
    await this.injectAppRig();
  }

  async cameraZoom(selector, scale = 1.4, holdMs = 550) {
    await this.injectAppRig();
    const ok = await this.page.evaluate(({ sel, z }) => {
      const iframe = document.getElementById('app-frame');
      const doc = iframe?.contentDocument;
      const win = iframe?.contentWindow;
      if (!doc || !win) return false;
      let target = null;
      const textMatch = sel.match(/^(.*):has-text\((['"])(.*?)\2\)$/);
      if (textMatch) {
        const base = textMatch[1] || '*';
        target = [...doc.querySelectorAll(base)].find(n => (n.textContent || '').includes(textMatch[3]));
      } else {
        target = doc.querySelector(sel);
      }
      if (!target) return false;
      target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
      return win.__cameraZoom(target, z);
    }, { sel: selector, z: scale });
    if (ok) {
      await this.stepAnimationsMs(650);
      if (holdMs > 0) await this.holdStaticMs(holdMs);
    }
  }

  async cameraReset(holdMs = 150) {
    await this.injectAppRig();
    const wasZoomed = await this.page.evaluate(() => {
      const html = document.getElementById('app-frame')?.contentDocument?.documentElement;
      const t = html?.style.transform || '';
      const active = t && t !== 'scale(1)';
      document.getElementById('app-frame')?.contentWindow?.__cameraReset?.();
      return active;
    });
    if (wasZoomed) {
      await this.stepAnimationsMs(650);
    }
    if (holdMs > 0) await this.holdStaticMs(holdMs);
  }

  async scrollAppTo(scrollY, holdMs = 350) {
    await this.page.evaluate(y => {
      const win = document.getElementById('app-frame')?.contentWindow;
      if (!win) return;
      const start = win.scrollY || 0;
      const max = Math.max(0, win.document.documentElement.scrollHeight - win.innerHeight);
      const target = Math.max(0, Math.min(y, max));
      win.__scrollAnim = { start, target };
      win.scrollTo(0, target);
    }, scrollY);
    await this.holdLiveMs(220);
    await this.injectAppRig();
    if (holdMs > 0) await this.holdStaticMs(holdMs);
  }

  async morphDevice(profileKey) {
    await this.cameraReset(0);
    const p = DEVICE_PROFILES[profileKey];
    const displayW = Math.round(p.width * p.scale);
    const displayH = Math.round(p.height * p.scale);
    await this.page.evaluate(({ prof, dw, dh }) => {
      const bezel = document.getElementById('device-bezel');
      const scaler = document.getElementById('frame-scaler');
      const badgeText = document.getElementById('platform-badge-text');
      bezel.dataset.device = prof.id;
      void bezel.offsetWidth;
      bezel.style.width = `${dw}px`;
      bezel.style.height = `${dh}px`;
      bezel.style.borderRadius = prof.radius;
      scaler.style.width = `${prof.width}px`;
      scaler.style.height = `${prof.height}px`;
      scaler.style.transform = `scale(${prof.scale})`;
      badgeText.textContent = prof.badge;
    }, { prof: p, dw: displayW, dh: displayH });
    await this.stepAnimationsMs(650);
    await this.injectAppRig();
    await this.holdStaticMs(360);
  }

  async setDateInput(selector, isoDate, postMs = 200) {
    await this.clickSelector(selector, { postMs: 80 });
    const loc = this.page.frameLocator('#app-frame').locator(selector).first();
    await loc.fill(isoDate);
    await this.injectAppRig();
    if (postMs > 0) await this.holdStaticMs(postMs);
  }

  async evalApp(expr) {
    return this.page.evaluate(code => {
      const win = document.getElementById('app-frame')?.contentWindow;
      return win?.eval?.(code);
    }, expr);
  }
}

function verifyVideoWithFfprobe(ffprobeBin, videoPath) {
  const probe = spawnSync(ffprobeBin, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,pix_fmt,codec_name:format=duration,size',
    '-of', 'json',
    videoPath,
  ], { encoding: 'utf8' });
  if (probe.status !== 0) {
    throw new Error(`ffprobe failed: ${probe.stderr}`);
  }
  const info = JSON.parse(probe.stdout);
  const stream = info.streams?.[0] || {};
  const format = info.format || {};
  if (Number(stream.width) !== WIDTH || Number(stream.height) !== HEIGHT) {
    throw new Error(`Unexpected dimensions ${stream.width}x${stream.height}; expected ${WIDTH}x${HEIGHT}`);
  }
  return { stream, format };
}

async function main() {
  const health = await ensureServerHealthy();
  console.log('[1/5] Server healthy:', JSON.stringify(health));

  const ffmpegBin = findFfmpeg();
  const ffprobeBin = findFfprobe();
  if (!ffmpegBin) throw new Error('ffmpeg binary not found');
  if (!ffprobeBin) throw new Error('ffprobe binary not found');
  console.log('[2/5] FFmpeg:', ffmpegBin);
  console.log('      FFprobe:', ffprobeBin);

  const browser = await chromium.launch({
    executablePath: findChromiumExecutable(),
    headless: true,
    args: ['--disable-gpu-vsync', '--autoplay-policy=no-user-gesture-required'],
  });

  try {
    // Option B verification: Direct CDP device metrics across Desktop / Tablet / Phone
    const cdpChecks = await verifyCdpResponsiveProfiles(browser);
    console.log('[3/5] CDP Emulation.setDeviceMetricsOverride verified:', JSON.stringify(cdpChecks));

    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });

    // Serve Studio canvas on exact origin and strip X-Frame-Options ONLY for local document requests in Playwright
    await context.route('**/*', async route => {
      const req = route.request();
      const url = req.url();
      if (url === STUDIO_URL) {
        return route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: buildStudioHtml(),
        });
      }
      if (url.startsWith(BASE_URL) && req.resourceType() === 'document') {
        const res = await route.fetch();
        const headers = { ...res.headers() };
        delete headers['x-frame-options'];
        return route.fulfill({ response: res, headers });
      }
      return route.continue();
    });

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await page.goto(STUDIO_URL, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      const iframe = document.getElementById('app-frame');
      if (iframe?.contentDocument?.fonts) await iframe.contentDocument.fonts.ready;
    });

    // Ensure clean demo session & sponsored flag before starting Act 1
    await page.evaluate(async () => {
      const win = document.getElementById('app-frame')?.contentWindow;
      if (win?.resetDemoSession) {
        await win.resetDemoSession();
        win.eval('sponsoredEnabled = false; localStorage.setItem("splitsync-sponsored", "false");');
        win.setThemeMode?.('dark');
        win.lockWallet?.();
        win.render?.();
      }
    });
    await page.waitForTimeout(400);

    const encoder = new VideoEncoderPipe(ffmpegBin, OUTPUT_FILE);
    encoder.start();
    const d = new StudioDirector(page, cdp, encoder);
    await d.injectAppRig();

    console.log('[4/5] Recording 7-Act Showcase...');

    // ==================== ACT 1: Auth & Core Home Shell (DESKTOP) ====================
    console.log('  -> Act 1: Auth & Core Home Shell (Desktop 1440x900)');
    await d.setCaption('Act 1 · Desktop 1440×900', 'Welcome, Leah — 4-Digit PIN Lock & Phone Authenticator');
    await d.holdStaticMs(500);
    await d.cameraZoom('.pin-boxes', 1.4, 300);
    await d.clickSelector('#pin-key-1', { postMs: 120 });
    await d.clickSelector('#pin-key-2', { postMs: 120 });
    await d.clickSelector('.medfarm-login-body button:has-text("Show")', { postMs: 360 });
    await d.clickSelector('.medfarm-login-body button:has-text("Hide")', { postMs: 220 });
    await d.moveCursorTo('#phone-auth-btn', 380);
    await d.clickSelector('#pin-key-3', { postMs: 120 });
    await d.clickSelector('#pin-key-4', { postMs: 550 });
    await d.cameraReset(200);

    await d.setCaption('Act 1 · Desktop 1440×900', 'Workspace Connection Status (#welcome · .env Auto-Login / Demo Preview)');
    await d.evalApp('manualDisconnect = true; go("welcome"); render();');
    await d.waitForAppSelector('button:has-text("Connect workspace")');
    await d.holdStaticMs(800);
    await d.evalApp('reconnectEnvSession().then(() => go("home"));');
    await d.waitForAppSelector('#wallet-3d-canvas');
    await d.holdLiveMs(500);

    await d.setCaption('Act 1 · Desktop 1440×900', 'PayPal Wallet ($245.00 USD), Three.js 3D Card Deck & Top-Up Modal');
    await d.cameraZoom('.wallet-card', 1.35, 320);
    await d.clickSelector('#shuffle-card-btn', { postMs: 550, animateApp: true });
    await d.clickSelector('#shuffle-card-btn', { postMs: 550, animateApp: true });
    await d.clickSelector('#recharge-wallet-btn', { postMs: 650 });
    await d.clickSelector('.recharge-modal button:has-text("Close")', { postMs: 250 });
    await d.cameraReset(200);

    await d.setCaption('Act 1 · Desktop 1440×900', '2×2 Payment Actions, Quick Contacts, Bento Store & Single leah@paypal QR');
    await d.moveCursorTo('.action-quad', 320);
    await d.scrollAppTo(420, 420);
    await d.scrollAppTo(950, 350);
    await d.cameraZoom('#home-receive-qr', 1.38, 650);
    await d.cameraReset(150);
    await d.scrollAppTo(0, 260);

    // ==================== ACT 2: Bidirectional International FX (DESKTOP) ====================
    console.log('  -> Act 2: Bidirectional FX & Transfers');
    await d.setCaption('Act 2 · Desktop 1440×900', 'Send Money — Name & Currency Recipient Cards + Bidirectional FX');
    await d.clickSelector('[aria-label="Quick contacts"] button.contact-pill:has-text("Allen")', { postMs: 420 });
    await d.cameraZoom('.contact-cards', 1.45, 520);
    await d.clickSelector('button.contact-card:has-text("Yuki")', { postMs: 380 });
    await d.cameraReset(120);

    await d.cameraZoom('.fx-side-tabs', 1.4, 240);
    await d.clickSelector('button.fx-side-btn:has-text("Yuki receives")', { postMs: 260 });
    await d.typeInto('#send-amount', '3000');
    await d.holdStaticMs(550);
    await d.clickSelector('button.fx-side-btn:has-text("You send")', { postMs: 260 });
    await d.clickSelector('button.fx-side-btn:has-text("Yuki receives")', { postMs: 360 });
    await d.cameraReset(120);

    await d.clickSelector('button:has-text("Review payment")', { postMs: 360 });
    await d.setCaption('Act 2 · Desktop 1440×900', 'Funding Source Selector (PayPal Wallet vs Cashback Card) & Locked FX Receipt');
    await d.cameraZoom('.payment-source-grid', 1.35, 360);
    await d.clickSelector('.payment-source-opt:has-text("PayPal Cashback")', { postMs: 320 });
    await d.clickSelector('.payment-source-opt:has-text("PayPal Wallet")', { postMs: 280 });
    await d.cameraReset(150);
    await d.clickSelector('#demo-pay-btn', { postMs: 900 });

    // ==================== ACT 3: Morph to TABLET -> Store, Cart & Split Cash ====================
    console.log('  -> Act 3: Morph to Tablet -> Store, Cart & Split Cash');
    await d.clickSelector('button:has-text("Done")', { postMs: 250 });
    await d.setCaption('Act 3 · Morphing to Tablet 1024×768', 'Adaptive Layout Transition -> Storefront, Cart & Split Cash');
    await d.morphDevice('tablet');
    await d.clickSelector('.nav-rail a[data-tab="store"]', { postMs: 450 });
    await d.clickSelector('.category-strip button:has-text("Lighting")', { postMs: 360 });
    await d.clickSelector('.category-strip button:has-text("All")', { postMs: 280 });
    await d.clickSelector('a:has-text("Matte LED Task Desk Lamp")', { postMs: 420 });

    await d.cameraZoom('.qty-stepper', 1.35, 320);
    await d.clickSelector('.qty-stepper button[aria-label="Increase quantity"]', { postMs: 260 });
    await d.cameraReset(120);
    await d.clickSelector('button:has-text("Add to Cart")', { postMs: 320 });
    await d.clickSelector('button:has-text("Cart (")', { postMs: 380 });

    await d.clickSelector('button[aria-label="Increase quantity"]', { postMs: 260 });
    await d.moveCursorTo('button:has-text("Split this purchase")', 320);
    await d.clickSelector('button:has-text("Checkout review")', { postMs: 420 });
    await d.clickSelector('button:has-text("Complete purchase")', { postMs: 550 });

    await d.waitForAppSelector('button:has-text("Split cash")');
    await d.cameraZoom('button:has-text("Split cash")', 1.5, 520);
    await d.clickSelector('button:has-text("Split cash")', { postMs: 450 });
    await d.cameraReset(180);

    // ==================== ACT 4: Multimodal Ask AI, Clarify & Group Draft (TABLET) ====================
    console.log('  -> Act 4: Ask AI, Clarify & Group Payment Draft');
    await d.setCaption('Act 4 · Tablet 1024×768', 'Ask AI — Voice Toggle, Contact Clarification & Batch Group Draft');
    await d.cameraZoom('.chat-composer', 1.4, 240);
    await d.clickSelector('button:has-text("Voice")', { postMs: 300 }); // turn Voice OFF for crisp deterministic pacing after showing toggle
    await d.cameraReset(120);

    // Ambiguous contact clarification ("Ask Alex" -> "Arun")
    await d.evalApp('chatDraft = null; chatAttachedBill = null; render();');
    await d.typeInto('#ask-input', 'Ask Alex $15 for coffee', { submitEnter: true });
    await d.waitForAppFn("return !win.eval('askBusy') && win.eval(\"chatHistory.at(-1)?.role\") === 'assistant' && Boolean(doc.querySelector('.draft-row-card.needs-fix'));", null, 25000);
    await d.holdStaticMs(550);
    await d.typeInto('#ask-input', 'Arun', { submitEnter: true });
    await d.waitForAppFn("return !win.eval('askBusy') && win.eval(\"chatHistory.at(-1)?.role\") === 'assistant';", null, 25000);
    const stillNeedsFix = await d.evalApp("Boolean(document.querySelector('.draft-row-card.needs-fix'))");
    if (stillNeedsFix) {
      await d.clickSelector('.draft-row-card button.chip:has-text("Arun")', { postMs: 360 });
    }
    await d.waitForAppFn("return [...doc.querySelectorAll('input')].some(i => /arun/i.test(i.value)) || (doc.body.innerText || '').includes('Arun');", null, 10000);
    await d.holdStaticMs(500);

    // Multi-person send prompt -> Group Payment Draft -> Receipt
    await d.typeInto('#ask-input', 'Start over: give Maya $24 and Arun $18 for dinner', { submitEnter: true });
    await d.waitForAppFn("return !win.eval('askBusy') && win.eval(\"chatHistory.at(-1)?.role\") === 'assistant';", null, 25000);
    await d.waitForAppSelector('button:has-text("Review 2 payments")', 15000);
    await d.holdStaticMs(420);
    await d.clickSelector('button:has-text("Review 2 payments")', { postMs: 420 });
    await d.cameraZoom('.narrow.card', 1.35, 520);
    await d.cameraReset(120);
    await d.clickSelector('button:has-text("Confirm demo payments")', { postMs: 750 });

    // ==================== ACT 5: Morph to PHONE -> Receipt Scan & Bills (PHONE) ====================
    console.log('  -> Act 5: Morph to Phone -> Scan Bill & Household Bills');
    await d.setCaption('Act 5 · Morphing to Phone 390×844', 'Mobile Responsive .bottom-nav -> Receipt OCR & Household Bills');
    await d.morphDevice('phone');
    await d.clickSelector('.bottom-nav a[data-tab="home"]', { postMs: 450 });
    await d.moveCursorTo('.bottom-nav', 350);

    await d.clickSelector('button.action-tile:has-text("Split a Bill")', { postMs: 420 });
    await d.waitForAppFn("return win.location.hash === '#scan-bill';", null, 10000);
    const camActive = await d.evalApp("billCameraState === 'scanning'");
    if (camActive) {
      await d.evalApp('stopStandaloneBillCamera();');
    }
    await d.waitForAppSelector('button:has-text("Use sample receipt")');
    await d.clickSelector('button:has-text("Use sample receipt")', { postMs: 550 });
    await d.waitForAppSelector('#sb-total');
    // Trigger mismatch banner briefly so viewer sees auto-reconcile
    await d.typeInto('#sb-total', '45.00');
    await d.evalApp('render();');
    await d.waitForAppSelector('button:has-text("Match")');
    await d.cameraZoom('.bill-editor .callout.error', 1.45, 520);
    await d.clickSelector('button:has-text("Match")', { postMs: 320 });
    await d.cameraReset(120);

    await d.clickSelector('.bill-editor button.contact-card:has-text("Maya")', { postMs: 220 });
    await d.clickSelector('.bill-editor button.contact-card:has-text("Arun")', { postMs: 220 });
    await d.clickSelector('button:has-text("Create requests")', { postMs: 650 });
    await d.waitForAppSelector('.progress');
    await d.holdLiveMs(2500); // Staggered settlement arrival & progress bar update

    // Electricity & Rent Household Bill Builders + Saved Rule Reuse
    await d.setCaption('Act 5 · Phone 390×844', 'Household Bills (#electricity & #rent) + Equal/Custom & Saved Rule Reuse');
    await d.evalApp('openElectricityFlow();');
    await d.clickSelector('button:has-text("Create electricity request")', { postMs: 320 });
    await d.clickSelector('.chip-row button.chip:has-text("Maya")', { postMs: 180 });
    await d.clickSelector('.chip-row button.chip:has-text("Arun")', { postMs: 180 });
    await d.typeInto('#electricity-amt', '90');
    await d.setDateInput('#electricity-due', '2026-12-01', 200);
    await d.clickSelector('button.chip:has-text("Custom")', { postMs: 240 });
    await d.clickSelector('button.chip:has-text("Equal")', { postMs: 220 });
    await d.clickSelector('input[type="checkbox"]', { postMs: 180 });
    await d.clickSelector('button:has-text("Review electricity requests")', { postMs: 280 });
    await d.clickSelector('button:has-text("Confirm & create electricity requests")', { postMs: 250 });
    await d.waitForAppFn("return win.location.hash.startsWith('#request/') && !win.eval('electricityForm.busy');", null, 15000);
    await d.holdStaticMs(350);

    await d.evalApp('openRentFlow();');
    await d.clickSelector('button:has-text("Create rent request")', { postMs: 320 });
    await d.clickSelector('.chip-row button.chip:has-text("Maya")', { postMs: 180 });
    await d.clickSelector('.chip-row button.chip:has-text("Arun")', { postMs: 180 });
    await d.typeInto('#rent-amt', '1200');
    await d.setDateInput('#rent-due', '2026-12-05', 200);
    await d.clickSelector('input[type="checkbox"]', { postMs: 180 });
    await d.clickSelector('button:has-text("Review rent requests")', { postMs: 280 });
    await d.clickSelector('button:has-text("Confirm & create rent requests")', { postMs: 250 });
    await d.waitForAppFn("return win.location.hash.startsWith('#request/') && Boolean(win.eval('savedRentRule'));", null, 15000);
    await d.holdStaticMs(350);

    await d.evalApp('openRentFlow();');
    await d.waitForAppSelector('button:has-text("Use saved rule")');
    await d.clickSelector('button:has-text("Use saved rule")', { postMs: 480 });

    // ==================== ACT 6: PayPal Sandbox Merchant Flow SS-001 (PHONE) ====================
    console.log('  -> Act 6: PayPal Sandbox SS-001 & Isolated Payer Checkout');
    await d.setCaption('Act 6 · Phone 390×844', 'PayPal Sandbox Merchant Flow (#purchase/SS-001) & Isolated Payer Checkout');
    await d.evalApp('openScanPay();');
    await d.waitForAppSelector('#purchase-link');
    await d.cameraZoom('.camera-frame', 1.4, 380);
    await d.cameraReset(120);
    await d.clickSelector('button:has-text("Open Demo Merchant (SS-001)")', { postMs: 450 });

    await d.waitForAppSelector('button:has-text("Prepare AI split")');
    await d.cameraZoom('.split-grid', 1.45, 520);
    await d.cameraReset(120);
    await d.clickSelector('button:has-text("Prepare AI split")', { postMs: 500 });
    await d.waitForAppFn("return !win.eval('aiState === \"loading\"');", null, 20000);

    await d.waitForAppSelector('button:has-text("Confirm & get PayPal links")');
    await d.cameraZoom('.chip-row', 1.45, 280);
    await d.clickSelector('.chip-row button.chip:has-text("Arun")', { postMs: 320 });
    await d.clickSelector('.chip-row button.chip:has-text("Maya")', { postMs: 320 });
    await d.cameraReset(120);
    await d.clickSelector('button:has-text("Confirm & get PayPal links")', { postMs: 300 });
    await d.waitForAppFn("return win.location.hash === '#requests';", null, 15000);

    await d.waitForAppSelector('button:has-text("QR")');
    await d.clickSelector('button:has-text("QR")', { postMs: 450 });
    await d.clickSelector('a:has-text("checkout")', { postMs: 650 });
    await d.waitForAppSelector('.payment-summary, .narrow.card');
    await d.cameraZoom('.payment-summary, .narrow.card', 1.35, 520);
    await d.cameraReset(120);
    await d.evalApp('go("dashboard");');
    await d.waitForAppSelector('.split-grid');
    await d.holdStaticMs(650);

    // ==================== ACT 7: Activity Cycle, Theme Switcher & Dev Tools (DESKTOP) ====================
    console.log('  -> Act 7: Morph to Desktop -> Activity Cycle, Themes & Dev Tools');
    await d.evalApp('go("activity");');
    await d.waitForAppSelector('.bottom-nav');
    await d.setCaption('Act 7 · Morphing to Desktop 1440×900', 'Unified Activity Cycle Graph, Medfarm Theme Switcher & Dev Tools');
    await d.morphDevice('desktop');
    await d.waitForAppSelector('#payment-cycle-card');
    await d.cameraZoom('#payment-cycle-card', 1.4, 520);
    await d.cameraReset(120);

    for (const tab of ['Awaiting payment', 'Payment received', 'Sent', 'Sandbox', 'All']) {
      await d.clickSelector(`.category-strip button:has-text("${tab}")`, { postMs: 220 });
    }

    await d.clickSelector('.nav-rail a[data-tab="home"]', { postMs: 250 });
    await d.clickSelector('#profile-avatar-btn', { postMs: 420 });
    await d.cameraZoom('.theme-segmented', 1.35, 300);
    await d.clickSelector('.theme-segmented button:has-text("Light")', { postMs: 520 });
    await d.clickSelector('.theme-segmented button:has-text("Dark")', { postMs: 520 });
    await d.cameraReset(120);

    await d.cameraZoom('#profile-receive-qr', 1.35, 420);
    await d.cameraReset(120);

    await d.clickSelector('a[href="#dev"]', { postMs: 450 });
    await d.clickSelector('button:has-text("Hidden (default)")', { postMs: 520 });
    await d.moveCursorTo('button:has-text("Reset demo session")', 450);

    await d.setCaption('SplitSync AI · Complete Multi-Device Showcase', '1920×1080 · 60fps · Web, Flutter & PayPal Sandbox');
    await d.holdStaticMs(1100);

    const renderedFrames = await encoder.finish();
    if (!DRY_RUN) {
      console.log(`[5/5] Encoded ${renderedFrames} frames -> ${OUTPUT_FILE}`);
      const { stream, format } = verifyVideoWithFfprobe(ffprobeBin, OUTPUT_FILE);
      const sizeBytes = fs.statSync(OUTPUT_FILE).size;
      console.log('ffprobe verification:', JSON.stringify({
        codec: stream.codec_name,
        width: stream.width,
        height: stream.height,
        fps: stream.r_frame_rate,
        pix_fmt: stream.pix_fmt,
        duration_sec: Number(format.duration).toFixed(2),
        size_bytes: sizeBytes,
      }));
    } else {
      console.log('[DRY RUN] All 7 acts completed cleanly!');
    }

    // Cleanly reset demo data so app returns to pristine state
    await page.evaluate(async () => {
      const win = document.getElementById('app-frame')?.contentWindow;
      if (win?.resetDemoSession) await win.resetDemoSession();
    });
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
