# Reusable component library

Use this library after the content model and before final wireframing. The registry is the machine-readable source of truth: [component-registry.json](component-registry.json). The reusable geometry and token defaults live in [assets/component-library.css](../assets/component-library.css); copy only the needed rules into the generated deck or inline the file. Use `node scripts/select-components.mjs <output>/design-plan.json` to rank component candidates for each slide.

## What a component is

A component is a reusable semantic composition with:

- a stable `data-component-type` such as `info-card-row` or `ribbon-detail-card`;
- a unique `data-component-instance` such as `info-card-row-01`;
- named `data-component-slot` elements for content injection;
- a variant chosen from the registry;
- atomic PPTX markers on every visible primitive;
- an optional `data-pptx-group` so the instance becomes one PowerPoint group while its children remain independently editable.

Components are recipes, not fixed slide templates. Keep the component's silhouette, internal rhythm, and boundary language; adapt its width, height, copy length, and placement to the current 1600×900 wireframe.

## Selection protocol

1. Finish the slide's `design-plan.json` first. Record `relationType`, `layoutFamily`, `groups`, `primaryVisual`, and `componentStrategy.peerObjectCount`.
2. Run `select-components.mjs`. Treat its output as a shortlist, not an automatic layout decision.
3. Select one primary component family and at most two supporting families on an ordinary slide. Use the same type and variant for parallel peers.
4. Reject a candidate when its slots cannot hold the required facts, when the number of peers exceeds its capacity, or when its visual boundary would imply a relationship that the content does not have.
5. Instantiate the component with a unique group ID and replace only the slot content. Do not flatten the whole component into an image.
6. Run the HTML visual audit and the structural PPTX audit. Component counts, slot counts, and child-object counts are test assertions.

## Variant contract

Every registered family has a small set of visual variants. A variant changes the internal rhythm, emphasis, or silhouette while keeping the same information role and slot contract. Select the variant with `data-component-variant`; keep the component type stable so the selector, audit, and exporter can still reason about it.

| Family | Available variants | Use the variant when |
|---|---|---|
| `info-card-row` | `icon-left`, `icon-right`, `compact` | the icon needs to lead, trail, or reduce the card footprint |
| `ribbon-detail-card` | `corner-ribbon`, `top-tab`, `plain` | the card needs a strong corner cue, a calmer top label, or no label |
| `metric-tile` | `accent-number`, `split-value`, `minimal` | the number should dominate, sit on a soft tint, or recede into a quiet tile |
| `metric-ring` | `doughnut`, `semi-ring`, `ring-with-label` | the percentage is the hero, the ring is secondary, or the label needs a side column |
| `progress-row` | `single-bar`, `dual-bar`, `ranked` | the slide shows one measure, two measures, or ordered peers |
| `process-node` | `numbered`, `icon-node`, `swimlane-node` | the sequence is explicit, icon-led, or organized as compact lanes |
| `comparison-panel` | `mirror`, `before-after`, `pros-cons` | the relationship is balanced, chronological, or argument-based |
| `evidence-row` | `marker-left`, `value-right`, `source-under` | the row is a finding, a quantified finding, or a sourced note |
| `status-chip` | `filled`, `outline`, `dot-label` | the label should carry weight, remain lightweight, or work as a legend |
| `quote-block` | `accent-bar`, `large-quote`, `source-under` | the statement needs a rule, a larger quotation mark, or a source-led footer |

Variants are not interchangeable decoration. Keep the same semantic slots, mark any added primitive such as a rank badge or secondary progress track, and reject a variant when it forces the copy to wrap beyond the registry capacity.

## Reference-image component recipes

### `info-card-row` — icon + title + explanation

Use for repeated peer facts, classifications, roles, short cause-response items, or four-up explanatory modules. It matches the first reference image: a wide quiet card, a filled circular icon badge, a strong title, and a two-line explanation. The lower accent wedge may be a small native shape or a marked SVG image; do not bake the whole card into a PNG.

