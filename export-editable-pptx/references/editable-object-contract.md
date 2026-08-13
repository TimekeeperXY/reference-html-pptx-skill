# Editable object contract v2

Use this contract when a visual element must remain independently selectable and editable in PowerPoint.

## Truthful editability levels

| Level | Marker | PowerPoint result | Counts as native editable |
|---|---|---|---|
| Native | `data-pptx-render="native"` plus shape/line metadata | PowerPoint shape or line | Yes |
| Chart | `data-pptx-render="chart" data-pptx-chart="..."` | PowerPoint chart | Yes |
| SVG | `data-pptx-render="svg" data-pptx-svg="true"` | Movable/scalable SVG image | No; report separately |
| Raster | `data-pptx-render="raster"` | Remains in slide screenshot | No |

Omitting `data-pptx-render` preserves compatibility: shape and line markers default to `native`, chart markers to `chart`, and SVG markers to `svg`.

Only objects removed from the screenshot and rebuilt count as editable. A transparent native object placed over a raster duplicate does not count.

## Atomic annotation

Annotate every independently meaningful visual primitive, not only its parent container. A progress bar is at least two objects: track and fill. A brand mark made from two circles is two ellipses. A three-step flow contains three card shapes and two line-arrow objects. A card containing a doughnut chart contains a card shape, a chart, and editable text.

Use real DOM elements for editable primitives. Do not use `::before` or `::after` for editable dots, arcs, arrows, underlines, or connectors.

Useful semantic metadata:

```html
data-pptx-semantic="true"
data-pptx-role="brand-dot|card|progress-track|progress-fill|connector|metric-chart|footer-band"
data-pptx-z="20"
```

`data-pptx-role` or `data-pptx-semantic="true"` includes the element in semantic editability coverage. `data-pptx-z` controls reconstruction order; typical layers are 10–29 backgrounds and containers, 30–59 charts/lines/icons, and 100+ text.

## Native shapes

```html
<div class="brand-dot"
  data-pptx-render="native"
  data-pptx-shape="ellipse"
  data-pptx-fill="#D00000"
  data-pptx-line="#D00000"
  data-pptx-line-opacity="0"
  data-pptx-role="brand-dot"
  data-pptx-z="20"></div>
```

Supported metadata includes:

- `data-pptx-shape="auto|rect|roundRect|ellipse|blockArc|<PptxGenJS shape key>"`;
- `data-pptx-fill`, `data-pptx-fill-opacity`;
- `data-pptx-fill-gradient="linear:135:#A855F7:#7C3AED"` or `radial:#FFFFFF:#F5F3FF`;
- `data-pptx-line`, `data-pptx-line-opacity`, `data-pptx-line-width`;
- `data-pptx-rotation`, `data-pptx-flip-h`, `data-pptx-flip-v`;
- `data-pptx-arc-thickness-ratio` for block arcs;
- `data-pptx-shadow="true"` and shadow color/opacity/blur/distance/angle.

The repository exporter injects marked gradients into PowerPoint OOXML as `gradFill`, so stops remain editable. A CSS gradient still requires an explicit `data-pptx-fill` or `data-pptx-fill-gradient` fallback.

## Progress bars

```html
<div class="track" data-pptx-render="native" data-pptx-shape="roundRect"
  data-pptx-fill="#F0D8D8" data-pptx-line-opacity="0"
  data-pptx-role="progress-track" data-pptx-z="20"></div>
<div class="fill" data-pptx-render="native" data-pptx-shape="roundRect"
  data-pptx-fill="#D00000" data-pptx-line-opacity="0"
  data-pptx-role="progress-fill" data-pptx-z="21"></div>
```

Do not mark only the outer progress component. Track and fill must be sibling atomic elements or otherwise independently annotated.

## Lines and arrows

```html
<div class="connector"
  data-pptx-render="native"
  data-pptx-line-shape="horizontal"
  data-pptx-line-start="0,50"
  data-pptx-line-end="100,50"
  data-pptx-line-color="#D00000"
  data-pptx-line-width="2"
  data-pptx-line-end-arrow="triangle"
  data-pptx-role="connector"
  data-pptx-z="40"></div>
```

## Editable doughnut charts

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

The chart host is hidden from the screenshot and rebuilt as a native PowerPoint chart. Put center labels in separate DOM text elements; do not place text inside the chart host.

## SVG and raster

Use SVG for exact gradients, complex paths, masks, or icons that need vector sharpness but not path-level editing. Mark the SVG itself with `data-pptx-svg="true" data-pptx-render="svg"`. It remains one vector image object.

Mark intentionally flattened visuals with `data-pptx-render="raster"`. Raster-only elements remain visible in the screenshot and are excluded from editable text extraction. Use this for photos, texture, complex blur, canvas, video frames, and unsupported illustrations.

## Background decomposition rule

A supplied PNG background is always raster. Pixels inside it cannot become editable merely by adding metadata to HTML. If the user requires its circles, bands, dots, lines, or other ornaments to be editable:

1. create or obtain a clean base background without those ornaments;
2. rebuild each ornament as annotated DOM primitives;
3. use the clean image only as the bottom layer;
4. verify that the screenshot captured for PPTX contains no duplicate ornament pixels.

If a clean base cannot be created without changing the supplied image, explicitly report those background pixels as raster-only.

## Acceptance gate

Before delivery:

1. Every element marked semantic must be native, chart, SVG, or explicitly raster.
2. Logic-heavy slides must have native shapes and native lines where the relationship calls for them.
3. Native objects must disappear from the screenshot capture and reappear only as PowerPoint objects.
4. Report native shapes, native lines, native charts, SVG objects, intentional raster-only objects, unsupported semantic objects, and semantic editability coverage.
5. Default semantic coverage target is at least 90%; SVG and raster objects do not count as native coverage unless the user accepts those levels.
