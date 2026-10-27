# Autonomous Task: Harden and productionize BuildSight (Next.js 16 build copilot)

## Instructions
Continue working until all todos are complete.
Do not stop to ask questions.
Do not wait for confirmation at checkpoints.
Make reasonable assumptions and proceed. Log each assumption in Notes.
If a fix does not work, try a different approach.
Run validation after every meaningful change.
Update progress in this file as you go (tick boxes, add Notes).
Commit after each phase on branch `improve/hardening` with a clear message. Never push to `main`. Never commit secrets or `.env.local`.
Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (this is NOT the Next.js in your training data; see AGENTS.md).

## Task Description
BuildSight is a hands-free build copilot (Cal Hacks 13.0): the user shows it picture-based instructions (LEGO/IKEA PDFs), a camera watches the build, Claude compares frames to the manual's step picture, voice (Azure STT + Cartesia TTS) guides and catches mistakes. It was built in a weekend; the baseline works (all `npm test` suites pass, lint clean, typecheck clean after `next typegen`). Goal: make it safe to run publicly, maintainable, and measurable, WITHOUT changing user-visible behavior.

Four workstreams: (1) CI + docs, (2) API hardening (unauthenticated, spend-bearing routes), (3) split the 1788-line `BuildView.tsx` with zero behavior change, (4) test + offline eval coverage for untested logic.

## Context
- Relevant files: `src/app/api/*/route.ts` (extract, tts, search, speech-token, locate, assist, vision, where-am-i, check), `src/lib/*.ts` (claude.ts, issueBox.ts, autoCheck.ts, commands.ts, assistReply.ts, whereAmI.ts, manuals.ts, catalog.ts, json.ts, encode.ts, parts.ts), `src/components/BuildView.tsx`, `scripts/test-*.mjs`, `package.json`, `.github/workflows/azure-image.yml`, `README.md`, `DECISIONS.md`, `.env.example`.
- Dependencies: Node + npm only. Do NOT use real API keys; no test may touch the network. `npm ci` already works.
- Test pattern: plain Node scripts run with `node --experimental-strip-types --no-warnings scripts/test-*.mjs`. New testable modules must be strip-types compatible (no path aliases, no enums/namespaces, relative imports with `.ts` extensions as existing libs do; check an existing lib for the exact convention).
- Typecheck needs route types first: `npx next typegen && npx tsc --noEmit` (plain `tsc` fails on `LayoutProps` without typegen).
- Constraints / do not touch: `public/steps/**`, `src/data/catalog.json`, `scripts/catalog-cache.json`, `DEPLOY-AZURE.md` command values, any model name/effort/token settings in `src/lib/claude.ts` (documented in DECISIONS.md), `scripts/preread.py`, `scripts/hires.py`. Do not add heavy dependencies; prefer zero new runtime deps (a dev-only test helper is fine).
- Out of scope (needs credentials or a human; separate spec): phone-to-laptop pairing via Azure Web PubSub, real-camera accuracy testing, Azure deploy changes.

## Todo Checklist

### Investigation
- [x] `git checkout -b improve/hardening`; run `npm ci`, `npm test`, `npm run lint`, `npx next typegen && npx tsc --noEmit`, `npm run build`; record baseline results in Notes (if build needs env vars, create `.env.local` with dummy values, never commit it, log as assumption)
- [x] Read every `src/app/api/*/route.ts`; table in Notes: route, what it spends (Claude/Cartesia/Azure/fetch to lego.com or ikea.com), request body size limits, input validation present?, SSRF risk (any route fetching a user-supplied URL, esp. `search` and PDF rewrites in `next.config.ts`)
- [x] Read `BuildView.tsx` and list its responsibilities (camera/motion, checks, auto mode, voice wiring, step navigation, overlays, persistence) with line ranges in Notes; propose the split (hooks vs components) before editing
- [x] List `src/lib` modules with no test coverage; pick the pure ones for Phase 4

### Implementation
**Phase 1: CI + docs**
- [x] Add `typecheck` script to `package.json` (`next typegen && tsc --noEmit`)
- [x] Add `.github/workflows/ci.yml`: on push + pull_request, Node LTS, `npm ci`, lint, typecheck, `npm test`, `npm run build`; cache npm; leave `azure-image.yml` unchanged
- [x] Replace stub `README.md` with a real one: what it is, demo flow, architecture (data flow: PDF → extract → step records → camera check → voice), env vars from `.env.example` (no secret values), scripts table (dev/test/typecheck/build/catalog/preread), deploy pointer to DEPLOY-AZURE.md, known limitations, CREDITS pointer. Keep DECISIONS.md as-is

