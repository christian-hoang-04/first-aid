import { APIStatusError, AudioByteStream, shortuuid, tts, type APIConnectOptions } from '@livekit/agents';
import { ReadableStream } from 'node:stream/web';

const NUM_CHANNELS = 1;
/** Số câu giữ audio trong bộ nhớ (một bước dài ~10 s PCM 24 kHz ≈ 0,5 MB). */
const CACHE_LIMIT = 64;

type AudioFrame = ReturnType<AudioByteStream['flush']>[number];

export interface OpenRouterTTSOptions {
  apiKey: string;
  baseURL: string;
  model: string;
  /** Voice của từng provider, ví dụ `Kore` (Gemini) hay `vi-VN-Harper:MAI-Voice-2.1-Flash`. */
  voice: string;
  instructions?: string;
  /** Tốc độ đọc (1 = bình thường). MAI tôn trọng tham số này; Gemini bỏ qua, chỉnh nhịp bằng `instructions`. */
  speed?: number;
  /** Sample rate của PCM provider trả về (Gemini, MAI: 24000 Hz). */
  sampleRate: number;
}

/**
 * TTS gọi `POST /audio/speech` của OpenRouter, nhận PCM 16-bit mono.
 * Plugin OpenAI của LiveKit chỉ nhận voice của OpenAI nên không dùng được voice của provider khác.
 *
 * Giảm độ trễ: phát audio ngay khi những byte đầu về (không chờ tải hết), giữ audio đã tổng hợp để
 * câu lặp lại phát ngay, và `prefetch()` tổng hợp sẵn câu sắp đọc. LiveKit tách câu trước khi gọi
 * `synthesize()`, nên câu đọc nguyên văn (nội dung bước) đi qua `speech()` để dùng đúng audio đã cache.
 */
export class OpenRouterTTS extends tts.TTS {
  label = 'openrouter.TTS';
  readonly #opts: OpenRouterTTSOptions;
  readonly #abortController = new AbortController();
  /** Audio đầy đủ theo nội dung câu; promise để lần gọi sau dùng chung request đang chạy. */
  readonly #cache = new Map<string, Promise<Uint8Array>>();

  constructor(opts: OpenRouterTTSOptions) {
    super(opts.sampleRate, NUM_CHANNELS, { streaming: false });
    this.#opts = opts;
  }

  get model() {
    return this.#opts.model;
  }

  get provider() {
    return 'openrouter';
  }

  /** Gửi request tổng hợp; body là PCM trả về dần. */
  async #request(text: string, signal: AbortSignal) {
    const response = await fetch(`${this.#opts.baseURL}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.#opts.model,
        input: text,
        voice: this.#opts.voice,
        instructions: this.#opts.instructions,
        speed: this.#opts.speed,
        response_format: 'pcm',
      }),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new APIStatusError({
        message: `OpenRouter TTS lỗi ${response.status}: ${await response.text()}`,
        options: { statusCode: response.status },
      });
    }
    return response.body;
  }

  #remember(text: string, audio: Promise<Uint8Array>) {
    if (this.#cache.size >= CACHE_LIMIT) {
      const oldest = this.#cache.keys().next().value;
      if (oldest !== undefined) this.#cache.delete(oldest);
    }
    this.#cache.set(text, audio);
    // Lỗi mạng hay bị huỷ giữa chừng thì bỏ khỏi cache để lần sau tổng hợp lại.
    audio.catch(() => this.#cache.delete(text));
  }

  /** PCM của câu: lấy từ cache, hoặc nhận dần từ OpenRouter (đồng thời lưu cache khi nhận đủ). */
  async *#pcm(text: string, signal: AbortSignal): AsyncGenerator<Uint8Array> {
    const cached = this.#cache.get(text);
    if (cached) {
      yield await cached;
      return;
    }
    const chunks: Uint8Array[] = [];
    let settle: { resolve: (audio: Uint8Array) => void; reject: (error: unknown) => void } | undefined;
    this.#remember(text, new Promise((resolve, reject) => (settle = { resolve, reject })));
    let complete = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      reader = (await this.#request(text, signal)).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        yield value;
      }
      complete = true;
      settle?.resolve(Buffer.concat(chunks));
    } finally {
      // Bị ngắt lời hoặc lỗi giữa chừng: dừng tải và không giữ audio dở dang.
      if (!complete) {
        settle?.reject(new Error('Tổng hợp bị huỷ'));
        void reader?.cancel().catch(() => {});
      }
    }
  }

  /** Frame audio của câu, phát dần theo PCM nhận được. */
  async *frames(text: string, signal: AbortSignal): AsyncGenerator<AudioFrame> {
    const audioByteStream = new AudioByteStream(this.sampleRate, NUM_CHANNELS);
    for await (const chunk of this.#pcm(text, signal)) yield* audioByteStream.write(chunk.slice().buffer);
    yield* audioByteStream.flush();
  }

  /** Audio cho `session.say(text, { audio })`: đọc nguyên văn cả câu, dùng audio đã cache nếu có. */
  speech(text: string): ReadableStream<AudioFrame> {
    const frames = this.frames(text, this.#abortController.signal);
    return new ReadableStream({
      async pull(controller) {
        const { done, value } = await frames.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      async cancel() {
        await frames.return(undefined);
      },
    });
  }

  /** Tổng hợp sẵn một câu sắp đọc (ví dụ bước kế tiếp) để khi đọc thì phát ngay. */
  prefetch(text: string) {
    if (this.#cache.has(text)) return;
    void (async () => {
      for await (const chunk of this.#pcm(text, this.#abortController.signal)) void chunk;
    })().catch((error) => console.warn('Không tổng hợp trước được câu', error));
  }

  synthesize(text: string, connOptions?: APIConnectOptions, abortSignal?: AbortSignal) {
    const signal = abortSignal
      ? AbortSignal.any([abortSignal, this.#abortController.signal])
      : this.#abortController.signal;
    return new OpenRouterChunkedStream(this, text, connOptions, signal);
  }

  stream(): tts.SynthesizeStream {
    throw new Error('OpenRouter TTS không hỗ trợ streaming');
  }

  async close() {
    this.#abortController.abort();
  }
}

class OpenRouterChunkedStream extends tts.ChunkedStream {
  label = 'openrouter.ChunkedStream';
  readonly #owner: OpenRouterTTS;
  readonly #text: string;
  readonly #signal: AbortSignal;

  constructor(owner: OpenRouterTTS, text: string, connOptions: APIConnectOptions | undefined, abortSignal: AbortSignal) {
    super(text, owner, connOptions, abortSignal);
    this.#owner = owner;
    this.#text = text;
    this.#signal = abortSignal;
  }

  protected async run() {
    const requestId = shortuuid();
    // Giữ lại frame cuối để đánh dấu `final` khi đã nhận hết audio.
    let pending: AudioFrame | undefined;
    try {
      for await (const frame of this.#owner.frames(this.#text, this.#signal)) {
        if (pending) this.queue.put({ requestId, segmentId: requestId, frame: pending, final: false });
        pending = frame;
      }
      if (pending) this.queue.put({ requestId, segmentId: requestId, frame: pending, final: true });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      throw error;
    } finally {
      this.queue.close();
    }
  }
}
