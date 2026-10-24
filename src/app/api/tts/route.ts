// Text to speech with Cartesia. Streams raw audio (32-bit float PCM, mono, 24 kHz) straight through to the browser,
// which starts playing as the first bytes arrive. The key stays on the server.

const CARTESIA_URL = "https://api.cartesia.ai/tts/bytes";
const CARTESIA_VERSION = "2026-08-14";
const MODEL = "sonic-3.6";
const VOICE = process.env.CARTESIA_VOICE_ID || "4bc3cb8c-adb9-4bb8-b5d5-cbbef950b991"; // "George": steady British male
const SAMPLE_RATE = 24000; // the browser player in lib/speech.ts assumes this rate
const MAX_CHARS = 1500;

export async function POST(request: Request) {
  const key = process.env.CARTESIA_API_KEY?.trim();
  if (!key) return Response.json({ error: "Voice isn't set up on the server (missing Cartesia key)." }, { status: 503 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  const transcript = text?.trim().slice(0, MAX_CHARS);
  if (!transcript) return Response.json({ error: "Nothing to say." }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(CARTESIA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Cartesia-Version": CARTESIA_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_id: MODEL,
        transcript,
        voice: { id: VOICE },
        output_format: { container: "raw", encoding: "pcm_f32le", sample_rate: SAMPLE_RATE },
        language: "en",
      }),
      signal: request.signal,
    });
  } catch {
    return Response.json({ error: "Couldn't reach Cartesia." }, { status: 502 });
  }
  if (!res.ok || !res.body) {
    const reason = res.status === 401 ? "the Cartesia key was rejected" : `Cartesia returned ${res.status}`;
    return Response.json({ error: `Voice failed: ${reason}.` }, { status: 502 });
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/pcm", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
