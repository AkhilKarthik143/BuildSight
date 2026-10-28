import { guard } from "@/lib/apiGuard";
import { isRoomCode } from "@/lib/pairing/codes";
import { parsePairMessage } from "@/lib/pairing/schema";
import { getPairTransport } from "@/lib/pairing/transport";

async function post(request: Request) {
  const body = (await request.json()) as { code?: unknown; message?: unknown };
  if (typeof body.code !== "string" || !isRoomCode(body.code)) return Response.json({ error: "Room not found." }, { status: 404 });
  const message = parsePairMessage(body.message);
  if (!message) return Response.json({ error: "Message not understood." }, { status: 400 });
  const joined = await getPairTransport().join(body.code);
  if (!joined.ok) return Response.json({ error: "Room not found." }, { status: 404 });
  const ok = await getPairTransport().publish(body.code, message);
  if (!ok) return Response.json({ error: "Message not understood." }, { status: 400 });
  return Response.json({ ok: true });
}

export const POST = guard("pair-publish", post);
