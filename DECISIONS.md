# BuildSight — Decisions Log

Running record of every product and technical decision, newest at the bottom of each section.
Feeds the README, the Devpost write-up, and the demo script. Add a line whenever something changes.

Format: **Decision** — why. *(date, PT)*

---

## Product

- **Build a hands-free build copilot, not a repair copilot.** You show it any picture-based instructions; it watches you build through the camera, tells you what's next, and catches mistakes. — Building moves forward naturally (no faked faults), the instructions-as-input design makes it general, and a caught mistake is a stronger demo moment than naming a part. *(Sat Oct 24, ~1 AM)*
- **Dropped earlier ideas:** FixSight bike repair (story didn't match the factory pitch; purchase step felt forced) and desktop-PC repair (practical but uninspiring). *(Sat Oct 24, ~1 AM)*
- **Target user: frontline workers following work instructions with their hands busy** (assembly lines, kitting, field installs, new hires). LEGO and IKEA are stand-ins judges can watch. *(Sat Oct 24, ~1 AM)*
- **Working name: BuildSight.** Easy to change. *(Sat Oct 24, ~1 AM)*

## Demo

- **Main prop: a small LEGO set (100–250 pieces), bright colors, mostly larger bricks. No Technic** (grey pins and beams look alike on camera). *(Sat Oct 24, ~1 AM)*
- **Second prop: a small IKEA piece** (4–8 steps) to prove it isn't LEGO-specific. *(Sat Oct 24, ~1:30 AM)*
- **Demo beats:** guide the next step → catch a deliberate mistake (side-by-side with the manual picture) → switch to the IKEA build by voice. *(Sat Oct 24, ~1 AM)*
- **Camera is fixed overhead on a stand over a plain white mat,** not chest-mounted. — A fixed view makes every frame comparable to the manual picture. *(Sat Oct 24, ~1 AM)*
- **Voice plays through a table speaker** so judges hear it; a live transcript is shown on screen. *(Sat Oct 24, ~1 AM)*

## Platform

- **Website, not an app-store app.** One Next.js codebase runs in the phone's browser and on a laptop; it can be added to the phone's home screen. — No separate builds or store approval, and the demo looks the same. *(Sat Oct 24, ~1:15 AM)*
- **Demo setup: phone as overhead camera, laptop as the big screen,** paired with a room code or QR. *(Sat Oct 24, ~1:15 AM)*
- **Stack:** Next.js 16 + React 19 + TypeScript + Tailwind on Vercel; three.js via react-three-fiber for 3D; Motion for animation. *(Sat Oct 24, ~1:30 AM)*
- **Phone ↔ laptop real-time link: Azure Web PubSub** (Vercel functions can't hold a live socket; also keeps Microsoft in the build). *Not built yet.* *(Sat Oct 24, ~1:15 AM)*
- **Speech to text: Azure AI Speech; voice out: Cartesia; telemetry: Azure Application Insights.** *Not built yet; keys pending.* *(Sat Oct 24, ~1:15 AM)*

## AI

- **Claude through OpenRouter** (team has an OpenRouter key). Models: `anthropic/claude-sonnet-5.5` for live checks and questions, `anthropic/claude-opus-5.5` for reading manuals once. Model is set by `OPENROUTER_MODEL`. *(Sat Oct 24, ~1:30 AM)*
- **Step checks compare the camera frame to the manual's own picture for that step** (plus the previous step's), instead of asking the model to work out the build from scratch. Output: `step_complete`, `confidence`, `issues[]`. Below 0.7 confidence it asks for a closer look. *(Sat Oct 24, ~1 AM)*
- **Manuals are turned into step records once** (parts, action, expected picture, things to watch for), and a person approves them. *(Sat Oct 24, ~1 AM)*
- **Simple commands (next, back, repeat) skip the model** for sub-second replies. *(Sat Oct 24, ~1 AM)*
- **Step check endpoint: `POST /api/check`** takes `frame`, `expected`, optional `previous`, `instruction`, `watchFor`; returns `step_complete`, `confidence`, `issues[]`, and a short `say` line. Temperature 0. *(Sat Oct 24, ~1:45 AM)*
- **Test manual: LEGO Creator 31163** (official PDF from lego.com, book 1, 100 pages, 1–2 steps per page with parts boxes). *(Sat Oct 24, ~1:40 AM)*
- **Stand-in test result: 10/10** (5 step pairs × finished / not yet), ~3 s per check, using manual pictures as fake camera frames. Without a test-mode note, Claude refused to call a drawing "finished" and asked for a real photo, which is the behavior we want live. **Real-photo test still needed.** *(Sat Oct 24, ~1:50 AM)*
- **Checks fire when the scene goes still** (hands out of frame ~1.5 s), detected in the browser, rather than sending every frame. *(Sat Oct 24, ~1 AM)*

## Hologram / interactive UI

- **Level 1 (building now): floating glass instruction card + a glowing blue 3D model of the next piece, and a pulsing marker roughly where it goes.** *(Sat Oct 24, ~1:15 AM)*
- **Level 2 (maybe): 3D replay of the step** using a community LDraw model of the set, if one exists for the chosen set. *(Sat Oct 24, ~1:15 AM)*
- **Level 3 (out): hologram locked onto the real bricks (true AR).** — Needs precise tracking, and iPhone Safari doesn't support WebXR AR. Roadmap only. *(Sat Oct 24, ~1:15 AM)*
- **First hologram pieces are generated in code** (bricks and plates from stud size and color) instead of loading LDraw files. — No parts library to bundle; covers most pieces in a Creator-style set. LDraw for slopes and special parts later. *(Sat Oct 24, ~1:30 AM)*
- **Marker position comes from the model as an approximate location,** not exact pixels. Fine because the camera is fixed overhead. *(Sat Oct 24, ~1:15 AM)*

## Prizes

- **Primary: Microsoft "Built for the Real World" / FDE.** Also Anthropic and Cartesia, which the build covers anyway. Visa only as an optional add-on. *(Sat Oct 24, ~1 AM)*
- **Open: whether Azure is required and Microsoft's exact criteria** — ask at the booth Saturday morning. *(Sat Oct 24)*

## Rules and references

- **All code is written during the event** (Cal Hacks rule). Reference repos are used for ideas only; no code copied. *(Sat Oct 24, ~1:30 AM)*
  - [FORGE](https://github.com/kaushikchaturvedula/FORGE) — ideas: grounding tool arguments against a known catalog; verbal confirmation for safety steps; auto-written work order.
  - [AR Technician Assistant](https://github.com/omer-izhaki/-ar-technician-assistant) — ideas: AI-placed highlight markers (box / point / arrow, with severity); captions for both sides; typed input fallback for loud rooms; mic level meter; end-of-session summary.
- **Secrets live in `.env.local`** (git-ignored) and in Vercel's environment settings. Never committed. *(Sat Oct 24, ~1:30 AM)*

## Open questions

- [ ] Microsoft booth: Azure required? "Path to production" meaning? Credits for Claude on Foundry?
- [ ] Which LEGO set and IKEA piece; do both instruction PDFs download?
- [ ] Step-check risk test result (goal: 13 of 15 judged right).
- [ ] Team size and roles.
