# Skillselion MCP server

An [MCP](https://modelcontextprotocol.io) server that lets your AI agent search
**[Skillselion](https://skillselion.com)** - a curated directory of Claude Code
**agent skills, MCP servers and plugin marketplaces**, ranked by real community
signal (installs + GitHub stars) - without leaving the editor.

Works with any MCP client: Claude Code, Claude Desktop, Cursor, Codex, and more.

## Tools

| Tool | What it does |
|---|---|
| `search_skillselion` | Search the catalog by keyword/task (e.g. `postgres`, `code review`, `playwright`); optional `type` filter (`skill` / `mcp` / `marketplace`). Returns name, type, installs, stars, trust signal, repo, an install command, and the listing URL. |
| `top_skillselion` | List the most-installed entries (the leaderboard), optionally by type - "what are the best Claude Code skills/MCP servers right now". |

Read-only: the server only issues `GET` requests to the public Skillselion
catalog API. No auth, no writes, no secrets, no telemetry.

## Install

### Claude Code

```bash
claude mcp add skillselion -- npx -y github:skillselion/skillselion-mcp
```

### Claude Desktop / Cursor (config)

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

> Once published to npm, `skillselion-mcp` (without the `github:` prefix) will
> work too. For now the `github:` form runs straight from this repo - no build step.

## Example

> "Find me a trusted Postgres skill for Claude Code."

The agent calls `search_skillselion({ query: "postgres", type: "skill" })` and
gets back the top ranked results with install commands.

## Development

```bash
npm install
node index.js   # speaks MCP over stdio
```

## License

MIT
