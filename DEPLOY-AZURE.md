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
`.github/workflows/azure-image.yml` runs on every push to `main` (and only `main`):
1. **build**: builds the image on GitHub's runners and pushes `buildsight:<commit sha>` to `buildsighto54ae`.
2. **deploy**: signs in to Azure with **OIDC** as the user-assigned managed identity `buildsight-github-deploy`
   (Contributor on `calhacks-rg` only; its federated credential trusts only this repo's `main`).
   No password is stored anywhere; the GitHub secrets `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`
   are identifiers. (A classic service principal wasn't possible: the Duke directory blocks app registrations.)
   Then `az containerapp update` to the commit's image, and a check that an active revision runs that image,
   is Healthy, and the site returns 200. (The environment is an "express" environment: it keeps one revision,
   `buildsight--latest`, and doesn't allow custom revision names.)

## Rollback
Every image is kept in the registry, tagged with its commit, so rolling back is re-running the workflow on the last good commit:
```bash
gh run list --repo davidzhu314/Calhacks --workflow azure-image.yml --branch main   # find the last good run
gh run rerun <run-id> --repo davidzhu314/Calhacks                                    # rebuilds and redeploys that commit
```
Or in the browser: **Actions → Azure image →** the last good run **→ Re-run all jobs**. To skip the rebuild (the image is
already in the registry), re-run just its **deploy** job. The workflow's check confirms the live revision is on that commit.

The next push to `main` deploys again, so also revert the bad change on `main` (`git revert <commit>`), or it comes back.
