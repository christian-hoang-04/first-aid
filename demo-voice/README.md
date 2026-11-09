# AI Voice web app and worker

This folder contains the Next.js UI/API and the Mastra/LiveKit voice worker. See the repository [setup guide](../SETUP.md) for a complete local run sequence and dependency details.

Quick start:

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env with your own model API key and reachable LiveKit, ASR, and TTS endpoints.
npm run livekit:up
npm run dev
# In another terminal, from this folder:
npm run worker:dev
```

The web app defaults to port 3000. The worker uses port 8081. The included LiveKit Compose service is for local development only. A real call also needs a valid OpenRouter key, an ASR service compatible with `FUNASR_STT_URL`, and a VieNeu/OpenAI-compatible TTS service at `TTS_BASE_URL`. The TTS model runtime is external to this repository. Keep real values in the ignored `.env`, never in Git.