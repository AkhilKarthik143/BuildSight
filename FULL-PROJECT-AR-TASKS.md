# Autonomous Task: Take BuildSight from hackathon demo to production-ready product

## Instructions
Continue working until all todos are complete.
Do not stop to ask questions.
Do not wait for confirmation at checkpoints.
Make reasonable assumptions and proceed. Log each assumption in Notes.
If a fix does not work, try a different approach.
Run validation after every meaningful change.
Update progress in this file as you go (tick boxes, add Notes).
Work on branch `improve/full-project`. Commit after each phase. Never push to `main`. Never commit secrets or `.env.local`.
Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (this is NOT the Next.js in your training data; see AGENTS.md).
Features that need paid credentials (Azure Web PubSub, real Claude/Cartesia calls) must be built behind an interface with a local in-memory fallback and tested with mocks. No test may touch the network.
Phases are ordered by dependency. If a phase is blocked, log it in Notes and continue to the next independent phase.

## Task Description
BuildSight is a hands-free build copilot (Cal Hacks 13.0): the user shows it picture-based instructions (LEGO/IKEA PDFs), an overhead camera watches the build, Claude compares frames to the manual's step picture, and voice (Azure STT, Cartesia TTS) guides the user and catches mistakes. Baseline: all 6 `npm test` suites pass, lint clean, typecheck clean after `next typegen`.

Goal: make the whole project safe to run publicly, maintainable, measurable, and more complete. Seven workstreams:
1. CI + docs
2. API hardening (all 9 routes are unauthenticated and spend money)
3. Behavior-preserving split of the 1788-line `BuildView.tsx`
4. Test + offline eval coverage
5. Product features (phone-to-laptop pairing, session summary, typed fallback, mic meter, PWA, a11y)
6. Observability and cost controls
7. Web AR overlay: anchor holograms, "where it goes" markers and mistake boxes to the physical build surface so they stay locked when the phone moves (browser-only; no Unity/ARKit/ARCore, because the stack is Next.js and iOS Safari has no WebXR)

## Context
- Relevant files: `src/app/api/*/route.ts` (extract, tts, search, speech-token, locate, assist, vision, where-am-i, check), `src/lib/*.ts` (claude.ts, issueBox.ts, autoCheck.ts, commands.ts, assistReply.ts, whereAmI.ts, manuals.ts, catalog.ts, json.ts, parts.ts, speech.ts, listen.ts), `src/components/BuildView.tsx`, `src/components/VoicePanel.tsx`, `src/components/Hub.tsx`, `src/components/practice/*`, `scripts/test-*.mjs`, `package.json`, `next.config.ts`, `.github/workflows/azure-image.yml`, `README.md`, `DECISIONS.md`, `.env.example`, `src/instrumentation*.ts`.
- Dependencies: Node + npm. `npm ci` works. Prefer zero new runtime deps; log any added dep and why in Notes.
- Test pattern: `node --experimental-strip-types --no-warnings scripts/test-*.mjs`. New testable modules must be strip-types compatible (relative imports, no enums/namespaces, mirror the convention in existing `src/lib` files).
- Typecheck: `npx next typegen && npx tsc --noEmit` (plain `tsc` fails on `LayoutProps`).
- Do NOT touch: `public/steps/**`, `src/data/catalog.json`, `scripts/catalog-cache.json`, `scripts/preread.py`, `scripts/hires.py`, model name / effort / max_tokens settings in `src/lib/claude.ts` (documented in DECISIONS.md), `DEPLOY-AZURE.md` command values, `CREDITS.md` content (append only).
- Preserve documented UX decisions in DECISIONS.md (mic is a mute toggle, no Back/Next buttons, auto mode, `isPass()` rule: can_see + confidence >= 0.7 + complete + no issues). Any change to these must be logged in Notes and DECISIONS.md.
- Out of scope: real-camera accuracy testing (needs hardware), Azure resource provisioning, new manuals/catalog scraping, native apps (Unity, ARKit, ARCore), markerless SLAM, LDraw 3D replay of whole sets.
- AR background: DECISIONS.md lists "hologram locked onto the real bricks" as Level 3 / roadmap. Phase 7 revises that to marker-anchored tracking, which is feasible in a browser. Existing mistake boxes only line up while the phone stays where it was for the check; Phase 7 removes that limitation.

## Todo Checklist

