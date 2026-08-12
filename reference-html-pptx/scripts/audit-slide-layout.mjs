import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (key) out[key] = argv[i + 1];
  }
  return out;
}

function numberedPath(base, index, count) {
  if (count === 1) return base;
  const ext = path.extname(base) || '.png';
  const stem = base.slice(0, base.length - ext.length);
  return `${stem}-${String(index + 1).padStart(3, '0')}${ext}`;
}

function companionPath(base, suffix) {
  const ext = path.extname(base) || '.png';
  const stem = base.slice(0, base.length - ext.length);
  return `${stem}-${suffix}${ext}`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.screenshot || !args['playwright-root']) {
  throw new Error('Required arguments: --input, --screenshot, --playwright-root');
}

const input = path.resolve(args.input);
const screenshot = path.resolve(args.screenshot);
const width = Number(args.width || 1760);
const height = Number(args.height || 1100);
const playwrightEntry = path.join(path.resolve(args['playwright-root']), 'node_modules', 'playwright-core', 'index.js');
const playwrightModule = await import(pathToFileURL(playwrightEntry).href);
const chromium = playwrightModule.chromium || playwrightModule.default?.chromium;
if (!chromium) throw new Error('playwright-core did not expose Chromium.');

const browserCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const executablePath = browserCandidates.find((candidate) => fs.existsSync(candidate));
if (!executablePath) throw new Error('Microsoft Edge or Google Chrome was not found.');

fs.mkdirSync(path.dirname(screenshot), { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });

const result = {
  inputPath: input,
  slideCount: 0,
  screenshots: [],
  scrollPreview: companionPath(screenshot, 'scroll'),
  errors: [],
  warnings: [],
  slides: [],
};

