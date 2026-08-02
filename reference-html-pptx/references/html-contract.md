# HTML slide contract

Use this minimum structure:

```html
<main class="deck-preview">
  <div class="slide-shell" data-slide-shell>
    <section class="slide" data-slide-index="1">...</section>
  </div>
</main>
```

Required CSS behavior:

```css
html, body { margin: 0; background: #e8ebef; }
.slide-shell {
  position: relative;
  width: min(1600px, calc(100vw - 64px));
  aspect-ratio: 16 / 9;
  overflow: hidden;
  scroll-snap-align: start;
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

Always keep the authored slide at 1600×900. Uniformly scale the complete slide inside the shell for responsive preview. Follow [preview-and-density.md](preview-and-density.md) for deck spacing, scroll snapping, typography, and density metadata.

Use real `<img>` elements or CSS background images with staged relative paths such as `assets/background.png`. Keep all visible copy in DOM elements (`h1`, `p`, `li`, `span`). Avoid SVG `<text>`, canvas text, and rasterized copy.

Each page must be independently renderable with no dependency on application state. Avoid external CDNs, web fonts, remote scripts, and network-only assets.

The editable PPTX exporter works at text-node granularity. Inline `<span>` and `<strong>` elements are safe and preserve mixed emphasis. Add `data-pptx-ignore="true"` to decorative DOM text that should remain flattened into the background rather than becoming editable.

Use these QA markers on semantic HTML:

- `data-slide-content` on the principal composition region;
- `data-content-block` on its major occupied semantic blocks;
- `data-density-card="true"` on informational cards whose content-to-container density should be audited;
- `data-text-role="note"` or `data-text-role="source"` for legitimate 14–15px text;
- `data-density-exempt="true"` or `data-overflow-exempt="true"` only for a documented semantic exception.

## Editable shapes

Mark structural containers that should become editable PowerPoint shapes:

```html
<article class="card"
  data-pptx-shape="roundRect"
  data-pptx-fill="#FFFFFF"
  data-pptx-fill-opacity="94"
  data-pptx-line="#FFFFFF">...</article>
```

Use `auto`, `rect`, `roundRect`, `ellipse`, or a supported PptxGenJS shape key such as `chevron`, `hexagon`, `diamond`, or `arc`. `auto` infers a rectangle, rounded rectangle, or ellipse from the computed border radius.

Always provide a solid `data-pptx-fill` representative color. Optional metadata includes:

- `data-pptx-fill-opacity="94"`;
- `data-pptx-line="#FFFFFF"`;
- `data-pptx-line-opacity="100"`;
- `data-pptx-shadow="true"` and related shadow attributes.

Do not mark complex gradients, masks, illustrations, or glass effects; keep those in the background layer.

## Editable lines, arrows, and connectors

Use a real DOM element for every line that carries sequence, hierarchy, direction, axes, or logical relationships:

```html
<div class="connector"
  data-pptx-line-shape="horizontal"
  data-pptx-line-color="#C90000"
  data-pptx-line-width="2"
  data-pptx-line-end-arrow="triangle"></div>
```

Supported directions include `horizontal`, `vertical`, `up`, `down`, `diagonal`, and `down-right`. For exact endpoints inside the element bounds, use percentage coordinates:

```html
<div class="axis"
  data-pptx-line-shape="horizontal"
  data-pptx-line-start="0,50"
  data-pptx-line-end="100,50"
  data-pptx-line-color="#667085"
  data-pptx-line-width="1.5"
  data-pptx-line-dash="dash"></div>
```

Optional arrow metadata:

- `data-pptx-line-begin-arrow="triangle"`;
- `data-pptx-line-end-arrow="triangle"`;
- `data-pptx-line-dash="dash"`.

Do not implement semantic connectors with `::before` or `::after`; pseudo-elements are not independently extractable. Decorative borders and non-semantic divider lines may remain rasterized.

## Pre-export structure audit

Before export:

1. Count semantic cards, nodes, badges, cells, axes, arrows, and connectors.
2. Confirm every semantic container has `data-pptx-shape`.
3. Confirm every semantic line has `data-pptx-line-shape`.
4. Treat zero editable shapes or zero editable lines as a failure for logic-heavy pages.
5. Target at least 90% native-editable coverage of semantic structural objects.
