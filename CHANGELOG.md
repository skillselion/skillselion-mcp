# Changelog

## 0.9.0

### Added
- **New `synthesize_skills` tool.** Alongside `load_skill` (still the everyday default), it retrieves the top matching skills (default 5, `SK_SYNTH_N`, clamp 2-8), deduped by repo, and returns a compact, provenance-tagged digest of their key rules merged and deduped across sources - a cross-source playbook no single skill or the model's memory has. Each source skill is still materialized to disk for full detail. Rule extraction is a cheap client-side heuristic (no server LLM); output is budget-capped (`SK_SYNTH_BUDGET`, default 4000 chars) and per-skill capped (`SK_SYNTH_PER_SKILL`, default 12). Degrades to a single `load_skill` card when only one skill matches. `load_skill` behavior is unchanged.

## 0.8.3

### Changed
- **`load_skill` output is now lean by default.** Instead of inlining the full SKILL.md into the tool
  result, it returns a compact emoji summary (skill, one-liner, dependency flags, file map, runner-up
  candidates) and leaves the complete SKILL.md plus bundled files materialized on disk for the agent to
  read and follow. Keeps the human-facing result short and scannable while the agent still gets
  everything. (The GitHub-fallback path, used when a skill's files can't be materialized, still inlines
  the SKILL.md text since there is no local copy.)

## 0.8.2

### Changed
- Docs and packaging cleanup. No behavior change to the three tools.

## 0.8.1

### Changed
- **`load_skill` responses now use 3-tier progressive disclosure** to cut the tokens injected into the
  caller's context. A compact card (name, one-liner, dependency flags, local path, runner-ups) is
  always returned; the SKILL.md body is inlined in full when small and, when large, clipped at a
  section boundary with a pointer to the full file on local disk; bundled reference/script files are
  listed with a one-line purpose each and read on demand rather than inlined. The complete skill is
  always materialized to disk (unchanged) - only what is placed in-context is bounded, so there is no
  added latency. The inline budget is env-overridable via `SK_INLINE_BUDGET` (default 6000 chars).

## 0.8.0

### Added
- **Self-improving loop (opt-in, human-gated).** `load_skill` now records a scrubbed, anonymous
  demand signal server-side (no identity/IP/fingerprint; query stripped of emails, tokens and file
  paths, capped at 200 chars; `context` never sent). Opt out with `DO_NOT_TRACK=1` or `SK_NO_DEMAND=1`.
- **Lesson-biased ranking.** The matcher reads human-approved "lessons" from the catalog
  (`GET /mcp/lessons/active`, best-effort, read-only) and lets a `prefer`/`block` lesson nudge a
  listing for the query shapes it names. Inert until a human promotes a lesson, so default ranking is
  unchanged - and it degrades to today's behavior if the fetch fails.

## 0.7.0

### Changed
- **`load_skill` now materializes from Skillselion's own skill-files store** (`GET /api/skills/:id/files`)
  before falling back to GitHub. The old loader guessed 4 conventional GitHub paths and 404'd on repos
  with non-standard layouts (e.g. skills nested under `plugins/`), so the right skill was picked but
  couldn't be loaded. Pulling the real upstream content by id fixes that. Measured on a 228-case
  catalog-validated eval: hit-rate **72% → 81%**, "couldn't load" failures **24 → 0**. The catalog
  fetch is capped (~25s) and falls back to GitHub so a cold lazy-backfill never hangs the agent.
- **Ranking + relevance-floor tuned via grid-search** over the 228-case set: semantic matches weigh
  more relative to keyword hits, and the floor requires a genuinely close semantic match (or ≥2
  curated keyword hits) so off-topic queries are refused. All knobs are env-overridable
  (`SK_SEM_WEIGHT`, `SK_QSTRONG_WEIGHT`, `SK_SEM_DIST_MAX`, `SK_SEM_FLOOR_RANK`, `SK_FLOOR_MIN_QSTRONG`).

### Added
- `test/eval.mjs` labeled relevance harness + `test/eval-cases.json` (228 catalog-validated cases),
  and `test/embed-variants.mjs` (offline A/B/C embedding-text experiment).

## 0.6.1

### Changed
- **Privacy: the demand signal no longer transmits your `context`.** `load_skill` used to POST the
  `context` string you pass (your task, stack and constraints) to the catalog's demand endpoint. It
  now sends only the search query, whether it matched, and the id of the skill it loaded.
- **New `DO_NOT_TRACK` / `SK_NO_DEMAND` opt-out.** Set either env var to disable the demand signal
  entirely.
- **Docs: corrected the README privacy note.** The server makes one best-effort `POST` to record
  demand, so the old "GET-only / no telemetry" wording was inaccurate; the note now states exactly
  what is read locally and what is sent.

## 0.6.0

### Added
- **Hybrid semantic matching for `load_skill`.** Alongside the two keyword pools, `load_skill` now
  pulls a third pool from the catalog's new embedding-ranked `semantic=` search, so it surfaces
  concept matches that share no keyword with the query (e.g. a "pub/sub" skill for a "Postgres
  LISTEN/NOTIFY" task) - the recall the keyword pools can't reach. `rankCandidates` blends a
  rank-decayed semantic boost into the score, and a strong semantic match (top-5 of the embedding
  pool) clears the relevance floor.
- Degrades safely: if the catalog has no embeddings configured, `semantic=` falls back to a keyword
  search server-side, so behavior is unchanged. No new dependency (fetch-based).

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
