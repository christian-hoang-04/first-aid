import { mergeFrames, normalizeLanguage, stt } from '@livekit/agents';
import type { AudioBuffer } from '@livekit/agents';

const MODEL_ALIAS = 'funasr';
const MODEL_NAME = 'Fun-ASR-MLT-Nano-2512';

type LocalTranscriptionResponse = {
  results?: Array<{
    model?: string;
    text?: string;
    error?: string;
  }>;
};

function toWav(frame: ReturnType<typeof mergeFrames>): Buffer {
  const pcm = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
  const header = Buffer.alloc(44);
  const bitsPerSample = 16;
  const blockAlign = (frame.channels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(frame.channels, 22);
  header.writeUInt32LE(frame.sampleRate, 24);
  header.writeUInt32LE((frame.sampleRate * frame.channels * bitsPerSample) / 8, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.byteLength, 40);

  return Buffer.concat([header, pcm]);
}

export class FunAsrSTT extends stt.STT {
  readonly label = 'funasr-local';
  readonly #endpoint: string;

  constructor(endpoint = 'http://127.0.0.1:7860/api/transcribe') {
    super({ streaming: false, interimResults: false, alignedTranscript: false });
    this.#endpoint = endpoint;
  }

  override get model(): string {
    return MODEL_NAME;
  }

  override get provider(): string {
    return 'local';
  }

  override stream(): never {
    throw new Error('FunASR adapter is non-streaming; use recognize() after VAD ends the turn.');
  }

  protected async _recognize(
    audio: AudioBuffer,
    abortSignal?: AbortSignal,
  ): Promise<stt.SpeechEvent> {
    const frame = mergeFrames(audio);
    const wav = toWav(frame);
    const form = new FormData();
    form.append('file', new File([new Uint8Array(wav)], 'speech.wav', { type: 'audio/wav' }));
    form.append('models', MODEL_ALIAS);

    const response = await fetch(this.#endpoint, {
      method: 'POST',
      body: form,
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Local FunASR service returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as LocalTranscriptionResponse;
    const result = payload.results?.find((item) => item.model === MODEL_ALIAS);
    if (!result) {
      throw new Error('Local FunASR response did not contain a transcription result.');
    }
    if (result.error) {
      throw new Error(`Local FunASR transcription failed: ${result.error}`);
    }
    if (typeof result.text !== 'string') {
      throw new Error('Local FunASR response did not contain transcript text.');
    }

    return {
      type: stt.SpeechEventType.FINAL_TRANSCRIPT,
      alternatives: [
        {
          text: result.text,
          language: normalizeLanguage('vi'),
          startTime: 0,
          endTime: frame.samplesPerChannel / frame.sampleRate,
          confidence: 0,
        },
      ],
    };
  }
}
