---
name: export-editable-pptx
description: Convert HTML or browser-based slide decks into editable PowerPoint (.pptx) files by rebuilding visible text, marked containers, lines, arrows, and connectors as native PowerPoint objects while retaining unsupported visuals as a background. Use for webpage PPT conversion, local index.html decks, slide URLs, hybrid editable PPTX export, or when cards and logic diagrams must remain editable without Dashi PPT.
---

# Export Editable PPTX

Convert a rendered HTML deck into a hybrid editable PPTX. Reconstruct visible text and explicitly marked structural graphics as native PowerPoint objects; preserve unsupported visuals as a text-and-structure-free background. Do not claim that animations, video, canvas, WebGL, CSS filters, or arbitrary graphics remain editable.

## Workflow

1. Identify the source:
   - URL, or
   - local `index.html`, or
   - directory containing `index.html`.
2. Identify the slide selector. Prefer the deck's known selector. Otherwise let the exporter try its defaults.
3. Run the PowerShell wrapper:

```powershell
& "<skill-root>/scripts/export-editable-pptx.ps1" `
  -InputPath "<url-or-local-path>" `
  -OutputPath "<output.pptx>"
```

4. If slide detection fails, rerun with `-SlideSelector`, for example:

```powershell
& "<skill-root>/scripts/export-editable-pptx.ps1" `
  -InputPath "<source>" `
  -OutputPath "<output.pptx>" `
  -SlideSelector "#deck > .slide"
```

5. Verify page count, text presence, visual alignment, and file size. When Microsoft PowerPoint is installed, render the PPTX through PowerPoint itself and inspect the PNG output:

```powershell
& "<skill-root>/scripts/render-pptx-preview.ps1" `
  -InputPath "<output.pptx>" `
  -OutputDirectory "<preview-directory>"
```

6. Compare the PowerPoint-rendered PNG against the HTML screenshot. Reject the export if text is duplicated, unexpectedly wraps, changes scale materially, or overlaps adjacent elements. Read `references/compatibility.md` when explaining limitations or diagnosing fidelity.
7. Run a structural editability gate. Count semantic HTML structures (cards/nodes/cells/badges and connectors/axes/arrows) and compare them with exporter totals. For diagram decks, reject any result with zero editable shapes or zero editable lines, and reject suspiciously low coverage (default threshold: 90% of semantic structural elements). Do not use visual fidelity as a substitute for editability.

The exporter extracts visible text nodes rather than contenteditable parent containers. Inline `<span>` and `<strong>` styling therefore remains editable without duplicating their parent text. Mark intentionally raster-only DOM text with `data-pptx-ignore="true"`; it will stay in the visual background and will not become an editable text box.

To rebuild a simple container as a native PowerPoint shape, mark it explicitly:

```html
<div data-pptx-shape="roundRect"
     data-pptx-fill="#FFFFFF"
     data-pptx-fill-opacity="94"
     data-pptx-line="#FFFFFF">...</div>
```

Use `auto`, `rect`, `roundRect`, `ellipse`, or a PptxGenJS shape key such as `chevron`, `hexagon`, `diamond`, or `arc`. `auto` infers rectangle, rounded rectangle, or ellipse from the computed border radius. A marked element is removed from the raster background before capture, preventing duplicate shapes.

Mark a DOM element that represents a line or connector:

```html
<div class="connector"
     data-pptx-line-shape="horizontal"
     data-pptx-line-color="#C90000"
     data-pptx-line-width="2"
     data-pptx-line-end-arrow="triangle"></div>
```

Supported directions are `horizontal`, `vertical`, `up`, `down`, `diagonal`, and `down-right`. For exact endpoints within the element bounds, use `data-pptx-line-start="0,50"` and `data-pptx-line-end="100,50"` percentage coordinates. Optional attributes include `data-pptx-line-dash`, `data-pptx-line-begin-arrow`, and `data-pptx-line-end-arrow`.

Do not use CSS pseudo-elements for logic arrows that must be editable. Replace `::before` or `::after` connectors with real DOM elements carrying `data-pptx-line-shape`. CSS borders used only as decoration may remain rasterized; structural dividers, timelines, arrows, and connectors must be marked.

### Required pre-export audit

Before running the exporter, inspect the source for `data-pptx-shape` and `data-pptx-line-shape`. A logic-heavy deck must contain both. If ordinary CSS classes such as `.card`, `.node`, `.axis`, `.connector`, `.arrow`, `.ring`, or `.matrixCell` carry semantic structure but lack metadata, stop and annotate them first. After export, treat the counts as test assertions, not informational statistics.

## Output contract

- Return an absolute path to the generated `.pptx`.
- Report the number of slides, editable text objects, editable shape objects, and editable line objects from the exporter output.
- Say "hybrid editable PPTX": visible text is editable; complex visuals are retained in a background image.
- If fonts differ on the destination machine, warn that PowerPoint may substitute them.
- Never copy or invoke Dashi PPT's proprietary `html-deck-to-pptx` package from this skill.

## Requirements

- Windows PowerShell, Node.js 20+, npm.
- Microsoft Edge or Google Chrome installed.
- Network access on first run to install `playwright-core` and `pptxgenjs` into this skill.