### Investigation
- [x] `git checkout -b improve/full-project`; run `npm ci`, `npm test`, `npm run lint`, `npx next typegen && npx tsc --noEmit`, `npm run build`; record baseline in Notes (use dummy `.env.local` if build needs env; never commit)
- [x] Table in Notes for every API route: what it spends (Claude/Cartesia/Azure/outbound fetch), body size limit, input validation, SSRF risk (check `search` and the `/manual-pdf/*` rewrites in `next.config.ts`)
- [x] Read `BuildView.tsx`; list responsibilities with line ranges (camera/motion, check flow, auto mode, voice wiring, step nav, overlays, persistence) and write the split plan in Notes before editing
- [x] List `src/lib` modules with no test coverage; mark pure ones
- [x] Read DECISIONS.md "Open questions" and "Not built yet" items; confirm Web PubSub pairing is the only unbuilt core feature

### Implementation
**Phase 1: CI + docs**
- [x] Add `typecheck` script (`next typegen && tsc --noEmit`) to `package.json`
- [x] Add `.github/workflows/ci.yml` (push + PR): Node LTS, `npm ci`, lint, typecheck, test, build, npm cache; leave `azure-image.yml` untouched
- [x] Replace stub `README.md`: purpose, demo flow, architecture/data flow (PDF -> extract -> step records -> camera check -> voice), env vars from `.env.example` (names only), scripts table, deploy pointer, limitations, credits pointer

**Phase 2: API hardening**
- [x] `src/lib/rateLimit.ts`: in-memory token bucket keyed by IP (first `x-forwarded-for` hop) + route; per-route limits (cheap: speech-token, search; expensive: check, assist, extract, locate, where-am-i, vision, tts); bounded memory with stale-key eviction; documented as per-instance
- [x] `src/lib/apiGuard.ts` wrapper for all routes: rate limit -> 429 + `Retry-After`; per-route max body (frames ~8 MB, text ~64 KB) -> 413; bad JSON -> 400; never echo upstream errors or keys
- [x] Apply guard to all 9 routes with identical success response shapes
- [x] Validate and clamp inputs (types, string lengths, frame counts, image mime/prefix) in check, assist, locate, where-am-i, tts, extract, vision
- [x] `search` and PDF rewrites: allowlist lego.com / ikea.com hosts only; reject everything else
- [x] Security headers in `next.config.ts` (`X-Content-Type-Options`, `Referrer-Policy`); `Permissions-Policy` must still allow camera and microphone for self
- [x] Optional daily spend ceiling: env `DAILY_CLAUDE_CALL_LIMIT` (default off) that makes expensive routes return 429 once exceeded; documented in `.env.example` and README

**Phase 3: Split `BuildView.tsx` (zero behavior change)**
- [x] Extract in small commits, tests after each: camera + motion-stillness, check-build flow + result state, auto-mode controller, voice/command wiring, step navigation + persistence, overlays/panels into `src/components/build/`
- [x] Target `BuildView.tsx` under ~600 lines, no logic changes, no changed props on existing components, no new `any`
- [x] Pure logic that moves to `src/lib` gets a test

**Phase 4: Tests + offline eval**
- [x] `scripts/test-api-guard.mjs`: limiter (burst, refill, per-IP isolation, eviction), body size, JSON errors, host allowlist
- [x] `scripts/test-claude.mjs`: mocked fetch; SDK vs OpenRouter selection by env, no `temperature` sent, errors never leak keys
- [x] Tests for pure functions in `manuals.ts`, `catalog.ts`, `json.ts`, `whereAmI.ts`
- [x] `scripts/eval-check.mjs`: 12+ recorded-output fixtures in `scripts/fixtures/check/*.json` (pass, issues, `can_see:false`, low confidence, malformed JSON, refusal text) through `isPass()` / `checkVerdict()` / issue-box location; print confusion table; exit non-zero on mismatch; add `test:eval`
- [x] Add every new suite to `npm test`

