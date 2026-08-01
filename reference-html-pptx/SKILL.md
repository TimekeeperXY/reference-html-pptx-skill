---
name: reference-html-pptx
description: Build polished 16:9 HTML presentation pages from a user-provided text-free background image, one or more slide design reference images, and page titles/body copy, then render, visually verify, and export the result as a hybrid editable PPTX. Use when the user asks to 仿照参考图做PPT、根据背景图和内容页示例生成HTML幻灯片、提炼页面强调色和组件样式、批量生成同风格页面、网页PPT转可编辑PPTX, or provides background/reference screenshots plus slide copy. Do not use Dashi PPT.
---

# Reference HTML PPTX

Create slides with Codex's own HTML/CSS design ability. Treat the background, reference, and copy as three separate inputs with different authority.

## Input contract

Collect or identify:

- text-free 16:9 background image;
- at least one content-slide design reference image;
- title and body copy for each new page;
- desired output: HTML only or HTML plus PPTX. Default to both when the user asks for a complete PPT workflow.

If one input is absent, ask only when it materially changes the result. Reuse the last confirmed background and reference style during the same task unless the user replaces them.

## Authority order

1. Preserve the background image exactly as the bottom layer. Stage it inside the output folder; never link to a temporary clipboard path.
2. Derive visual language from the content reference: accent colors, typography hierarchy, component types, borders, radii, shadows, icon treatment, spacing, and composition rhythm.
3. Recompose the user's new copy for clarity. Do not copy the reference page's original text or force new content into its exact geometry.
4. Preserve all user facts. Small bridging labels are allowed; do not invent claims, numbers, or examples.

Read [references/design-extraction.md](references/design-extraction.md) before designing. Read [references/html-contract.md](references/html-contract.md) before writing HTML.

## Workflow

1. Inspect every image at original detail. Identify which image is the background and which is the content reference.
2. State a concise design extraction in commentary: palette, component family, typography, emphasis, and composition.
3. Create a new output directory. Copy the background and any required local assets into its `assets/` folder.
4. Create a self-contained `index.html` using `apply_patch`. Use one `.slide` element per logical page and set `data-slide-index`.
5. Make layout decisions from content density:
   - sequence/process: numbered vertical or horizontal steps;
   - summary/framework: modular cards with one dominant takeaway;
   - comparison: mirrored columns or rows;
   - quote/template: one large readable text region plus a supporting visual anchor.
6. Use CSS or Unicode for simple shapes and icons. **When PPTX is requested, every structural card, container, badge, circle, process node, matrix cell, axis, arrow, and connector that carries layout or logic meaning must be explicitly marked** with `data-pptx-shape` or `data-pptx-line-*`. Only purely decorative gradients, glows, illustrations, and non-semantic ornaments may remain unmarked and flattened. Do not treat CSS appearance alone as sufficient: unmarked CSS graphics become background pixels.
7. Render with Edge/Chrome at 1600×900. Run `scripts/inspect-slide-html.ps1` for deterministic file and screenshot checks.
8. Visually inspect the screenshot. Fix overflow, clipping, weak hierarchy, inconsistent spacing, or poor contrast. Do not finish on the first uninspected render.
9. When PPTX is requested, read and use the installed `export-editable-pptx` skill. Export with the selector `.slide`:

```powershell
& "<export-editable-pptx-skill-root>/scripts/export-editable-pptx.ps1" `
  -InputPath "<absolute-path-to-index.html>" `
  -OutputPath "<absolute-output.pptx>" `
  -SlideSelector ".slide"
```

10. Verify the PPTX exists, has the expected page count, and contains editable text, shape, and line objects. Before accepting export, compare the exporter counts against the HTML structure audit: for a logic-heavy deck, `editable shape objects: 0` or `editable line objects: 0` is an automatic failure. A deck with dozens of visible cards but only one or two editable shapes is also an automatic failure. When PowerPoint is installed, run the exporter skill's `scripts/render-pptx-preview.ps1`, inspect the resulting PNG, and compare it with the HTML screenshot.

## Quality bar

- Keep every slide at 16:9 with no scrollbars.
- Use the actual supplied background, not an approximate CSS recreation.
- Match the reference's design system, not its subject matter.
- Maintain a clear title, one dominant message, and deliberate reading order.
- Avoid generic dashboard card walls when the reference uses another component grammar.
- Prefer fewer, larger components over many tiny labels.
- Keep body text comfortably legible at 1600×900.
- Avoid text embedded in decorative pseudo-elements; PPTX export cannot rebuild it reliably.
- Make visible text real DOM text. `contenteditable="true"` is optional and useful for user adjustment.
- Preserve the original HTML and staged assets alongside the PPTX.
- For logic diagrams, target at least 90% native-editable coverage of semantic containers and connectors. Report any intentionally flattened structural objects explicitly; otherwise do not deliver.

## Deliverables

Return absolute links to:

- `index.html`;
- rendered preview PNG;
- `.pptx` when requested.

Report the slide count, editable text-object count, editable shape-object count, and editable line-object count from the exporter. For logic-heavy pages, also report structural editability coverage and identify any intentionally flattened semantic objects. Mention font-substitution risk only when the deck uses non-system fonts.

## Prohibitions

- Do not invoke or depend on Dashi PPT.
- Do not overwrite an earlier page unless the user explicitly asks; create a new page or deck file.
- Do not use temporary clipboard paths in final HTML.
- Do not claim arbitrary graphics, animations, canvas, filters, or videos are editable in PowerPoint.
