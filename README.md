<p align="center">
  <img src="https://raw.githubusercontent.com/skillselion/skillselion-mcp/master/assets/banner.svg" alt="Skillselion MCP" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/skillselion-mcp"><img src="https://img.shields.io/npm/v/skillselion-mcp?style=flat-square&color=d8455f&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/skillselion-mcp"><img src="https://img.shields.io/npm/dm/skillselion-mcp?style=flat-square&color=5b7fb0&label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/skillselion/skillselion-mcp/blob/master/LICENSE"><img src="https://img.shields.io/github/license/skillselion/skillselion-mcp?style=flat-square&color=1a1a1a" alt="License"></a>
  <img src="https://img.shields.io/badge/MCP-server-5b7fb0?style=flat-square" alt="MCP server">
  <img src="https://img.shields.io/badge/node-%E2%89%A518-6fae7d?style=flat-square" alt="Node >= 18">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/read--only-no_auth-6fae7d?style=flat-square" alt="Read-only, no auth">
  <a href="https://skillselion.com"><img src="https://img.shields.io/badge/catalog-thousands_of_tools-e0a23a?style=flat-square" alt="thousands of tools"></a>
  <a href="https://github.com/skillselion/skillselion-mcp/pulls"><img src="https://img.shields.io/badge/PRs-welcome-d8455f?style=flat-square" alt="PRs welcome"></a>
  <img src="https://img.shields.io/github/last-commit/skillselion/skillselion-mcp?style=flat-square&color=5b7fb0&label=updated" alt="Last commit">
  <a href="https://github.com/skillselion/skillselion-mcp/stargazers"><img src="https://img.shields.io/github/stars/skillselion/skillselion-mcp?style=flat-square&color=d8455f" alt="Stars"></a>
</p>

<p align="center">
  <b>Augment your coding agent with thousands of battle-tested skills.</b><br>
  It searches <a href="https://skillselion.com">Skillselion</a> — a curated directory of Claude Code skills, MCP servers & marketplaces ranked by real installs —<br>
  and pulls a skill's <b>actual instructions</b> to apply <b>mid-task</b>. So your agent works from proven patterns, not guesses.
</p>

<p align="center">
  🧩 Works with <b>Claude Code</b> · <b>Claude Desktop</b> · <b>Cursor</b> · <b>Codex</b> · and any MCP client
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/skillselion/skillselion-mcp/master/assets/demo.gif" alt="Skillselion MCP: search the live catalog, then load_skill materializes the real skill into a temp folder" width="92%">
</p>

<p align="center"><sub>Real run against the live catalog: <code>search_skillselion</code> → <code>load_skill</code> pulls the skill's real <code>SKILL.md</code> + bundled files into a temp folder → your agent follows it like an installed skill.</sub></p>

---

## ✨ What it does

Skillselion indexes **thousands of** Claude Code skills, MCP servers and plugin marketplaces, ranked by **real community signal** (installs + GitHub stars). This server turns that directory into a live capability for your agent: it can **search** for the right skill and **`load_skill` to dynamically load it mid-task** — the real `SKILL.md` into context, **plus any bundled scripts / references / templates materialized into a temp folder** — so it works from the skill exactly like an installed one, instead of improvising "best practices." **Find the skill → load it → follow it.**

## 🔧 Tools

| Tool | What it does |
|------|--------------|
| 🔍 **`search_skillselion`** | Search by keyword or task (`postgres`, `code review`, `playwright`); optional `type` filter (`skill` / `mcp` / `marketplace`). Returns name, type, installs, stars, repo, an install command, and the listing URL. |
| 📥 **`load_skill`** | **The dynamic load.** Pulls a skill's real **`SKILL.md`** into context **and materializes its whole directory** (scripts, references, templates) into a **temp folder**, so the agent uses it like an *installed* skill — read/run the bundled files included. Pass an `id` from search, or a `query`. |
| 🧬 **`synthesize_skills`** | **The cross-source playbook.** Merges the key rules from the top matching skills into one deduped, provenance-tagged digest - the field's combined guidance rather than a single skill's. Each source skill is still materialized to disk in full. Pass a `query` + `context`. |
| 🏆 **`top_skillselion`** | The leaderboard — "what are the best Claude Code skills / MCP servers right now." Skills rank by installs; MCP servers & marketplaces by GitHub stars. |