```html
<article class="component info-card-row info-card-row--icon-left"
  data-component-type="info-card-row"
  data-component-instance="info-card-row-01"
  data-component-variant="icon-left"
  data-density-card="true"
  data-content-block
  data-pptx-group="info-card-row-01"
  data-pptx-group-name="Info card 01">
  <div class="info-card-row__surface"
    data-component-slot="surface"
    data-pptx-render="native"
    data-pptx-shape="rect"
    data-pptx-fill="#FFFFFF"
    data-pptx-line="#F6D5D8"
    data-pptx-line-opacity="100"
    data-pptx-shadow="true"
    data-pptx-role="info-card-surface"
    data-pptx-z="20"></div>
  <div class="info-card-row__icon-badge"
    data-component-slot="icon-badge"
    data-pptx-render="native"
    data-pptx-shape="circle"
    data-pptx-fill="#ED171C"
    data-pptx-line-opacity="0"
    data-pptx-role="info-card-icon-badge"
    data-pptx-z="30">
    <svg class="info-card-row__icon"
      data-component-slot="icon"
      data-pptx-svg="true"
      data-pptx-render="svg"
      data-pptx-role="info-card-icon"
      data-pptx-z="40"
      viewBox="0 0 32 32" aria-hidden="true"><!-- icon path --></svg>
  </div>
  <h3 class="info-card-row__title"
    data-component-slot="title"
    data-pptx-text="true"
    data-pptx-role="info-card-title"
    data-pptx-z="100">标题</h3>
  <p class="info-card-row__body"
    data-component-slot="body"
    data-pptx-text="true"
    data-pptx-role="info-card-body"
    data-pptx-z="100">两行以内的解释文本。</p>
  <div class="info-card-row__wedge"
    data-component-slot="accent-wedge"
    data-pptx-render="native"
    data-pptx-shape="trapezoid"
    data-pptx-fill="#F7C8CD"
    data-pptx-line-opacity="0"
    data-pptx-role="info-card-accent"
    data-pptx-z="19"></div>
</article>
```

Recommended default capacity: title ≤ 18 Chinese characters, body ≤ 2 lines, 2–6 peers. If the body needs more detail, switch to `ribbon-detail-card` or `evidence-row` instead of shrinking the text.

### `ribbon-detail-card` — corner label + title + details

Use for repeated versions, milestones, categories, options, or three-column detail comparisons. It matches the second reference image: a tall rounded outlined card with a diagonal corner label and two separated explanation blocks.

```html
<article class="component ribbon-detail-card ribbon-detail-card--corner-ribbon"
  data-component-type="ribbon-detail-card"
  data-component-instance="ribbon-detail-card-01"
  data-component-variant="corner-ribbon"
  data-density-card="true"
  data-content-block
  data-pptx-group="ribbon-detail-card-01"
  data-pptx-group-name="Ribbon detail card 01">
  <div class="ribbon-detail-card__surface"
    data-component-slot="surface"
    data-pptx-render="native"
    data-pptx-shape="roundRect"
    data-pptx-fill="#FFFFFF"
    data-pptx-line="#D00000"
    data-pptx-line-width="1.2"
    data-pptx-shadow="true"
    data-pptx-role="ribbon-card-surface"
    data-pptx-z="20"></div>
  <div class="ribbon-detail-card__ribbon"
    data-component-slot="ribbon"
    data-pptx-render="native"
    data-pptx-shape="parallelogram"
    data-pptx-fill="#D00000"
    data-pptx-line-opacity="0"
    data-pptx-rotation="-45"
    data-pptx-role="ribbon-card-ribbon"
    data-pptx-z="30"></div>
  <span class="ribbon-detail-card__ribbon-label"
    data-component-slot="ribbon-label"
    data-pptx-text="true"
    data-pptx-role="ribbon-card-label"
    data-pptx-z="100">20XX</span>
  <h3 class="ribbon-detail-card__title"
    data-component-slot="title"
    data-pptx-text="true"
    data-pptx-role="ribbon-card-title"
    data-pptx-z="100">标题</h3>
  <p class="ribbon-detail-card__body ribbon-detail-card__body--primary"
    data-component-slot="body-primary"
    data-pptx-text="true"
    data-pptx-role="ribbon-card-body-primary"
    data-pptx-z="100">第一段说明。</p>
  <p class="ribbon-detail-card__body ribbon-detail-card__body--secondary"
    data-component-slot="body-secondary"
    data-pptx-text="true"
    data-pptx-role="ribbon-card-body-secondary"
    data-pptx-z="100">第二段说明。</p>
</article>
```

Do not place the ribbon text inside an SVG. Keep it as DOM text so it remains editable in PowerPoint. If the diagonal ribbon cannot be represented faithfully by a native shape, use a marked SVG image for the ribbon geometry and keep the label separate.

