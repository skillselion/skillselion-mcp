# Changelog

## 0.5.3

End-to-end hardening pass (see `docs/feature-status.md` for the full verified surface).

### Fixed
- **load_skill no longer errors on long natural-language queries.** The catalog API rejects an
  over-long `q` (HTTP 400); `smartFetch` now skips over-long variants and swallows per-variant
  errors, falling through to broader (shorter) variants instead of aborting the whole call. This was
  causing most full-sentence `load_skill` queries to fail outright.
- **Relevance floor actually fires now.** It keys off a query match in a *curated* field
  (name / tool / editorial highlights / category) rather than any token anywhere in the haystack, so
  a clear no-match (e.g. a poem task) returns "no clear match" instead of a junk popular skill.
- **Top pick that can't be materialized falls back to the next candidate** (dead repo / odd path)
  instead of dead-ending with "Couldn't load".
- **Sharper ranking + anchor selection:** strong (curated-field) hits outweigh weak (prose) hits;
  generic code/English/filler words ("function", "return", "optimize", "up", ...) no longer pollute
  matching or hijack the broad-pool anchor.

### Added
- **Optional `GITHUB_TOKEN` / `GH_TOKEN` support** on the skill-materializing GitHub fetches - raises
  the rate limit from 60/hr to 5000/hr so heavy use keeps loading full multi-file skills.
- **Troubleshooting** section in the README (deferred-tool/ToolSearch reality, rate limits, the
  relevance floor, auto-register fallback).
- Regression tests: `test/relevance.mjs` (long-query no-throw, floor, domain pick); `test/live.mjs`
  now forwards env so it's token-aware; `test:live` npm script.

## 0.5.2
- setup: treat "already exists" MCP registration as success (idempotent).

## 0.5.1
- setup: resolve the `claude` binary by absolute path (PATH-independent).

## 0.5.0
- load_skill: required `context`, scored candidates, repo-aware ranking, dependency warnings.
