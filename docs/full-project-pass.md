# BuildSight full-project pass

Working notes for the production-readiness pass on `improve/full-project`. Newest notes at the bottom of each section. Assumptions are marked **Assumption**.

## Checklist

### Investigation
- [x] Branch `improve/full-project` from `main`. Baseline recorded below.
- [x] API route table
- [x] BuildView responsibilities and split plan
- [x] Untested `src/lib` modules
- [x] DECISIONS.md open questions: Web PubSub pairing is the only unbuilt core feature

### Phase 1: CI + docs
- [x] `typecheck` script
- [x] `.github/workflows/ci.yml`
- [x] README replaced

### Phase 2: API hardening
- [x] rate limit, guard, validation, host allowlist, security headers, daily ceiling

### Phase 3: Split BuildView.tsx
- [x] extract into `src/components/build/`, BuildView under ~600 lines

### Phase 4: Tests + offline eval
- [ ] api guard, claude, pure libs, eval-check, wired into `npm test`

### Phase 5: Product features
- [ ] pairing, session summary, typed fallback, mic meter, PWA, a11y, error states

### Phase 6: Observability and cost
- [ ] route metrics, Claude usage log, README queries

### Validation and cleanup
- [ ] lint, typecheck, test, build, dev curl, 429, pairing round-trip
- [ ] DECISIONS.md full-project section, `.env.example`, no do-not-touch diffs

## Notes

### Baseline (2026-10-27, this pass)

Commands run on a clean `main` checkout after `git checkout -b improve/full-project` and `npm ci` (621 packages, lockfile install succeeded).

- `npm test`: all six suites passed (`test:boxes` 66/66, `test:commands` 67/67, `test:parts`, `test:assist`, `test:auto` 51/51, `test:practice`).
- `npm run lint`: clean (exit 0, no output).
- `npx next typegen && npx tsc --noEmit`: clean after typegen (exit 0).
- `npm run build`: succeeded (Next.js 16.4.3). No `.env.local` was required. Build was not given a dummy env file.

### API routes

| Route | Spends | Body / size today | Validation today | SSRF |
| --- | --- | --- | --- | --- |
| `POST /api/check` | Claude (`askClaude`) | 3 images, each capped at 4,000,000 chars | `data:image/` prefix and length. No mime allowlist. `watchFor` and instruction not length-clamped. | No user URL. |
| `POST /api/assist` | Claude stream | frame under 4,000,000 chars | question required. Frame is any string under the cap, not checked as an image. History sliced to 8. | No user URL. |
| `POST /api/extract` | Claude, up to 2 calls | page under 6,000,000 chars | `data:image/` prefix. | No user URL. |
| `POST /api/locate` | Claude | image under 4,000,000 chars | `data:image/` prefix. `part` trimmed, max 120 chars. | No user URL. |
| `GET /api/search` | Outbound fetch: `www.lego.com`, `sik.search.blue.cdtapps.com` (hardcoded IKEA search), then each product `pipUrl` | Query string only. `q` length 2–80. | Set numbers are `^\d{4,7}(-\d)?$`. IKEA `pipUrl` must start with `https://www.ikea.com/`. PDF links matched from HTML. | User-influenced URLs are the query and URLs parsed out of IKEA HTML. Prefix check is bypassable by lookalike hosts if the parser disagrees. `cdtapps.com` is not user-controlled. |
| `GET /api/speech-token` | Azure Speech token endpoint | None | Key and region from env only. Region is interpolated into the host. | Not user input. A poisoned env region could change the host. |
| `POST /api/tts` | Cartesia bytes API | Text sliced to 1,500 chars | Empty text → 400. Bad JSON becomes `{}` then "Nothing to say." | URL is hardcoded. |
| `POST /api/vision` | Claude | image over 4,000,000 chars → 413 | `data:image/` prefix. Question not clamped. | No user URL. |
| `POST /api/where-am-i` | Claude (medium effort) | frame + up to 8 sheets, each image 4,000,000 chars | `data:image/` prefix. Sheet count capped. | No user URL. |

`/manual-pdf/*` rewrites in `next.config.ts`:

- `/manual-pdf/lego/:file` → `https://www.lego.com/cdn/product-assets/product.bi.core.pdf/:file` (host fixed, `:file` is not restricted to a numeric PDF name).
- `/manual-pdf/ikea/:path*` → `https://www.ikea.com/:path*` (host fixed, path is any path on that host, so the app is an open proxy for `www.ikea.com`).

Neither rewrite can be pointed at a different host by the request path. The gap is path shape, plus search fetching whatever IKEA HTML links.

Error responses today sometimes include upstream text (`OpenRouter error …` plus the first 200 chars of the body, Anthropic `e.message`, and `raw` model text on check/extract/where-am-i).

