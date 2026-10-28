# BuildSight

Hands-free assembly copilot built for Cal Hacks 13.0. Select a LEGO/IKEA manual or upload a picture-based PDF, point a camera at the workspace, and follow spoken instructions. Check build compares the camera with the manual and highlights visible mistakes. Auto Mode checks after the scene changes and settles. AR Practice offers simulated parrot and PC assembly lessons without physical parts.

The `improve/full-project` hardening work is post-event maintenance, separate from the hackathon submission. Design history is in [DECISIONS.md](../DECISIONS.md); implementation and validation notes are in [BUILDSIGHT-TASKS.md](../BUILDSIGHT-TASKS.md).

## Local setup

Use a current Node LTS with native TypeScript stripping (Node 22.18+), and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Set server credentials in `.env.local` for AI and voice, then restart. Never commit that file or share a key in browser code. The hub, included pre-read manuals, and practice lessons can open without keys. Camera and microphone require HTTPS on a phone; localhost works on a laptop. Library data and progress live in this browser's IndexedDB.

### Demo flow

1. Open the hub, select Exotic Parrot and a manual, or upload your own PDF.
2. Allow camera access. Follow the manual picture and instruction; tap step thumbnails to navigate.
3. Press **Check build** to compare the camera with the current step. A confident pass advances; mistakes show photo boxes and fixes.
4. Use the microphone for “next”, “go back”, “go to step 8”, “check”, or a question. “I'm stuck” creates smaller actions.
5. Optionally turn on **Auto** and select its speed. Say “stop” or press Cancel to cancel a pending advance.
6. Try `/practice/parrot` or `/practice/pc` for simulated placement exercises. Practice does not verify a real assembly.

## Configuration

The two core keys are listed in `.env.example`; the additional voice/telemetry settings below are read by the server code. None is needed for unit tests or production compilation.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Preferred Claude provider |
| `OPENROUTER_API_KEY` | Fallback when no Anthropic key is set |
| `ANTHROPIC_MODEL`, `OPENROUTER_MODEL` | Optional model overrides; defaults/tuning documented in DECISIONS |
| `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID` | Spoken audio and optional voice override |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Speech recognition token service |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Optional server telemetry |
| `OTEL_SERVICE_NAME` | Optional telemetry service name |
| `BUILD_STANDALONE` | Container build output, set by Dockerfile |

## Architecture

PDF/catalog → browser PDF rendering → `/api/extract` → cached step records → camera + expected/previous step pictures → `/api/check` → verdict, mistake boxes, spoken guidance.

- Next.js App Router hosts the hub, `/build/[id]`, practice pages, and nine API routes.
- IndexedDB stores library metadata, uploaded PDF bytes, page readings and progress. Included `public/steps` data skips live extraction.
- `/api/locate` identifies parts in manual drawings; browser cutouts create the part previews.
- `/api/where-am-i` compares camera imagery to contact sheets to identify progress. Auto Mode uses local motion sampling before requesting a check.
- `/api/assist` streams answers and structured actions. `src/lib/claude.ts` centralizes model transport. Cartesia produces audio; Azure provides short-lived STT tokens.
- Manual PDFs are proxied through fixed LEGO/IKEA origins. Search uses LEGO pages and IKEA's fixed discovery API, then approved product pages.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next route types, then TypeScript |
| `npm run test:http` | Local-server validation/rate-limit smoke (port 3102) |
| `npm run test:browser` | Mocked 390×844 browser regression smoke against a production server |
| `npm run test:eval` | Offline verdict/issue-box regression table from 18 stored fixtures |
| `npm test` | Offline tests (no real API keys or provider calls) |
| `npm run build` | Production build; Google Fonts may require network at build time |
| `npm start` | Serve the production build |
| `node scripts/build-catalog.mjs` | Refresh catalog/cache; uses network and changes generated data |
| `python scripts/preread.py manual.pdf --id 6455750` | Pre-read a manual; requires PyMuPDF, running server, API key; incurs model calls |
| `python scripts/hires.py --id 6455750 --pdf manual.pdf` | Render high-resolution manual crops; requires PyMuPDF |

