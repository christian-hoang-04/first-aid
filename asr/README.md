# Vietnamese ASR Lab

A local demo that records microphone audio and compares three Vietnamese speech recognition models on the same recording. The upload panel also accepts WAV, FLAC, and OGG files. All three models run sequentially on CPU and their results appear on the same page.

## Run on Windows

Use Python 3.10 or newer. In PowerShell, from this folder:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:7860> in Chrome or Edge and allow microphone access. The server listens on localhost only.

The first use of each model downloads its Q8_0 GGUF weights into `%LOCALAPPDATA%\first-aid-asr-demo\models`; later runs reuse them. Approximate sizes are 2.04 GB, 2.25 GB, and 0.83 GB. The cache and Python environment are outside this project folder. Internet access is only needed for the initial model downloads. Audio is sent to this local app and inference uses the `transcribe.cpp` CPU backend.

## Models

| Demo entry | Weights | WER reference | CPU reference speed | Model source |
| --- | ---: | ---: | ---: | --- |
| Qwen3-ASR-1.7B | Q8_0, ~2.04 GB | 6.15% | 2.5× realtime | [GGUF model](https://huggingface.co/handy-computer/Qwen3-ASR-1.7B-gguf) |
| Cohere Transcribe 03-2026 | Q8_0, ~2.25 GB | 7.39% | 4.3× realtime | [GGUF model](https://huggingface.co/handy-computer/cohere-transcribe-03-2026-gguf) |
| Fun-ASR-MLT-Nano-2512 | Q8_0, ~0.83 GB | 8.32% | 5.5× realtime | [GGUF model](https://huggingface.co/handy-computer/Fun-ASR-MLT-Nano-2512-gguf) |

The WER and CPU speed above are reference scores from the [Vietnamese FLEURS benchmark](https://models.handy.computer/languages/vi/), not measurements of a recording from your microphone. The interface reports actual decode seconds and realtime factor for each run. Enter an optional reference transcript to estimate word-level error rate (WER) for that recording. The estimate uses whitespace-separated Vietnamese words and simple punctuation normalization.

Cohere Transcribe accepts up to 400 seconds per audio input, so the app caps recordings and uploads at 6 minutes 40 seconds. The listed Fun-ASR model uses the [FunASR Model Open Source License Agreement](https://github.com/handy-computer/transcribe.cpp/blob/main/docs/models/fun-asr-mlt-nano-2512.md); review model terms before redistribution or non-personal use.

## Troubleshooting

- If PowerShell blocks virtual-environment activation, use `Set-ExecutionPolicy -Scope Process Bypass` in that terminal, then activate again.
- If a model download fails, keep the cache folder and retry after reconnecting to the internet.
- If the browser blocks the microphone, open `http://127.0.0.1:7860` and allow microphone access for that local address.
- Model loading and first-time download are excluded from the displayed decode timing. The models run one at a time, so allow for their combined run time.