try {
  await page.goto(pathToFileURL(input).href, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts?.ready; });
  await page.waitForTimeout(250);

  const slides = page.locator('.slide');
  result.slideCount = await slides.count();
  if (result.slideCount < 1) result.errors.push('No .slide element found.');

  const audit = await page.evaluate(() => {
    const px = (value) => Number.parseFloat(value || '0') || 0;
    const visible = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0 && r.width > 0 && r.height > 0;
    };
    const directText = (el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    const rectUnion = (rects) => {
      if (!rects.length) return null;
      return rects.reduce((a, r) => ({
        left: Math.min(a.left, r.left), top: Math.min(a.top, r.top),
        right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom),
      }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    };
    const slideEls = [...document.querySelectorAll('.slide')];
    const snapStyles = [document.documentElement, document.body, document.querySelector('.deck-preview')]
      .filter(Boolean).map((el) => getComputedStyle(el).scrollSnapType);
    const bodyBg = getComputedStyle(document.body).backgroundColor;

    const pages = slideEls.map((slide, index) => {
      const shell = slide.closest('[data-slide-shell]');
      const sr = slide.getBoundingClientRect();
      const slideStyle = getComputedStyle(slide);
      const shellStyle = shell ? getComputedStyle(shell) : null;
      const textIssues = [];
      const overflowIssues = [];
      const seen = new Set();

      const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const el = node.parentElement;
        if (!el || seen.has(el) || !visible(el) || el.closest('[data-pptx-ignore="true"]')) continue;
        seen.add(el);
        const size = px(getComputedStyle(el).fontSize);
        const role = el.closest('[data-text-role]')?.getAttribute('data-text-role') || '';
        const note = role === 'note' || role === 'source';
        const floor = note ? 14 : 16;
        if (size + 0.01 < floor) textIssues.push({ tag: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 48), size, floor });
      }

      for (const el of slide.querySelectorAll('*')) {
        if (!visible(el) || el.closest('[data-overflow-exempt="true"]')) continue;
        const cs = getComputedStyle(el);
        if (!directText(el)) continue;
        const clipped = ['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflowY);
        if (clipped && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
          overflowIssues.push({ tag: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 48), client: [el.clientWidth, el.clientHeight], scroll: [el.scrollWidth, el.scrollHeight] });
        }
      }

      const cards = [...slide.querySelectorAll('[data-density-card="true"]')].map((card) => {
        const cr = card.getBoundingClientRect();
        const cs = getComputedStyle(card);
        const innerHeight = Math.max(1, cr.height - px(cs.paddingTop) - px(cs.paddingBottom));
        const contentRects = [...card.querySelectorAll('*')]
          .filter((el) => visible(el) && (directText(el) || ['IMG', 'SVG'].includes(el.tagName) || el.hasAttribute('data-content-block')))
          .map((el) => el.getBoundingClientRect());
        const union = rectUnion(contentRects);
        const occupied = union ? Math.min(innerHeight, Math.max(0, union.bottom - union.top)) : 0;
        return {
          id: card.id || card.getAttribute('aria-label') || `card-${index + 1}`,
          height: cr.height / (sr.width / slide.offsetWidth || 1),
          utilization: occupied / innerHeight,
          exempt: card.getAttribute('data-density-exempt') === 'true',
        };
      });

      const componentTypes = [...slide.querySelectorAll('[data-component-type]')]
        .filter(visible).map((el) => el.getAttribute('data-component-type')).filter(Boolean);
      const distinctComponentTypes = [...new Set(componentTypes)];
      const primaryEmphasisCount = [...slide.querySelectorAll('[data-emphasis-level="primary"]')].filter(visible).length;
      const secondaryEmphasisCount = [...slide.querySelectorAll('[data-emphasis-level="secondary"]')].filter(visible).length;

      const region = slide.querySelector('[data-slide-content]');
      let occupancy = null;
      let occupancyExempt = false;
      if (region && visible(region)) {
        occupancyExempt = region.getAttribute('data-density-exempt') === 'true';
        const rr = region.getBoundingClientRect();
        const blocks = [...region.querySelectorAll('[data-content-block]')].filter(visible).map((el) => el.getBoundingClientRect());
        const union = rectUnion(blocks);
        occupancy = union ? ((union.right - union.left) * (union.bottom - union.top)) / Math.max(1, rr.width * rr.height) : 0;
      }

      const hasOutline = !!shellStyle && (
        shellStyle.boxShadow !== 'none' || px(shellStyle.borderTopWidth) > 0 ||
        (shellStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && shellStyle.backgroundColor !== bodyBg)
      );

      return {
        index: index + 1,
        authored: [slide.offsetWidth, slide.offsetHeight],
        rendered: [sr.width, sr.height],
        top: sr.top + scrollY,
        bottom: sr.bottom + scrollY,
        hasShell: !!shell,
        hasOutline,
        shellSnapAlign: shellStyle?.scrollSnapAlign || 'none',
        textIssues,
        overflowIssues,
        cards,
        distinctComponentTypes,
        primaryEmphasisCount,
        secondaryEmphasisCount,
        occupancy,
        occupancyExempt,
        slideOverflow: slideStyle.overflow,
      };
    });

    return { pages, snapStyles, bodyBg };
  });

  if (!audit.snapStyles.some((value) => value && value !== 'none')) {
    result.warnings.push('Preview scrolling has no scroll-snap-type. Add y proximity unless the browsing mode intentionally disables snapping.');
  }

  for (let i = 0; i < audit.pages.length; i++) {
    const item = audit.pages[i];
    const prefix = `Slide ${item.index}`;
    if (Math.abs(item.authored[0] - 1600) > 1 || Math.abs(item.authored[1] - 900) > 1) {
      result.errors.push(`${prefix}: authored canvas is ${item.authored[0]}×${item.authored[1]}, expected 1600×900.`);
    }
    const ratio = item.rendered[0] / Math.max(1, item.rendered[1]);
    if (Math.abs(ratio - 16 / 9) > 0.01) result.errors.push(`${prefix}: rendered aspect ratio is not 16:9.`);
    if (!item.hasShell) result.errors.push(`${prefix}: missing preview-only [data-slide-shell] wrapper.`);
    if (!item.hasOutline) result.errors.push(`${prefix}: preview shell lacks a visible border, shadow, or contrasting background.`);
    if (!item.shellSnapAlign || item.shellSnapAlign === 'none') result.warnings.push(`${prefix}: preview shell has no scroll-snap-align.`);
    for (const issue of item.textIssues) result.errors.push(`${prefix}: ${issue.size}px text is below the ${issue.floor}px floor: “${issue.text}”.`);
    for (const issue of item.overflowIssues) result.errors.push(`${prefix}: clipped text overflow in <${issue.tag}>: “${issue.text}”.`);
    for (const card of item.cards) {
      if (card.exempt) continue;
      if (card.height > 120 && card.utilization < 0.25) result.errors.push(`${prefix}: ${card.id} uses only ${Math.round(card.utilization * 100)}% of its usable vertical space.`);
      else if (card.utilization < 0.45) result.warnings.push(`${prefix}: ${card.id} content utilization is ${Math.round(card.utilization * 100)}%; review excess internal whitespace.`);
    }
    if (item.distinctComponentTypes.length > 3) result.warnings.push(`${prefix}: ${item.distinctComponentTypes.length} marked component families may create visual vocabulary overload (${item.distinctComponentTypes.join(', ')}).`);
    if (item.primaryEmphasisCount === 0) result.warnings.push(`${prefix}: no [data-emphasis-level="primary"] focal system is marked.`);
    if (item.primaryEmphasisCount > 2) result.warnings.push(`${prefix}: ${item.primaryEmphasisCount} primary emphasis objects may compete for attention.`);
    if (item.secondaryEmphasisCount > 4) result.warnings.push(`${prefix}: ${item.secondaryEmphasisCount} secondary emphasis objects may dilute the hierarchy.`);
    if (item.occupancy !== null && !item.occupancyExempt) {
      if (item.occupancy < 0.55) result.warnings.push(`${prefix}: main content-block bounds occupy only ${Math.round(item.occupancy * 100)}% of the marked content region.`);
      if (item.occupancy > 0.92) result.warnings.push(`${prefix}: main content-block bounds occupy ${Math.round(item.occupancy * 100)}% of the marked content region; review crowding.`);
    }
    if (i > 0) {
      const previous = audit.pages[i - 1];
      const gap = item.top - previous.bottom;
      const minimum = Math.max(48, item.rendered[1] * 0.05);
      if (gap + 1 < minimum) result.errors.push(`Slides ${i} and ${i + 1}: preview gap is ${Math.round(gap)}px; expected at least ${Math.round(minimum)}px.`);
    }
    result.slides.push({
      index: item.index,
      authoredSize: item.authored,
      renderedSize: item.rendered,
      textIssueCount: item.textIssues.length,
      overflowIssueCount: item.overflowIssues.length,
      markedCardCount: item.cards.length,
      componentTypes: item.distinctComponentTypes,
      primaryEmphasisCount: item.primaryEmphasisCount,
      secondaryEmphasisCount: item.secondaryEmphasisCount,
      contentOccupancy: item.occupancy,
    });
  }

  for (let i = 0; i < result.slideCount; i++) {
    const target = numberedPath(screenshot, i, result.slideCount);
    await slides.nth(i).screenshot({ path: target });
    result.screenshots.push(target);
  }
  await page.screenshot({ path: result.scrollPreview, fullPage: true });
} finally {
  await browser.close();
}

process.stdout.write(JSON.stringify(result));
process.exitCode = result.errors.length ? 1 : 0;