**Phase 2: API hardening** (no behavior change for normal use)
- [ ] `src/lib/rateLimit.ts`: in-memory token bucket keyed by client IP (from `x-forwarded-for`, first hop) + route name; per-route limits (cheap: speech-token, search; expensive: check, assist, extract, locate, where-am-i, vision, tts); returns `{ok, retryAfterSec}`; bounded memory (evict stale keys); document that it is per-instance
- [ ] `src/lib/apiGuard.ts`: wrapper used by every route: rate limit → 429 with `Retry-After`; reject bodies over a per-route max (e.g. 8 MB for frames, 64 KB for text) with 413; JSON parse errors → 400 not 500; never echo upstream error bodies or keys in responses
- [ ] Apply the guard to all 9 routes; keep response shapes for success cases identical (existing UI must keep working)
- [ ] Validate and clamp inputs in `check`, `assist`, `locate`, `where-am-i`, `tts` (types, max string lengths, max frame count, allowed image mime/prefix); `search` must only fetch lego.com / ikea.com hosts (allowlist) and reject anything else
- [ ] Add `X-Content-Type-Options` and `Referrer-Policy` headers in `next.config.ts` without breaking camera/mic (`Permissions-Policy` must still allow camera and microphone for self)

**Phase 3: Split `BuildView.tsx` (behavior-preserving)**
- [ ] Extract in small commits, running tests after each: camera/motion-stillness logic, check-build flow + result state, auto-mode controller, voice/command wiring, step navigation + persistence, overlays/panels as components under `src/components/build/`
- [ ] Target: `BuildView.tsx` under ~600 lines, no logic changes, no changed props on existing components, no new `any`
- [ ] Pure logic that moves into `src/lib` gets a test in the matching `scripts/test-*.mjs`

**Phase 4: Tests + offline eval**
- [ ] `scripts/test-api-guard.mjs`: rate limiter (burst, refill, per-IP isolation, eviction), body-size and JSON-error handling, host allowlist; add to `npm test`
- [ ] `scripts/test-claude.mjs`: mock `fetch`; verify `src/lib/claude.ts` picks Anthropic SDK path vs OpenRouter fallback by env, never sends `temperature`, surfaces errors without leaking keys; add to `npm test`
- [ ] Tests for `manuals.ts`, `catalog.ts`, `json.ts`, `whereAmI.ts` parsing (pure functions only); add to `npm test`
- [ ] `scripts/eval-check.mjs`: offline eval of the pass/fail pipeline using recorded model outputs in `scripts/fixtures/check/*.json` (write 12+ cases: pass, issues, can_see false, low confidence, malformed JSON, refusal text) through `isPass()` / `checkVerdict()` / issue-box location logic; print a confusion table; exit non-zero on any mismatch; add `test:eval` script and include in `npm test`

### Validation
- [ ] Run `npm run lint` and fix any issues
- [ ] Run `npm run typecheck` and ensure zero errors
- [ ] Run `npm test` and ensure all suites pass (original 6 + new ones)
- [ ] Run `npm run build` and ensure it succeeds
- [ ] Start `npm run dev` in background; `curl -s -o /dev/null -w "%{http_code}"` against `/` (expect 200) and `/practice/parrot` (expect 200); hit one API route 40 times fast and confirm 429s appear, then a valid small request succeeds after the window; kill dev server
- [ ] Confirm no new network calls in tests (`grep -rn "api.anthropic.com\|openrouter.ai\|cartesia" scripts/test-*.mjs scripts/eval-check.mjs` shows only mocked references)
- [ ] `git diff main --stat`: confirm none of the do-not-touch paths changed

### Cleanup
- [ ] Remove debug logging and scratch files; no `console.log` added to `src/`
- [ ] Add a "Hardening pass" section to `DECISIONS.md` (decision, why, date) for: rate limiting, input caps, host allowlist, CI, BuildView split, eval harness
- [ ] Final validation: `npm run lint && npm run typecheck && npm test && npm run build`

## Definition of Done
- `.github/workflows/ci.yml` exists and runs lint, typecheck, test, build; the same four commands pass locally
- Every file in `src/app/api/*/route.ts` goes through the guard; over-limit returns 429 + `Retry-After`, oversized body 413, bad JSON 400; `search` rejects non-lego.com/ikea.com hosts
- `src/components/BuildView.tsx` is under ~600 lines with extracted modules in `src/components/build/` and `src/lib`; all pre-existing tests pass unmodified (except import-path fixes)
- New suites (`test-api-guard`, `test-claude`, manuals/catalog/json/whereAmI, `eval-check`) are part of `npm test` and pass offline
- README documents setup, env vars, architecture, scripts, limitations
- No regressions in: voice commands (`test:commands`), assist parsing (`test:assist`), auto mode (`test:auto`), practice mode (`test:practice`), mistake boxes (`test:boxes`), parts (`test:parts`)
- All work committed on `improve/hardening`; nothing pushed to `main`

