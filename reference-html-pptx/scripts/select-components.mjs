#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const registryPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../references/component-registry.json');
const inputPath = process.argv[2];
if (!inputPath) fail('Required: node select-components.mjs <design-plan.json> [--slide <id>] [--limit <n>]');

const plan = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const requestedSlide = argValue('--slide');
const limit = Math.max(1, Number(argValue('--limit') || 5));
const slides = Array.isArray(plan.slides) ? plan.slides : [];
if (!slides.length) fail('design-plan.json must contain a non-empty slides array.');

const selectedSlides = requestedSlide ? slides.filter(slide => String(slide.id) === requestedSlide) : slides;
if (!selectedSlides.length) fail(`No slide found with id: ${requestedSlide}`);

const results = selectedSlides.map(slide => {
  const relation = normalize(slide.relationType);
  const layout = normalize(slide.layoutFamily);
  const peerCount = Number(slide.componentStrategy?.peerObjectCount || slide.groups?.length || 1);
  const searchText = normalize([
    slide.primaryVisual,
    slide.layoutFamily,
    ...(Array.isArray(slide.groups) ? slide.groups : []),
    ...(Array.isArray(slide.supportingMechanisms) ? slide.supportingMechanisms : []),
    ...(Array.isArray(slide.componentStrategy?.primaryTypes) ? slide.componentStrategy.primaryTypes : []),
  ].join(' '));
  const ranked = registry.components.map(component => {
    let score = 0;
    const rationale = [];
    if (component.relationTypes.some(value => normalize(value) === relation)) {
      score += 6;
      rationale.push(`relationType=${slide.relationType}`);
    }
    if (component.layoutFamilies.some(value => normalize(value) === layout)) {
      score += 4;
      rationale.push(`layoutFamily=${slide.layoutFamily}`);
    }
    if (peerCount >= component.repeat.min && peerCount <= component.repeat.max) {
      score += 3;
      rationale.push(`peer count ${peerCount} fits ${component.repeat.min}-${component.repeat.max}`);
    } else if (peerCount > 1 && component.repeat.min <= peerCount + 1 && component.repeat.max >= peerCount - 1) {
      score += 1;
      rationale.push(`peer count ${peerCount} is near the preferred range`);
    }
    const signalMatches = component.contentSignals.filter(signal => searchText.includes(normalize(signal)));
    if (signalMatches.length) {
      score += Math.min(3, signalMatches.length);
      rationale.push(`signals=${signalMatches.slice(0, 3).join(', ')}`);
    }
    return { id: component.id, label: component.label, family: component.family, score, rationale, recommendedVariant: component.variants[0] };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { slideId: slide.id || null, relationType: slide.relationType || null, layoutFamily: slide.layoutFamily || null, peerObjectCount: peerCount, candidates: ranked.slice(0, limit) };
});

process.stdout.write(JSON.stringify({ registry: registry.version, slides: results }, null, 2));

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalize(value) { return String(value || '').trim().toLowerCase(); }
function fail(message) { console.error(message); process.exit(1); }
