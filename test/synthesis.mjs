/** Offline unit tests for the synthesize_skills pure helpers, plus one live
 *  smoke. Run: node test/synthesis.mjs   (offline only, no network)
 *            node test/synthesis.mjs --live  (also runs the live smoke) */
import assert from 'node:assert/strict';
import { extractRules, dedupeRules, buildSynthesis } from '../index.js';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ok -', name); };

// --- extractRules ---
const SAMPLE = `---
name: sample
description: a sample skill
---
# Sample Skill
Some intro prose that is not a rule.

## Best Practices
- Always use role-based locators for Playwright tests.
- Prefer \`getByRole\` over CSS selectors.

## Setup
1. Install the dependency first.

\`\`\`js
// this code fence must be ignored
- not a real rule inside a fence
\`\`\`

## Anti-patterns
- DON'T hardcode timeouts.
`;

t('extractRules pulls bullets + numbered, tags with heading, skips prose + fences', () => {
  const rules = extractRules(SAMPLE);
  const texts = rules.map((r) => r.text);
  assert.ok(texts.some((x) => /role-based locators/i.test(x)), 'has locator rule');
  assert.ok(texts.some((x) => /Install the dependency/i.test(x)), 'has numbered rule');
  assert.ok(texts.some((x) => /hardcode timeouts/i.test(x)), 'has anti-pattern rule');
  assert.ok(!texts.some((x) => /not a real rule inside a fence/i.test(x)), 'ignores fenced content');
  assert.ok(!texts.some((x) => /intro prose/i.test(x)), 'ignores plain prose');
  const locator = rules.find((r) => /role-based/i.test(r.text));
  assert.equal(locator.heading, 'Best Practices');
});

t('extractRules caps per-skill and clips long lines', () => {
  const many = '## H\n' + Array.from({ length: 30 }, (_, i) => `- rule number ${i}`).join('\n');
  assert.equal(extractRules(many, { perSkill: 5 }).length, 5);
  const long = '## H\n- ' + 'x'.repeat(400);
  assert.ok(extractRules(long)[0].text.length <= 141, 'clipped to ~140');
});

// --- dedupeRules ---
t('dedupeRules drops normalized duplicates, keeps first + provenance', () => {
  const input = [
    { text: 'Use role-based locators.', slug: 'a', heading: 'X' },
    { text: 'use ROLE-based  locators', slug: 'b', heading: 'Y' },
    { text: 'Prefer getByRole.', slug: 'a', heading: 'X' },
  ];
  const out = dedupeRules(input);
  assert.equal(out.length, 2);
  assert.equal(out[0].slug, 'a', 'keeps first occurrence');
});

// --- buildSynthesis ---
t('buildSynthesis renders header, sources, provenance rules, footer', () => {
  const out = buildSynthesis({
    query: 'playwright best practices',
    sources: [
      { slug: 'playwright-e2e', repo: 'owner/repo', tmpDir: '/tmp/x' },
      { slug: 'web-testing', repo: 'owner2/repo2', tmpDir: '/tmp/y' },
    ],
    rules: [
      { text: 'Use role-based locators.', slug: 'playwright-e2e' },
      { text: 'Avoid hardcoded waits.', slug: 'web-testing' },
    ],
  });
  assert.ok(out.startsWith('🧬 Synthesized from 2 skills for "playwright best practices"'), 'header');
  assert.ok(/Sources: playwright-e2e \(owner\/repo\) · web-testing \(owner2\/repo2\)/.test(out), 'source inline');
  assert.ok(/playwright-e2e → \/tmp\/x/.test(out), 'disk path');
  assert.ok(/## Merged rules/.test(out), 'rules header');
  assert.ok(/- \[playwright-e2e\] Use role-based locators\./.test(out), 'provenance rule');
  assert.ok(/read any for detail/.test(out), 'footer');
});

t('buildSynthesis respects the budget cap', () => {
  const rules = Array.from({ length: 100 }, (_, i) => ({ text: `rule ${i} ` + 'y'.repeat(50), slug: 's' }));
  const out = buildSynthesis({ query: 'q', sources: [{ slug: 's', repo: 'o/r', tmpDir: '/t' }], rules, budget: 300 });
  const ruleLines = out.split('\n').filter((l) => l.startsWith('- [s]'));
  assert.ok(ruleLines.length < 100, 'dropped rules past budget');
  assert.ok(ruleLines.join('\n').length <= 300 + 60, 'roughly within budget');
});

console.log(`\nsynthesis offline: ${pass} passed`);
