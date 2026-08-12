# Content reasoning and layout decisions

Use this reference before writing HTML. The objective is not to decorate all supplied content; it is to make the intended argument immediately understandable without losing required facts.

## 1. Define the page argument

Write two sentences internally:

- **Core question:** What exact question does this page answer?
- **Takeaway:** What should the audience be able to repeat after seeing it for three seconds?

A page may contain several modules, but they must serve one argument. If the takeaway needs “and also” to join unrelated claims, split the page when possible.

Prefer a conclusion-bearing subtitle or message line. A descriptive title may remain for navigation, but the page still needs a conclusion in its hierarchy.

Record the reasoning artifact in this shape:

```json
{
  "slides": [
    {
      "id": "s1",
      "coreQuestion": "What does this page explain?",
      "takeaway": "The conclusion the audience should retain.",
      "requiredFacts": [],
      "relationType": "flow",
      "mainPath": [],
      "groups": [],
      "supportingMechanisms": [],
      "exceptions": [],
      "layoutFamily": "layered-flow",
      "primaryVisual": "the main process path",
      "referenceTraits": [],
      "densityIntent": {},
      "visualTokens": {},
      "emphasisPlan": {
        "primary": "the main process path",
        "secondary": [],
        "accentIntensity": "low"
      },
      "componentStrategy": {
        "primaryTypes": ["process-node", "evidence-row"],
        "peerObjectCount": 5,
        "boundaryMethods": ["background-zone", "divider"]
      }
    }
  ]
}
```

Use one entry per logical slide. Keep the file concise; it is a design decision record, not presentation copy.

## 2. Preserve, compress, or remove

Classify source content:

- `required`: facts, actors, stages, constraints, results, and relationships that cannot be dropped;
- `compressible`: explanations that can become shorter labels or details;
- `supporting`: context, governance, evidence, or exceptions that should be visually secondary;
- `redundant`: text that repeats the title or another visible element without adding meaning.

Do not delete required information for aesthetics. Do not preserve every sentence at equal visual weight.

## 3. Build a semantic graph

Identify nodes and typed edges before choosing a layout.

### Nodes

- actor or role;
- stage or action;
- input or output;
- decision or condition;
- evidence or metric;
- governance or supporting mechanism.

### Edge meanings

- sequence or handoff;
- hierarchy or ownership;
- collaboration or exchange;
- dependency;
- feedback or return;
- cause → response;
- containment or scope.

Every arrow, line, ring, layer, or enclosure in the final page must map to one of these meanings. If a graphic has no edge meaning, treat it as decoration and keep it low priority.

## 4. Separate structural levels

Distinguish:

1. **main path:** the primary process, argument, or comparison;
2. **supporting mechanisms:** validation, governance, context, or explanation;
3. **exceptions:** condition → response pairs;
4. **decoration:** brand identity or atmosphere only.

Never give all four the same visual weight. Supporting mechanisms should sit below, outside, or beside the main path. Exceptions should not interrupt the normal flow unless they are the page's subject.

Use consistent grammar within parallel groups: all nouns or all verbs; similar length and specificity.

## 5. Choose layout from relationship

| Relationship | Suitable layout | Avoid |
|---|---|---|
| sequence / handoff | horizontal or vertical flow, staged pipeline | unconnected card grid |
| hierarchy / ownership | layered architecture, tree, nested regions | circular orbit without recursion |
| parallel roles | swimlane, aligned role modules, hub-and-spoke only when a real hub exists | scattered floating cards |
| collaboration / exchange | network with typed connectors, coordinated 2×2 or lanes | decorative random lines |
| cycle / feedback | closed loop with explicit return edge | circle used only for balance |
| comparison | balanced columns, mirrored rows, before/after | one side visually dominant without meaning |
| classification | grouped regions, matrix, spectrum | separate card for every item |
| cause → response | paired rows, decision tree, exception band | list of condition nouns only |
| central control | controller + execution layer + governance + output | oversized central circle with unclear handoffs |
| main module + context | dominant visual region plus secondary side panel | equal emphasis everywhere |

For a complex page, compare at least two structural candidates. Do not create two polished pages; evaluate two low-fidelity wireframes and choose the clearer one.

## 6. Build the wireframe

Define before styling:

- outer margins and title zone;
- explicit grid and alignment lines;
- 3–5 macro regions when appropriate;
- primary visual region;
- reading direction;
- relative area based on information importance;
- minimum text sizes and density budget.

Use large structures for major relationships, medium structures for modules, and small components for labels. Do not try to construct the entire page from equally weighted cards.

The “one primary visual” rule means one dominant reading hierarchy, not necessarily one object. A comparison page may have two equal panels if the comparison itself is the primary visual.

## 7. Apply the reference design system

Extract the reference's visual grammar after the wireframe is chosen:

- title and body hierarchy;
- component silhouette and corner treatment;
- border, fill, shadow, and icon language;
- spacing rhythm;
- accent behavior;
- brand decorations.

Adapt these traits to the selected information structure. Never copy a radial structure merely because the reference contains circles.

Freeze the extracted traits as visual tokens and define the emphasis and component strategy before polishing. Read `visual-craft.md`; do not allow late CSS improvisation to introduce unrelated radii, shadows, icon styles, or boundary effects.

Use accent color for the conclusion, main path, key node, or important state. Do not apply it simultaneously to every title, border, arrow, icon, and ornament. Numeric color ratios are guidance, not a hard requirement.

Prefer grouping by proximity, alignment, whitespace, and background zones. Use borders only when they clarify a real container or state.

## 8. Design acceptance gate

A page must pass all hard gates:

- **Argument:** one clear core question and takeaway;
- **Relationship:** the layout accurately represents sequence, hierarchy, collaboration, cycle, comparison, or cause-response;
- **Reading path:** the first, second, and final viewing destinations are obvious;
- **Hierarchy:** main path, support, and exceptions have different weights;
- **Grouping:** viewers see macro regions before individual details;
- **Density:** area and emphasis roughly match information importance;
- **Restraint:** no unnecessary card-per-sentence pattern, nested borders, or semantic-looking decoration;
- **Legibility:** text remains readable at 1600×900;
- **Reference fit:** the visual language matches the reference without copying an unsuitable layout;
- **Craft:** tokens, emphasis, components, boundaries, icons, and typography form one restrained visual system;
- **Truthfulness:** all required facts remain and no unsupported claims were introduced.

Use the three-second test: if a viewer cannot state the page's main point and reading direction after a quick glance, revise the structure rather than adding decoration.

## 9. PPTX considerations

Design for meaning and visual clarity first. Add export metadata only after visual acceptance. Prefer DOM elements for semantic connectors and text, but do not choose an inferior composition only because it is easier to export.

After annotation, audit semantic objects and compare HTML versus PowerPoint rendering. Editability is a delivery requirement, not the source of the design concept.
