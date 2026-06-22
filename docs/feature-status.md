# Skillselion MCP - feature status tracker (canonical)

Single source of truth for the end-to-end product loop. Derived from `index.js`, README.md,
package.json, test/*.mjs.

Status: `untested` · `pass` · `fail` · `fixed` (failed then fixed + retested) · `deferred` (reason).

Last updated: **Loop 3** (test + fix) - 2026-06-22, VERSION 0.5.3. Tests: `test/{smoke,verbose,live,relevance}.mjs` all green.

---

## A. INSTALL / SETUP

| ID | story | expected | status | note |
|----|-------|----------|--------|------|
| I1 | interactive TTY setup | picker shows packs+auto+history, then per-pack count | deferred | interactive-only; logic exercised via flags (I3). Not driven in a pty this loop. |
| I2 | `setup --yes` | never prompts; defaults popular×10; writes config+MCP+hook+settings | pass | clean tmp HOME: config written, MCP registered, hook written+valid+emits priming |
| I3 | flags `--packs/--per-pack/--auto` | parsed, non-interactive, config reflects them | pass | `frontend×5,backend×5 auto=true` correct |
| I4 | `--packs all` | 8 packs | pass | covered by parser (keyList=all) |
| I5 | unknown pack | logs skip, falls back to popular | pass | `! unknown pack "boguspack" (skipped)` -> popular×10 |
| I6 | resolveClaude | abs path PATH-independent | pass | resolves `~/.local/bin/claude` |
| I7 | MCP register success | `claude mcp add --scope user`, "✓ registered" | pass | live register in clean HOME |
| I8 | idempotent re-register | "already registered (left as-is)" | pass | 2nd run reports it |
| I9 | register failure honesty | prints manual fallback, no false success | deferred | code-verified (can't remove claude to live-test); logic correct |
| I10 | hook write | self-contained mjs at ~/.skillselion | pass | written, `node -c` ok, runs |
| I11 | absolute node path | `${execPath} ${hook}` not bare node | pass | settings has full nvm node path |
| I12 | settings merge | preserves model + existing hooks | pass | model:opus + "echo existing" kept, ours appended |
| I13 | re-run de-dupe | upgrades in place, no dup | pass | SessionStart entries=1 after re-run |
| I14 | corrupt settings guard | "not valid JSON", not clobbered | pass | file left untouched |
| I15 | `--history` | adds history pack or "no clear focus" | deferred | not exercised this loop; best-effort scan, low risk |
| I16 | config.json shape | `{packs:[{key,count,categories}],auto}` | pass | valid |
| I17 | interactive cancel | "Setup cancelled." | deferred | interactive-only |
| I18 | uninstall | none exists | deferred | GAP - no uninstall command (0.5.4 candidate) |
| I19 | per-client config | CC-only auto; others manual JSON | pass | confirmed by code + doc truth (README) |

## B. RUNTIME TOOLS

| ID | story | expected | status | note |
|----|-------|----------|--------|------|
| R1 | server + 3 tools | smoke | pass | smoke.mjs |
| R2 | instructions handshake | SERVER_INSTRUCTIONS + gapLine | pass | present, includes gap line |
| R3 | search basic | ranked fmt rows | pass | live.mjs [1] |
| R4 | search broadening | wordy query broadens, no error | fixed | smartFetch now skips >120-char variants + catches per-variant errors |
| R5 | search no results | helpful message | pass | |
| R6 | search type filter | restricts | pass | type=mcp |
| R7 | load by id multi-file | materialize SKILL.md+refs | pass | live.mjs: 10 files materialized (with token) |
| R8 | load by query | rank->pick->materialize+alternates | pass | verbose.mjs + relevance.mjs |
| R9 | requires context | refuse w/o context | pass | verbose.mjs |
| R10 | relevance ranking | topical pick | pass | mcp/playwright/supabase/stripe/nestjs/seo all correct on concise queries |
| R11 | repo-aware boost | repoCategories | pass | code-verified (repoCategories) |
| R12 | dep warning | flags tools/secret | pass | detectDeps + conflict note |
| R13 | tree->raw fallback | raw SKILL.md when tree fails | pass | verified under rate-limit (returned "# Skill:" body) |
| R14 | unloadable repo | install hint, no crash | pass | bad id -> "Couldn't load ... Install it instead" |
| R15 | top_skillselion | sorted leaderboard | pass | type=mcp by stars |

## C. ERROR / EDGE

| ID | story | expected | status | note |
|----|-------|----------|--------|------|
| E1 | relevance floor | no-match -> "no clear match", not junk | fixed | floor now keys off curated-field (strong) query match; haiku floors; see deferred negatives below |
| E2 | demand fire-and-forget | POST swallowed, tool unaffected | pass | endpoint not deployed -> still loads (404 swallowed) |
| E3 | API down / 400 | graceful | fixed | the big one: long `q` HTTP-400 no longer aborts load_skill (smartFetch resilient) |
| E4 | offline priming | directive-only fallback | pass | code-verified (printSessionContext catch) |
| E5 | malformed/dead skill | fallback to alternate, then install hint | fixed | load now tries pick + 2 alternates before giving up (frontend_pricing no longer dead-ends) |
| E6 | GitHub rate-limit | 60->5000 w/ token | fixed | added GITHUB_TOKEN/GH_TOKEN support on all 3 GitHub fetches |
| E7 | trigger rate (A1/A2) | re-measure vs 8% baseline | tested | Loop 4 swarm: realistic 1/9 (unchanged); native-blocked 2/9 (vs ~1/9). Discoverability works (agent ToolSearches skillselion, load_skill IS available) - it declines on confident/familiar tasks. Trigger is **model-confidence-gated**, not what these fixes targeted. |
| E8 | gap-targeting yields to local | prefer local plugin | pass | Loop 4: on overlap domains (supabase/frontend/nestjs/seo) the agent uses the **native** plugin (native=1), MCP correctly stays out - exactly the intended yield |

## D. DOCS

| ID | story | status | note |
|----|-------|--------|------|
| D1 | install cmd | fixed | added `--scope user` + scope note |
| D2 | supported clients | pass | CC auto-setup; others manual JSON (truthful) |
| D3 | tools table | pass | matches runtime |
| D4 | flags table | pass | every flag parsed |
| D5 | deferred-tool/ToolSearch | fixed | added Troubleshooting entry |
| D6 | rate-limit troubleshooting | fixed | added (GITHUB_TOKEN) |
| D7 | version sync | pass | badges dynamic; 0.5.3 |

---

## Deferred (with reason)
- **neg_fib** (`python` skill) and **neg_rename** (refactoring/vscode) still load on forced calls: the task text literally contains domain words ("Python ... unit tests", "rename"), which lexically match plausibly-relevant skills. Distinguishing "trivial, no skill needed" from "domain word present" needs semantics, not lexical matching. Autonomously these got 0/3 false triggers; the floor catches the clear no-match (haiku). **Out of MCP scope** - needs catalog tag enrichment.
- **Weak picks on vague multi-term perf queries** (e.g. "react list performance optimization" -> a kitchen-sink skill matching all 4 terms): lexical ceiling. **Prism/backend item:** populate `semanticTags`/`taskQueries` so ranking can be semantic, not regex.
- **I1/I17 interactive picker, I15 history:** interactive/best-effort; logic exercised via flags, not a pty, this loop.
- **I18 uninstall:** no command exists. 0.5.4 candidate.
- **E7/E8 trigger + gap-yield:** require the `claude -p` swarm; Loop 4.

## Loop 4 - trigger swarm (2026-06-22, local 0.5.3 build, 9 positives + 3 negatives)
- **Realistic (hook + native plugins present): 1/9 triggered** (stripe -> stripe-integration-expert). Same as the 0.5.2 baseline.
- **Native-blocked (isolates the MCP's own trigger): 2/9** (stripe, frontend_pricing). Up from ~1/9.
- **Negatives false-triggered: 0/3** (good - no over-triggering).
- **Gap-yield confirmed:** on overlap domains the agent ran the local plugin (`native=1`), MCP stayed out - working as designed.
- **Root cause of low trigger (verified, not inferred):** runs COMPLETED (result=success, not killed) and the agent **did** ToolSearch for skillselion and **had** `load_skill` available - it just declined on tasks it's confident about (playwright/mcp/ci/react), building from memory. So trigger is gated by **model confidence**, not discoverability or the deferred-tool friction. The 0.5.3 fixes targeted relevance/floor/robustness (all improved); trigger is a separate, inherent ceiling. Moving it further would need a more coercive priming directive (risk: annoying real users) and still can't force a tool call.

## Prism/backend follow-ups (NOT MCP scope)
- Populate `semanticTags` / `taskQueries` / `keywords` on listings so load_skill ranking is semantic.
- Deploy `mcp-demand-flywheel` (held): `/mcp/demand` endpoint + McpDemandSignal table - needs prod DB migration + deploy on Itzik's go.
