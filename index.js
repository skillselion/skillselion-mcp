#!/usr/bin/env node
/**
 * Skillselion MCP server + installer.
 *
 * Three modes (dispatched on argv):
 *   (default)         - run the MCP server over stdio (what an MCP client launches)
 *   setup             - register the server globally + install a SessionStart hook
 *                       that primes every Claude Code session with the top skills
 *   session-context   - print the SessionStart additionalContext (used by the hook)
 *
 * The server AUGMENTS a coding agent: it can search thousands of community-vetted
 * Claude Code skills AND pull a skill's real instructions (`get_skill`) to apply
 * them mid-task. Read-only: only GETs the public Skillselion catalog + public
 * GitHub raw files. No auth, no writes, no secrets.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API = 'https://skillselion.com/api/upstream';
const SITE = 'https://skillselion.com';
const VERSION = '0.2.0';
const CLIENT_HEADERS = {
  accept: 'application/json',
  'user-agent': `skillselion-mcp/${VERSION} (+https://github.com/skillselion/skillselion-mcp)`,
  'x-skillselion-client': 'mcp',
};

// ---- URL + formatting helpers (ported from the web app's listing-url logic) ----
const TYPE_BASE = { skill: 'skills', mcp: 'mcp/tool', marketplace: 'marketplace', plugin: 'plugin', workflow: 'workflow' };
const LEGACY_ID = /^[\w.-]+$/;

function pathSegments(id, type, repo) {
  if (LEGACY_ID.test(id)) return [id];
  let segs = [];
  if (type === 'skill' || type === 'workflow') {
    const m = id.match(/^skill:([^#]+)#(.+)$/);
    if (m) {
      const repoSegs = m[1].split('/');
      const skillSegs = m[2].split('/');
      segs = skillSegs.length === 1 && skillSegs[0] === repoSegs[repoSegs.length - 1] ? repoSegs : [...repoSegs, ...skillSegs];
    }
  } else if (type === 'mcp') { const m = id.match(/^mcp:(.+)$/); if (m) segs = m[1].split('/'); }
  else if (type === 'marketplace') { const m = id.match(/^market:(.+)$/); if (m) segs = m[1].split('/'); }
  else if (type === 'plugin') { const m = id.match(/^plugin:(.+)$/); if (m) segs = m[1].split('/'); }
  if (segs.length) return segs;
  const r = (repo || '').trim();
  if (r.includes('/')) return r.split('/');
  if (r) return [r];
  return [id];
}

function listingUrl(row) {
  const base = TYPE_BASE[row.type] || 'skills';
  const segs = pathSegments(String(row.id || ''), row.type, row.repo);
  return `${SITE}/${base}/${segs.map(encodeURIComponent).join('/')}`;
}

function installHint(row) {
  const id = String(row.id || '');
  const slug = id.includes('#') ? id.slice(id.indexOf('#') + 1) : '';
  if (row.type === 'skill' && row.repo && slug) return `npx skills add https://github.com/${row.repo} --skill ${slug}`;
  if ((row.type === 'marketplace' || row.type === 'plugin') && row.repo) return `/plugin marketplace add ${row.repo}`;
  return null;
}

function fmt(row) {
  const lines = [`### ${row.name}  (${row.type})`];
  const meta = [];
  if (typeof row.installs === 'number' && row.installs > 0) meta.push(`${row.installs.toLocaleString()} installs`);
  if (typeof row.stars === 'number' && row.stars > 0) meta.push(`${row.stars.toLocaleString()} stars`);
  if (row.category) meta.push(row.category);
  if (row.verifiedSafe) meta.push('verified-safe');
  if (meta.length) lines.push(meta.join(' · '));
  if (row.repo) lines.push(`repo: github.com/${row.repo}`);
  const desc = (row.summary || row.description || '').trim();
  if (desc) lines.push(desc.length > 220 ? desc.slice(0, 217) + '...' : desc);
  const install = installHint(row);
  if (install) lines.push('install: `' + install + '`');
  if (row.type === 'skill') lines.push('apply now: call `get_skill` with id `' + row.id + '`');
  lines.push(`details: ${listingUrl(row)}`);
  return lines.join('\n');
}

async function fetchListings(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/listings?${qs}`, { headers: CLIENT_HEADERS });
  if (!res.ok) throw new Error(`Skillselion API ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data.data || data.items || []);
  return rows.filter((r) => r && typeof r.name === 'string' && r.name.trim());
}

/** Fetch a skill's real SKILL.md from its public GitHub repo. skills.sh skills live
 *  at a handful of conventional paths; try them across the default branches. */
