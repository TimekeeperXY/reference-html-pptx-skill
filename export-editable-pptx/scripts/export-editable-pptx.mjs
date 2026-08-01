#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import { chromium } from 'playwright-core';

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.output) fail('Required: --input <url|index.html|directory> --output <file.pptx>');
const viewport = { width: Number(args.width || 1920), height: Number(args.height || 1080) };
const source = await resolveSource(args.input);
const browser = await launchBrowser();
let server;
try {
  let url = source.url;
  if (source.root) ({ server, url } = await serveDirectory(source.root, source.entry));
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate(() => document.fonts?.ready);
  const selector = await detectSelector(page, args.selector);
  const count = await page.locator(selector).count();
  if (!count) fail(`No slides found with selector: ${selector}`);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'export-editable-pptx skill';
  pptx.subject = 'HTML deck converted to hybrid editable PowerPoint';
  pptx.title = path.basename(args.output, path.extname(args.output));
  pptx.company = 'OpenAI Codex';
  pptx.lang = 'zh-CN';
  const outDir = path.dirname(path.resolve(args.output));
  const tempDir = path.join(outDir, `.editable-pptx-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  let textObjects = 0;
  let shapeObjects = 0;
  let lineObjects = 0;

  for (let index = 0; index < count; index++) {
    const data = await prepareSlide(page, selector, index);
    const imagePath = path.join(tempDir, `slide-${String(index + 1).padStart(3, '0')}.png`);
    await page.screenshot({ path: imagePath, clip: data.clip, animations: 'disabled' });
    await restoreSlide(page);
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addImage({ path: imagePath, x: 0, y: 0, w: 13.333, h: 7.5 });
    for (const item of data.shapes) {
      const x = clamp((item.x / data.clip.width) * 13.333, 0, 13.333);
      const y = clamp((item.y / data.clip.height) * 7.5, 0, 7.5);
      const w = clamp((item.w / data.clip.width) * 13.333, 0.02, 13.333 - x);
      const h = clamp((item.h / data.clip.height) * 7.5, 0.02, 7.5 - y);
      const shapeType = resolveShapeType(pptx, item.type);
      const shapeOptions = {
        x, y, w, h,
        fill: { color: item.fill, transparency: item.fillTransparency },
        line: { color: item.line, transparency: item.lineTransparency, width: Math.max(0.1, item.lineWidth * item.slideScaleX * (13.333 * 72 / data.clip.width)) },
      };
      if (item.shadow) shapeOptions.shadow = { type: 'outer', color: item.shadowColor, opacity: item.shadowOpacity, blur: item.shadowBlur, angle: 45, distance: item.shadowDistance };
      slide.addShape(shapeType, shapeOptions);
      shapeObjects++;
    }
    for (const item of data.lines) {
      const x = clamp((item.x / data.clip.width) * 13.333, 0, 13.333);
      const y = clamp((item.y / data.clip.height) * 7.5, 0, 7.5);
      const w = (item.w / data.clip.width) * 13.333;
      const h = (item.h / data.clip.height) * 7.5;
      const line = {
        color: item.color,
        transparency: item.transparency,
        width: Math.max(0.1, item.width * item.slideScaleX * (13.333 * 72 / data.clip.width)),
        dash: mapDash(item.dash),
      };
      if (item.beginArrowType) line.beginArrowType = item.beginArrowType;
      if (item.endArrowType) line.endArrowType = item.endArrowType;
      slide.addShape(pptx.ShapeType.line, { x, y, w, h, line });
      lineObjects++;
    }
    for (const item of data.texts) {
      // CSS font sizes are expressed in layout pixels, not PowerPoint points.
      // Convert through the rendered slide scale instead of assuming 1px = .75pt.
      const fontSizePt = Math.max(1, item.fontSize * item.slideScaleX * (13.333 * 72 / data.clip.width));
      // PowerPoint and Chromium use different font metrics. Give each native text
      // box a small directional safety gutter so text does not wrap prematurely.
      const gutterPx = Math.max(2, item.fontSize * item.slideScaleX * 0.28);
      const verticalPx = Math.max(1, item.fontSize * item.slideScaleY * 0.14);
      const xPad = item.textAlign === 'right' ? gutterPx : item.textAlign === 'center' ? gutterPx / 2 : 0;
      const rawX = item.x - xPad;
      const rawY = item.y - verticalPx / 2;
      const rawW = item.w + gutterPx;
      const rawH = item.h + verticalPx;
      const x = clamp((rawX / data.clip.width) * 13.333, 0, 13.333);
      const y = clamp((rawY / data.clip.height) * 7.5, 0, 7.5);
      const w = clamp((rawW / data.clip.width) * 13.333, 0.02, 13.333 - x);
      const h = clamp((rawH / data.clip.height) * 7.5, 0.02, 7.5 - y);
      const options = {
        x, y, w, h,
        margin: 0,
        fontFace: cleanFont(item.fontFamily),
        fontSize: fontSizePt,
        bold: item.fontWeight >= 600,
        italic: item.fontStyle === 'italic',
        color: rgbToHex(item.color),
        align: mapAlign(item.textAlign),
        valign: 'mid',
        breakLine: false,
        fit: 'shrink',
        rotate: item.rotation || 0,
        transparency: opacityToTransparency(item.opacity),
        charSpacing: Math.max(-5, Math.min(20, item.letterSpacing * item.slideScaleX * (13.333 * 72 / data.clip.width))),
        lineSpacingMultiple: item.lineHeight > 0 && item.fontSize > 0 ? item.lineHeight / item.fontSize : 1,
      };
      if (item.href) options.hyperlink = { url: item.href };
      slide.addText(item.text, options);
      textObjects++;
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  await pptx.writeFile({ fileName: path.resolve(args.output) });
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log(`PPTX exported: ${path.resolve(args.output)}`);
  console.log(`Slides: ${count}; editable text objects: ${textObjects}; editable shape objects: ${shapeObjects}; editable line objects: ${lineObjects}; mode: hybrid-editable`);
} finally {
  await browser.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
}

async function prepareSlide(page, selector, index) {
  return page.evaluate(({ selector, index }) => {
    const slides = [...document.querySelectorAll(selector)];
    const target = slides[index];
    if (!target) throw new Error(`Slide ${index + 1} is missing`);
    window.__editablePptxRestore = slides.map(el => ({ el, style: el.getAttribute('style'), hidden: el.hidden }));
    slides.forEach((el, i) => {
      el.hidden = false;
      if (i !== index) el.style.setProperty('display', 'none', 'important');
      else {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
      }
    });
    const rect = target.getBoundingClientRect();
    const slideScaleX = target.offsetWidth > 0 ? rect.width / target.offsetWidth : 1;
    const slideScaleY = target.offsetHeight > 0 ? rect.height / target.offsetHeight : 1;
    const colorAlpha = value => {
      const text = String(value || '').trim();
      if (text === 'transparent') return 0;
      const parts = text.match(/[\d.]+/g)?.map(Number) || [];
      return parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1;
    };
    const colorHex = (value, fallback='#FFFFFF') => {
      const text = String(value || fallback).trim();
      if (/^#[0-9a-f]{6}$/i.test(text)) return text.slice(1).toUpperCase();
      if (/^#[0-9a-f]{3}$/i.test(text)) return text.slice(1).split('').map(x => x + x).join('').toUpperCase();
      if (/^[0-9a-f]{6}$/i.test(text)) return text.toUpperCase();
      if (/^[0-9a-f]{3}$/i.test(text)) return text.split('').map(x => x + x).join('').toUpperCase();
      const parts = text.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
      return parts.length === 3 ? parts.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase() : fallback.replace('#', '').toUpperCase();
    };
    const shapes = [...target.querySelectorAll('[data-pptx-shape]')].map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const typeValue = (el.getAttribute('data-pptx-shape') || '').trim();
      const fillValue = el.getAttribute('data-pptx-fill') || cs.backgroundColor;
      const lineValue = el.getAttribute('data-pptx-line') || cs.borderTopColor;
      const fillOpacity = Number(el.getAttribute('data-pptx-fill-opacity') || '') || colorAlpha(fillValue) * 100;
      const lineOpacity = Number(el.getAttribute('data-pptx-line-opacity') || '') || colorAlpha(lineValue) * 100;
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      const normalizedType = typeValue.toLowerCase();
      const type = !typeValue || normalizedType === 'auto'
        ? (radius >= Math.min(r.width, r.height) * 0.45 ? 'ellipse' : radius > 1 ? 'roundRect' : 'rect')
        : normalizedType === 'roundrect' ? 'roundRect' : typeValue;
      return {
        type, x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height,
        fill: colorHex(fillValue, el.getAttribute('data-pptx-fill') || '#FFFFFF'),
        fillTransparency: Math.round(100 - Math.max(0, Math.min(100, fillOpacity))),
        line: colorHex(lineValue, el.getAttribute('data-pptx-line') || '#FFFFFF'),
        lineTransparency: Math.round(100 - Math.max(0, Math.min(100, lineOpacity))),
        lineWidth: parseFloat(cs.borderTopWidth) || 0.1,
        shadow: el.getAttribute('data-pptx-shadow') === 'true',
        shadowColor: (el.getAttribute('data-pptx-shadow-color') || '#53677A').replace('#', '').toUpperCase(),
        shadowOpacity: Number(el.getAttribute('data-pptx-shadow-opacity') || 0.16),
        shadowBlur: Number(el.getAttribute('data-pptx-shadow-blur') || 3),
        shadowDistance: Number(el.getAttribute('data-pptx-shadow-distance') || 1.2),
        slideScaleX, slideScaleY
      };
    }).filter(x => x.w > 1 && x.h > 1 && x.x + x.w > 0 && x.y + x.h > 0 && x.x < rect.width && x.y < rect.height);
    const lines = [...target.querySelectorAll('[data-pptx-line-shape]')].map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const direction = (el.getAttribute('data-pptx-line-shape') || 'horizontal').toLowerCase();
      let x1 = r.left - rect.left, y1 = r.top - rect.top, x2 = r.right - rect.left, y2 = r.top - rect.top;
      if (direction === 'vertical' || direction === 'down') { x2 = x1; y2 = r.bottom - rect.top; }
      if (direction === 'up') { y1 = r.bottom - rect.top; x2 = r.right - rect.left; y2 = r.top - rect.top; }
      if (direction === 'down-right' || direction === 'diagonal') y2 = r.bottom - rect.top;
      const start = (el.getAttribute('data-pptx-line-start') || '').split(',').map(Number);
      const end = (el.getAttribute('data-pptx-line-end') || '').split(',').map(Number);
      if (start.length === 2 && start.every(Number.isFinite)) { x1 = r.left - rect.left + r.width * start[0] / 100; y1 = r.top - rect.top + r.height * start[1] / 100; }
      if (end.length === 2 && end.every(Number.isFinite)) { x2 = r.left - rect.left + r.width * end[0] / 100; y2 = r.top - rect.top + r.height * end[1] / 100; }
      const colorValue = el.getAttribute('data-pptx-line-color') || cs.borderTopColor || cs.color;
      const opacityAttr = el.getAttribute('data-pptx-line-opacity');
      const opacity = opacityAttr == null || opacityAttr === '' ? colorAlpha(colorValue) * 100 : Number(opacityAttr);
      return {
        x: x1, y: y1, w: x2 - x1, h: y2 - y1,
        color: colorHex(colorValue, '#000000'), transparency: Math.round(100 - Math.max(0, Math.min(100, opacity))),
        width: Number(el.getAttribute('data-pptx-line-width')) || parseFloat(cs.borderTopWidth) || 1,
        dash: el.getAttribute('data-pptx-line-dash') || cs.borderTopStyle || 'solid',
        beginArrowType: el.getAttribute('data-pptx-line-begin-arrow') || '',
        endArrowType: el.getAttribute('data-pptx-line-end-arrow') || '',
        slideScaleX, slideScaleY
      };
    }).filter(x => Number.isFinite(x.x + x.y + x.w + x.h) && (Math.abs(x.w) > .5 || Math.abs(x.h) > .5));
    // Extract visible text nodes, not both their contenteditable container and
    // styled descendants. This prevents duplicated parent/child text overlays.
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const el = node.parentElement;
        if (!el || el.closest('[data-pptx-ignore="true"]')) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) return NodeFilter.FILTER_REJECT;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return NodeFilter.FILTER_REJECT;
        const range = document.createRange();
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        return r.width > 0.5 && r.height > 0.5 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const texts = textNodes.map(node => {
      const el = node.parentElement;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const matrix = cs.transform?.startsWith('matrix(') ? cs.transform.slice(7, -1).split(',').map(Number) : null;
      const rotation = matrix ? Math.round(Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI) : 0;
      const weight = cs.fontWeight === 'bold' ? 700 : parseInt(cs.fontWeight, 10) || 400;
      return {
        text: node.textContent.replace(/\s+/g, ' ').trim(), x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height,
        fontFamily: cs.fontFamily, fontSize: parseFloat(cs.fontSize) || 16,
        fontWeight: weight, fontStyle: cs.fontStyle,
        color: cs.color, opacity: parseFloat(cs.opacity) || 1, textAlign: cs.textAlign,
        lineHeight: parseFloat(cs.lineHeight) || 0, letterSpacing: parseFloat(cs.letterSpacing) || 0,
        rotation, href: el.closest('a[href]')?.href || '', slideScaleX, slideScaleY
      };
    }).filter(x => x.x + x.w > 0 && x.y + x.h > 0 && x.x < rect.width && x.y < rect.height);
    [...new Set(textNodes.map(node => node.parentElement))].forEach(el => el.classList.add('__editable_pptx_text'));
    target.querySelectorAll('[data-pptx-shape]').forEach(el => el.classList.add('__editable_pptx_shape'));
    target.querySelectorAll('[data-pptx-line-shape]').forEach(el => el.classList.add('__editable_pptx_line'));
    const style = document.createElement('style');
    style.id = '__editable_pptx_hide_text';
    style.textContent = `.__editable_pptx_text{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important} .__editable_pptx_text::before,.__editable_pptx_text::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important} .__editable_pptx_shape{background:transparent!important;background-image:none!important;border-color:transparent!important;box-shadow:none!important} .__editable_pptx_line{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:transparent!important} svg text{fill:transparent!important;stroke:transparent!important}`;
    document.head.appendChild(style);
    return { clip: { x: Math.max(0, rect.left), y: Math.max(0, rect.top), width: rect.width, height: rect.height }, texts, shapes, lines };
  }, { selector, index });
}

async function restoreSlide(page) {
  await page.evaluate(() => {
    document.getElementById('__editable_pptx_hide_text')?.remove();
    document.querySelectorAll('.__editable_pptx_text').forEach(el => el.classList.remove('__editable_pptx_text'));
    document.querySelectorAll('.__editable_pptx_shape').forEach(el => el.classList.remove('__editable_pptx_shape'));
    document.querySelectorAll('.__editable_pptx_line').forEach(el => el.classList.remove('__editable_pptx_line'));
    (window.__editablePptxRestore || []).forEach(({ el, style, hidden }) => {
      style == null ? el.removeAttribute('style') : el.setAttribute('style', style);
      el.hidden = hidden;
    });
    delete window.__editablePptxRestore;
  });
}

async function detectSelector(page, requested) {
  const candidates = requested ? [requested] : ['#deck > .slide', '.slides > section', '[data-slide]', '.slide', 'main > section', 'body > section'];
  for (const candidate of candidates) {
    try { if (await page.locator(candidate).count()) return candidate; } catch {}
  }
  fail(`Could not detect slides. Pass --selector, e.g. "#deck > .slide"`);
}

async function resolveSource(input) {
  if (/^https?:\/\//i.test(input)) return { url: input };
  let full = path.resolve(input);
  if (!fs.existsSync(full)) fail(`Input does not exist: ${full}`);
  if (fs.statSync(full).isDirectory()) return { root: full, entry: 'index.html' };
  return { root: path.dirname(full), entry: path.basename(full) };
}

async function serveDirectory(root, entry) {
  const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4' };
  const server = http.createServer((req, res) => {
    const raw = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = raw === '/' ? entry : raw.replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(path.resolve(root)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/${encodeURI(entry)}` };
}

