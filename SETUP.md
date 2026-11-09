# First Aid demo setup

This repository contains several related demos. The backends are separate services; start the one(s) used by the page you are running.

## Repository layout

- Root `index.html`, `script.js`, and `styles.css`: standalone static first-aid demo. `asr/` is a separate Vietnamese ASR comparison page. `tts/` contains prerecorded guide audio and tools used to generate or replace clips. `map-data/` and `vendor/` contain map data and local browser libraries.
- `sos-now/`: React/Vite website. Its `backend/` is the Spring Boot API used by the main app; `ai-service/` is an optional FastAPI triage/transcription service.
- `demo-voice/`: separate Next.js web/API app and Mastra/LiveKit voice worker.

## Prerequisites

- Git, Node.js 20.19+ or 22.12+, and npm for the Vite and Next.js apps.
- JDK 21 and Apache Maven for the Spring API. Maven is not bundled in this repository.
- Python 3.11 recommended for the ASR services. The first ASR use downloads model weights; the model files are intentionally not committed.
- Docker Desktop or Docker Engine with Compose only if you run the bundled local LiveKit server.

## Run the main SOS NOW website

From the repository root, use two terminals. These commands work in PowerShell and shells with `cd`/`npm`.

Terminal 1, Vite website:

```sh
cd sos-now
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to `http://127.0.0.1:8080` and `/voice-runtime` to the AI Voice app on port 3000.

Terminal 2, Spring Boot backend:

```sh
cd sos-now/backend
mvn test
mvn spring-boot:run
```

The Spring API listens on port 8080 and uses the included H2 database and facility catalog by default. Its source and tests are in `sos-now/backend/`; this is the general SOS NOW backend.

## Optional keyword triage and transcription API

`sos-now/ai-service/` is a separate FastAPI service. It uses keyword rules for triage and can download the pinned Fun-ASR model on first transcription. Use port 8001 if the local VieNeu TTS service will use port 8000 at the same time.

Windows PowerShell:

```powershell
cd sos-now/ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

macOS/Linux:

```sh
cd sos-now/ai-service
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Set `VITE_AI_API_URL=http://127.0.0.1:8001` in the Vite terminal before starting `npm run dev` to route microphone requests to this service. Without it, the website uses its browser recognition/fallback path. The service is optional for the basic website.

## Run the AI Voice app and worker

`demo-voice/` is the AI Voice web/API and its separate LiveKit worker. It needs a LiveKit server, an OpenRouter API key for the model, a compatible FunASR endpoint, and a compatible VieNeu/OpenAI-style TTS endpoint. Credentials and model services are not bundled.

1. In `demo-voice/`, install packages and create a private environment file:

   ```sh
   cd demo-voice
   npm ci
   cp .env.example .env
   ```

   In PowerShell, use `Copy-Item .env.example .env` for the last command. Edit `.env`: provide your own `OPENROUTER_API_KEY`; set the LiveKit URL/key/secret; and point `FUNASR_STT_URL` and `TTS_BASE_URL` at running local or hosted services. Never commit `.env`.
2. To run the included local development LiveKit server, start Docker, then run `npm run livekit:up`. The compose file uses LiveKit development mode and local-only sample credentials; do not reuse those values for a deployed service.
3. Terminal 1: `npm run dev` starts the Next.js app at `http://127.0.0.1:3000`.
4. Terminal 2: `npm run worker:dev` starts the voice worker (default worker health port 8081).
5. Open the AI Voice page in the Vite website. The browser calls the Next.js token endpoint through Vite's `/voice-runtime` proxy.

The default worker ASR URL is `http://127.0.0.1:7860/api/transcribe`; run the root `asr/` service below or point it at another compatible service. The default TTS URL is `http://127.0.0.1:8000/v1`. The VieNeu model server used on the original development machine lives outside this repository, so install/provision a compatible server separately. Do not expect AI Voice to complete a call until LiveKit, the model API/key, ASR, and TTS are all reachable.

## Run the standalone ASR comparison demo

Windows PowerShell:

```powershell
cd asr
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

macOS/Linux:

```sh
cd asr
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:7860` and allow microphone access. The first run downloads several gigabytes of model weights to the user cache; audio inference runs locally on CPU. This same service exposes the `/api/transcribe` endpoint used by the AI Voice worker.

## TTS guide assets

The prerecorded step clips are in `tts/giong-doc-vieneu/` and are embedded in the three `sos-now/public/guides/*-3d.html` pages. No TTS server is needed to play those clips. The `tts/tools/` scripts can regenerate or replace clips; they require the VieNeu Python package/model and `ffmpeg`/`ffprobe`. Those model weights are not stored in Git.

## Standalone static page

To preview the root static demo, run `python -m http.server 4173` from the repository root and open `http://127.0.0.1:4173`.

## Useful checks

```sh
cd sos-now
npm test
npm run build
cd backend
mvn test
```

For AI Voice, from `demo-voice/`, use `npm run lint` and `npm run build`. A full voice call additionally needs the private environment and external services described above.

## Configuration and privacy

`.env.example` files contain settings/examples only. Copy them to ignored `.env` files and enter your own credentials. ASR model weights, package installs, build output, local databases, and caches are excluded from Git. The demo's medical content is illustrative and should not be used as emergency medical advice without professional review.