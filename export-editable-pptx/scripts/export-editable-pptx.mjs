#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
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
  let svgObjects = 0;
  let chartObjects = 0;
  let rasterOnlyObjects = 0;
  let semanticObjects = 0;
  let semanticRebuiltObjects = 0;
  let unsupportedSemanticObjects = 0;
  let groupObjects = 0;
  // 渐变填充的 shape：pptxgenjs 只支持 solid fill，这里记录形状在 slide XML 中的 <p:sp> 顺序，
  // 导出完成后统一注入 gradFill（渐变颜色/色标在 PowerPoint 中仍可编辑）。
  const gradientShapes = [];
  const groupDefinitions = [];

  for (let index = 0; index < count; index++) {
    const data = await prepareSlide(page, selector, index);
    const imagePath = path.join(tempDir, `slide-${String(index + 1).padStart(3, '0')}.png`);
    await page.screenshot({ path: imagePath, clip: data.clip, animations: 'disabled' });
    await restoreSlide(page);
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addImage({ path: imagePath, x: 0, y: 0, w: 13.333, h: 7.5 });
    const objects = [
      ...data.shapes.map(item => ({ kind: 'shape', item })),
      ...data.lines.map(item => ({ kind: 'line', item })),
      ...data.charts.map(item => ({ kind: 'chart', item })),
      ...data.svgs.map(item => ({ kind: 'svg', item })),
      ...data.texts.map(item => ({ kind: 'text', item })),
    ].sort((a, b) => a.item.z - b.item.z || a.item.order - b.item.order);
    for (const object of objects) {
      if (object.item.groupId) groupDefinitions.push({
        slideIndex: index,
        id: object.item.groupId,
        name: object.item.groupName,
        objectName: object.item.objectName,
      });
    }
    let shapeIdx = 0;
    for (const object of objects) {
      const item = object.item;
      if (object.kind === 'shape') {
      const x = clamp((item.x / data.clip.width) * 13.333, 0, 13.333);
      const y = clamp((item.y / data.clip.height) * 7.5, 0, 7.5);
      const w = clamp((item.w / data.clip.width) * 13.333, 0.02, 13.333 - x);
      const h = clamp((item.h / data.clip.height) * 7.5, 0.02, 7.5 - y);
      const shapeType = resolveShapeType(pptx, item.type);
      // 渐变：先以首个色标作占位 solid fill（视觉兜底），后处理阶段再注入 gradFill。
      const fillColor = item.gradient ? item.gradient.colors[0] : item.fill;
      const fillTransparency = item.gradient ? 0 : item.fillTransparency;
      if (item.gradient) gradientShapes.push({ slideIndex: index, spIndex: shapeIdx, name: item.objectName, gradient: item.gradient });
      const shapeOptions = {
        x, y, w, h,
        fill: { color: fillColor, transparency: fillTransparency },
        line: { color: item.line, transparency: item.lineTransparency, width: Math.max(0.1, item.lineWidth * item.slideScaleX * (13.333 * 72 / data.clip.width)) },
        objectName: item.objectName,
        rotate: item.rotation || 0,
        flipH: item.flipH,
        flipV: item.flipV,
      };
      if (Number.isFinite(item.arcThicknessRatio)) shapeOptions.arcThicknessRatio = item.arcThicknessRatio;
      if (item.shadow) shapeOptions.shadow = { type: 'outer', color: item.shadowColor, opacity: item.shadowOpacity, blur: item.shadowBlur, angle: 45, distance: item.shadowDistance };
      slide.addShape(shapeType, shapeOptions);
      shapeObjects++;
        shapeIdx++;
      } else if (object.kind === 'line') {
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
        slide.addShape(pptx.ShapeType.line, { x, y, w, h, line, objectName: item.objectName });
      lineObjects++;
      } else if (object.kind === 'chart') {
        const x = clamp((item.x / data.clip.width) * 13.333, 0, 13.333);
        const y = clamp((item.y / data.clip.height) * 7.5, 0, 7.5);
        const w = clamp((item.w / data.clip.width) * 13.333, 0.02, 13.333 - x);
        const h = clamp((item.h / data.clip.height) * 7.5, 0.02, 7.5 - y);
        const chartType = pptx.ChartType[item.chartType] || pptx.ChartType.doughnut;
        slide.addChart(chartType, [{ name: item.seriesName, labels: item.labels, values: item.values }], {
          x, y, w, h,
          showLegend: false, showTitle: false, showValue: false, showCategoryName: false, showPercent: false,
          showBorder: false, holeSize: item.holeSize, firstSliceAng: item.firstSliceAngle, chartColors: item.colors,
          objectName: item.objectName,
          chartArea: { fill: { color: 'FFFFFF', transparency: 100 } },
          plotArea: { fill: { color: 'FFFFFF', transparency: 100 } },
        });
        chartObjects++;
      } else if (object.kind === 'svg') {
      const x = clamp((item.x / data.clip.width) * 13.333, 0, 13.333);
      const y = clamp((item.y / data.clip.height) * 7.5, 0, 7.5);
      const w = clamp((item.w / data.clip.width) * 13.333, 0.02, 13.333 - x);
      const h = clamp((item.h / data.clip.height) * 7.5, 0.02, 7.5 - y);
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(item.svgMarkup, 'utf8').toString('base64')}`;
      slide.addImage({ data: dataUri, x, y, w, h, objectName: item.objectName });
      svgObjects++;
      } else if (object.kind === 'text') {
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
      options.objectName = item.objectName;
      slide.addText(item.text, options);
      textObjects++;
      }
    }
    rasterOnlyObjects += data.metrics.rasterOnly;
    semanticObjects += data.metrics.semantic;
    semanticRebuiltObjects += data.metrics.semanticRebuilt;
    unsupportedSemanticObjects += data.metrics.unsupportedSemantic;
  }

  fs.mkdirSync(outDir, { recursive: true });
  await pptx.writeFile({ fileName: path.resolve(args.output) });
  // 后处理：pptxgenjs 无渐变 API，把记录到的渐变 shape 的 solidFill 替换为 gradFill
  if (gradientShapes.length) await injectGradientFills(path.resolve(args.output), gradientShapes);
  if (groupDefinitions.length) groupObjects = await injectGroups(path.resolve(args.output), groupDefinitions);
  console.log(`PPTX exported: ${path.resolve(args.output)}`);
  const semanticCoverage = semanticObjects ? Math.round(semanticRebuiltObjects / semanticObjects * 1000) / 10 : 100;
  console.log(`Slides: ${count}; editable text objects: ${textObjects}; editable shape objects: ${shapeObjects}; editable line objects: ${lineObjects}; editable chart objects: ${chartObjects}; SVG image objects: ${svgObjects}; PowerPoint group objects: ${groupObjects}; intentional raster-only objects: ${rasterOnlyObjects}; semantic editability coverage: ${semanticCoverage}%; unsupported semantic objects: ${unsupportedSemanticObjects}; mode: hybrid-editable-v3`);
  // Best-effort temp cleanup. A sandbox safe-delete hook can make fs.rmSync throw (genie-trash
  // ETIMEDOUT); that must never mask a successful export, so swallow it and warn instead.
  try { fs.rmSync(tempDir, { recursive: true, force: true }); }
  catch (e) { console.warn(`temp cleanup skipped (non-fatal): ${e.message}`); }
} finally {
  // Agent/sandbox gotcha: browser.close() can hang indefinitely in some sandboxed Chromium builds.
  // The PPTX is already written above, so cap the close with a timeout race and never block delivery.
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  if (server) await new Promise(resolve => server.close(resolve));
}

async function prepareSlide(page, selector, index) {
  return page.evaluate(({ selector, index }) => {
    const slides = [...document.querySelectorAll(selector)];
    const target = slides[index];
    if (!target) throw new Error(`Slide ${index + 1} is missing`);
    const targetShell = target.closest('[data-slide-shell]');
    const shells = [...new Set(slides.map(el => el.closest('[data-slide-shell]')).filter(Boolean))];
    window.__editablePptxRestore = {
      slides: slides.map(el => ({ el, style: el.getAttribute('style'), hidden: el.hidden })),
      shells: shells.map(el => ({ el, style: el.getAttribute('style'), hidden: el.hidden })),
    };
    shells.forEach(el => {
      el.hidden = false;
      if (el !== targetShell) el.style.setProperty('display', 'none', 'important');
    });
    slides.forEach((el, i) => {
      el.hidden = false;
      if (i !== index) el.style.setProperty('display', 'none', 'important');
      else {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
      }
    });
    // Capture every slide at the viewport origin instead of expanding Chromium to the
    // height of the whole stacked deck. This stays stable for long presentations.
    if (targetShell) {
      targetShell.style.setProperty('position', 'fixed', 'important');
      targetShell.style.setProperty('left', '0', 'important');
      targetShell.style.setProperty('top', '0', 'important');
      targetShell.style.setProperty('width', '1600px', 'important');
      targetShell.style.setProperty('height', '900px', 'important');
      targetShell.style.setProperty('overflow', 'visible', 'important');
      targetShell.style.setProperty('transform', 'none', 'important');
      targetShell.style.setProperty('z-index', '2147483647', 'important');
    } else {
      // Generic decks may expose slides directly without a data-slide-shell wrapper.
      // Fix the active slide itself to the origin so later stacked pages are capturable too.
      target.style.setProperty('position', 'fixed', 'important');
      target.style.setProperty('z-index', '2147483647', 'important');
    }
    target.style.setProperty('--slide-scale', '1', 'important');
    target.style.setProperty('transform', 'none', 'important');
    target.style.setProperty('left', '0', 'important');
    target.style.setProperty('top', '0', 'important');
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
    // 解析 data-pptx-fill-gradient："linear:135:#A855F7:#7C3AED" 或 "radial:#FFFFFF:#F5F3FF"
    const parseGradient = (attr) => {
      if (!attr) return null;
      const parts = attr.split(':').map(s => s.trim());
      const type = parts[0].toLowerCase();
      if (type !== 'linear' && type !== 'radial') return null;
      let angle = 0;
      let startIdx = 1;
      if (type === 'linear' && /^-?\d+$/.test(parts[1])) { angle = Number(parts[1]); startIdx = 2; }
      const colors = parts.slice(startIdx)
        .map(c => c.replace('#', '').trim())
        .filter(c => /^[0-9a-f]{6}$/i.test(c))
        .map(c => c.toUpperCase());
      if (colors.length < 2) return null;
      return { type, angle, colors };
    };
    // 从 CSS box-shadow 第一层推断外阴影（无显式 data-pptx-shadow 时兜底）
    const parseBoxShadow = (value) => {
      if (!value || value === 'none') return null;
      const colorMatch = value.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/);
      if (!colorMatch) return null;
      const numericPart = value.slice(0, colorMatch.index);
      const nums = (numericPart.match(/[-+]?\d*\.?\d+/g) || []).map(Number);
      const offX = nums[0] || 0;
      const offY = nums[1] || 0;
      return {
        colorHex: colorHex(colorMatch[0], '53677A'),
        opacity: colorAlpha(colorMatch[0]),
        blur: Math.max(0, nums[2] || 3),
        distance: Math.max(0.5, Math.sqrt(offX * offX + offY * offY)),
      };
    };
    const orderOf = (() => {
      const elements = [...target.querySelectorAll('*')];
      return el => Math.max(0, elements.indexOf(el));
    })();
    const renderMode = (el, fallback='native') => (el.getAttribute('data-pptx-render') || fallback).trim().toLowerCase();
    const zOf = (el, fallback) => {
      const raw = el.closest('[data-pptx-z]')?.getAttribute('data-pptx-z');
      return raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
    };
    const numberAttr = (el, name, fallback) => {
      const raw = el.getAttribute(name);
      return raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
    };
    const listAttr = (el, name) => (el.getAttribute(name) || '').split(',').map(v => v.trim()).filter(Boolean);
    const groupOf = el => {
      const groupEl = el.closest('[data-pptx-group]');
      if (!groupEl) return { groupId: '', groupName: '' };
      return {
        groupId: groupEl.getAttribute('data-pptx-group') || '',
        groupName: groupEl.getAttribute('data-pptx-group-name') || groupEl.getAttribute('data-pptx-group') || 'Group',
      };
    };
    const safeName = (prefix, el, fallback) => {
      const label = el.getAttribute('data-pptx-name') || el.getAttribute('data-pptx-role') || fallback;
      return `${prefix}-${orderOf(el)}-${label.replace(/[^A-Za-z0-9_.-]+/g, '-')}`;
    };
    const nativeShapeEls = [...target.querySelectorAll('[data-pptx-shape]')].filter(el => renderMode(el) === 'native');
    const shapes = nativeShapeEls.map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const typeValue = (el.getAttribute('data-pptx-shape') || '').trim();
      const fillValue = el.getAttribute('data-pptx-fill') || cs.backgroundColor;
      const lineValue = el.getAttribute('data-pptx-line') || cs.borderTopColor;
      const fillOpacity = numberAttr(el, 'data-pptx-fill-opacity', colorAlpha(fillValue) * 100);
      const lineOpacity = numberAttr(el, 'data-pptx-line-opacity', colorAlpha(lineValue) * 100);
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      const normalizedType = typeValue.toLowerCase();
      const type = !typeValue || normalizedType === 'auto'
        ? (radius >= Math.min(r.width, r.height) * 0.45 ? 'ellipse' : radius > 1 ? 'roundRect' : 'rect')
        : normalizedType === 'roundrect' ? 'roundRect' : typeValue;
      // 外阴影：显式 data-pptx-shadow 优先，否则从 CSS box-shadow 推断
      const shadowAttr = el.getAttribute('data-pptx-shadow');
      const explicitShadow = shadowAttr === 'true' || shadowAttr === 'false';
      const inferred = explicitShadow ? null : parseBoxShadow(cs.boxShadow);
      const shadow = explicitShadow ? shadowAttr === 'true' : !!inferred;
      const shadowColor = explicitShadow
        ? (el.getAttribute('data-pptx-shadow-color') || '#53677A').replace('#', '').toUpperCase()
        : (inferred ? inferred.colorHex : '53677A');
      const shadowOpacity = explicitShadow
        ? Number(el.getAttribute('data-pptx-shadow-opacity') || 0.16)
        : (inferred ? inferred.opacity : 0.16);
      const shadowBlur = explicitShadow
        ? Number(el.getAttribute('data-pptx-shadow-blur') || 3)
        : (inferred ? inferred.blur : 3);
      const shadowDistance = explicitShadow
        ? Number(el.getAttribute('data-pptx-shadow-distance') || 1.2)
        : (inferred ? inferred.distance : 1.2);
      const group = groupOf(el);
      return {
        type, x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height,
        fill: colorHex(fillValue, el.getAttribute('data-pptx-fill') || '#FFFFFF'),
        fillTransparency: Math.round(100 - Math.max(0, Math.min(100, fillOpacity))),
        line: colorHex(lineValue, el.getAttribute('data-pptx-line') || '#FFFFFF'),
        lineTransparency: Math.round(100 - Math.max(0, Math.min(100, lineOpacity))),
        lineWidth: numberAttr(el, 'data-pptx-line-width', parseFloat(cs.borderTopWidth) || 0.1),
        gradient: parseGradient(el.getAttribute('data-pptx-fill-gradient')),
        shadow, shadowColor, shadowOpacity, shadowBlur, shadowDistance,
        rotation: numberAttr(el, 'data-pptx-rotation', 0),
        flipH: el.getAttribute('data-pptx-flip-h') === 'true',
        flipV: el.getAttribute('data-pptx-flip-v') === 'true',
        arcThicknessRatio: numberAttr(el, 'data-pptx-arc-thickness-ratio', NaN),
        objectName: safeName('shape', el, 'object'),
        ...group,
        z: zOf(el, 20), order: orderOf(el),
        slideScaleX, slideScaleY
      };
    }).filter(x => x.w > 1 && x.h > 1 && x.x + x.w > 0 && x.y + x.h > 0 && x.x < rect.width && x.y < rect.height);
    const nativeLineEls = [...target.querySelectorAll('[data-pptx-line-shape]')].filter(el => renderMode(el) === 'native');
    const lines = nativeLineEls.map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const direction = (el.getAttribute('data-pptx-line-shape') || 'horizontal').toLowerCase();
      let x1 = r.left - rect.left, y1 = r.top - rect.top, x2 = r.right - rect.left, y2 = r.top - rect.top;
      if (direction === 'vertical' || direction === 'down') { x2 = x1; y2 = r.bottom - rect.top; }
      if (direction === 'up') { y1 = r.bottom - rect.top; x2 = r.right - rect.left; y2 = r.top - rect.top; }
      if (direction === 'down-right' || direction === 'diagonal') y2 = r.bottom - rect.top;
      const start = listAttr(el, 'data-pptx-line-start').map(Number);
      const end = listAttr(el, 'data-pptx-line-end').map(Number);
      if (start.length === 2 && start.every(Number.isFinite)) { x1 = r.left - rect.left + r.width * start[0] / 100; y1 = r.top - rect.top + r.height * start[1] / 100; }
      if (end.length === 2 && end.every(Number.isFinite)) { x2 = r.left - rect.left + r.width * end[0] / 100; y2 = r.top - rect.top + r.height * end[1] / 100; }
      const colorValue = el.getAttribute('data-pptx-line-color') || cs.borderTopColor || cs.color;
      const opacityAttr = el.getAttribute('data-pptx-line-opacity');
      const opacity = opacityAttr == null || opacityAttr === '' ? colorAlpha(colorValue) * 100 : Number(opacityAttr);
      const group = groupOf(el);
      return {
        x: x1, y: y1, w: x2 - x1, h: y2 - y1,
        color: colorHex(colorValue, '#000000'), transparency: Math.round(100 - Math.max(0, Math.min(100, opacity))),
        width: numberAttr(el, 'data-pptx-line-width', parseFloat(cs.borderTopWidth) || 1),
        dash: el.getAttribute('data-pptx-line-dash') || cs.borderTopStyle || 'solid',
        beginArrowType: el.getAttribute('data-pptx-line-begin-arrow') || '',
        endArrowType: el.getAttribute('data-pptx-line-end-arrow') || '',
        objectName: safeName('line', el, 'connector'),
        ...group,
        z: zOf(el, 40), order: orderOf(el), slideScaleX, slideScaleY
      };
    }).filter(x => Number.isFinite(x.x + x.y + x.w + x.h) && (Math.abs(x.w) > .5 || Math.abs(x.h) > .5));
    const chartEls = [...target.querySelectorAll('[data-pptx-chart]')].filter(el => renderMode(el, 'chart') === 'chart');
    const charts = chartEls.map(el => {
      const r = el.getBoundingClientRect();
      const values = listAttr(el, 'data-pptx-values').map(Number).filter(Number.isFinite);
      const safeValues = values.length >= 2 ? values : [75, 25];
      const labels = listAttr(el, 'data-pptx-labels');
      const colors = listAttr(el, 'data-pptx-colors').map(value => colorHex(value, '#D00000'));
      const group = groupOf(el);
      return {
        chartType: (el.getAttribute('data-pptx-chart') || 'doughnut').trim(),
        values: safeValues,
        labels: labels.length === safeValues.length ? labels : safeValues.map((_, i) => `Part ${i + 1}`),
        colors: colors.length === safeValues.length ? colors : ['D00000', 'F4D9D9'],
        seriesName: el.getAttribute('data-pptx-series-name') || 'Value',
        holeSize: Math.max(10, Math.min(90, numberAttr(el, 'data-pptx-hole-size', 70))),
        firstSliceAngle: Math.max(0, Math.min(359, numberAttr(el, 'data-pptx-first-slice-angle', 270))),
        objectName: safeName('chart', el, 'metric'),
        ...group,
        x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height,
        z: zOf(el, 30), order: orderOf(el), slideScaleX, slideScaleY,
      };
    }).filter(x => x.w > 1 && x.h > 1 && x.x + x.w > 0 && x.y + x.h > 0 && x.x < rect.width && x.y < rect.height);
    // Extract visible text nodes, not both their contenteditable container and
    // styled descendants. This prevents duplicated parent/child text overlays.
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const el = node.parentElement;
        if (!el || el.closest('[data-pptx-ignore="true"],[data-pptx-render="raster"],[data-pptx-chart]')) return NodeFilter.FILTER_REJECT;
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
    const svgEls = [...target.querySelectorAll('[data-pptx-svg]')].filter(el => renderMode(el, 'svg') === 'svg');
    const svgs = svgEls.map(el => {
      const svg = el.tagName.toLowerCase() === 'svg' ? el : el.querySelector('svg');
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      const copyStyles = (source, clone) => {
        const cs = getComputedStyle(source);
        const style = [
          ['fill', cs.fill], ['fill-opacity', cs.fillOpacity], ['fill-rule', cs.fillRule],
          ['clip-rule', cs.clipRule], ['stroke', cs.stroke], ['stroke-opacity', cs.strokeOpacity],
          ['stroke-width', cs.strokeWidth], ['stroke-linecap', cs.strokeLinecap],
          ['stroke-linejoin', cs.strokeLinejoin], ['stroke-dasharray', cs.strokeDasharray],
          ['stroke-miterlimit', cs.strokeMiterlimit], ['opacity', cs.opacity]
        ].filter(([, value]) => value && value !== 'none' && value !== 'normal').map(([key, value]) => `${key}:${value}`).join(';');
        if (style) clone.setAttribute('style', style);
        [...source.children].forEach((child, index) => {
          const childClone = clone.children[index];
          if (childClone) copyStyles(child, childClone);
        });
      };
      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      copyStyles(svg, clone);
      // Resolve shared <use href="#id"> references so the exported SVG is self-contained.
      // PowerPoint's SVG importer does not reliably resolve external <use> refs, so expand
      // them into concrete geometry, then merge referenced <defs> (gradients, filters, etc).
      const expandUses = (root) => {
        const uses = [...root.querySelectorAll('use')];
        for (const use of uses) {
          const href = (use.getAttribute('href') || use.getAttribute('xlink:href') || '').trim();
          if (!href.startsWith('#')) continue;
          const ref = document.getElementById(href.slice(1));
          if (!ref) continue;
          let replacement;
          if (ref.tagName.toLowerCase() === 'symbol') {
            // A symbol owns its own viewport. Preserve that viewport in a nested SVG so
            // a 24×24 icon scales correctly when <use> renders it at another size.
            replacement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const viewBox = ref.getAttribute('viewBox');
            if (viewBox) replacement.setAttribute('viewBox', viewBox);
            replacement.setAttribute('preserveAspectRatio', use.getAttribute('preserveAspectRatio') || ref.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
            replacement.setAttribute('x', use.getAttribute('x') || '0');
            replacement.setAttribute('y', use.getAttribute('y') || '0');
            replacement.setAttribute('width', use.getAttribute('width') || '100%');
            replacement.setAttribute('height', use.getAttribute('height') || '100%');
            [...ref.children].forEach(c => replacement.appendChild(c.cloneNode(true)));
          } else {
            replacement = ref.cloneNode(true);
            ['x', 'y', 'width', 'height'].forEach(a => { const v = use.getAttribute(a); if (v != null) replacement.setAttribute(a, v); });
          }
          // Preserve presentation and transform attributes applied directly to <use>.
          for (const attr of [...use.attributes]) {
            if (['href', 'xlink:href', 'x', 'y', 'width', 'height', 'preserveAspectRatio'].includes(attr.name)) continue;
            replacement.setAttribute(attr.name, attr.value);
          }
          use.replaceWith(replacement);
          expandUses(replacement);
        }
      };
      const mergeDefs = (root) => {
        let rootDefs = root.querySelector('defs');
        if (!rootDefs) {
          rootDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          root.insertBefore(rootDefs, root.firstChild);
        }
        const seen = new Set();
        root.querySelectorAll('[id]').forEach(node => seen.add(node.getAttribute('id')));
        document.querySelectorAll('svg defs').forEach(src => {
          [...src.children].forEach(child => {
            const id = child.getAttribute('id');
            if (id && seen.has(id)) return;
            if (id) seen.add(id);
            rootDefs.appendChild(child.cloneNode(true));
          });
        });
      };
      expandUses(clone);
      mergeDefs(clone);
      return { x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height, svgMarkup: new XMLSerializer().serializeToString(clone), objectName: safeName('svg', el, 'graphic'), ...groupOf(el), z: zOf(el, 50), order: orderOf(el), slideScaleX, slideScaleY };
    }).filter(item => item && item.w > 1 && item.h > 1 && item.x + item.w > 0 && item.y + item.h > 0 && item.x < rect.width && item.y < rect.height);
    const cumulativeTextScale = (node) => {
      let scaleX = 1;
      let scaleY = 1;
      let current = node;
      while (current && current !== target) {
        const transform = getComputedStyle(current).transform;
        if (transform && transform.startsWith('matrix(')) {
          const values = transform.slice(7, -1).split(',').map(Number);
          if (values.length >= 6 && values.every(Number.isFinite)) {
            scaleX *= Math.hypot(values[0], values[1]);
            scaleY *= Math.hypot(values[2], values[3]);
          }
        }
        current = current.parentElement;
      }
      return { scaleX, scaleY };
    };
    const texts = textNodes.map((node, textIndex) => {
      const el = node.parentElement;
      const range = document.createRange();
      range.selectNodeContents(node);
      // Most text slots live inside a positioned container whose width is
      // intentionally larger than the glyph bounds. When a component marks
      // that host with data-pptx-text="true", preserve the authored text box
      // instead of shrinking it to the browser's painted range. This keeps
      // Chinese copy and other font-metric-sensitive text from wrapping
      // prematurely after PowerPoint rebuilds it as a native text box.
      const rangeRect = range.getBoundingClientRect();
      const hostRect = el.matches('[data-pptx-text="true"]') ? el.getBoundingClientRect() : null;
      const r = hostRect && hostRect.width > rangeRect.width ? hostRect : rangeRect;
      const cs = getComputedStyle(el);
      const matrix = cs.transform?.startsWith('matrix(') ? cs.transform.slice(7, -1).split(',').map(Number) : null;
      const rotation = matrix ? Math.round(Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI) : 0;
      const textScale = cumulativeTextScale(el);
      const weight = cs.fontWeight === 'bold' ? 700 : parseInt(cs.fontWeight, 10) || 400;
      const group = groupOf(el);
      return {
        text: node.textContent.replace(/\s+/g, ' ').trim(), x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height,
        fontFamily: cs.fontFamily, fontSize: (parseFloat(cs.fontSize) || 16) * textScale.scaleY,
        fontWeight: weight, fontStyle: cs.fontStyle,
        color: cs.color, opacity: parseFloat(cs.opacity) || 1, textAlign: cs.textAlign,
        lineHeight: (parseFloat(cs.lineHeight) || 0) * textScale.scaleY, letterSpacing: (parseFloat(cs.letterSpacing) || 0) * textScale.scaleX,
        rotation, href: el.closest('a[href]')?.href || '', objectName: `${safeName('text', el, 'text')}-${textIndex}`, ...group, z: zOf(el, 100), order: orderOf(el), slideScaleX, slideScaleY
      };
    }).filter(x => x.x + x.w > 0 && x.y + x.h > 0 && x.x < rect.width && x.y < rect.height);
    [...new Set(textNodes.map(node => node.parentElement))].forEach(el => el.classList.add('__editable_pptx_text'));
    nativeShapeEls.forEach(el => el.classList.add('__editable_pptx_shape'));
    nativeLineEls.forEach(el => el.classList.add('__editable_pptx_line'));
    chartEls.forEach(el => el.classList.add('__editable_pptx_chart'));
    svgEls.forEach(el => el.classList.add('__editable_pptx_svg'));
    const style = document.createElement('style');
    style.id = '__editable_pptx_hide_text';
    style.textContent = `.__editable_pptx_text{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important} .__editable_pptx_text::before,.__editable_pptx_text::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important} .__editable_pptx_shape{background:transparent!important;background-image:none!important;border-color:transparent!important;box-shadow:none!important;outline-color:transparent!important} .__editable_pptx_line{background:transparent!important;background-image:none!important;border-color:transparent!important;box-shadow:none!important;color:transparent!important} .__editable_pptx_chart,.__editable_pptx_svg{visibility:hidden!important}`;
    document.head.appendChild(style);
    const semanticEls = [...target.querySelectorAll('[data-pptx-semantic="true"],[data-pptx-role]')];
    const rebuiltEls = new Set([...nativeShapeEls, ...nativeLineEls, ...chartEls, ...svgEls]);
    const textHosts = new Set(textNodes.map(node => node.parentElement));
    const rasterEls = [...target.querySelectorAll('[data-pptx-render="raster"]')];
    const nativeEls = new Set([...nativeShapeEls, ...nativeLineEls, ...chartEls]);
    const semanticRebuilt = semanticEls.filter(el => nativeEls.has(el) || textHosts.has(el) || el.matches('[data-pptx-text="true"]')).length;
    const metrics = {
      rasterOnly: rasterEls.length,
      semantic: semanticEls.length,
      semanticRebuilt,
      unsupportedSemantic: semanticEls.filter(el => !rebuiltEls.has(el) && !textHosts.has(el) && !rasterEls.includes(el) && !el.matches('[data-pptx-text="true"]')).length,
    };
    return { clip: { x: Math.max(0, rect.left), y: Math.max(0, rect.top), width: rect.width, height: rect.height }, texts, shapes, lines, charts, svgs, metrics };
  }, { selector, index });
}

async function restoreSlide(page) {
  await page.evaluate(() => {
    document.getElementById('__editable_pptx_hide_text')?.remove();
    document.querySelectorAll('.__editable_pptx_text').forEach(el => el.classList.remove('__editable_pptx_text'));
    document.querySelectorAll('.__editable_pptx_shape').forEach(el => el.classList.remove('__editable_pptx_shape'));
    document.querySelectorAll('.__editable_pptx_line').forEach(el => el.classList.remove('__editable_pptx_line'));
    document.querySelectorAll('.__editable_pptx_chart').forEach(el => el.classList.remove('__editable_pptx_chart'));
    document.querySelectorAll('.__editable_pptx_svg').forEach(el => el.classList.remove('__editable_pptx_svg'));
    const restore = window.__editablePptxRestore || { slides: [], shells: [] };
    [...restore.slides, ...restore.shells].forEach(({ el, style, hidden }) => {
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
  // Agent/sandbox environments (CodeBuddy/WorkBuddy sandbox, CI) need --no-sandbox or Chromium's
  // sandbox init crashes and the process is killed with empty output. Safe for local headless use too.
  return chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox'],
  });
}

function parseArgs(argv) { const out = {}; for (let i=0;i<argv.length;i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i+1]?.startsWith('--') ? true : argv[++i]; return out; }
function cleanFont(value='Arial') { return value.split(',')[0].replace(/["']/g,'').trim() || 'Arial'; }
function rgbToHex(value='rgb(0,0,0)') { const n = value.match(/[\d.]+/g)?.slice(0,3).map(Number) || [0,0,0]; return n.map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('').toUpperCase(); }
function mapAlign(v) { return ['center','right','justify'].includes(v) ? v : 'left'; }
function resolveShapeType(pptx, value='roundRect') {
  const key = String(value || 'roundRect').trim();
  const aliases = { roundrect:'roundRect', rectangle:'rect', circle:'ellipse', pill:'roundRect', blockarc:'blockArc' };
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

// 把渐变 shape 的占位 solidFill 替换为原生 gradFill（渐变颜色/色标在 PowerPoint 中仍可编辑）。
async function injectGradientFills(outputPath, gradientShapes) {
  const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));
  const bySlide = new Map();
  for (const g of gradientShapes) {
    if (!bySlide.has(g.slideIndex)) bySlide.set(g.slideIndex, []);
    bySlide.get(g.slideIndex).push(g);
  }
  for (const [slideIndex, items] of bySlide) {
    const file = `ppt/slides/slide${slideIndex + 1}.xml`;
    const entry = zip.file(file);
    if (!entry) continue;
    let xml = await entry.async('string');
    // 匹配完整 <p:sp>…</p:sp>（<p:spPr>/<p:spt> 等前缀被 (?=[\s>]) 排除）
    const sps = [...xml.matchAll(/<p:sp(?=[\s>])[\s\S]*?<\/p:sp>/g)];
    for (const item of items) {
      const named = item.name && sps.find(candidate => new RegExp(`<p:cNvPr[^>]*name="${escapeRegex(item.name)}"`).test(candidate));
      const sp = named || sps[item.spIndex];
      if (!sp) continue;
      const original = sp[0];
      const replaced = original.replace(/<a:solidFill(?:\s[^>]*)?>[\s\S]*?<\/a:solidFill>/, gradFillXml(item.gradient));
      if (replaced !== original) xml = xml.replace(original, replaced);
    }
    zip.file(file, xml);
  }
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outputPath, out);
}

// 将同一 data-pptx-group 下的原生对象包进真正的 PowerPoint p:grpSp。
// 子对象不被栅格化，仍可在 PowerPoint 中单独选中、编辑和取消组合。
async function injectGroups(outputPath, groupDefinitions) {
  const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));
  const bySlide = new Map();
  for (const definition of groupDefinitions) {
    if (!definition.id || !definition.objectName) continue;
    if (!bySlide.has(definition.slideIndex)) bySlide.set(definition.slideIndex, new Map());
    const slideGroups = bySlide.get(definition.slideIndex);
    const key = String(definition.id);
    if (!slideGroups.has(key)) slideGroups.set(key, { id: key, name: definition.name || key, objectNames: [] });
    const group = slideGroups.get(key);
    if (!group.objectNames.includes(definition.objectName)) group.objectNames.push(definition.objectName);
  }

  let total = 0;
  for (const [slideIndex, groups] of bySlide) {
    const file = `ppt/slides/slide${slideIndex + 1}.xml`;
    const entry = zip.file(file);
    if (!entry) continue;
    let xml = await entry.async('string');
    for (const group of groups.values()) {
      if (group.objectNames.length < 2) continue;
      const candidates = [...xml.matchAll(/<(p:sp|p:pic|p:graphicFrame|p:cxnSp)(?=[\s>])[\s\S]*?<\/\1>/g)];
      const selected = group.objectNames
        .map(name => candidates.find(candidate => new RegExp(`<p:cNvPr[^>]*name="${escapeRegex(name)}"`).test(candidate[0])))
        .filter(Boolean)
        .filter((candidate, index, all) => all.findIndex(item => item.index === candidate.index) === index)
        .sort((a, b) => a.index - b.index);
      if (selected.length < 2) continue;

      const bounds = selected.map(candidate => extractNodeBounds(candidate[0])).filter(Boolean);
      if (bounds.length < 2) continue;
      const minX = Math.min(...bounds.map(item => item.x));
      const minY = Math.min(...bounds.map(item => item.y));
      const maxX = Math.max(...bounds.map(item => item.x + item.w));
      const maxY = Math.max(...bounds.map(item => item.y + item.h));
      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      const groupId = nextXmlId(xml);
      const groupName = escapeXml(group.name || 'Group');
      const groupXml = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${groupId}" name="${groupName}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${minX}" y="${minY}"/><a:ext cx="${width}" cy="${height}"/><a:chOff x="${minX}" y="${minY}"/><a:chExt cx="${width}" cy="${height}"/></a:xfrm></p:grpSpPr>${selected.map(candidate => candidate[0]).join('')}</p:grpSp>`;
      let replacement = '';
      let cursor = 0;
      selected.forEach((candidate, index) => {
        replacement += xml.slice(cursor, candidate.index);
        if (index === 0) replacement += groupXml;
        cursor = candidate.index + candidate[0].length;
      });
      replacement += xml.slice(cursor);
      xml = replacement;
      total++;
    }
    zip.file(file, xml);
  }
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outputPath, out);
  return total;
}