async function fetchSkillContent(repo, slug) {
  const branches = ['main', 'master'];
  const paths = slug
    ? [`skills/${slug}/SKILL.md`, `${slug}/SKILL.md`, `.claude/skills/${slug}/SKILL.md`, `SKILL.md`]
    : ['SKILL.md'];
  for (const branch of branches) {
    for (const p of paths) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${p}`;
      try {
        const res = await fetch(url, { headers: { 'user-agent': CLIENT_HEADERS['user-agent'] } });
        if (res.ok) {
          const text = await res.text();
          if (text.trim().length > 30) return { url, content: text };
        }
      } catch { /* try next */ }
    }
  }
  return null;
}

// ---- mode: MCP server -------------------------------------------------------
async function runServer() {
  const server = new McpServer({ name: 'skillselion', version: VERSION });

  server.tool(
    'search_skillselion',
    'Search Skillselion, a curated directory of Claude Code agent skills, MCP servers and plugin marketplaces, ranked by real community signal (installs + GitHub stars). Use to find a trusted skill/MCP/marketplace for the task at hand (e.g. "postgres", "code review", "playwright"). For skills, follow up with get_skill to load and apply the actual instructions.',
    {
      query: z.string().describe('What to search for - a tool, framework, task, or keyword.'),
      type: z.enum(['skill', 'mcp', 'marketplace']).optional().describe('Restrict to one listing type. Omit to search all.'),
      limit: z.number().int().min(1).max(25).optional().describe('Max results (default 8).'),
    },
    async ({ query, type, limit }) => {
      const rows = await fetchListings({ q: query, ...(type ? { type } : {}), limit: String(limit ?? 8) });
      if (!rows.length) return { content: [{ type: 'text', text: `No Skillselion results for "${query}".` }] };
      const head = `Top ${rows.length} Skillselion results for "${query}"${type ? ` (type: ${type})` : ''}:\n`;
      return { content: [{ type: 'text', text: head + '\n' + rows.map(fmt).join('\n\n') }] };
    },
  );

  server.tool(
    'get_skill',
    'Fetch a skill\'s ACTUAL instructions (its SKILL.md) so you can APPLY it to the current task instead of improvising. This is how Skillselion augments you: search for a skill, then pull its real content and follow it. Pass the listing id from search_skillselion, or a query (the top-matching skill is used).',
    {
      id: z.string().optional().describe('A skill listing id, e.g. "skill:owner/repo#slug" (from search_skillselion).'),
      query: z.string().optional().describe('Alternatively, a search query - the top-matching skill is fetched.'),
    },
    async ({ id, query }) => {
      let row;
      if (!id && query) {
        const rows = await fetchListings({ q: query, type: 'skill', limit: '1' });
        row = rows[0];
        id = row?.id;
      }
      if (!id) return { content: [{ type: 'text', text: 'Provide a skill `id` (from search_skillselion) or a `query`.' }] };
      const m = String(id).match(/^skill:([^#]+)#(.+)$/);
      const repo = m ? m[1] : row?.repo;
      const slug = m ? m[2] : '';
      if (!repo) return { content: [{ type: 'text', text: `Could not resolve a GitHub repo for "${id}".` }] };
      const got = await fetchSkillContent(repo, slug);
      if (!got) {
        return { content: [{ type: 'text', text: `Couldn't fetch SKILL.md for "${id}". Install it instead: npx skills add https://github.com/${repo}${slug ? ` --skill ${slug}` : ''}` }] };
      }
      const body = got.content.length > 12000 ? got.content.slice(0, 12000) + '\n\n…(truncated — see ' + got.url + ')' : got.content;
      const header = `# Skill: ${slug || repo}\nSource: ${got.url}\n\nApply these instructions to the current task:\n\n`;
      return { content: [{ type: 'text', text: header + body }] };
    },
  );

  server.tool(
    'top_skillselion',
    'List the top entries on Skillselion (the leaderboard), optionally by type. Skills rank by installs; MCP servers and marketplaces by GitHub stars.',
    {
      type: z.enum(['skill', 'mcp', 'marketplace']).optional().describe('Restrict to one listing type. Omit for all.'),
      limit: z.number().int().min(1).max(25).optional().describe('Max results (default 10).'),
    },
    async ({ type, limit }) => {
      const n = limit ?? 10;
      const sort = type === 'mcp' || type === 'marketplace' ? 'stars' : undefined;
      const rows = (await fetchListings({ ...(type ? { type } : {}), ...(sort ? { sort } : {}), limit: String(n) })).slice(0, n);
      if (!rows.length) return { content: [{ type: 'text', text: 'No Skillselion results.' }] };
      const by = sort === 'stars' ? 'GitHub stars' : 'installs';
      const head = `Top ${rows.length} on Skillselion${type ? ` (type: ${type})` : ''}, by ${by}:\n`;
      return { content: [{ type: 'text', text: head + '\n' + rows.map(fmt).join('\n\n') }] };
    },
  );

  await server.connect(new StdioServerTransport());
  console.error('skillselion-mcp running (stdio). Catalog: ' + SITE);
}

