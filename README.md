<p align="center">
  <img src="./assets/banner.svg" alt="Skillselion MCP" width="100%">
</p>

<p align="center">
  <a href="https://github.com/skillselion/skillselion-mcp/releases"><img src="https://img.shields.io/github/v/release/skillselion/skillselion-mcp?style=flat-square&color=d8455f&label=release&sort=semver" alt="Release"></a>
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
  <img src="./assets/demo.gif" alt="Skillselion MCP: search the live catalog, then load_skill materializes the real skill into a temp folder" width="92%">
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
| 🏆 **`top_skillselion`** | The leaderboard — "what are the best Claude Code skills / MCP servers right now." Skills rank by installs; MCP servers & marketplaces by GitHub stars. |

> **Read-only & private.** The server only issues `GET` requests to the public Skillselion catalog API. No auth, no writes, no secrets, no telemetry.

## 🚀 Install

> **Using an AI agent?** Just tell it: *"install the Skillselion MCP from github.com/skillselion/skillselion-mcp"* — it can run the commands below itself. For a fully unattended install (no prompts), point it at `setup --yes` (see [Skill autopilot](#-skill-autopilot-one-command-setup)).

### Claude Code

```bash
claude mcp add skillselion --scope user -- npx -y github:skillselion/skillselion-mcp
```

`--scope user` makes it available in **all** your projects (drop it to add to the current project only).

### Claude Desktop / Cursor / Codex

Add this to your MCP config:

```json
{
  "mcpServers": {
    "skillselion": {
      "command": "npx",
      "args": ["-y", "github:skillselion/skillselion-mcp"]
    }
  }
}
```

> Runs straight from this repo — **no build step**. Once published to npm, plain `skillselion-mcp` (without the `github:` prefix) will work too.

## 🪄 Skill autopilot (one-command setup)

Want your agent skill-aware **automatically**, every session?

```bash
# Interactive — pick your packs (humans, in a terminal)
npx -y github:skillselion/skillselion-mcp setup

# Non-interactive — for agents / CI / scripts (never prompts)
npx -y github:skillselion/skillselion-mcp setup --yes
npx -y github:skillselion/skillselion-mcp setup --packs frontend,ai-agents --per-pack 5 --auto --yes
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
node index.js   # speaks MCP over stdio
```

## 📄 License

[MIT](./LICENSE) © [Skillselion](https://skillselion.com)

<p align="center">
  <sub>Built for builders. Find the skill, not the noise. → <a href="https://skillselion.com">skillselion.com</a></sub>
</p>