async function launchBrowser() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  const executablePath = candidates.find(fs.existsSync);
  if (!executablePath) fail('Microsoft Edge or Google Chrome was not found.');
  return chromium.launch({ executablePath, headless: true });
}

function parseArgs(argv) { const out = {}; for (let i=0;i<argv.length;i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i+1]?.startsWith('--') ? true : argv[++i]; return out; }
function cleanFont(value='Arial') { return value.split(',')[0].replace(/["']/g,'').trim() || 'Arial'; }
function rgbToHex(value='rgb(0,0,0)') { const n = value.match(/[\d.]+/g)?.slice(0,3).map(Number) || [0,0,0]; return n.map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('').toUpperCase(); }
function mapAlign(v) { return ['center','right','justify'].includes(v) ? v : 'left'; }
function resolveShapeType(pptx, value='roundRect') {
  const key = String(value || 'roundRect').trim();
  const aliases = { roundrect:'roundRect', rectangle:'rect', circle:'ellipse', pill:'roundRect' };
  const resolved = aliases[key.toLowerCase()] || key;
  return pptx.ShapeType[resolved] || pptx.ShapeType[resolved.toLowerCase()] || pptx.ShapeType.roundRect;
}
function mapDash(value='solid') {
  const key = String(value).toLowerCase();
  if (key.includes('dot')) return 'dash';
  if (key.includes('dash')) return 'dash';
  return 'solid';
}
function opacityToTransparency(v) { return Math.round((1 - Math.max(0, Math.min(1, v))) * 100); }
function clamp(v,min,max) { return Math.max(min,Math.min(max,v)); }
function fail(message) { console.error(message); process.exit(1); }
