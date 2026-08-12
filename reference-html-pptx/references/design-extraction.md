# Design extraction checklist

Extract the reference into a compact design system after the content model and wireframe direction are chosen. The reference supplies visual language; it does not decide the information relationship.

## Color

- Sample the primary accent, dark text, secondary text, card fill, border, and shadow tint.
- Distinguish brand color from semantic colors.
- Use the accent selectively for titles, step numbers, keywords, arrows, and thin rules.
- Name every sampled color by role and record it in `visualTokens.colors`; do not scatter unrelated hex values through CSS.

## Components

Identify the repeated unit: long information bar, floating card, numbered step, badge, chip, quote box, illustration platform, diagram node, or data tile. Preserve its visual grammar: geometry, radius, border, glow, icon position, and internal alignment.

Identify the reference's primary boundary method and material behavior. Record whether components are separated mainly by whitespace, background zones, outlines, elevation, glass, or image planes.

## Typography

Record title scale and weight, body scale, italic usage, keyword emphasis, line height, and alignment. Prefer installed system fonts when editable PPTX is required.

Record icon language separately: outline, filled, duotone, 3D, photographic, or typographic. Do not infer that every component needs an icon.

## Composition

Measure approximate outer margins, title zone, content bounds, column ratio, card gap, and visual center. Adapt geometry to new copy while preserving the rhythm.

Separate reusable composition traits from page-specific geometry. Reuse margins, rhythm, hierarchy, and component language; do not automatically reuse an orbit, timeline, matrix, or card grid when the new content has a different semantic structure.

## Content transformation

- Group related sentences into one component.
- Convert ordered actions into numbered steps.
- Convert scenarios into short chips or rows.
- Keep quoted templates in a large text block with generous line height.
- Add only neutral organizing labels; never introduce new factual content.
- Preserve required facts while compressing repeated explanations.

Summarize the extraction in one sentence before implementation, for example: “浅蓝背景、红色强调、白色玻璃长卡、红色圆形图标、黑色斜体正文、关键词加粗变红、柔和投影。”