**Phase 5: Product features**
- [ ] **Pairing (phone camera <-> laptop screen):** define `src/lib/pairing/transport.ts` interface (`createRoom`, `join(code)`, `publish`, `subscribe`); implement a local in-memory/SSE transport that works with `npm run dev` and a stubbed Azure Web PubSub transport selected by env (`WEBPUBSUB_CONNECTION_STRING`); 6-char room codes, QR display on the laptop, join page on the phone; messages: frame, step change, check result, voice transcript. Unit-test the transport and message schema with the in-memory implementation
- [ ] **Session summary:** at end of a build (or via "I'm done" voice command in `commands.ts` with tests), generate a summary (steps completed, mistakes caught and where, time per step) from local state, shown in a panel and exportable as Markdown; pure formatter in `src/lib` with tests
- [ ] **Typed input fallback** in `VoicePanel.tsx` for loud rooms: text box that sends through the same path as a transcribed phrase (including `commands.ts` matching)
- [ ] **Mic level meter** in the voice pill using Web Audio `AnalyserNode`; must not break the mute-toggle and echo-avoidance behavior
- [ ] **Offline-friendly PWA:** `manifest` + icons + minimal service worker caching the app shell and pre-read demo manual (`public/steps/**`); must not cache `/api/*`; add-to-home-screen works
- [ ] **Accessibility pass:** labels and focus states on all controls, `aria-live` for check results and voice status, keyboard reachability of Check/mic/auto settings, `prefers-reduced-motion` disables scan/hologram animation; fix issues eslint-config-next flags
- [ ] **Error states:** friendly UI + voice line for camera denied, mic denied, network offline, 429 from the API; each has a unit test where logic is pure

**Phase 6: Observability and cost**
- [x] Per-route request counters and latency in `src/instrumentation.node.ts` custom metrics (only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set; no-op otherwise)
- [x] Log model name + token usage per Claude call (no prompts, no images, no keys) through one helper in `claude.ts` without changing its model/effort settings
- [x] Document dashboards/queries in README (names only, no secrets)

**Phase 7: Web AR overlay (marker-anchored, browser only)**
- [ ] Investigation first: read `CameraFeed.tsx`, `HighlightBox.tsx`, `CheckErrorOverlay.tsx`, `src/lib/issueBox.ts`, `src/components/practice/Scene.tsx` (existing three.js/AR-practice code) and write in Notes how boxes (normalized 0-1 coordinates) and the "where it goes" marker are drawn today and what breaks when the phone moves
- [ ] Decide and log in Notes + DECISIONS.md: anchor = a printed marker sheet (4 fiducial markers at the corners of the build mat, AprilTag/ArUco family) giving a homography from mat coordinates to camera pixels. Prefer a small pure-JS detector with no native/WASM build step; if you add a dependency log name, size and license. Markerless SLAM is out of scope
- [ ] `src/lib/ar/homography.ts`: solve a 4-point homography, project points and boxes both ways (mat <-> camera), invert, plus a low-pass pose smoother to cut jitter; pure functions, strip-types compatible
- [ ] `src/lib/ar/tracker.ts`: interface `Tracker { update(frame): PoseResult }` with states `tracking | lost | searching`, a 3-of-4-marker partial fix, and hysteresis (N lost frames before dropping); detector adapter behind the interface so tests can inject synthetic marker corners
- [ ] Run detection on a downscaled frame (~320 px wide) in a Web Worker so the UI thread never blocks; target >= 15 detections/s on a mid-range phone; expose measured fps in a dev-only overlay
- [ ] Printable marker sheet at route `/ar/markers`: print-ready page at true scale (letter + A4 CSS `@page`), 4 corner markers with IDs, a scale bar so the user can verify 1:1 printing, and one line of setup instructions
- [ ] `src/components/build/ArOverlay.tsx`: a canvas/three layer above the live camera that draws, through the current homography, (a) the step's "where it goes" marker, (b) the existing mistake boxes, (c) the part hologram cut-out next to the target location. Boxes stored in mat coordinates at check time and re-projected every frame, so they stay on the right bricks when the phone moves
- [ ] Graceful fallback: when tracking is `lost` or `searching`, fall back to today's behavior (boxes drawn as before, with the existing "view changed" handling) and show a short hint ("Show the mat corners"); AR must never block Check build, voice, auto mode or step navigation
- [ ] Settings toggle "AR overlay" (default off, remembered per device in localStorage with try/catch); add to the keyboard shortcuts and `aria-live` status; respect `prefers-reduced-motion`
- [ ] Optional progressive enhancement: where `navigator.xr?.isSessionSupported('immersive-ar')` is true (Android Chrome), offer a WebXR hit-test mode to place the hologram on a detected surface; feature-detect in a pure helper with tests; no-op on iOS Safari and desktop. Skip if it destabilizes the marker path, log the reason
- [ ] Keep 3D light: reuse existing cut-out holograms and 2D manual crops; no new 3D model assets; if any texture or model is added keep it under 200 KB each
- [ ] `AR-QA.md` at repo root: human test checklist the agent cannot run (print at 100%, lighting, distance, tilt, marker occlusion by hands, drift over 5 minutes, iPhone Safari vs Android Chrome); the agent writes it, a human runs it

