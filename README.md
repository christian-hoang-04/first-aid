# First Aid demo workspace

This repository groups the SOS NOW website, its Spring API, local ASR utilities, and the separate AI Voice app/worker.

Start with [SETUP.md](SETUP.md) for prerequisites, service boundaries, configuration, and commands to run each part. The main website is under `sos-now/`; its general backend is `sos-now/backend/`. The AI Voice backend and worker live under `demo-voice/`.

Local secrets, model weights, caches, and build output are not committed. AI Voice needs separately configured LiveKit, OpenRouter, ASR, and TTS services; see the setup guide.