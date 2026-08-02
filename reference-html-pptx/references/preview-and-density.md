# Preview separation and information density

This reference defines the browser-preview and legibility contract. It supplements design reasoning; it does not replace visual judgment.

## 1. One canonical coordinate system

- Author every `.slide` on a fixed logical canvas of **1600×900**.
- Use pixel values inside the slide for typography and geometry.
- On smaller browser windows, scale the complete slide uniformly inside a preview shell.
- Do not independently reflow cards, change font sizes with `vw`, or use viewport-dependent `clamp()` inside the slide. The HTML composition and PPTX export must share one coordinate system.

## 2. Multi-page preview anatomy

Use a preview-only shell around each exportable slide:

```html
<main class="deck-preview">
  <div class="slide-shell" data-slide-shell>
    <section class="slide" data-slide-index="1">...</section>
  </div>
  <div class="slide-shell" data-slide-shell>
    <section class="slide" data-slide-index="2">...</section>
  </div>
</main>
```

The exporter still selects `.slide`; the shell, page gap, outer shadow, and neutral browser canvas are not exported.

Required preview behavior:

- browser canvas: neutral grey distinct from the slide background;
- shell gap: normally 6%–10% of visible page height, with a practical minimum of 48px;
- page outline: subtle border and/or shadow, visible even when the slide itself is pale;
- `scroll-snap-type: y proximity` on the scrolling container;
- `scroll-snap-align: start` on every shell;
- page numbers are optional supporting navigation, never the only page boundary.

Recommended base CSS:

```css
:root { --slide-w: 1600; --slide-h: 900; }
html { scroll-snap-type: y proximity; background: #e8ebef; }
body { margin: 0; background: #e8ebef; }
.deck-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(54px, 8vh, 96px);
  padding: 48px 32px 72px;
}
.slide-shell {
  position: relative;
  width: min(1600px, calc(100vw - 64px));
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, .14);
  box-shadow: 0 18px 48px rgba(15, 23, 42, .16);
  scroll-snap-align: start;
  scroll-margin-top: 24px;
}
.slide {
  position: absolute;
  inset: 0 auto auto 0;
  width: 1600px;
  height: 900px;
  overflow: hidden;
  transform: scale(var(--slide-scale, 1));
  transform-origin: 0 0;
}
```

Set `--slide-scale` from `shell.clientWidth / 1600` with a `ResizeObserver`. A static script is preferred over responsive internal layout rules.

## 3. Typography floor on the 1600×900 canvas

Use these as starting ranges, then tune for the reference style:

| Role | Recommended size |
|---|---:|
| Page title | 38–48px |
| Subtitle / lead | 18–24px |
| Module title | 22–28px |
| Module body | 16–20px |
| Source / footnote / minor annotation | 14–16px |
| Key number / central keyword | 28–48px |

Normal visible text must not be below **16px**. Only explicit source, footnote, or minor annotation text may be 14–15px; mark it with `data-text-role="source"` or `data-text-role="note"`.

Do not shrink text as the first response to overflow. Prefer, in order: tighten wording, remove duplication, change grouping, resize the container, change layout family, or split the page.

## 4. Card density and whitespace

Large modules must earn their area. Mark informational containers with `data-density-card="true"` so the auditor can compare occupied content height with usable card height.

Guidelines:

- card padding: normally 24–36px on a 1600×900 canvas;
- module title-to-body gap: normally 8–14px;
- body line height: normally 1.35–1.55;
- content should usually occupy at least 45% of a card's usable vertical space;
- a card taller than 120px with less than 25% utilization is a hard failure unless it is deliberately image-led or compositionally sparse;
- do not give all cards the same fixed height when their content volumes differ;
- shrink, merge, or redistribute low-content modules instead of preserving decorative empty area.

For a justified exception, add `data-density-exempt="true"` and record the reason in `design-plan.json`. Exemptions must be semantic, such as a hero visual, quotation, intentional pause, or empty drop zone—not convenience.

## 5. Page-level occupancy

Mark the main composition region with `data-slide-content` and its major semantic units with `data-content-block`. On ordinary content pages, the union of major blocks should visually occupy roughly **65%–85%** of that region. This is a heuristic, not a requirement to fill every gap.

Below 55% usually signals undersized content or oversized containers. Above 90% usually signals crowding. Quote pages, section dividers, hero pages, and image-led pages may be exempt when their whitespace has a clear narrative function.

## 6. Acceptance gates

The HTML preview fails when any of the following is true:

- slides touch or the boundary between adjacent pages is ambiguous;
- a slide is not approximately 16:9 or is not authored at 1600×900;
- normal visible text is below 16px, or note/source text is below 14px;
- text is clipped or overflows its container;
- a large marked card has extreme unused vertical space without a declared exemption;
- the continuous-scroll preview makes it difficult to identify where one page ends and the next begins.

Automated warnings support visual judgment. Passing the script does not prove good hierarchy, a correct relationship model, or a compelling composition.
