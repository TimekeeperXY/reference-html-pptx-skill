# Visual craft and restraint

Use this reference after the semantic wireframe and design-reference extraction are complete. It converts a reference image into a coherent visual system without locking the deck to a fixed theme.

## 1. Freeze visual tokens before polishing

Record tokens in `design-plan.json` and expose repeated values as CSS variables. Extract roles, not merely colors:

- accent, accent tint, primary text, secondary text, surface, divider, and semantic status colors;
- title, lead, module title, body, note, and key-number typography;
- large, medium, and small radii;
- spacing rhythm and major grid gaps;
- boundary language: flat, divider-led, outlined, elevated, glass, or image-led;
- shadow character: none, soft-diffused, crisp, colored ambient, or hard offset;
- icon language: outline, filled, duotone, 3D, photographic, or typographic.

Do not average incompatible traits from several references. Choose one dominant reference language and use other references only for clearly named secondary traits.

## 2. Plan emphasis as a budget

Define one primary focus per slide. A balanced comparison may have two equal primary subjects, but the comparison remains one focal system.

- Use the accent on the conclusion, main path, key state, or decisive metric.
- Limit secondary accents to elements that help the reading path.
- Do not apply the accent simultaneously to every heading, icon, border, connector, badge, and keyword.
- Treat roughly 10%–20% accent area as a common low-to-medium-intensity starting point, never as a universal hard limit.
- Reserve large saturated fields for a hero, section divider, result state, or data-led page.
- If everything is emphasized, remove emphasis until the first and second viewing destinations are obvious.

Mark the intended primary focus with `data-emphasis-level="primary"`. Use `secondary` sparingly. The mark is for QA and does not affect export.

## 3. Give components distinct jobs

Use a full card when information needs a meaningful boundary, independent state, comparison role, reusable module, key conclusion, or metric. Use simpler structures for ordinary explanation:

| Information role | Prefer |
|---|---|
| conclusion / key metric | focal card, data tile, or dominant text block |
| process stage / actor | aligned node, lane, or compact module |
| secondary explanation | proximity, indentation, quiet background zone, or divider |
| list / evidence | rows, columns, table, or line-led group |
| label / state | restrained chip or badge |

Do not create a card for every sentence. Avoid nested cards unless the nesting expresses real containment. On ordinary pages, use no more than about three primary component families. If there are more than eight peer objects, group, matrix, list, aggregate, or split them.

Mark reusable component families with stable values such as `data-component-type="metric-card"`, `process-node`, `evidence-row`, or `status-chip`.

## 4. Use one primary boundary method per component

A component may be separated by background contrast, border, shadow, whitespace, or a divider. Select one primary method and at most one subtle supporting method.

Avoid the common overbuilt combination of colored fill + thick border + accent stripe + strong shadow + glow. Reserve elevation for objects that are actually focal or layered.

For a soft professional reference, a neutral multi-layer shadow may use low opacity and increasing blur:

```css
--shadow-soft:
  0 4px 12px rgba(15, 23, 42, .04),
  0 18px 40px rgba(15, 23, 42, .07),
  0 42px 80px rgba(15, 23, 42, .05);
```

Do not apply this recipe when the reference is flat, brutalist, editorial, retro, or uses intentional colored ambient light. Match the reference's material behavior.

Keep radius families limited. Similar semantic levels should not alternate randomly between sharp corners, pills, circles, and large rounded rectangles.

## 5. Keep icon and illustration language coherent

- Do not mix outline, filled, duotone, 3D, emoji, and photographic icons at one semantic level.
- Match stroke width, cap style, corner character, container shape, and optical size.
- Use icons to aid recognition, classification, state, or action—not to fill empty card corners.
- Do not force every peer item to have an icon if the reference or content does not need one.
- Keep decorative SVG and illustration elements flattened with `data-pptx-ignore="true"`; keep their text labels in DOM elements.

## 6. Refine typography, not only font size

- Use a system-safe font stack when editable PPTX is required unless the chosen font is confirmed installed.
- Keep parallel titles grammatically consistent and similar in specificity.
- Prefer weight, size, placement, or one accent color for keyword emphasis; avoid turning inline keywords into multiple colored pills.
- Keep body line lengths readable; narrow the text measure or restructure content rather than stretching prose across the page.
- Use consistent number and unit formatting. Enable tabular numerals for aligned metrics where supported.
- Use dividers only when they clarify a real internal grouping; do not place a rule between every title and sentence by default.

## 7. Visual-craft acceptance gate

Reject or revise the page when:

- CSS values look improvised instead of belonging to a token system;
- more than one object competes as the primary focus without semantic justification;
- most content is enclosed in equal cards despite different importance;
- ordinary components stack several boundary effects;
- peer components use inconsistent radii, shadows, padding, icon styles, or title grammar;
- colored badges and highlighted keywords create visual noise;
- decoration appears to encode a relationship that the content does not contain;
- the page matches the reference's colors but not its rhythm, material, component silhouette, or emphasis behavior.

Passing this gate requires visual coherence and restraint, not adherence to one fixed theme.