function extractNodeBounds(node) {
  const xfrm = node.match(/<(?:p|a):xfrm\b[\s\S]*?<\/(?:p|a):xfrm>/)?.[0] || node;
  const offTag = xfrm.match(/<a:off\b[^>]*>/)?.[0];
  const extTag = xfrm.match(/<a:ext\b[^>]*>/)?.[0];
  if (!offTag || !extTag) return null;
  const attr = (tag, name) => {
    const match = tag.match(new RegExp(`\\b${name}="(-?\\d+)"`));
    return match ? Number(match[1]) : NaN;
  };
  const x = attr(offTag, 'x');
  const y = attr(offTag, 'y');
  const w = attr(extTag, 'cx');
  const h = attr(extTag, 'cy');
  return [x, y, w, h].every(Number.isFinite) ? { x, y, w, h } : null;
}

function nextXmlId(xml) {
  let max = 0;
  for (const match of xml.matchAll(/\bid="(\d+)"/g)) max = Math.max(max, Number(match[1]));
  return max + 1;
}

function escapeXml(value) {
  return String(value).replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));
}

function gradFillXml(gradient) {
  const stops = gradient.colors.map((c, i) => {
    const pos = Math.round((i * 100000) / (gradient.colors.length - 1));
    return `<a:gs pos="${pos}"><a:srgbClr val="${c}"/></a:gs>`;
  }).join('');
  if (gradient.type === 'radial') {
    return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill>`;
  }
  const ang = Math.round(gradient.angle * 60000);
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:lin ang="${ang}" scaled="0"/></a:gradFill>`;
}

function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
