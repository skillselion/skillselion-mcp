import assert from 'node:assert';
import { skillOneLiner, clipSkillMd, filePurpose, buildFilesNote, buildCard } from '../index.js';

// skillOneLiner: prefers frontmatter description
const md1 = '---\nname: x\ndescription: Does the thing well\n---\n# X\nbody';
assert.equal(skillOneLiner(md1), 'Does the thing well');
// falls back to first non-heading line
assert.equal(skillOneLiner('# Title\n\nFirst real line here'), 'First real line here');
// caps at 200
assert.ok(skillOneLiner('# T\n' + 'a'.repeat(400)).length <= 200);

// clipSkillMd: small stays whole
const small = '# A\nshort body';
const r1 = clipSkillMd(small, 6000);
assert.equal(r1.text, small); assert.equal(r1.clipped, false);
// large clips at a section boundary and reports remaining
const big = '# Top\n' + 'x'.repeat(5000) + '\n## Sec2\nmore\n## Sec3\nmore';
const r2 = clipSkillMd(big, 5015);
assert.equal(r2.clipped, true);
assert.ok(r2.text.length <= 5200);
assert.ok(!r2.text.includes('## Sec3'), 'clipped before Sec3');
assert.ok(r2.remaining >= 1, 'reports dropped sections');

// filePurpose
assert.equal(filePurpose('references/a.md', '# Retry policy\ntext'), 'Retry policy');
assert.equal(filePurpose('scripts/x.sh', ''), '');

// buildFilesNote: path once, per-file lines, empty case
const note = buildFilesNote('/tmp/skill', [{rel:'references/a.md', purpose:'Retry policy'}, {rel:'scripts/x.sh', purpose:''}]);
assert.equal((note.match(/\/tmp\/skill/g) || []).length, 1, 'temp path appears once');
assert.ok(note.includes('- references/a.md - Retry policy'));
assert.ok(note.includes('- scripts/x.sh'));
assert.ok(buildFilesNote('/tmp/skill', []).toLowerCase().includes('just its skill.md'));

// buildCard: first line format preserved, path + oneLiner present
const card = buildCard({slug:'foo', repo:'owner/repo', tmpDir:'/tmp/skill', oneLiner:'Does X'});
assert.ok(card.startsWith('# Skill loaded: foo  (owner/repo)'), 'first line format');
assert.ok(card.includes('Local copy: /tmp/skill'));
assert.ok(card.includes('Does X'));
console.log('response-format ok');
