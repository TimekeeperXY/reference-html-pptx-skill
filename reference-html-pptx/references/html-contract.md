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

Use real `<img>` elements or CSS background images with staged relative paths such as `assets/background.png`. **A user-supplied background image is mandatory: place it as the slide's bottom layer and reference the staged asset — do not substitute a hand-drawn CSS gradient when a background image was provided.** Keep all visible copy in DOM elements (`h1`, `p`, `li`, `span`). Avoid SVG `<text>`, canvas text, and rasterized copy.

Each page must be independently renderable with no dependency on application state. Avoid external CDNs, web fonts, remote scripts, and network-only assets.

The editable PPTX exporter works at text-node granularity. Inline `<span>` and `<strong>` elements are safe and preserve mixed emphasis. Add `data-pptx-ignore="true"` to decorative DOM text that should remain flattened into the background rather than becoming editable.

Use these QA markers on semantic HTML:

- `data-slide-content` on the principal composition region;
- `data-content-block` on its major occupied semantic blocks;
- `data-density-card="true"` on informational cards whose content-to-container density should be audited;
- `data-text-role="note"` or `data-text-role="source"` for legitimate 14–15px text;
- `data-density-exempt="true"` or `data-overflow-exempt="true"` only for a documented semantic exception.

## Editable object levels

Every visual object requested as editable must be classified with `data-pptx-render="native|chart|svg|raster"`. Shape and line markers default to native for backward compatibility, chart markers to chart, and SVG markers to SVG.

Use `data-pptx-role` or `data-pptx-semantic="true"` on meaningful objects so the audit can calculate coverage. Use `data-pptx-z` to preserve layer order. Only objects removed from the screenshot and rebuilt count as editable.

Pixels inside an `<img>` or CSS background image are raster. To make baked-in circles, dots, bands, arrows, or other ornaments editable, use a clean base image and recreate each ornament as a DOM primitive.

## PowerPoint groups

Use `data-pptx-group` to express a relationship between two or more atomic editable objects that should move together in PowerPoint:

```html
<div data-pptx-group="metric-card-01" data-pptx-group-name="Metric card">
  <div data-pptx-render="native" data-pptx-shape="roundRect" data-pptx-role="card"></div>
  <div data-pptx-render="chart" data-pptx-chart="doughnut" data-pptx-role="metric-chart"></div>
  <span data-pptx-role="metric-value">75%</span>
</div>
```

The group marker can be placed on a shared wrapper or repeated on each member. The exporter uses the nearest group ancestor, creates a native PowerPoint group only when at least two members are exported, and leaves every child as an independently editable PowerPoint object. Groups are slide-local; do not overlap groups or expect nested group synthesis. Group metadata cannot make pixels in a background image editable, and every member still needs its own native, chart, SVG, raster, or text treatment.

## Editable shapes

Mark structural containers that should become editable PowerPoint shapes:

```html
<article class="card"
  data-pptx-render="native"
  data-pptx-shape="roundRect"
  data-pptx-fill="#FFFFFF"
  data-pptx-fill-opacity="94"
  data-pptx-line="#FFFFFF"
  data-pptx-role="card"
  data-pptx-z="20">...</article>
```

Supported `data-pptx-shape` values:

- `auto` — infers `rect`, `roundRect`, or `ellipse` from the computed border radius;
- `rect`, `roundRect` — rectangle / rounded rectangle;
- `ellipse`, `circle` — both map to a PowerPoint oval; use `circle` for a deliberate round badge, dot, or number disc;
- any PptxGenJS shape key such as `chevron`, `hexagon`, `diamond`, `arc`, `pie`, `donut`, `rightArrow`, etc.

### Fill

Solid fill (default):

- `data-pptx-fill="#FFFFFF"` — representative fill color;
- `data-pptx-fill-opacity="94"` — fill opacity percent (`0` = fully transparent, `100` = fully opaque).

Gradient fill (linear or radial):

- `data-pptx-fill-gradient="linear:135:#A855F7:#7C3AED"` — two-stop linear gradient at 135°;
- `data-pptx-fill-gradient="linear:90:#A855F7:#7C3AED:#6D28D9"` — three-stop linear gradient;
- `data-pptx-fill-gradient="radial:#FFFFFF:#F5F3FF"` — radial gradient.

The exporter converts these into a native PowerPoint `gradFill`, so the gradient colors and stops remain editable in PowerPoint. When `data-pptx-fill-gradient` is present it overrides `data-pptx-fill`.

