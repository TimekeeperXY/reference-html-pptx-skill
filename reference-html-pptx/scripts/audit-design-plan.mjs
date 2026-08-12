import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) {
  process.stderr.write('Usage: node audit-design-plan.mjs <design-plan.json>\n');
  process.exit(2);
}

const resolved = path.resolve(input);
let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
} catch (error) {
  process.stderr.write(`Invalid design plan: ${error.message}\n`);
  process.exit(2);
}

const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
const errors = [];
const warnings = [];
if (!slides.length) errors.push('design-plan.json must contain a non-empty slides array.');

const required = ['id', 'coreQuestion', 'takeaway', 'relationType', 'layoutFamily', 'primaryVisual', 'densityIntent', 'referenceTraits', 'visualTokens', 'emphasisPlan', 'componentStrategy'];

for (const [index, slide] of slides.entries()) {
  const prefix = `Slide ${slide.id || index + 1}`;
  for (const key of required) {
    const value = slide[key];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      errors.push(`${prefix}: missing ${key}.`);
    }
  }

  const tokens = slide.visualTokens || {};
  for (const key of ['colors', 'typography', 'radii', 'boundaryLanguage', 'iconLanguage', 'spacingRhythm']) {
    if (tokens[key] === undefined || tokens[key] === null || tokens[key] === '') warnings.push(`${prefix}: visualTokens.${key} is not recorded.`);
  }

  const emphasis = slide.emphasisPlan || {};
  if (!emphasis.primary) errors.push(`${prefix}: emphasisPlan.primary must name the focal system.`);
  if (!['low', 'medium', 'high'].includes(emphasis.accentIntensity)) warnings.push(`${prefix}: emphasisPlan.accentIntensity should be low, medium, or high.`);

  const strategy = slide.componentStrategy || {};
  const types = Array.isArray(strategy.primaryTypes) ? strategy.primaryTypes : [];
  if (!types.length) errors.push(`${prefix}: componentStrategy.primaryTypes must not be empty.`);
  if (types.length > 3) warnings.push(`${prefix}: ${types.length} primary component families may create visual vocabulary overload.`);
  if (Number(strategy.peerObjectCount) > 8 && !strategy.groupingResponse) warnings.push(`${prefix}: more than eight peer objects require grouping, aggregation, a matrix/list, or a split-page response.`);
  const methods = Array.isArray(strategy.boundaryMethods) ? strategy.boundaryMethods : [];
  if (methods.length > 3) warnings.push(`${prefix}: too many boundary methods are planned (${methods.join(', ')}).`);
}

const result = { inputPath: resolved, slideCount: slides.length, errors, warnings };
process.stdout.write(JSON.stringify(result, null, 2));
process.exitCode = errors.length ? 1 : 0;
