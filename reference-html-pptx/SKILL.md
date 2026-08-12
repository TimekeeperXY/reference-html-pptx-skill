---
name: reference-html-pptx
description: Build polished, logically structured 16:9 HTML presentation pages from a user-provided text-free background image, one or more design reference images, and slide copy, then visually verify and export them as structurally editable PPTX files. Use when the user asks to 仿照参考图做PPT、根据背景图和内容页示例生成HTML幻灯片、优化PPT内容逻辑与版式、批量生成同风格多页演示、网页PPT转可编辑PPTX, or provides background/reference screenshots plus slide content. Do not use Dashi PPT.
---

# Reference HTML PPTX

## Version

Current design-workflow version: **2.2.0**.

Create slides with Codex's own content reasoning and HTML/CSS design ability. Optimize in this order:

**conclusion → semantic relationships → grouping → hierarchy → layout → wireframe → visual tokens → emphasis and component strategy → visual craft → PPTX annotation → dual-render QA**

Do not begin styling before the content model and layout rationale are clear.

## Input contract

Collect or identify:

- text-free 16:9 background image;
- at least one content-slide design reference image;
- title and body copy for each page;
- desired output: HTML only or HTML plus PPTX. Default to both for a complete PPT workflow.

Reuse the last confirmed background and reference language during the same task unless the user replaces them. Ask only when a missing input materially changes the result.

## Authority order

1. Preserve user facts and required relationships. Do not invent claims, numbers, actors, or process steps.
2. Clarify the page's intended conclusion and reorganize copy to make that conclusion understandable.
3. Preserve the supplied background exactly as the bottom layer and stage it inside the output folder.
4. Derive the visual system from the reference: palette, typography, components, spacing, shadows, icons, and rhythm. Match its design language, not its original subject matter or geometry.

Read [references/design-reasoning.md](references/design-reasoning.md) before planning. Read [references/design-extraction.md](references/design-extraction.md) before styling. Read [references/visual-craft.md](references/visual-craft.md) after extracting the reference and before writing final CSS. Read [references/preview-and-density.md](references/preview-and-density.md) before writing HTML. Read [references/html-contract.md](references/html-contract.md) only after the visual plan is frozen or when PPTX annotation begins.

## Workflow

### 1. Inspect and stage inputs

Inspect every image at original detail. Identify background versus design reference. Create a new output directory and copy all required local assets into `assets/`; never leave temporary clipboard paths in final HTML.

### 2. Build the content model

For every logical page, create `design-plan.json` in the output directory with:

- `coreQuestion`: the one question the page answers;
- `takeaway`: the one-sentence conclusion the audience should retain;
- `requiredFacts`: facts and labels that must remain;
- `relationType`: sequence, hierarchy, collaboration, flow, cycle, comparison, classification, matrix, or cause-response;
- `mainPath`: the primary reading or process path;
- `groups`: usually 3–5 macro regions, treated as a heuristic rather than a quota;
- `supportingMechanisms`: governance, validation, context, or explanation;
- `exceptions`: conditions paired with responses;
- `layoutFamily` and `primaryVisual`;
- `densityIntent`: page type, intended content-region occupancy, minimum body size, and any justified density exemptions;
- `referenceTraits`: the visual traits to preserve.
- `visualTokens`: extracted color roles, type scale, radii, boundaries, shadows, icon language, and spacing rhythm;
- `emphasisPlan`: one primary focus, secondary accents, and accent intensity;
- `componentStrategy`: primary component types, card count, boundary methods, and deliberate exceptions.

If the page answers multiple unrelated questions or needs more than three information levels, split it when allowed; otherwise prioritize one main argument and demote the rest to supporting regions. Normalize parallel labels into consistent noun or verb structures.

### 3. Choose structure before style

Map the semantic relationship to a suitable layout using `design-reasoning.md`. For complex pages, evaluate at least two wireframe candidates internally. Choose based on:

1. relationship fidelity;
2. obvious reading order;
3. hierarchy and grouping;
4. density balance;
5. fit with the reference's design language.

Do not choose orbit, radial, timeline, matrix, or card-grid layouts unless the content relationship justifies them. Establish a 12-column grid or another explicit alignment system, title zone, content bounds, macro regions, and whitespace before styling.

Run `node scripts/audit-design-plan.mjs <output>/design-plan.json` before styling. Fix missing or contradictory decisions instead of silently inventing them in CSS.

### 4. Freeze the visual system

Translate the reference traits into reusable CSS variables and component rules. Define semantic color roles rather than isolated hex values. Give each component family one silhouette, one boundary method, one spacing rhythm, and one icon language. Plan where the accent appears before applying it.

Use cards only for information that needs a meaningful boundary: conclusions, key metrics, comparison subjects, states, or reusable modules. Use proximity, alignment, whitespace, background zones, and restrained dividers for ordinary explanation. Limit the page to a small visual vocabulary; more component types do not create more hierarchy.