### `quote-block` — quote + source + accent rule

Use for a single principle, conclusion, customer voice, or source-led takeaway that deserves a wide reading surface without becoming the slide's only structure. Keep the quotation and source as DOM text; the surface and accent rule should remain separate native primitives.

```html
<article class="component quote-block quote-block--accent-bar"
  data-component-type="quote-block"
  data-component-instance="quote-block-01"
  data-component-variant="accent-bar"
  data-content-block
  data-pptx-group="quote-block-01"
  data-pptx-group-name="Quote block 01">
  <div class="quote-block__surface"
    data-component-slot="surface"
    data-pptx-render="native"
    data-pptx-shape="roundRect"
    data-pptx-fill="#FFFFFF"
    data-pptx-line="#EAD8DA"
    data-pptx-line-opacity="100"
    data-pptx-shadow="true"
    data-pptx-role="quote-surface"
    data-pptx-z="20"></div>
  <div class="quote-block__bar"
    data-component-slot="accent-bar"
    data-pptx-render="native"
    data-pptx-shape="roundRect"
    data-pptx-fill="#D00000"
    data-pptx-line-opacity="0"
    data-pptx-role="quote-accent"
    data-pptx-z="40"></div>
  <div class="quote-block__mark"
    data-component-slot="quote-mark"
    data-pptx-text="true"
    data-pptx-role="quote-mark"
    data-pptx-z="100">“</div>
  <p class="quote-block__text"
    data-component-slot="text"
    data-pptx-text="true"
    data-pptx-role="quote-text"
    data-pptx-z="100">一句可被记住的观点。</p>
  <div class="quote-block__source"
    data-component-slot="source"
    data-pptx-text="true"
    data-pptx-role="quote-source"
    data-pptx-z="100">— 来源或上下文</div>
</article>
```

Recommended default capacity: one quote, up to 4 lines, with one short source line. Pair it with a supporting `evidence-row`, `status-chip`, or metric component when the slide needs a second information layer.

## Other registered families

| Component | Use when the content is | Main editable primitives |
|---|---|---|
| `metric-tile` | a number, unit, label, and short context | native shapes + text |
| `metric-ring` | a percentage or part-to-whole comparison | native doughnut chart + text |
| `progress-row` | ranked values, targets, or completion | track/fill shapes + text |
| `process-node` | ordered stages, handoffs, or causal flow | node shapes + lines + text |
| `comparison-panel` | mirrored alternatives, before/after, pros/cons | panels + rows + text |
| `evidence-row` | findings, sources, validation, or notes | marker/divider + text |
| `status-chip` | state, category, priority, or legend labels | shape + text + optional SVG icon |
| `quote-block` | a principle, opinion, source, or takeaway | surface + accent rule + text |

Read the corresponding entry in `component-registry.json` for slot capacity, variants, visual grammar, and export levels. Do not invent a new family when a registered family fits; do create a page-specific composition when the content relationship is genuinely different.

## Component export rules

- Put `data-pptx-group` on the component root and use a unique ID per instance. The exporter groups only the marked child objects; the root itself does not become editable unless it also has an atomic marker.
- Mark every visible surface, accent, icon, chart, connector, and text host. Add `data-pptx-text="true"` to a text host whose layout box is intentionally wider than its glyph bounds. A component label does not make an unmarked child editable.
- Use `data-pptx-render="native"` for simple surfaces, bars, ribbons, dividers, and badges; use `chart` for percentage rings; use `svg` for icons or geometry that must stay crisp but does not need path-level editing; use `raster` only for intentionally flattened effects.
- Keep the component's group children at stable z layers: surfaces around 20, accents/icons/charts around 30–60, and text at 100+.
- Keep components slide-local and non-overlapping. Nested component groups are not synthesized by the exporter.
- Count component instances separately from child editables. Report both `data-component-type` counts and PPTX text/shape/chart/SVG/group counts.

## Adding a new component

Add a registry entry only when the pattern recurs across at least two realistic slide structures. Define its relation types, layout families, signals, peer capacity, slots, variants, visual grammar, and export levels. Add one concise HTML recipe here, then test it with a real design plan, HTML audit, and PPTX export. Avoid collecting visually attractive but semantically interchangeable cards; a component library should reduce decisions without forcing every slide into a grid.