### Validation
- [ ] Run `npm run lint` and fix any issues
- [ ] Run `npm run typecheck` and ensure zero errors
- [ ] Run `npm test` and ensure all suites pass (6 original + new)
- [ ] Run `npm run build` and ensure it succeeds
- [ ] Start `npm run dev` in background; `curl -s -o /dev/null -w "%{http_code}"` on `/`, `/practice/parrot`, `/practice/pc` (expect 200); hit one API route 40x fast and confirm 429, then a valid small request succeeds after the window; open two pairing clients against the local transport and confirm a message round-trips; kill the dev server
- [ ] `grep -rn "api.anthropic.com\|openrouter.ai\|cartesia\|webpubsub" scripts/test-*.mjs scripts/eval-check.mjs` shows only mocked references
- [ ] `git diff main --stat` shows no do-not-touch path changed
- [ ] Verify no regression in: `npm run test:commands`, `test:assist`, `test:auto`, `test:practice`, `test:boxes`, `test:parts`
- [ ] Run `node --experimental-strip-types --no-warnings scripts/test-ar.mjs` and ensure all pass: homography round-trip error < 1e-6 on random quads, box projection matches known cases, smoother reduces jitter on a synthetic noisy track, tracker state machine (tracking -> lost -> searching with hysteresis, 3-of-4 partial fix), XR feature detection; add `test:ar` to `package.json` and to `npm test`
- [ ] Run `node --experimental-strip-types --no-warnings scripts/bench-ar.mjs` (synthetic frames through the detector adapter) and record ms/frame in Notes; fail if the downscaled detection exceeds 60 ms/frame on this machine
- [ ] With dev server running, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ar/markers` returns 200, and the HTML contains 4 marker elements and the `@page` print rule

### Cleanup
- [ ] Remove debug code and scratch files; no new `console.log` in `src/`
- [ ] Append a "Full-project pass" section to `DECISIONS.md` (decision, why, date) for each workstream
- [ ] Update `.env.example` with every new env var (names, placeholder values only)
- [ ] Final validation: `npm run lint && npm run typecheck && npm test && npm run build`

## Definition of Done
- `.github/workflows/ci.yml` exists; lint, typecheck, test, build pass locally with the same commands
- All 9 files in `src/app/api/*/route.ts` use the guard: over-limit 429 + `Retry-After`, oversized body 413, bad JSON 400; `search` and PDF rewrites reject hosts other than lego.com / ikea.com
- `src/components/BuildView.tsx` under ~600 lines; extracted modules in `src/components/build/` and `src/lib`; all 6 original suites pass unmodified apart from import-path fixes
- New suites (`test-api-guard`, `test-claude`, pure-lib tests, pairing transport, session summary, `eval-check`) are in `npm test` and pass offline
- Pairing works end to end on the local transport (two clients, room code, messages round-trip); Azure Web PubSub transport exists behind env and is unit-tested with a mock
- Session summary, typed input fallback, mic meter, PWA manifest + service worker, a11y fixes, and the four error states are implemented
- AR overlay: `src/lib/ar/{homography,tracker}.ts` and `src/components/build/ArOverlay.tsx` exist; `/ar/markers` prints a 4-marker sheet; with the toggle on and tracking active, mistake boxes and the target marker are drawn through the homography; with tracking lost or the toggle off, behavior is identical to before; `test:ar` is part of `npm test` and passes; `AR-QA.md` lists the human field tests
- README documents setup, env vars, architecture, scripts, AR setup (print sheet, place on mat), limitations
- All work committed on `improve/full-project`; nothing pushed to `main`; `git diff main --stat` shows only intended paths

## Notes

### Investigation — 2026-10-30
- Reused the requested existing `improve/full-project` branch and fast-forwarded it to the fork's merged main (`ed5f57f`). Local main and upstream remain untouched. Baseline clean install, all offline suites, lint, generated typecheck, and production build pass. Credentials explicitly unset for build; no .env edits.
- Phases 1–4 and 6 already exist from PRs #1/#2, verified by code and baseline tests. Phase 5 has pairing/SSE preview, summaries, typed fallback, mic meter, PWA, focus/reduced-motion and failure copy. Remaining product gaps: remote preview does not yet feed Check build; summary records visited steps, not verified completions. Historical “pairing is the only unbuilt feature” is false: accurate physical registration is also absent, and Azure remains a mock-tested stub. Real-camera accuracy and Azure provisioning remain out of scope.
- BuildView responsibilities now live in `build/`: entry composition lines 1–50, state 1–115, navigation/persistence 1–323, check/countdown 1–118, auto controller 1–135, recognition 1–64, voice 1–121, overlays 1–87, card 1–347, summary 1–40. No repeat split needed. Plan: add independent AR math/tracker/worker, hook and overlay; capture registration with each checked frame. Preserve navigation/check/pass rules and existing public component props.
- Coverage audit: pure command/box/parts/assist/auto/catalog/manual/JSON/recognition/limiter/rate/guard/provider/summary/fault/metrics/pair-schema/transport/QR helpers are covered. Browser-only PDF, cutout, encoder, speech/listen and prebuilt loading lack isolated tests and are exercised only partly in browser smoke. New pure AR code will have deterministic tests; worker will be tested with rendered marker images.
- Current graphics: HighlightBox uses percentages of the *manual crop*, not the live camera; those coordinates cannot be copied onto the physical assembly. LiveIssueBoxes maps normalized checked-photo boxes with object-cover and hides them after camera motion. Practice Scene uses synthetic millimetre models, gyro/orbit and snap targets; it is not physical registration.
- AR assumption: one printed planar mat, original orientation, four ArUco MIP 36h12 markers. This tracks the mat plane, not tall bricks or a build moved independently of the mat. No automatic stud-exact placement is claimed. A builder pins a target on the mat for the current step; it is labeled “Your placement” and never marks a step done. Manual localization stays in the manual. A check uses marker detection on its exact captured image, not the later response camera view.
- Detector choice: js-aruco2@2.0.0, MIT headers for the used aruco/cv modules, 42,862 bytes source total; no transitive runtime deps, native code, WASM, CDN or keys. Package includes additional third-party license notices; unused POSIT/SVD modules are not imported. Use the same dictionary to print and detect. Source: https://github.com/damianofalcioni/js-aruco2 .
- Design extension: existing Geist, ink #04070d, cyan #5cc8ff, red issues, 4px spacing, 12px controls and 16px panels. Dials: variance 2, motion 2, density 6, assets 3, fidelity 10. Phone viewing distance, quiet operational status. Keep camera/check/voice primary; group secondary actions to avoid header overflow. One AR toggle, short tracking hint, print link and one target-pin action. No calibration “1/2” taps. 150ms feedback only, no decorative loops; reduced motion preserved. User explicitly waives skill confirmation checkpoints.

| API | Spend / external access | Boundary cap | Validation / SSRF |
| --- | --- | --- | --- |
| check | Claude | 12 MiB | inline images + bounded instruction/parts; no URL fetch |
| assist | Claude stream | 8 MiB | question/history/step/image; no URL fetch |
| extract | Claude | 8 MiB | image up to 6M chars; no URL fetch |
| locate | Claude | 8 MiB | image + part/parts; no URL fetch |
| where-am-i | Claude | 12 MiB | image + up to 8 sheets/20 tile IDs; no URL fetch |
| vision | Claude | 8 MiB | image + question; no URL fetch |
| tts | Cartesia | 64 KiB | bounded nonempty text |
| speech-token | Azure | 1 KiB GET declaration | fixed Azure endpoint from server config |
| search | LEGO/IKEA | 1 KiB GET declaration | fixed discovery + exact HTTPS hosts/redirect checks/time and byte bounds |
| pair | none (local) | 64 KiB | create/join action + room code |
| pair/events | none (local SSE) | 1 KiB | room code |
| pair/publish | optional Azure stub | 8 MiB | room + message schema; endpoint server-only |

PDF rewrites use fixed www.lego.com/www.ikea.com origins and the proxy rejects non-PDF/traversal paths. Per-process rate budgets and optional daily ceiling are mitigations, not user authentication. Public production needs trusted ingress/access controls; not a new auth product in this scope.


Baseline (spec author, 2026-10-27): `npm ci` ok (621 pkgs); `npm test` all passed; `npm run lint` clean; `tsc --noEmit` fails only on `LayoutProps` until `next typegen`, then clean; `npm run build` not yet verified.