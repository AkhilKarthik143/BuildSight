# BuildSight

Hands-free build copilot. You show it picture-based instructions (a LEGO or IKEA PDF). An overhead camera watches the build, Claude compares each frame to the manual's picture for that step, and a voice guides you and catches mistakes.

Cal Hacks 13.0. Decisions and the reasons behind the UX live in [DECISIONS.md](DECISIONS.md). Photo credits are in [CREDITS.md](CREDITS.md).

## Demo flow

1. Open the hub and pick a LEGO set or IKEA product (or upload a PDF). The featured demo is LEGO 31136 Exotic Parrot, Book 1, which is pre-read and opens without a model call.
2. The build screen shows the current step's picture, the parts as holograms, and a **Check build** button.
3. The camera watches the table. In Auto Mode it checks when the scene changes and then holds still. A pass moves on; a mistake is boxed on the photo and spoken aloud.
4. Talk with the mic (mute toggle, or the M key), or type the same phrase in the text box. "Next", "back", and "go to step 8" are instant. Other questions go to Claude with the current frame.
5. Open Build options → Pair a phone camera. Join from the phone, then choose **Use phone camera** on the laptop. Check build and AR now use that camera; step/check updates return to the phone. The local transport sends preview frames, not full-rate video.

## Architecture

```
PDF (lego.com / ikea.com, or an upload)
  → browser renders a page (pdf.js)
  → POST /api/extract reads one page into step records (cached in IndexedDB)
  → overhead camera frame
  → POST /api/check compares the frame to this step's picture (and the previous one)
  → verdict (isPass: can see, confidence ≥ 0.7, complete, no issues)
  → voice: Azure speech-to-text, Claude /api/assist, Cartesia /api/tts
```

Phone-to-laptop pairing uses a transport interface. With no Azure connection string it is an in-memory room plus server-sent events on this process. The `WEBPUBSUB_CONNECTION_STRING` transport is a mocked Azure REST stub, not a deployable cross-instance pairing implementation. Leave it unset for local testing.

Manual PDFs are loaded through same-origin rewrites (`/manual-pdf/lego/…`, `/manual-pdf/ikea/…`) so the browser is not blocked by CORS. Those rewrites only forward to `www.lego.com` and `www.ikea.com`, and only for instruction-PDF paths.

## Setup

Use Node 22.18+ (or a newer LTS) and npm.

```bash
npm ci
cp .env.example .env.local   # fill in keys locally; never commit .env.local
npm run dev                  # http://localhost:3000
```

The camera and microphone need HTTPS on a phone. `localhost` is enough on the machine running the dev server. Deploy steps for the Azure container are in [DEPLOY-AZURE.md](DEPLOY-AZURE.md).

### Environment variables

Names only. Values stay in `.env.local` or the host's secret store. See `.env.example` for placeholders.

| Name | Role |
| --- | --- |
| `ANTHROPIC_API_KEY` | Preferred Claude key. Used when set. |
| `OPENROUTER_API_KEY` | Claude fallback when the Anthropic key is unset. |
| `ANTHROPIC_MODEL` | Optional override. Blank keeps the default in `src/lib/claude.ts`. |
| `OPENROUTER_MODEL` | Optional override for the OpenRouter path. |
| `AZURE_SPEECH_KEY` | Speech to text. The browser only receives a short-lived token. |
| `AZURE_SPEECH_REGION` | Azure Speech region, for example `westus2`. |
| `CARTESIA_API_KEY` | Text to speech. |
| `CARTESIA_VOICE_ID` | Optional voice override. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Turns on request metrics. Unset means metrics are a no-op. |
| `DAILY_CLAUDE_CALL_LIMIT` | Optional per-instance cap on Claude routes per UTC day. Unset or `0` means off. |
| `WEBPUBSUB_CONNECTION_STRING` | Selects the Azure Web PubSub pairing transport. Unset uses the local in-memory transport. |
| `BUILD_STANDALONE` | Set by the container build. Not needed for `npm run dev`. |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint (`eslint-config-next`). |
| `npm run typecheck` | `next typegen` then `tsc --noEmit`. Plain `tsc` fails on `LayoutProps` until typegen has run. |
| `npm test` | All offline suites, including the original six and the guard, Claude, library, pairing, summary, and eval suites. |
| `npm run test:commands` | Spoken command matcher. |
| `npm run test:boxes` | Mistake boxes, `isPass`, `checkVerdict`. |
| `npm run test:parts` | Part descriptions. |
| `npm run test:assist` | Streaming assist JSON. |
| `npm run test:auto` | Auto Mode timing. |
| `npm run test:practice` | Practice-mode measurements. |
| `npm run test:http` | HTTP boundary and local pairing smoke; requires a server on port 3102 with provider keys unset. |
| `npm run test:browser` | Playwright smoke at 390×844 with a simulated camera and mocked paid endpoints; requires that server and Chromium. |
| `npm run test:eval` | Offline check-verdict fixtures. No network. |
| `npm run test:pairing` | Pairing schema, in-memory transport, mocked Azure transport, QR matrix. |
| `npm run test:summary` | Session summary Markdown and the "I'm done building" command. |
| `npm run test:faults` | Camera, mic, offline, and rate-limit copy. |
| `npm run test:metrics` | Request counters stay off unless Application Insights is configured. |

