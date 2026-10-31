// Phone-to-laptop link. Dev uses the in-memory transport. Azure Web PubSub is selected
// only when WEBPUBSUB_CONNECTION_STRING is set, and tests inject fetch.

import { isRoomCode, roomCode } from "./codes.ts";
import { parsePairMessage, type PairMessage } from "./schema.ts";

export type PairTransport = {
  createRoom(): Promise<{ code: string }>;
  join(code: string): Promise<{ ok: true } | { ok: false }>;
  publish(code: string, message: PairMessage): Promise<boolean>;
  subscribe(code: string, listener: (message: PairMessage) => void): () => void;
};

type Room = { touched: number; listeners: Set<(message: PairMessage) => void> };

const rooms = () => {
  const g = globalThis as { __buildsightRooms?: Map<string, Room> };
  g.__buildsightRooms ??= new Map();
  return g.__buildsightRooms;
};

export function resetRoomsForTests() {
  rooms().clear();
}

export function memoryTransport({ maxRooms = 200, ttlMs = 30 * 60 * 1000, now = Date.now }: { maxRooms?: number; ttlMs?: number; now?: () => number } = {}): PairTransport {
  const sweep = () => { const at = now(); for (const [code, room] of rooms()) if (at - room.touched > ttlMs) rooms().delete(code); };
  return {
    async createRoom() {
      sweep();
      const store = rooms();
      if (store.size >= maxRooms) throw new Error("Pairing is busy. Try again later.");
      let code = roomCode();
      while (store.has(code)) code = roomCode();
      store.set(code, { touched: now(), listeners: new Set() });
      return { code };
    },
    async join(code) {
      sweep();
      const room = rooms().get(code);
      if (!room || !isRoomCode(code)) return { ok: false };
      room.touched = now();
      return { ok: true };
    },
    async publish(code, message) {
      sweep();
      const room = rooms().get(code);
      if (!room || !parsePairMessage(message)) return false;
      room.touched = now();
      for (const listener of room.listeners) listener(message);
      return true;
    },
    subscribe(code, listener) {
      const room = rooms().get(code);
      if (!room) return () => {};
      room.listeners.add(listener);
      return () => room.listeners.delete(listener);
    },
  };
}

type AzureOpts = {
  connectionString: string;
  fetch?: typeof fetch;
};

export function parseConnectionString(value: string): { endpoint: string; accessKey: string } | null {
  const parts = Object.fromEntries(
    value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        return eq < 0 ? ["", ""] : [part.slice(0, eq), part.slice(eq + 1)];
      }),
  );
  const endpoint = parts.Endpoint?.replace(/\/$/, "");
  const accessKey = parts.AccessKey;
  if (!endpoint || !accessKey || !/^https:\/\//.test(endpoint)) return null;
  return { endpoint, accessKey };
}

/** Stub Azure Web PubSub REST client. Listeners in this process are notified after a successful send. */
export function azureTransport({ connectionString, fetch: doFetch = fetch }: AzureOpts): PairTransport {
  const parsed = parseConnectionString(connectionString);
  if (!parsed) throw new Error("Pairing is not configured.");
  const { endpoint, accessKey } = parsed;
  const local = new Map<string, Set<(message: PairMessage) => void>>();
  const urlFor = (code: string) => `${endpoint}/api/hubs/buildsight/groups/${encodeURIComponent(code)}/:send?api-version=2024-12-01`;

  return {
    async createRoom() {
      const code = roomCode();
      local.set(code, new Set());
      return { code };
    },
    async join(code) {
      if (!isRoomCode(code)) return { ok: false };
      if (!local.has(code)) local.set(code, new Set());
      return { ok: true };
    },
    async publish(code, message) {
      if (!isRoomCode(code) || !parsePairMessage(message)) return false;
      let res: Response;
      try {
        res = await doFetch(urlFor(code), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessKey}` },
          body: JSON.stringify({ hub: "buildsight", group: code, data: message }),
        });
      } catch {
        throw new Error("Pairing publish failed.");
      }
      if (!res.ok) throw new Error("Pairing publish failed.");
      const listeners = local.get(code);
      if (listeners) for (const listener of listeners) listener(message);
      return true;
    },
    subscribe(code, listener) {
      const set = local.get(code) ?? new Set();
      local.set(code, set);
      set.add(listener);
      return () => set.delete(listener);
    },
  };
}

const singleton = globalThis as { __buildsightPair?: PairTransport; __buildsightPairMode?: string };

export function getPairTransport(): PairTransport {
  const cs = process.env.WEBPUBSUB_CONNECTION_STRING?.trim() ?? "";
  const mode = cs ? `azure:${cs}` : "memory";
  if (!singleton.__buildsightPair || singleton.__buildsightPairMode !== mode) {
    singleton.__buildsightPair = cs ? azureTransport({ connectionString: cs }) : memoryTransport();
    singleton.__buildsightPairMode = mode;
  }
  return singleton.__buildsightPair;
}

export function resetPairTransportForTests() {
  singleton.__buildsightPair = undefined;
  singleton.__buildsightPairMode = undefined;
  resetRoomsForTests();
}
