#!/usr/bin/env node
/**
 * Skillselion MCP server.
 *
 * Exposes Skillselion's curated directory of Claude Code agent skills, MCP
 * servers and plugin marketplaces (ranked by installs and GitHub stars) as MCP
 * tools, so an agent can discover trusted skills/MCPs from inside the editor.
 *
 * Read-only: it only issues GET requests against the public Skillselion catalog
 * API (https://skillselion.com/api/upstream). No auth, no writes, no secrets.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API = 'https://skillselion.com/api/upstream';
const SITE = 'https://skillselion.com';
const VERSION = '0.1.0';
// Self-identify so Skillselion can distinguish MCP traffic from website (UI)
// traffic - the UI calls the same endpoint from a browser (Origin: skillselion.com),
// this client tags itself explicitly. Lets us monitor + rate-limit each source.
const CLIENT_HEADERS = {
  accept: 'application/json',
  'user-agent': `skillselion-mcp/${VERSION} (+https://github.com/skillselion/skillselion-mcp)`,
  'x-skillselion-client': 'mcp',
};
const TYPE_BASE = { skill: 'skills', mcp: 'mcp/tool', marketplace: 'marketplace', plugin: 'plugin', workflow: 'workflow' };
const LEGACY_ID = /^[\w.-]+$/;

/** Public detail-page path segments for a listing id, ported verbatim from the
 *  web app's listing-url.ts so the emitted URL always resolves (200), never a
 *  soft-404. Skill `skill:owner/repo#slug`; mcp `mcp:name`; marketplace
 *  `market:owner/repo`; plugin `plugin:owner/repo`. */
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

/** Public Skillselion detail URL for a listing row. */
function listingUrl(row) {
  const base = TYPE_BASE[row.type] || 'skills';
  const segs = pathSegments(String(row.id || ''), row.type, row.repo);
  return `${SITE}/${base}/${segs.map(encodeURIComponent).join('/')}`;
}

/** One-line install hint per type, derived from the listing id/repo. */
function installHint(row) {
  const id = String(row.id || '');
  const slug = id.includes('#') ? id.slice(id.indexOf('#') + 1) : '';
  if (row.type === 'skill' && row.repo && slug) return `npx skills add https://github.com/${row.repo} --skill ${slug}`;
  if ((row.type === 'marketplace' || row.type === 'plugin') && row.repo) return `/plugin marketplace add ${row.repo}`;
  return null;
}

function fmt(row) {
  const lines = [];
  lines.push(`### ${row.name}  (${row.type})`);
  const meta = [];
  if (typeof row.installs === 'number' && row.installs > 0) meta.push(`${row.installs.toLocaleString()} installs`);
  if (typeof row.stars === 'number' && row.stars > 0) meta.push(`${row.stars.toLocaleString()} stars`);
  if (row.category) meta.push(row.category);
  if (row.verifiedSafe) meta.push('verified-safe');
  else if (typeof row.trustScore === 'number' && row.trustScore > 0) meta.push(`trust ${row.trustScore}`);
  if (meta.length) lines.push(meta.join(' · '));
  if (row.repo) lines.push(`repo: github.com/${row.repo}`);
  const desc = (row.summary || row.description || '').trim();
  if (desc) lines.push(desc.length > 220 ? desc.slice(0, 217) + '...' : desc);
  const install = installHint(row);
  if (install) lines.push('install: `' + install + '`');
  lines.push(`details: ${listingUrl(row)}`);
  return lines.join('\n');
}

async function fetchListings(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/listings?${qs}`, { headers: CLIENT_HEADERS });
  if (!res.ok) throw new Error(`Skillselion API ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data.data || data.items || []);
  // Drop hub/aggregate rows with no real name (they yield empty, unhelpful entries).
  return rows.filter((r) => r && typeof r.name === 'string' && r.name.trim());
}

const server = new McpServer({ name: 'skillselion', version: '0.1.0' });

server.tool(
  'search_skillselion',
  'Search Skillselion, a curated directory of Claude Code agent skills, MCP servers and plugin marketplaces, ranked by real community signal (installs + GitHub stars). Use to find a trusted skill/MCP/marketplace for a task (e.g. "postgres", "code review", "playwright"). Returns name, type, installs, stars, trust signal, repo, an install command, and the listing URL.',
  {
    query: z.string().describe('What to search for - a tool, framework, task, or keyword (e.g. "postgres", "next.js", "security review").'),
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
  'top_skillselion',
  'List the top entries on Skillselion (the leaderboard), optionally filtered by type. Use to answer "what are the best/most popular Claude Code skills/MCP servers right now". Skills rank by installs; MCP servers and marketplaces rank by GitHub stars (they have no install telemetry).',
  {
    type: z.enum(['skill', 'mcp', 'marketplace']).optional().describe('Restrict to one listing type. Omit for all.'),
    limit: z.number().int().min(1).max(25).optional().describe('Max results (default 10).'),
  },
  async ({ type, limit }) => {
    const n = limit ?? 10;
    // MCP servers/marketplaces have ~no install telemetry, so rank them by stars;
    // skills (and the all-types board) rank by installs (the API default).
    const sort = type === 'mcp' || type === 'marketplace' ? 'stars' : undefined;
    const rows = (await fetchListings({ ...(type ? { type } : {}), ...(sort ? { sort } : {}), limit: String(n) })).slice(0, n);
    if (!rows.length) return { content: [{ type: 'text', text: 'No Skillselion results.' }] };
    const by = sort === 'stars' ? 'GitHub stars' : 'installs';
    const head = `Top ${rows.length} on Skillselion${type ? ` (type: ${type})` : ''}, by ${by}:\n`;
    return { content: [{ type: 'text', text: head + '\n' + rows.map(fmt).join('\n\n') }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('skillselion-mcp running (stdio). Catalog: ' + SITE);
