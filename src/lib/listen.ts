"use client";

// Speech to text with Azure AI Speech, in the browser.
// The key stays on the server: we fetch a short-lived token from /api/speech-token.
// Push-to-talk: start() when the button goes down, stop() when it comes up; stop() resolves with what was said.

import type * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

type Sdk = typeof SpeechSDK;

export type ListenerEvents = {
  onInterim?: (text: string) => void; // words so far, while speaking
  onPhrase?: (text: string) => void; // a finished phrase (Azure ends one at a pause)
  onError?: (message: string) => void;
};

const TOKEN_MAX_AGE = 8 * 60_000; // tokens last 10 min; refresh a bit early

async function fetchToken(): Promise<{ token: string; region: string }> {
  let res: Response;
  try {
    res = await fetch("/api/speech-token", { cache: "no-store" });
  } catch {
    throw new Error("Can't reach the server. Check the network.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(data.error ?? "Couldn't start speech.");
  return data;
}

// Ask for the mic once up front, so a "blocked" answer gives a clear message instead of a vague SDK error.
async function ensureMic() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("The mic needs HTTPS (or localhost).");
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError") throw new Error("Mic access is blocked. Allow the microphone in the browser's address bar, then try again.");
    if (name === "NotFoundError") throw new Error("No microphone found.");
    throw new Error("Couldn't open the microphone.");
  }
}

export class Listener {
  private sdk: Sdk | null = null;
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private tokenAt = 0;
  private micOk = false;
  private running = false;
  private phrases: string[] = [];
  private interim = "";

  constructor(private events: ListenerEvents) {}

  get listening() {
    return this.running;
  }

  // Loads the SDK, gets a token and opens the connection ahead of time, so the first press starts fast.
  async warm() {
    await this.ready();
    connectionOf(this.sdk!, this.recognizer!)?.openConnection();
  }

  async start() {
    if (this.running) return;
    this.phrases = [];
    this.interim = "";
    if (!this.micOk) {
      await ensureMic();
      this.micOk = true;
    }
    const recognizer = await this.ready();
    this.running = true;
    await new Promise<void>((resolve, reject) =>
      recognizer.startContinuousRecognitionAsync(resolve, (e) => {
        this.running = false;
        reject(new Error(`Couldn't start listening: ${e}`));
      }),
    );
  }

  // Stops listening and returns everything said since start().
  async stop(): Promise<string> {
    if (!this.running || !this.recognizer) return "";
    const recognizer = this.recognizer;
    await new Promise<void>((resolve) => recognizer.stopContinuousRecognitionAsync(resolve, () => resolve()));
    this.running = false;
    const text = (this.phrases.length ? this.phrases.join(" ") : this.interim).trim();
    this.phrases = [];
    this.interim = "";
    return text;
  }

  close() {
    this.running = false;
    this.recognizer?.close();
    this.recognizer = null;
  }

  private async ready(): Promise<SpeechSDK.SpeechRecognizer> {
    this.sdk ??= await import("microsoft-cognitiveservices-speech-sdk");
    const sdk = this.sdk;
    const stale = Date.now() - this.tokenAt > TOKEN_MAX_AGE;

    if (this.recognizer && !stale) return this.recognizer;
    const { token, region } = await fetchToken();
    this.tokenAt = Date.now();
    if (this.recognizer) {
      this.recognizer.authorizationToken = token;
      return this.recognizer;
    }

    const config = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    config.speechRecognitionLanguage = "en-US";
    const recognizer = new sdk.SpeechRecognizer(config, sdk.AudioConfig.fromDefaultMicrophoneInput());

    recognizer.recognizing = (_, e) => {
      this.interim = [...this.phrases, e.result.text].join(" ");
      this.events.onInterim?.(this.interim);
    };
    recognizer.recognized = (_, e) => {
      if (e.result.reason !== sdk.ResultReason.RecognizedSpeech || !e.result.text) return;
      this.phrases.push(e.result.text);
      this.interim = this.phrases.join(" ");
      this.events.onInterim?.(this.interim);
      this.events.onPhrase?.(e.result.text);
    };
    recognizer.canceled = (_, e) => {
      if (e.reason !== sdk.CancellationReason.Error) return;
      this.running = false;
      const code = e.errorCode;
      const C = sdk.CancellationErrorCode;
      const message =
        code === C.AuthenticationFailure || code === C.Forbidden
          ? "Speech sign-in expired. Try again."
          : code === C.ConnectionFailure || code === C.ServiceTimeout
            ? "Lost the connection to Azure Speech. Check the network and try again."
            : code === C.TooManyRequests
              ? "Speech is busy. Wait a moment and try again."
              : "Speech recognition stopped unexpectedly. Try again.";
      // Rebuild from scratch next time (fresh token and connection).
      this.recognizer?.close();
      this.recognizer = null;
      this.tokenAt = 0;
      this.events.onError?.(message);
    };

    this.recognizer = recognizer;
    return recognizer;
  }
}

function connectionOf(sdk: Sdk, recognizer: SpeechSDK.SpeechRecognizer) {
  try {
    return sdk.Connection.fromRecognizer(recognizer);
  } catch {
    return null;
  }
}