### BuildView.tsx (1788 lines) — responsibilities

| Concern | Lines (approx) |
| --- | --- |
| Auto mode store, toggle, speed popover | 57–218 |
| Step thumbs, crop, grid, labels, phone hook, page reader | 220–415 |
| Component state, camera ref, manual load, page read, crop, locate, holograms | 417–670 |
| Step navigation, persistence (`saveManual`), go-to-step search | 677–705, 791–968 |
| Check flow, verdict, advance countdown | 707–789 |
| Voice command wiring and assistant actions | 1130–1196 |
| Keyboard shortcuts | 1198–1213 |
| Where-am-I and the auto/stillness loop (camera samples) | 970–1121 |
| Overlays and panels (header, reticle, manual, zoom, voice, notice, holograms, step card) | 1218–1787 |

### Split plan (no behavior change)

Move code in small commits, then run `npm test`, `npm run lint`, and `npm run typecheck`.

1. `src/components/build/autoStore.ts` + `AutoControls.tsx` — storage hooks and the Auto switch / speed popover.
2. `src/lib/stepText.ts` — `stepLabel` / `spokenStep` (pure, tested). `src/components/build/pageWork.ts` — crop, grid, thumbs, limiter, page reader (browser).
3. `src/components/build/useCheckFlow.ts` — `runCheck` and the advance timer.
4. `src/components/build/useAutoWatch.ts` — stillness loop and Auto Mode tick.
5. `src/components/build/useVoiceWiring.ts` — `onCommand`, `onAction`, keyboard.
6. `src/components/build/useStepNav.ts` — next/back, go-to-step, strip jumps, IndexedDB page save stays where it is called today.
7. `src/components/build/StepCard.tsx` and `BuildChrome.tsx` — the step card and the overlays.

Target: `BuildView.tsx` under ~600 lines. No prop changes on `CameraFeed`, `VoicePanel`, `ManualPanel`, `ZoomViewer`, `PieceHologram`, or `CheckErrorOverlay`. No new `any`. Pure functions that land in `src/lib` get a test.

### `src/lib` coverage

| Module | Test today | Pure? |
| --- | --- | --- |
| `issueBox.ts` | `test:boxes` | yes |
| `commands.ts` | `test:commands` | yes |
| `parts.ts` | `test:parts` | yes |
| `assistReply.ts` | `test:assist` | yes |
| `autoCheck.ts` | `test:auto` | yes |
| `json.ts` | none | yes — `firstJsonObject` |
| `catalog.ts` | none | `matches`, `metaLine`, `toResult`, `categoriesOf` are pure; the module also imports `catalog.json` via `@/`, so tests need a relative-import module |
| `whereAmI.ts` | none | `decide` is pure; the rest needs the DOM and `/api/where-am-i` |
| `manuals.ts` | none | IndexedDB. The only pure bit is the upload title string inside `addUpload`. |
| `claude.ts` | none | network |
| `speech.ts`, `listen.ts`, `pdf.ts`, `cutout.ts`, `encode.ts`, `prebuilt.ts` | none | browser or fetch, not pure |

### DECISIONS.md open items

Open questions are the Microsoft booth, which physical sets, the 13-of-15 step-check risk test, and team size. Those are event questions, not code.

"Not built yet" on the platform decision is **Azure Web PubSub** for the phone-to-laptop link. Speech-to-text, Cartesia, the check/assist/extract loop, Auto Mode, and practice mode are built. Pairing is the only unbuilt core feature.

### Assumptions

- **Assumption:** CI uses Node 22. It is the maintenance LTS that matches `@types/node` ^20 and Next 16.4.3. `lts/*` in October 2026 may resolve to Node 24; 22 is the safer pin.
- **Assumption:** "I'm done." stays a check command. `scripts/test-commands.mjs` and DECISIONS.md both say so. The session summary command is a longer phrase ("I'm done building", "end the build", "session summary") plus the end-of-manual screen. Logged again in DECISIONS.md when that command lands.
- **Assumption:** IKEA's hardcoded search host `sik.search.blue.cdtapps.com` stays. It is not taken from the user. Every user-influenced fetch and both PDF rewrites allow only `lego.com` and `ikea.com` hosts.
- **Assumption:** Rate limits and `DAILY_CLAUDE_CALL_LIMIT` are per Node process, not shared across instances. The ceiling counts a well-formed request to a Claude route. Unset or `0` means off.
- **Assumption:** No new runtime dependencies. QR codes, the service worker, and the pairing transport are in-repo.
- **Assumption:** Claude token usage is one `console.info` JSON line from a single helper. No new `console.log`. The existing Auto Mode `[auto] change` `console.log` stays; DECISIONS.md documents it for venue tuning.
- **Assumption:** The Azure pairing transport is a REST client behind `WEBPUBSUB_CONNECTION_STRING`, unit-tested with an injected `fetch`. `npm run dev` uses the in-memory transport and SSE. No real Azure call in tests or in the default dev setup.
- **Assumption:** SVG and other non-JPEG/PNG/GIF/WebP data URLs are rejected. The old check only required a `data:image/` prefix.
- **Assumption:** Error responses no longer include upstream body text or the `raw` model reply. Success JSON shapes stay the same.
- **Assumption:** README's script table names suites added in later phases. They are part of the same branch before the pass is done.
- **Assumption:** Relative imports inside the new server modules use a `.ts` extension so `node --experimental-strip-types` can load them. `allowImportingTsExtensions` is on because `noEmit` is already set. Next still resolves `@/` imports in the routes.
- **Assumption:** A present but invalid `frame` on `/api/assist` is a 400. Omitting the frame still sends the question without a photo.
- **Assumption:** Azure Speech region must match `^[a-z0-9]+$` before it is placed in a hostname. A bad value returns the existing "not set up" 503.

