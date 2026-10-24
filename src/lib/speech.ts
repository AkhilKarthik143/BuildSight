"use client";

// BuildSight's voice: Cartesia text to speech via /api/tts, played with Web Audio as it streams in.
// Long replies are spoken sentence by sentence: each sentence is sent to Cartesia as soon as it's complete,
// so speech starts while Claude is still writing. If Cartesia fails, the browser's built-in voice takes over.

const SAMPLE_RATE = 24000; // matches /api/tts (32-bit float PCM, mono)
const MIN_SENTENCE = 24; // merge very short sentences ("Okay.") with the next one

type Listener = (speaking: boolean) => void;

// ---- Browser voice, used only as a fallback ----
let fallbackVoice: SpeechSynthesisVoice | null | undefined;
function browserSay(text: string): Promise<void> {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  if (!fallbackVoice) {
    const voices = window.speechSynthesis.getVoices();
    const prefer = ["Daniel", "Google UK English Male", "Arthur", "Oliver"];
    fallbackVoice =
      prefer.map((n) => voices.find((v) => v.name.startsWith(n))).find(Boolean) ?? voices.find((v) => v.lang === "en-GB") ?? null;
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (fallbackVoice) u.voice = fallbackVoice;
    u.rate = 1.05;
    u.onend = u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Splits streamed text into speakable sentences.
function takeSentences(buffer: string, flush: boolean): [string[], string] {
  const out: string[] = [];
  let rest = buffer;
  for (;;) {
    const m = rest.match(/^([\s\S]*?[.!?…]["')\]]?)(\s+)/);
    if (!m) break;
    let sentence = m[1];
    let cut = m[0].length;
    // Too short on its own: hold it and join with the next sentence.
    while (sentence.trim().length < MIN_SENTENCE) {
      const next = rest.slice(cut).match(/^([\s\S]*?[.!?…]["')\]]?)(\s+)/);
      if (!next) {
        // Last bit of the text: when flushing, keep the short sentence together with whatever is left.
        if (flush && rest.slice(cut).trim()) {
          sentence += " " + rest.slice(cut).trim();
          cut = rest.length;
        }
        break;
      }
      sentence += " " + next[1];
      cut += next[0].length;
    }
    if (sentence.trim().length < MIN_SENTENCE && !flush) break;
    out.push(sentence.trim());
    rest = rest.slice(cut);
  }
  if (flush && rest.trim()) {
    out.push(rest.trim());
    rest = "";
  }
  return [out, rest];
}

class Speaker {
  private ctx: AudioContext | null = null;
  private listeners = new Set<Listener>();
  private sources = new Set<AudioBufferSourceNode>();
  private abort: AbortController | null = null;
  private generation = 0;
  private active = false;
  private nextTime = 0;
  private cartesiaWorked = false; // once Cartesia has spoken, never fall back to the browser's different voice
  private wake: (() => void) | null = null; // wakes an idle reply loop so a stopped reply can finish

  get speaking() {
    return this.active;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  // Call from a click or key press: browsers only allow audio to start after the user interacts.
  unlock() {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  /** Stops anything playing, then speaks the whole text. */
  say(text: string) {
    const s = this.stream();
    s.push(text);
    return s.end();
  }

  /** Starts a new spoken reply that you feed as text streams in. Interrupts anything already playing. */
  stream() {
    this.stop();
    const gen = ++this.generation;
    const abort = new AbortController();
    this.abort = abort;
    let buffer = "";
    const queue: string[] = [];
    let ended = false;
    let wake: (() => void) | null = null;
    const notify = () => {
      wake?.();
      wake = null;
    };

    // Plays sentences in order. Audio is fetched for the sentence playing now and the next one only:
    // Cartesia rejects too many requests at once, and a rejected sentence used to come out in a different voice.
    const pending: Promise<ReadableStream<Uint8Array> | null>[] = [];
    const fill = (next: number) => {
      while (pending.length < queue.length && pending.length <= next + 1) pending.push(this.fetchAudio(queue[pending.length], abort.signal));
    };
    this.wake = notify;

    const run = (async () => {
      let next = 0;
      for (;;) {
        if (gen !== this.generation) return;
        if (next < queue.length) {
          fill(next);
          const audio = await pending[next];
          const sentence = queue[next++];
          fill(next); // start fetching the one after while this one plays
          if (gen !== this.generation) return;
          if (audio) {
            this.cartesiaWorked = true;
            this.setActive(true);
            await this.play(audio, gen);
          } else if (!this.cartesiaWorked) {
            // Cartesia isn't working at all (e.g. no key): use the browser voice so there's still sound.
            this.setActive(true);
            await this.waitForQueuedAudio(gen);
            if (gen !== this.generation) return;
            await browserSay(sentence);
          }
          // Otherwise skip this sentence rather than switch voices mid-answer; the text is still on screen.
          continue;
        }
        if (ended) break;
        await new Promise<void>((r) => (wake = r));
      }
      await this.waitForQueuedAudio(gen);
      if (gen === this.generation) this.setActive(false);
    })();

    const add = (sentences: string[]) => {
      queue.push(...sentences);
      if (sentences.length && gen === this.generation) this.setActive(true); // about to speak: keep the mic off
      if (sentences.length) notify();
    };

    return {
      push: (text: string) => {
        if (gen !== this.generation) return;
        buffer += text;
        const [sentences, rest] = takeSentences(buffer, false);
        buffer = rest;
        add(sentences);
      },
      /** No more text is coming. Resolves when speaking finishes (or is interrupted). */
      end: () => {
        if (gen === this.generation) {
          const [sentences] = takeSentences(buffer, true);
          buffer = "";
          add(sentences);
          ended = true;
          notify();
        }
        return run;
      },
    };
  }

  stop() {
    this.generation++;
    this.wake?.(); // let the old reply's loop see it was stopped and exit
    this.wake = null;
    this.abort?.abort();
    this.abort = null;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    this.nextTime = 0;
    this.setActive(false);
  }

  private setActive(on: boolean) {
    if (this.active === on) return;
    this.active = on;
    this.listeners.forEach((fn) => fn(on));
  }

  // Gets one sentence's audio stream from /api/tts, retrying briefly if Cartesia is busy. Null if it can't.
  private async fetchAudio(text: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array> | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal.aborted) return null;
      try {
        const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal });
        if (r.ok && r.body) return r.body;
        if (r.status === 503 || r.status === 400) return null; // not set up / bad input: retrying won't help
      } catch {
        if (signal.aborted) return null;
      }
      await new Promise((res) => setTimeout(res, 250 * (attempt + 1)));
    }
    return null;
  }

  // Schedules each chunk of audio right after the previous one, as it downloads.
  private async play(body: ReadableStream<Uint8Array>, gen: number) {
    this.unlock();
    const ctx = this.ctx!;
    const reader = body.getReader();
    let carry = new Uint8Array(0);
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || gen !== this.generation) break;
        // Samples are 4 bytes; a network chunk can end mid-sample, so keep the leftover for next time.
        const bytes = new Uint8Array(carry.length + value.length);
        bytes.set(carry);
        bytes.set(value, carry.length);
        const usable = bytes.length - (bytes.length % 4);
        carry = bytes.slice(usable);
        if (!usable) continue;
        const samples = new Float32Array(bytes.buffer.slice(0, usable));
        const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
        buffer.copyToChannel(samples, 0);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        const at = Math.max(this.nextTime, ctx.currentTime + 0.03);
        src.start(at);
        this.nextTime = at + buffer.duration;
        this.sources.add(src);
        src.onended = () => this.sources.delete(src);
      }
    } catch {
      // aborted or network drop: whatever already played is fine
    } finally {
      reader.releaseLock();
    }
  }

  // Resolves once all scheduled audio has finished playing.
  private waitForQueuedAudio(gen: number) {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve();
    const left = this.nextTime - ctx.currentTime;
    if (left <= 0) return Promise.resolve();
    return new Promise<void>((r) => setTimeout(r, left * 1000 + 50)).then(() => {
      if (gen === this.generation) this.nextTime = 0;
    });
  }
}

let instance: Speaker | null = null;
/** The one shared voice for the app. */
export function speaker(): Speaker {
  instance ??= new Speaker();
  return instance;
}

// Older call sites (build screen step announcements) use these.
export function speak(text: string) {
  if (typeof window === "undefined" || !text) return;
  speaker().say(text);
}

export function stopSpeaking() {
  if (typeof window !== "undefined") instance?.stop();
}