**What `load_skill` returns** is progressive, to keep your context lean: a compact card (name, one-liner, dependency flags, local path, runner-up candidates) + the `SKILL.md` body (inlined in full when small; for very large skills clipped at a section boundary with a pointer to the complete file on local disk) + the bundled scripts/references listed with a one-line purpose each rather than inlined, so you `Read` them on demand. The whole skill is always materialized to disk in full, so nothing is lost - only the in-context portion is bounded. Tune that bound with the `SK_INLINE_BUDGET` env var (default 6000 chars).

### 🧬 `synthesize_skills` - one playbook across skills

`load_skill` gives you **one** skill (its real `SKILL.md` plus every bundled script and reference). `synthesize_skills` goes wider: it retrieves the top matching skills, dedupes them by repo, extracts their key rules with a cheap client-side heuristic (no server LLM), and merges them into a single **deduped, provenance-tagged digest** - a cross-source playbook that no single skill or the model's own memory holds. Every source skill is still materialized to disk in full, so you can drop into any one of them for the complete detail. When only one skill matches, it degrades gracefully to the standard `load_skill` card.

**When to use which:**

- **`load_skill`** - you want a *specific* skill and its bundled files (e.g. "load the Playwright e2e testing skill"). The everyday default.
- **`synthesize_skills`** - you want the field's *combined* guidance for a broad question that spans several skills (e.g. "current best practices for hardening a Postgres schema"), not one skill's take.

**Env vars:**

| Var | Default | What it controls |
|-----|---------|------------------|
| `SK_SYNTH_N` | `5` | How many top matching skills to merge (clamped to 2-8). |
| `SK_SYNTH_PER_SKILL` | `12` | Max rules kept per source skill before merging. |
| `SK_SYNTH_BUDGET` | `4000` | Character cap on the merged digest, so the result stays lean. |

> **Private by default.** To rank skills to your stack, it reads your installed-skill names and your project's `package.json` locally, and transmits none of that. The only data it sends is your **search query** (scrubbed of emails, tokens/keys and file paths, and capped at 200 chars), whether it matched, and the id of the skill it loaded, so the catalog learns which skills to add next. The signal carries no identity, IP, or client fingerprint. It never sends your code, your files, or the `context` you pass. Set `DO_NOT_TRACK=1` (or `SK_NO_DEMAND=1`) to disable that too. No auth, no secrets. Ranking can also be nudged by human-approved catalog "lessons" (fetched read-only) - never by your data.

## 🚀 Install