### Phase 1

- `npm run typecheck` is `next typegen && tsc --noEmit`.
- CI runs on push and pull_request: `npm ci`, lint, typecheck, test, build, npm cache. `azure-image.yml` was not edited.
- README covers purpose, demo flow, data flow, env names, scripts, deploy pointer, limitations, and credits.

### Phase 2

- `src/lib/rateLimit.ts`: token bucket on `globalThis`, key is first `x-forwarded-for` hop plus route. Cheap routes (`speech-token` capacity 20, `search` 12) refill faster than Claude routes (`check`/`assist`/`vision` 6 at 0.2/s, `where-am-i` 4 at 0.1/s, `extract` 8, `locate` 12, `tts` 12). Stale keys drop after 10 minutes. The map stays at or under 2,000 keys. Documented as per-instance.
- `src/lib/apiGuard.ts` wraps all 9 routes. Order: 429 + `Retry-After`, then 413 over the body cap (8 MB for frame routes, 64 KB for text/GET), then 400 for bad JSON, then the daily ceiling. The route's success `Response` is returned unchanged. Unexpected throws become `{ error: "Request failed." }` with no upstream text.
- Image fields accept only `data:image/(jpeg|png|gif|webp);base64,`. Strings are clamped (question 2,000, instruction 500, part name still 120, where-am-i sheets 8 with at most 40 integer tile numbers).
- `src/lib/hosts.ts` plus `src/proxy.ts`: PDF paths must be `/manual-pdf/lego/<digits>.pdf` or an IKEA `assembly_instructions` PDF. Search fetches check the URL host before `fetch`. The hardcoded IKEA search API is allowed only for that fixed URL.
- Security headers on `/:path*`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(self)`.
- `DAILY_CLAUDE_CALL_LIMIT` (default off) counts well-formed requests to the six Claude routes per UTC day in this process. Over the cap: 429 + `Retry-After` until the next UTC midnight, and the handler is not called.
- Claude errors no longer include `e.message` or the OpenRouter response body. Check, extract, and where-am-i no longer return a `raw` model snippet.
- `scripts/test-api-guard.mjs` is `npm run test:guard` and part of `npm test`. It covers burst, refill, per-IP isolation, eviction, 413, 400, the ceiling, and the host allowlist. No network.

### Phase 3

- `BuildView.tsx` is 355 lines. It still owns manual load, page read, crop, locate, and holograms. Check flow, auto/stillness, voice commands, step jumps, and the JSX live in `src/components/build/useBuildControls.ts` and `BuildLayout.tsx`. Auto storage and the speed popover are `autoStore.ts` / `AutoControls.tsx`. Page reading helpers are `pageWork.ts`. `stepLabel` / `spokenStep` are `src/lib/stepText.ts`, covered by `npm run test:steps`.
- **Assumption:** The six-hook plan in the split table collapsed into one controls hook plus a layout component. The closures share the same refs (`search`, `direction`, `watch`, and the rest). Splitting them further would pass those refs across hooks, which `react-hooks/immutability` rejects unless the local name ends in `Ref`. One hook keeps the original call order and the original dependency sets, plus the stable setters and refs the linter now requires. Adding those stable values does not change when the callbacks are recreated.
- Props of `CameraFeed`, `VoicePanel`, `ManualPanel`, `ZoomViewer`, `PieceHologram`, and `CheckErrorOverlay` are unchanged. No new `any`. The existing Auto Mode `console.log` stayed.
- `MAX_PARTS` (6) is one shared constant in `src/components/build/types.ts`, used by both the hologram effect and the step-card chips.
