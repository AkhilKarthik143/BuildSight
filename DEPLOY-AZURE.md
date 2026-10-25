# Deploying BuildSight on Azure

BuildSight runs on **Azure Container Apps** (the app) and **Azure AI Speech** (speech to text). Vercel is a second copy.

## How it's built
- `Dockerfile`: three stages (deps → `next build` with `BUILD_STANDALONE=1` → a slim `node server.js` image).
  Standalone output is switched on only by that variable (`next.config.ts`), so the Vercel build is unchanged.
- The image is built in the cloud with `az acr build`; no local Docker needed.
- **No keys in the image or the repo.** They're Container App secrets, mapped to environment variables at runtime:
  `ANTHROPIC_API_KEY`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `CARTESIA_API_KEY`.
- One replica always on (`--min-replicas 1`) so a judge never waits on a cold start. Set it to 0 after the event.

## Commands (resource group `calhacks-rg`, region `westus2`)
```bash
az acr build -r <registry> -t buildsight:<tag> .
az containerapp update -n buildsight -g calhacks-rg --image <registry>.azurecr.io/buildsight:<tag>
```
Secrets are set once with `az containerapp secret set` and referenced as `secretref:` env vars.

## Monitoring: Application Insights
- Resource `buildsight-insights` (westus2, workspace-based on the Container Apps environment's Log Analytics workspace).
- `src/instrumentation.ts` / `src/instrumentation.node.ts` start Azure Monitor OpenTelemetry **only when**
  `APPLICATIONINSIGHTS_CONNECTION_STRING` is set (a Container App secret), so Vercel and local dev are unaffected.
- Next.js's built-in spans become **requests** (`POST /api/check`, `GET /api/speech-token`, ...) and **dependencies**
  (Claude `api.anthropic.com`, Cartesia `api.cartesia.ai`, Azure Speech token endpoint). Live Metrics is on.
- `tracesPerSecond: 0`: the package's default (5 traces/s) silently drops request traces in bursts.

## Continuous deployment (GitHub Actions)
`.github/workflows/azure-image.yml` runs on pushes to `main` (and `claude/azure-deploy`):
1. **build**: builds the image on GitHub's runners and pushes `buildsight:<commit sha>` to `buildsighto54ae`.
2. **deploy**: signs in to Azure with **OIDC** as the user-assigned managed identity `buildsight-github-deploy`
   (Contributor on `calhacks-rg` only; its federated credentials trust only this repo's `main` and `claude/azure-deploy`).
   No password is stored anywhere; the GitHub secrets `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`
   are identifiers. (A classic service principal wasn't possible: the Duke directory blocks app registrations.)
   Then `az containerapp update` to the commit's image as revision `buildsight--c<sha8>`, and a check that this
   revision is Healthy, serving that image, and the site returns 200.