### 5. Design the HTML page

Create a self-contained `index.html` with one fixed 1600×900 `.slide[data-slide-index]` per logical page, wrapped by a preview-only `.slide-shell[data-slide-shell]`. Scale the complete slide for smaller screens; do not make internal typography or geometry viewport-responsive. Use large structures for major relationships, medium structures for modules, and small components for labels and details. Maintain one primary reading path; comparison pages may use two intentionally equal panels.

Use hierarchy, alignment, distance, whitespace, and background regions before adding borders or cards. Avoid card-per-sentence layouts, nested cards, duplicate borders, and decoration without information value. Keep accent color scarce and purposeful. Mark informational cards with `data-density-card="true"`, major component families with `data-component-type`, the primary focus with `data-emphasis-level="primary"`, the principal content region with `data-slide-content`, and its major occupied blocks with `data-content-block`. Apply exemptions only with a documented semantic reason.

### 6. Run HTML visual QA

Run `scripts/inspect-slide-html.ps1`. It must produce one PNG per slide plus a continuous-scroll preview and audit page dimensions, separation, preview outline, scroll snapping, font floors, text overflow, and marked-card density. Inspect both the individual PNGs and the continuous preview at original detail. Apply the design acceptance gate in `design-reasoning.md`; fix logic, hierarchy, density, alignment, typography, page separation, or decoration failures before proceeding.

Do not accept a page merely because it has no overflow. A page fails if the conclusion, reading path, relationship meaning, primary hierarchy, reference-derived visual grammar, emphasis control, or component consistency is unclear. Apply the visual-craft acceptance gate after the three-second test.

### 7. Annotate for PPTX after design freeze

Only after the HTML composition passes visual QA, add `data-pptx-shape` and `data-pptx-line-*` metadata to semantic cards, containers, nodes, matrix cells, axes, arrows, and connectors. Keep decorative gradients, glows, illustrations, and non-semantic ornaments unmarked and flattened.

Re-render once after annotation to confirm that metadata did not change the HTML appearance. Follow `html-contract.md`; do not redesign the page around exporter limitations.

### 8. Export and verify PPTX

Read and use the installed `export-editable-pptx` skill. Export with `.slide` as the selector. Verify the expected slide, text, shape, and line counts. For logic-heavy pages, zero editable shapes or zero editable lines is an automatic failure; target at least 90% native-editable coverage of semantic structures.

When PowerPoint is installed, render the PPTX through `render-pptx-preview.ps1` and compare it with the HTML PNG. Reject duplicated text, altered hierarchy, unexpected wrapping, clipping, displaced connectors, or meaningful visual drift.

## Multi-page rules

- Give every page one narrative role and one takeaway.
- Treat every page as an independent 16:9 canvas. Put it inside a preview shell, separate shells by 6%–10% of a page height, and place the deck on a contrasting neutral canvas.
- Use vertical scroll snapping in preview mode. Prefer `proximity`; use `mandatory` only for a deliberate full-screen browsing experience.
- Do not rely on page numbers alone to distinguish adjacent pages. Page outline, space, shadow, border, or background contrast must remain visible.
- Keep the design system consistent while varying layout families according to content relationships.
- Do not repeat the same card grid or composition on consecutive pages without semantic reason.
- Maintain deck-level progression: setup → development → evidence/structure → implication/action.
- Check both individual-page quality and transitions between pages.

## Deliverables

Return absolute links to:

- `index.html`;
- HTML preview PNGs;
- a continuous-scroll preview PNG for multi-page decks;
- `.pptx` and PowerPoint-rendered preview PNGs when requested.

Report slide count, editable text-object count, editable shape-object count, editable line-object count, and structural editability coverage for logic-heavy pages. Identify intentionally flattened semantic objects. Mention font substitution only when non-system fonts are used.

## Prohibitions

- Do not invoke or depend on Dashi PPT.
- Do not overwrite an earlier page unless explicitly requested.
- Do not use temporary clipboard paths in final HTML.
- Do not force content into the reference's exact geometry.
- Do not use viewport units or viewport-dependent `clamp()` for slide typography; scale the complete 1600×900 canvas instead.
- Do not shrink normal body copy below 16px to make it fit. Recompose, condense, split, or resize the container.
- Do not place consecutive `.slide` canvases directly against each other in browser preview.
- Do not use decorative arrows, rings, tracks, or connectors without semantic meaning.
- Do not use shadow, border, glow, color fill, and accent stripe simultaneously on one ordinary component.
- Do not mix outline, filled, 3D, emoji, and photographic icons at the same semantic level.
- Do not turn every sentence into a card or every keyword into a badge.
- Do not claim arbitrary graphics, animations, canvas, filters, or videos are editable in PowerPoint.