CI runs install, lint, typecheck, tests, and build on pushes and pull requests, without service credentials. Deployment remains documented in [DEPLOY-AZURE.md](../DEPLOY-AZURE.md); the Azure deployment workflow is unchanged.

## Limits and operation

- Vision results and error-box positions are estimates. Real-camera accuracy, lighting, occlusion, and phone performance still need human validation. A model verdict is not a guarantee of safe assembly.
- Phone-to-laptop frame preview is preserved from the fork. It uses in-process rooms/SSE, does not feed Check build, and does not sync IndexedDB progress. The Azure transport remains a mocked stub.
- Several hub categories are display-only; see the existing decisions and credits.
- API controls are per-process safeguards, not authentication or a global spend cap. Before exposing paid services publicly, use a trusted ingress that overwrites client IP headers, provider budgets, and shared rate limiting/access control when running multiple instances.
- No service keys are used by tests. Offline recorded-output evals measure parsing/decision behavior, not visual accuracy.

[Credits and asset sources](../CREDITS.md).

### Integration checks

After building, start `npm start -- --port 3102` with provider credentials unset for HTTP checks. In another terminal run `npm run test:http` and `npm run test:browser`. Install Chromium once with `npx playwright install chromium`, or set `CHROME_PATH` to an installed Chrome executable. `E2E_BASE_URL` can override the local URL. Browser tests mock paid endpoints and use a simulated camera; no real credentials or physical assembly are required. The browser test is separate from `npm test` because it needs a running server and browser installation. Use production mode to avoid the Next development badge covering mobile controls.

Known dependency advisory: the existing Azure telemetry tree includes `@azure/msal-node@6.0.1`, reported by npm audit under GHSA-xcx6-jx8p-x3h5 (also attributed to `@azure/identity`). The fixed MSAL major is outside the installed identity package's supported range. This pass does not force a breaking override or change Azure deployment; update the telemetry dependency chain before treating this as a fully audited public release.

## Consolidation on improve/full-project

Preserved the fork's pairing preview, session summaries, typed commands, mic meter, PWA, accessibility work, metrics and optional daily request ceiling. BuildView now composes focused hooks and panels, including summary tracking; the obsolete duplicate controller/layout were removed. All 12 API handlers use the shared guard. Check/contact-sheet bodies allow 12 MiB, other image/pair-publish bodies 8 MiB, text/pair bodies 64 KiB, and GET declarations 1 KiB. Rate settings are centralized in `src/lib/rateLimit.ts`; active quotas are never evicted to admit new IPs.

Both offline suites are retained, and both fixture formats run through one production parser (33 cases). Original six suites, provider model/tuning settings, generated manual/catalog content and Azure deployment files remain unchanged. No runtime dependencies were added; Playwright is a dev dependency.

The original PR #1 was independently merged while consolidation was in progress. These follow-up changes target only the fork's `improve/full-project` branch. Local main, ar-akhil and the upstream repository remain untouched.

### Combined branch verification — 2026-10-28

- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` passed on the integrated tree. All 33 eval fixtures passed. Build and local server ran with provider/telemetry/pairing credentials explicitly unset.
- Production HTTP smoke passed for page/security headers, all nine POST validation paths, oversized bodies, blocked search URLs, 20/40 rate rejections with recovery, and local pairing create/join/SSE/publish.
- Playwright at 390×844 passed checks/error boxes, auto settings, collapse, pass advancement, keyboard/thumbnail navigation, stale result rejection, summary button/typed command, pairing dialog and practice route. Simulated camera and mocked paid APIs; no horizontal overflow. Screenshot: `/tmp/buildsight-hardening-mobile.png` (local artifact).
- Final BuildView: 50 lines. All 12 API routes share the bounded guard; the fork's 2,000-key process limit is retained with fail-closed active buckets. Both prior suites and all 33 fixtures are retained. No protected files or original six test scripts changed.
- PR #1 was independently merged into the fork before this push; this work remains on `improve/full-project` for a follow-up PR. Neither local main nor the original repository was modified by this task.