// ---- mode: session-context (the SessionStart hook payload) ------------------
async function buildSessionContext(top) {
  let list = '(could not load the live list this session)';
  try {
    const rows = (await fetchListings({ type: 'skill', limit: String(top) })).slice(0, top);
    if (rows.length) {
      list = rows
        .map((r, i) => {
          const inst = typeof r.installs === 'number' && r.installs > 0 ? ` (${r.installs.toLocaleString()} installs)` : '';
          const desc = (r.summary || r.description || '').split('. ')[0].slice(0, 80);
          return `${i + 1}. ${r.name}${inst}${desc ? ` — ${desc}` : ''}  [id: ${r.id}]`;
        })
        .join('\n');
    }
  } catch { /* fall back to the generic message */ }
  return [
    'You have the **Skillselion MCP** connected — live access to thousands of community-vetted Claude Code skills, MCP servers and marketplaces, ranked by real installs.',
    '',
    'It AUGMENTS you while you work: when a task matches a known skill, call `get_skill` to pull its real instructions and follow them instead of improvising.',
    '',
    `Most-installed skills right now (top ${top}):`,
    list,
    '',
    'Tools: `search_skillselion(query, type?)` · `get_skill(id | query)` · `top_skillselion(type?)`.',
    'When you start work in one of these domains, FIRST `get_skill` the matching skill, then follow it.',
  ].join('\n');
}

async function printSessionContext() {
  const top = Number(process.env.SKILLSELION_TOP) || 10;
  let ctx;
  try { ctx = await buildSessionContext(top); }
  catch { ctx = 'You have the Skillselion MCP connected — search_skillselion / get_skill are available to find and apply community skills.'; }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } }));
}

