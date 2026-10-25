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
