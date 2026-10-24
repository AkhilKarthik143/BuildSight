// Trades the Azure Speech key for a short-lived token (valid 10 min), so the key never reaches the browser.
// Tokens are reused for 9 minutes to skip a round trip on every push-to-talk.

let cached: { token: string; region: string; expires: number } | null = null;

export async function GET() {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) {
    return Response.json({ error: "Speech isn't set up on the server (missing Azure Speech key or region)." }, { status: 503 });
  }

  if (cached && cached.region === region && cached.expires > Date.now()) {
    return Response.json({ token: cached.token, region }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) {
      const reason = res.status === 401 ? "the Azure Speech key was rejected" : `Azure returned ${res.status}`;
      return Response.json({ error: `Couldn't start speech: ${reason}.` }, { status: 502 });
    }
    const token = await res.text();
    cached = { token, region, expires: Date.now() + 9 * 60_000 };
    return Response.json({ token, region }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Couldn't reach Azure Speech. Check the network." }, { status: 502 });
  }
}
