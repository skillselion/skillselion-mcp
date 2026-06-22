# Goal — Skillselion MCP: flawless end-to-end product

Make the Skillselion MCP a flawless end-to-end product: every install path, every user flow, and
the README all correct and verified, tracked in ONE canonical spreadsheet, looped until green. The
MCP is the single file `~/Desktop/root/skillselion-mcp/index.js` (server + installer) plus its
SessionStart hook and README. Ship/deploy/push only on Itzik's explicit go.

## Where you are (do NOT redo)
Branch `eval-trigger-relevance-fixes` already has 4 fix commits on 0.5.2 (action-first priming +
relevance floor, local-skill gap targeting, richer ranking, demand signals) and a prism
`mcp-demand-flywheel` branch. These are built + unit-tested but NOT yet proven by a re-run eval.
Fold that proof into Phase 2 rather than treating it as separate.

## LOOP 1 — INVENTORY (build the canonical tracker from the code)
Read index.js, the hook (session-context.mjs / the embedded hook writer), package.json and README
end to end. Enumerate EVERY feature and user flow; for each write a user story + the exact expected
behavior, derived from the code. Keep it in ONE canonical file the whole loop updates:
`skillselion-mcp/docs/feature-status.md` (a markdown table = the spreadsheet). Columns:
ID | area | user story | expected behavior | test method | status (untested/pass/fail) |
error found | fix | retest. Cover at minimum every area below — add any you find:

- INSTALL: `npx github:skillselion/skillselion-mcp` interactive setup; `setup --yes`
  non-interactive; claude-binary resolution (resolveClaude, PATH-independent); idempotent
  `claude mcp add` (the "already exists" success path); SessionStart hook install; any
  "packs"/profile options; re-run over an existing install; uninstall/cleanup if present;
  per-client config writing (Claude Code, Cursor, Codex, Windsurf — whichever the installer
  targets).
- RUNTIME TOOLS: search_skillselion(query,type,limit); load_skill(query|id, context) full path
  (search -> rank -> materialize SKILL.md+files to temp -> return candidates + dependency
  warnings); top_skillselion(type); server `instructions` handshake; SessionStart priming
  injection.
- ERROR/EDGE PATHS: no-match relevance floor; load_skill missing required context; GitHub
  rate-limit (60/hr unauth vs 5000 w/ token) + raw.githubusercontent fallback; API/network down;
  malformed or file-less skill; demand-signal POST 404 swallowed (endpoint not yet deployed).
- DOCS: every claim in README (install command, supported clients, the 3 tools, troubleshooting)
  must map to a real, current behavior.

## LOOP 2 — TEST EVERY STORY E2E, document every error in the tracker
Test against the LOCAL branch build, not the published npx. For runtime, the eval harness exists at
`/tmp/ss-eval` (use ss-eval-mcp-local.json -> node .../index.js; arms A1/A2/B; baseline
SCORECARD.md).

- Install: run setup in a genuinely CLEAN state (fresh tmp HOME / cleared npx cache) and read back
  the files it wrote — confirm the registration + hook + per-client config are correct, and that
  output messaging is honest (no false "could not auto-register" — that 0.5.2 regression must stay
  dead). For clients you can't run live, verify the written config by inspection and mark
  "code-verified, not live-tested" — don't claim a pass you didn't observe.
- load_skill quality IS its acceptance test: re-run trigger (A1+A2, 9 positives) and
  relevance-floor (forced load on 3 negatives + ci_pipeline) and compare to the 0.5.2 baseline.
  Floor must now return "no clear match" not junk; trigger should be up; supabase/stripe/playwright
  must not regress; on overlap tasks gap-targeting should prefer the local plugin while the MCP
  stays out. Blind-judge any treatment-vs-control outcome contrast.
- Every flow gets a row marked pass/fail with the concrete error captured.

## LOOP 3 — FIX every install / logistical / UX error + bring the README to truth
Fix each failing row in index.js / the hook. Rewrite README so it exactly matches 0.5.3 behavior
and reads like a storefront for a PUBLIC repo (clear one-line install, the 3 tools, supported
clients, troubleshooting for the deferred-tool/ToolSearch reality and rate limits). Anything that
needs catalog DATA (semanticTags/taskQueries enrichment, dep pre-filtering) is OUT of MCP scope ->
log as a prism/backend item, don't fake it. Each fix gets a regression test in test/live.mjs.

## LOOP 4 — RE-TEST every story post-fix
Update the tracker; repeat Loops 2-4 until every row is pass (or explicitly deferred with a
reason). Then bump VERSION to 0.5.3 and write the changelog.

## CONSTRAINTS (hard)
- Nothing live without Itzik's explicit go. prism `mcp-demand-flywheel` needs a PROD DB MIGRATION +
  deploy to activate — keep it held; it's the one hard-to-reverse outward step.
- Don't push the public skillselion-mcp branch or open a PR unless told. When told:
  `gh auth switch -u skillselion`, push, then ALWAYS `gh auth switch -u ItzikDabush` back. Itzik's
  name must not appear on public commits/PRs.
- A parallel worktree session keeps its own files in /tmp/ss-eval (prefixes t_/c_/pr_,
  parse_primed.mjs, clean-home/). Leave them; use your own runs/ + *_local.json. You own index.js.
- TL;DR after each loop: rows passed / rows failing / what's next. No em dashes (use -).

## REPORT
After Loop 1: the full feature-status table (so Itzik sees the surface + expected behavior before
testing). Then a short status after each subsequent loop, and a final ship-readiness call.
