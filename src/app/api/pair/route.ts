import { guard } from "@/lib/apiGuard";
import { isRoomCode } from "@/lib/pairing/codes";
import { getPairTransport } from "@/lib/pairing/transport";

async function post(request: Request) {
  const body = (await request.json()) as { action?: unknown; code?: unknown };
  const transport = getPairTransport();
  if (body.action === "create") {
    const room = await transport.createRoom();
    return Response.json(room);
  }
  if (body.action === "join" && typeof body.code === "string" && isRoomCode(body.code)) {
    const joined = await transport.join(body.code);
    if (!joined.ok) return Response.json({ error: "Room not found." }, { status: 404 });
    return Response.json({ ok: true, code: body.code });
  }
  return Response.json({ error: "Send action create or join." }, { status: 400 });
}

export const POST = guard("pair", post);
