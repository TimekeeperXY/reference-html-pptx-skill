# Compatibility and fidelity

## Editable

- Visible HTML text becomes native PowerPoint text boxes.
- Basic font family, size, weight, italic, color, alignment, line spacing, rotation, and hyperlinks are mapped when available.
- Text can be changed, moved, resized, and deleted in PowerPoint.
- Inline text runs are extracted independently to preserve mixed emphasis without duplicating parent containers.
- Explicitly marked containers (`data-pptx-shape`) become native editable PowerPoint shapes, including gradient fills (`data-pptx-fill-gradient`, converted to native `gradFill`) and outer shadows (`data-pptx-shadow`, or inferred from CSS `box-shadow`).
- Explicitly marked lines and connectors (`data-pptx-line-shape`) become native editable PowerPoint line objects, including arrowheads and dashed styles.
- Explicitly marked SVGs (`data-pptx-svg`) become vector image objects (movable/scalable/replaceable, not path-editable). Shared `<use>` references are expanded at export time into a self-contained SVG.

## Preserved visually but not structurally editable

- Images, CSS gradients, masks, SVG, canvas, charts, WebGL, video frames, and unmarked decorative shapes are captured in a text-and-structure-free background image.
- Page transitions, entrance animations, hover states, forms, scripts, and browser interactions are not transferred.

## Expected limitations

- Browser line wrapping and PowerPoint line wrapping are different; small shifts can occur.
- Unsupported or unavailable fonts are substituted by PowerPoint.
- Text rendered inside images, canvas, or video cannot be extracted without OCR and remains part of the background.
- Cross-origin pages may block assets or automation.
- Decks that virtualize slides may require a custom selector or deck-specific navigation support.
- Unmarked CSS containers, masks, pseudo-elements, and decorative shapes remain in the slide background. Mark structural cards, badges, nodes, dividers, and connectors; keep truly complex CSS effects (image masks, backdrop-filter glass, etc.) rasterized for fidelity. Marked gradients and outer shadows ARE reconstructed as native PowerPoint formatting.
- CSS `::before` and `::after` lines cannot be reconstructed because they are not DOM elements. Use a real marked element when the line carries logic.
- Use `data-pptx-ignore="true"` on decorative text that should remain rasterized in the background.

## Validation

Do not treat a successful `.pptx` write as visual success. When PowerPoint is installed, run `scripts/render-pptx-preview.ps1` and inspect its exported PNG pages. Check font scale, line wrapping, duplicate text, clipping, z-order, connector placement, and whether exporter counts reflect intended shapes and lines.

## Why this remains useful

The exporter removes ordinary DOM text before capturing the visual background, then overlays the same text as native PPTX text boxes. This avoids the common result where the entire slide—including text—is a single flat screenshot, while still preserving complex browser visuals reliably.