// ---- mode: setup (register MCP + install SessionStart hook) -----------------
function runSetup() {
  const args = process.argv.slice(3);
  const topIdx = args.indexOf('--top');
  const top = topIdx >= 0 ? Math.max(1, Math.min(25, Number(args[topIdx + 1]) || 10)) : 10;

  const dir = join(homedir(), '.skillselion');
  const hookPath = join(dir, 'session-context.mjs');
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  const log = (s) => process.stdout.write(s + '\n');

  log('\n  Skillselion MCP — setup\n');

  // 0) read existing settings.json FIRST and capture it, BEFORE running `claude`
  // (claude's first-run migration can rewrite settings.json + drop keys like
  // `model`; we re-write our captured+merged copy last so nothing is lost).
  let settings = {};
  let settingsOk = true;
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); }
    catch { settingsOk = false; }
  }

  // 1) register the MCP server globally (best-effort; print manual fallback)
  log('  1/3  Registering the MCP server (claude mcp add --scope user)…');
  const r = spawnSync('claude', ['mcp', 'add', 'skillselion', '--scope', 'user', '--', 'npx', '-y', 'github:skillselion/skillselion-mcp'], { encoding: 'utf8' });
  if (r.status === 0) log('       ✓ registered (scope: user — available in all projects)');
  else log('       ! could not run `claude` — add it yourself:\n         claude mcp add skillselion --scope user -- npx -y github:skillselion/skillselion-mcp');

  // 2) write the self-contained SessionStart hook script (fast, no deps)
  log('  2/3  Installing the SessionStart hook…');
  mkdirSync(dir, { recursive: true });
  const hookScript = `// Auto-generated by skillselion-mcp setup. Prints the top ${top} skills as session context.
const TOP = ${top};
const API = '${API}';
(async () => {
  let list = '(could not load the live list this session)';
  try {
    const res = await fetch(API + '/listings?type=skill&limit=' + TOP, { headers: { accept: 'application/json', 'user-agent': 'skillselion-mcp-hook' } });
    const rows = (await res.json()).filter(r => r && r.name);
    if (rows.length) list = rows.slice(0, TOP).map((r, i) => {
      const inst = (typeof r.installs === 'number' && r.installs > 0) ? ' (' + r.installs.toLocaleString() + ' installs)' : '';
      const desc = (r.summary || r.description || '').split('. ')[0].slice(0, 80);
      return (i + 1) + '. ' + r.name + inst + (desc ? ' — ' + desc : '') + '  [id: ' + r.id + ']';
    }).join('\\n');
  } catch {}
  const ctx = [
    'You have the **Skillselion MCP** connected — live access to thousands of community-vetted Claude Code skills, ranked by real installs.',
    '',
    'It AUGMENTS you while you work: when a task matches a known skill, call get_skill to pull its real instructions and follow them instead of improvising.',
    '',
    'Most-installed skills right now (top ' + TOP + '):',
    list,
    '',
    'Tools: search_skillselion(query, type?) · get_skill(id | query) · top_skillselion(type?).',
    'When you start work in one of these domains, FIRST get_skill the matching skill, then follow it.'
  ].join('\\n');
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } }));
})();
`;
  writeFileSync(hookPath, hookScript);
  log(`       ✓ wrote ${hookPath}  (top ${top} — re-run with --top N to change)`);

  // 3) merge the hook into the settings we captured at step 0 (preserves model
  // etc.), then write last. Never clobber existing hooks.
  if (!settingsOk) {
    log('       ! ~/.claude/settings.json is not valid JSON — not touching it. Add the hook manually (see README).');
  } else {
    settings.hooks = settings.hooks || {};
    settings.hooks.SessionStart = settings.hooks.SessionStart || [];
    const command = `node ${hookPath}`;
    const already = settings.hooks.SessionStart.some((g) => (g.hooks || []).some((h) => h.command === command));
    if (already) log('       ✓ SessionStart hook already present (left as-is)');
    else {
      settings.hooks.SessionStart.push({ matcher: 'startup|resume', hooks: [{ type: 'command', command }] });
      mkdirSync(join(homedir(), '.claude'), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      log(`       ✓ added SessionStart hook to ${settingsPath}`);
    }
  }

  log('\n  Done.  → Restart Claude Code to activate the hook.');
  log('  Every new session will now be primed with the top skills, and the agent will pull + apply them via get_skill.\n');
}

// ---- dispatch ---------------------------------------------------------------
const cmd = process.argv[2];
if (cmd === 'setup') runSetup();
else if (cmd === 'session-context') await printSessionContext();
else await runServer();