> **Pitfall — CSS gradient/image backgrounds are NOT exported.** When a shape's visual fill is set via CSS `background: linear-gradient(...)` / `radial-gradient(...)` / `background-image`, the exporter reads `cs.backgroundColor` to determine fill — and on such elements `backgroundColor` is **transparent** because the visible fill comes from `background-image`. The exported PowerPoint shape therefore becomes a hollow ring (transparent fill, only the stroke shows) and any white SVG icon nested inside becomes invisible against the white slide background. **For any shape that uses a CSS gradient/image background, you MUST also set `data-pptx-fill` or `data-pptx-fill-gradient` explicitly** so the fill survives export.

### Outline

- `data-pptx-line="#FFFFFF"` — outline color;
- `data-pptx-line-opacity="100"` — outline opacity percent (`0` = fully transparent, `100` = fully opaque);
- outline width is inferred from the computed `border-top-width`.

### Outer shadow

- `data-pptx-shadow="true"` — enables a PowerPoint outer shadow;
- `data-pptx-shadow-color="#7C3AED"` (default `#53677A`);
- `data-pptx-shadow-opacity="0.16"` (0–1, default `0.16`);
- `data-pptx-shadow-blur="3"` (pt, default `3`);
- `data-pptx-shadow-distance="1.2"` (pt, default `1.2`).

When `data-pptx-shadow` is omitted but the element carries a CSS `box-shadow`, the exporter infers an outer shadow from the first visible shadow layer. Set `data-pptx-shadow="false"` to explicitly suppress shadow reconstruction on an element that only needs a rasterized CSS shadow. Prefer an explicit `data-pptx-shadow="true"` for predictable results.

Keep truly complex masks, image overlays, and glass effects in the background layer; they are not reconstructable as a single editable shape.

Annotate atomic primitives, not only their parent component. For a progress bar, mark the track and fill separately. For a logo made from overlapping circles, mark every circle. For cards connected by arrows, mark every card and connector.

## Editable doughnut charts

Use native charts for percentage rings:

```html
<div class="metric-ring"
  data-pptx-render="chart"
  data-pptx-chart="doughnut"
  data-pptx-values="75,25"
  data-pptx-labels="Complete,Remaining"
  data-pptx-colors="#D00000,#F4D9D9"
  data-pptx-hole-size="72"
  data-pptx-first-slice-angle="270"
  data-pptx-role="metric-chart"
  data-pptx-z="30"></div>
```

Place the center percentage in a separate DOM text element. Do not use `conic-gradient` when native chart editing is required.

## SVG and raster

Mark exact vector artwork with `data-pptx-svg="true" data-pptx-render="svg"`. It becomes one movable and scalable SVG image, not path-level editable PowerPoint shapes.

Mark intentionally flattened photos, textures, blur, canvas, or unsupported illustrations with `data-pptx-render="raster"`. Text inside raster-marked containers remains in the screenshot and is not extracted.

## Editable SVG icons

Mark an inline SVG that should remain a crisp, movable vector image object in PowerPoint:

```html
<div class="icon-circle">
  <svg data-pptx-svg="true" viewBox="0 0 32 32">
    <path d="M16 5v16m0 0l-6-6m6 6l6-6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>
</div>
```

The exporter serializes the SVG with computed presentation styles, hides it from the raster background, and adds it back as a native SVG image object — movable, scalable, and replaceable, but its internal paths are not individually editable shapes. Report these as `SVG image objects`, not editable shapes.

For inline SVGs that reference a shared `<symbol>` via `<use href="#id">`, the exporter resolves the `use` references against the document `<defs>` at export time, so the shared-defs pattern is supported and produces a complete, self-contained SVG. The outer wrapper (e.g. `.icon-circle`) can still carry `data-pptx-shape="circle"` for the background disc; the inner `<svg>` keeps its own `data-pptx-svg="true"`.

Decorative SVG that should stay flattened needs no marker. If an SVG sits inside a marked card or panel, it still needs its own `data-pptx-svg` marker, because the native panel shape would otherwise cover its rasterized background.

## Editable lines, arrows, and connectors

Use a real DOM element for every line that carries sequence, hierarchy, direction, axes, or logical relationships:

```html
<div class="connector"
  data-pptx-render="native"
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

1. Count semantic cards, nodes, badges, cells, axes, arrows, progress tracks/fills, brand primitives, charts, and connectors.
2. Confirm every semantic element has a render classification and the matching shape, line, chart, or SVG marker.
3. Confirm every semantic connector is a real DOM element rather than a pseudo-element.
4. Confirm background-image ornaments requested as editable were decomposed into DOM primitives.
5. Treat zero editable shapes or zero editable lines as a failure for logic-heavy pages.
6. Target at least 90% native-editable coverage and zero unsupported semantic objects.