## Notes
[Agent: log progress, assumptions, and blockers here]

Baseline (recorded by spec author, 2026-10-27): `npm ci` ok (621 pkgs); `npm test` all passed; `npm run lint` clean; `tsc --noEmit` fails only on `LayoutProps` until `next typegen` runs, then clean; `npm run build` not yet verified.

### Investigation — 2026-10-27
- Base: fetched upstream `86b82da`, created `improve/hardening` there because the spec describes its practice/auto features. `ar-akhil` remains at `abaaf0e`; local main remains at `3d0f3ef`. No merging or pushing to main. This is post-event maintenance, separate from the submission.
- Baseline: npm ci, all six original test suites, lint, typegen/typecheck, and production build pass. Old .next AR route types initially broke typecheck after branch switching; moved that generated cache to /tmp and regenerated. No dummy environment file was needed. Existing .env.local stays untouched/untracked; no live model calls are used for validation.
- npm ci reported two high dependency advisories; inspect separately before completion. No automatic dependency upgrades.
- Next route-handler, client component, and headers guides are the reference for implementation.

| Route | External work | Baseline body cap | Baseline validation | Fetch / SSRF surface |
| --- | --- | --- | --- | --- |
| extract | Claude, up to two attempts | none; page string 6M chars | image prefix only | no user URL fetch |
| check | Claude | none; each image 4M chars | images; optional metadata unchecked | no user URL fetch |
| assist | streamed Claude | none; frame 4M chars | question trim, last 8 turns; unsafe types | no user URL fetch |
| locate | Claude | none; image 4M chars | part <=120, image prefix | no user URL fetch |
| where-am-i | Claude | none; each image 4M chars | filters/slices 8 sheets; unsafe types | no user URL fetch |
| vision | Claude | none; image 4M chars | image prefix; unsafe types | no user URL fetch |
| tts | Cartesia | none; transcript sliced to1500 | trim assumes string | fixed endpoint |
| speech-token | Azure Speech token | none (GET) | server configuration only | server-controlled region |
| search | LEGO, IKEA pages + IKEA search | none (GET) | query 2–80 chars; pipUrl prefix | upstream page URLs and redirects; constrain hosts |

PDF rewrites use fixed HTTPS origins, not an arbitrary destination supplied by the client. IKEA wildcard forwards paths only; host cannot change from a path. Search's existing IKEA discovery endpoint is the fixed IKEA-operated `sik.search.blue.cdtapps.com/us/en/search-result-page`. Keep that exact server-owned endpoint to preserve IKEA search; all product/manual URL fetches and redirects must stay on lego.com/ikea.com. This necessary exception is never a user-selectable host.

BuildView baseline responsibilities / extraction plan (original line numbers):
- 51–224: state types, persisted auto preferences and settings UI → build/types, autoPreferences, AutoControls.
- 226–415: canvas crops/thumbnails, step labels, viewport, concurrent PDF/page reader → build/images, pageReader, useIsPhone; pure labels/limiter into tested lib modules.
- 417–598, 677–706, 795–969: library/PDF loading, extraction, target images, navigation, persistence, thumbnails → useBuildNavigation.
- 499–514, 599–669: part localization/cutout caches → usePartGuidance.
- 707–789: step-scoped checks, voice completion, cancellation/countdown → useBuildCheck.
- 970–1121: camera step recognition, grayscale motion/stillness loop, auto controller → useBuildRecognition / useAutoController.
- 671–675, 791–794, 1130–1213: announcements, voice actions/commands and shortcuts → useBuildVoice.
- 1215–1788: camera/header, overlays, panels and step card → BuildHeader, BuildOverlays, BuildStepCard, CheckResultPanel; BuildView composes them.

Untested lib modules: claude, manuals, catalog, json, whereAmI, prebuilt, pdf, cutout, encode, listen, speech. Phase4 covers pure manual key/title helpers, catalog filters/conversions, JSON parsing, where-am-I reply parsing/decisions and Claude's mocked network boundary. DOM/media/PDF algorithms require browser-specific checks and remain outside pure unit coverage.
