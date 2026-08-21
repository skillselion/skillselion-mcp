import assert from 'node:assert';
import { skillOneLiner, clipSkillMd, filePurpose, buildFilesNote, buildCard, queryVariants, installHint, isDomainSource, sourceUrl } from '../index.js';

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

// buildCard: machine first line preserved + emoji TL;DR with path, one-liner, files, deps, alts
const card = buildCard({slug:'foo', repo:'owner/repo', tmpDir:'/tmp/skill', oneLiner:'Does X', fileCount:3, depNeeds:'playwright', alts:'`skill:a/b#c`'});
assert.ok(card.startsWith('# Skill loaded: foo  (owner/repo)'), 'first line format (machine-parseable)');
assert.ok(card.includes('✅'), 'emoji tldr present');
assert.ok(card.includes('🎯 Does X'), 'one-liner in tldr');
assert.ok(card.includes('/tmp/skill'), 'temp path in tldr');
assert.ok(card.includes('3 file'), 'file count in tldr');
assert.ok(card.includes('playwright'), 'dep needs in tldr');
assert.ok(card.includes('skill:a/b#c'), 'alternate in tldr');
// no deps / no alts / no files -> those lines omitted, still valid
const bare = buildCard({slug:'x', repo:'o/r', tmpDir:'/t', oneLiner:''});
assert.ok(bare.startsWith('# Skill loaded: x  (o/r)'));
assert.ok(!bare.includes('⚠️') && !bare.includes('🔀'), 'no dep/alt lines when absent');

// queryVariants: significant terms before the raw query so catalog AND doesn't
// require filler words ("like", "a", "write") that hide the real skill.
const human = queryVariants('write like a human');
assert.equal(human[0], 'human', 'task query should search the domain noun first, not the raw phrase');
assert.ok(human.includes('write like a human'), 'raw query stays as fallback');
assert.deepEqual(queryVariants('playwright e2e tests')[0].split(' ').sort(), ['e2e', 'playwright', 'tests'].sort());
assert.equal(queryVariants('write')[0], 'write', 'all-stopword query still searches the raw token');

// Regression: a noise-only FALLBACK variant matches on coincidence, never
// domain. This query broadened to "2026 2027" and returned an AutoCAD skill
// ("AutoCAD 2027 and Visual Studio 2026") plus an unrelated MCP. Years must
// survive inside the full query (they sharpen it) but never stand alone.
const soup = queryVariants('2026 2027 UI UX design patterns large catalog search filter directory');
assert.ok(!soup.includes('2026 2027'), 'noise-only variant must never reach the catalog');
assert.ok(soup.every((v) => !/^[\d\s]+$/.test(v)), 'no variant may be digits alone');
assert.ok(soup[0].includes('2026'), 'years still sharpen the full-query variant');
assert.ok(soup.includes('filter directory') && soup.includes('directory'), 'ladder continues to the real terms');
// A genuinely numeric query still searches for itself rather than nothing.
assert.deepEqual(queryVariants('2026'), ['2026'], 'all-noise query keeps its raw token');

// installHint: a GitHub owner/repo source keeps the github.com URL...
assert.equal(
  installHint({ type: 'skill', repo: 'anthropics/skills', id: 'skill:anthropics/skills#frontend-design' }),
  'npx skills add https://github.com/anthropics/skills --skill frontend-design',
);
// ...but a domain-served skill must use its plain https origin. The skills CLI
// resolves that through its well-known provider; https://github.com/<domain> is
// a repo that cannot exist and the install fails.
assert.equal(
  installHint({ type: 'skill', repo: 'open.feishu.cn', id: 'skill:open.feishu.cn#lark-doc' }),
  'npx skills add https://open.feishu.cn --skill lark-doc',
);
assert.equal(
  installHint({ type: 'skill', repo: 'docs.stripe.com', id: 'skill:docs.stripe.com#stripe-payments' }),
  'npx skills add https://docs.stripe.com --skill stripe-payments',
);
// marketplace/plugin rows are unaffected
assert.equal(installHint({ type: 'plugin', repo: 'owner/repo', id: 'plugin:owner/repo' }), '/plugin marketplace add owner/repo');

// isDomainSource: hostnames yes, owner/repo no - including owners and repos that
// contain dots, which must never be mistaken for a domain.
for (const d of ['open.feishu.cn', 'code.deepline.com', 'uizze.com', 'smithery.ai', 'skills.volces.com']) {
  assert.ok(isDomainSource(d), `${d} is a domain source`);
}
for (const r of ['anthropics/skills', 'vercel-labs/agent-browser', 'foo.bar/baz.qux', 'owner', '']) {
  assert.ok(!isDomainSource(r), `${r} is not a domain source`);
}
assert.equal(sourceUrl('open.feishu.cn'), 'https://open.feishu.cn');
assert.equal(sourceUrl('owner/repo'), 'https://github.com/owner/repo');

console.log('response-format ok');
