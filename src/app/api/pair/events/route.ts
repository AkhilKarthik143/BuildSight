import { guard } from "@/lib/apiGuard";
import { isRoomCode } from "@/lib/pairing/codes";
import { getPairTransport } from "@/lib/pairing/transport";

async function get(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!isRoomCode(code)) return Response.json({ error: "Room not found." }, { status: 404 });
  const transport = getPairTransport();
  const joined = await transport.join(code);
  if (!joined.ok) return Response.json({ error: "Room not found." }, { status: 404 });

  const encoder = new TextEncoder();
  let stop = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      write(`event: ready\ndata: ${JSON.stringify({ code })}\n\n`);
      stop = transport.subscribe(code, (message) => write(`data: ${JSON.stringify(message)}\n\n`));
      ping = setInterval(() => write(`: ping\n\n`), 15000);
    },
    cancel() {
      stop();
      if (ping) clearInterval(ping);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export const GET = guard("pair-events", get);