`npm test` runs offline with `node --experimental-strip-types` and mocked provider calls. The separate HTTP/browser smoke scripts contact only a local server; browser tests block external requests. See [validation commands](docs/hardening-validation.md).

## Observability

When `APPLICATIONINSIGHTS_CONNECTION_STRING` is set, the Node server starts Azure Monitor OpenTelemetry (`src/instrumentation.ts`). Custom metrics:

- `buildsight.api.requests` — counter, attributes `route` and `status`
- `buildsight.api.latency_ms` — histogram, attribute `route`

Claude calls log one JSON line per request: `event`, `model`, `inputTokens`, `outputTokens`. Prompts, images, and keys are not logged.

Useful Application Insights queries (table and metric names only):

- `requests` where the name is `POST /api/check` (or assist, extract, locate, where-am-i, vision, tts)
- `dependencies` for outbound calls
- `customMetrics` where the name is `buildsight.api.requests` or `buildsight.api.latency_ms`
- `traces` where the message contains `claude.usage`

Rate limits and the daily Claude ceiling are per server instance, in memory. They reset on restart and are not shared across instances.

## Limitations

- The existing Azure identity/MSAL dependency has an unresolved high-severity advisory (GHSA-xcx6-jx8p-x3h5); no incompatible major-version override was forced.
- Real-camera accuracy is not covered by CI. It needs a phone over a build.
- Azure Web PubSub, Speech, and Application Insights are not provisioned by this repo. Without their keys the local fallbacks run: in-memory pairing, and speech/voice routes return a clear "not set up" error.
- The library (manuals, progress, extracted steps) lives in the browser's IndexedDB. Each device has its own copy.
- Search still calls LEGO and IKEA from the server. User-influenced URLs are limited to those hosts.
- Auto Mode and the mic toggle behave as recorded in DECISIONS.md. There are no Back/Next buttons. A step passes only when `isPass()` is true.

## License and credits

Hackathon project. Third-party photos on the display-only hub categories are listed in [CREDITS.md](CREDITS.md).

## Combined hardening validation

The post-event maintenance work is consolidated on `improve/full-project`. See [hardening validation](docs/hardening-validation.md) and [task checklist](BUILDSIGHT-TASKS.md). `main` and the upstream repository are unchanged.

## Marker AR overlay

1. Open `/ar/markers` and print the mat on A4 or US Letter at **100% / actual size**. Check its 50 mm scale bar with a ruler.
2. Keep the mat flat and the build fixed inside it. In the build screen turn on **AR overlay** (keyboard **G**). Show all four corners to acquire tracking; three visible markers can maintain it.
3. Choose **Pin target** and tap/drag the spot from the manual, then **Done positioning**. Keyboard users can place it at the mat center and nudge it. Targets belong only to the current step and never complete a step.
4. Check build normally. With tracking available, error boxes register to the exact checked image and follow the mat as the camera moves. Losing tracking restores the existing camera-motion fallback and shows a short hint.

This is a **2D, marker-anchored guide**. “Your placement” is user-positioned: manual-image coordinates are not physical stud coordinates. Cutouts are visual references, not scale-accurate 3D models. The plane cannot compensate for tall bricks or a build moved independently of the mat. The existing AR Practice lessons remain separate under Build options.

The detector is pinned `js-aruco2@2.0.0` (MIT-licensed aruco/cv modules, about 43 KB source, no transitive dependencies, native code, WASM or CDN). It runs on 320-pixel-wide frames in a worker, with bounded work and suspension in background tabs. Local synthetic benchmark: ~2.7 ms average / ~3.3 ms p95 per 320×400 frame; **not a phone performance result**. The development overlay reports observed detector FPS. Optional WebXR placement is deferred; capability detection is tested.

- `npm run test:ar`: deterministic geometry/state tests and actual detection on synthetic printed markers.
- `npm run bench:ar`: offline detector timing; fails if p95 exceeds 60 ms/frame on this machine.
- `npm run test:ar:browser`: real worker with synthetic camera at 390×844; requires local server at port 3102 and Playwright Chromium.
- `npm run test:pairing:browser`: two local clients, remote-frame checks and notifications; paid endpoints mocked.
- `npm run test:pwa`: cache policy (never API/pairing/private responses).

For browser scripts, run `npx playwright install chromium` once or set `CHROME_PATH` to a local Chrome executable. Unit tests/benchmark never use the network; HTTP/browser scripts only use localhost. **[AR-QA.md](AR-QA.md)** lists real-device, print, drift, lighting and accessibility checks still requiring a human.

Pairing rooms use cryptographically generated codes, expire after 30 idle minutes, and are capped at 200 per process. They are local development sessions, not account authentication. Azure PubSub is still a mock-tested stub. Session summaries separately count steps visited and steps verified complete. Offline caching includes initial app JS/CSS and the pre-read demo; further pages/chunks are saved as visited. No new environment variables are needed.