> **Using an AI agent?** Just tell it: *"install the Skillselion MCP from github.com/skillselion/skillselion-mcp"* — it can run the commands below itself. For a fully unattended install (no prompts), point it at `setup --yes` (see [Skill autopilot](#-skill-autopilot-one-command-setup)).

### Claude Code

```bash
claude mcp add skillselion --scope user -- npx -y skillselion-mcp
```

`--scope user` makes it available in **all** your projects (drop it to add to the current project only). Prefer the bleeding edge? Swap `skillselion-mcp` for `github:skillselion/skillselion-mcp` to run straight from `master`.

### Claude Desktop / Cursor / Codex

Add this to your MCP config:

```json
{
  "mcpServers": {
    "skillselion": {
      "command": "npx",
      "args": ["-y", "skillselion-mcp"]
    }
  }
}
```

> **No build step, no auth, no config.** `npx` fetches a single ~30 KB file. Want full multi-file skill loads without GitHub's 60-req/hr cap? Add a `GITHUB_TOKEN` to the server's `env` (raises it to 5000/hr — optional, read-only). See [Troubleshooting](#-troubleshooting).

## 🪄 Skill autopilot (one-command setup)

Want your agent skill-aware **automatically**, every session?

```bash
# Interactive — pick your packs (humans, in a terminal)
npx -y skillselion-mcp setup

# Non-interactive — for agents / CI / scripts (never prompts)
npx -y skillselion-mcp setup --yes
npx -y skillselion-mcp setup --packs frontend,ai-agents --per-pack 5 --auto --yes
```

It **registers the MCP globally** (`claude mcp add --scope user`) and installs a Claude Code **`SessionStart` hook** that primes every session with relevant skills and tells the agent to **`load_skill`** the right one the moment a task matches — so skills load **dynamically, on demand**, without you remembering the tools exist.

**Choose what it primes you with** (instead of a generic global top-10):

| Flag | What it does |
|---|---|
| `--packs <a,b,…>` | one or more **packs** (or `all`), e.g. `--packs frontend,backend` |
| `--packs frontend:6,backend:3` | per-pack skill counts |
| `--per-pack N` | skills per pack (default 3) · `--top N` sets the `popular` count |
| `--auto` | also adapt each session to the **current repo's stack** (Next.js → frontend, Python → data, Docker → devops) |
| `--history` | infer your focus from **Claude Code / Codex history** (one-time scan at setup) |
| `--yes` / `--non-interactive` | never prompt (this is the **default whenever there's no terminal**, so agents never hang) |

**Packs:** `popular` *(default)* · `frontend` · `ai-agents` · `media` *(generative)* · `backend` · `devops` · `quality` · `automation`.

Safe by design: `~/.claude/settings.json` is **merged, never clobbered**, re-running **de-dupes + upgrades** the hook in place, it only ever **reads** the catalog, and the hook runs via an **absolute node path** so it can't silently fail on `PATH`. Restart Claude Code to activate.

## 💬 Example

> 🗣️ *"Set up Postgres for this project."*

Instead of winging it, your agent:

1. `search_skillselion({ query: "postgres", type: "skill" })` → finds **supabase-postgres-best-practices** (244k installs)
2. `load_skill({ id: "skill:supabase/agent-skills#supabase-postgres-best-practices" })` → loads the real `SKILL.md` into context **and drops any bundled scripts/refs into a temp folder**
3. **follows that skill** — reading its references and running its scripts — like it was installed all along.

With the [setup hook](#-skill-autopilot-one-command-setup) above, steps 1–2 happen on their own — the agent loads the skill the moment your task calls for it. ⬆️

## 🩺 Troubleshooting

**The agent never calls `load_skill` / I don't see the tools.**
Some clients (including recent Claude Code) surface MCP tools **lazily** - they don't appear in the
initial tool list and are only loaded on demand via a tool search. If your agent doesn't seem to see
`load_skill`, tell it to **search its tools for "skillselion" first** (e.g. ToolSearch), then call it.
The [setup hook](#-skill-autopilot-one-command-setup) primes each session with this nudge so it
happens on its own.

**`load_skill` returns just the `SKILL.md` text, without the bundled files.**
Materializing a skill's full directory uses the GitHub API, which is rate-limited to **60 requests/hr
when unauthenticated**. Heavy use exhausts that and the server falls back to the raw `SKILL.md` only.
Set a **`GITHUB_TOKEN`** (or `GH_TOKEN`) in the server's environment to raise the limit to **5000/hr**
and keep full multi-file loads working. It's read-only and optional.

**"No skill on Skillselion clearly matches ..."**
That's the relevance floor working as intended - nothing in the catalog topically matched your task,
so loading a merely-popular skill would just waste context. Try a more specific `query`, or
`search_skillselion` to browse.

**Setup said it couldn't auto-register.**
Run the printed `claude mcp add ...` line yourself. Auto-registration uses the `claude` binary; if it
isn't on the setup process's `PATH` (common under `npx`), setup resolves it from common install
locations + a login shell, but a non-standard install can still miss.

## 🛠 Development

```bash
npm install
npm test         # smoke: server starts + exposes the 3 tools
npm run test:live  # hits the live catalog + GitHub (set GITHUB_TOKEN to avoid rate limits)
node index.js    # speaks MCP over stdio
```

## ⭐ Like it?

- **[Star this repo](https://github.com/skillselion/skillselion-mcp)** — it helps other developers find it.
- **Browse the full catalog at [skillselion.com](https://skillselion.com)** — search thousands of skills, MCPs & marketplaces, ranked by real installs.
- Found a great skill that's missing, or hit a bug? **[Open an issue](https://github.com/skillselion/skillselion-mcp/issues)** — PRs welcome.

## 📄 License

[MIT](./LICENSE) © [Skillselion](https://skillselion.com)

<p align="center">
  <sub>Built for developers. Find the skill, not the noise. → <a href="https://skillselion.com">skillselion.com</a></sub>
</p>
