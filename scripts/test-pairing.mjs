// Pairing transport, message schema, and QR matrix. fetch is injected. No network.
import { isRoomCode, roomCode } from "../src/lib/pairing/codes.ts";
import { qrMatrix } from "../src/lib/pairing/qr.ts";
import { parsePairMessage } from "../src/lib/pairing/schema.ts";
import { azureTransport, memoryTransport, parseConnectionString, resetRoomsForTests } from "../src/lib/pairing/transport.ts";

let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

check("frame", parsePairMessage({ type: "frame", image: "data:image/jpeg;base64,aaaa" })?.type === "frame");
check("step", parsePairMessage({ type: "step", page: 2, step: 8 })?.type === "step");
check("check", parsePairMessage({ type: "check", verdict: "fix", say: "Turn it." })?.type === "check");
check("transcript", parsePairMessage({ type: "transcript", text: "hi", from: "phone" })?.type === "transcript");
check("rejects svg", parsePairMessage({ type: "frame", image: "data:image/svg+xml;base64,aa" }) === null);
check("rejects bad step", parsePairMessage({ type: "step", page: 0, step: 1 }) === null);
check("rejects unknown", parsePairMessage({ type: "ping" }) === null);

const code = roomCode(() => 0);
check("code alphabet", isRoomCode(code) && code.length === 6 && code === "AAAAAA");
check("rejects lookalikes", !isRoomCode("OOOOOO") && !isRoomCode("abc"));

resetRoomsForTests();
const memory = memoryTransport();
const room = await memory.createRoom();
check("room code", isRoomCode(room.code));
check("unknown room", (await memory.join("ZZZZZZ")).ok === false);
const got = [];
const stop = memory.subscribe(room.code, (message) => got.push(message));
const other = memoryTransport();
const room2 = await other.createRoom();
await memory.publish(room.code, { type: "transcript", text: "from the phone", from: "phone" });
await memory.publish(room2.code, { type: "step", page: 1, step: 2 });
check("round trip", got.length === 1 && got[0].type === "transcript" && got[0].text === "from the phone");
stop();
await memory.publish(room.code, { type: "step", page: 1, step: 3 });
check("unsubscribe", got.length === 1);

const key = "azure-key-DO-NOT-LEAK";
const parsed = parseConnectionString(`Endpoint=https://demo.webpubsub.azure.com;AccessKey=${key};Version=1.0;`);
check("connection string", parsed?.endpoint === "https://demo.webpubsub.azure.com" && parsed.accessKey === key);
const calls = [];
const azure = azureTransport({
  connectionString: `Endpoint=https://demo.webpubsub.azure.com/;AccessKey=${key};Version=1.0;`,
  fetch: async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("fail")) return new Response("nope " + key, { status: 500 });
    return new Response("ok", { status: 202 });
  },
});
const azureRoom = await azure.createRoom();
const heard = [];
azure.subscribe(azureRoom.code, (message) => heard.push(message));
await azure.publish(azureRoom.code, { type: "step", page: 3, step: 4 });
check("azure url", calls.length === 1 && calls[0].url.includes(azureRoom.code) && calls[0].url.startsWith("https://demo.webpubsub.azure.com/"));
check("azure body", JSON.parse(calls[0].init.body).data.step === 4);
check("azure delivered", heard.length === 1 && heard[0].type === "step");
const failing = azureTransport({
  connectionString: `Endpoint=https://fail.webpubsub.azure.com;AccessKey=${key};Version=1.0;`,
  fetch: async () => new Response(`leak ${key}`, { status: 500 }),
});
const bad = await failing.createRoom();
let hidden = false;
try {
  await failing.publish(bad.code, { type: "transcript", text: "x", from: "laptop" });
} catch (e) {
  hidden = !String(e.message).includes(key) && e.message === "Pairing publish failed.";
}
check("azure error hides the key", hidden);

const matrix = qrMatrix("HELLO", 0);
const row = (r) => matrix[r].map((cell) => (cell ? "1" : "0")).join("");
check("qr size", matrix.length === 21 && matrix[0].length === 21);
check("qr golden row", row(0) === "111111100111001111111");
check("qr finder", row(0).startsWith("1111111") && row(20).startsWith("1111111"));

console.log(failed ? `\n${failed} failed` : "\npairing tests passed");
// Bounded room storage: active rooms survive pressure, abandoned rooms expire.
resetRoomsForTests();
let time = 0;
const bounded = memoryTransport({ maxRooms: 2, ttlMs: 1000, now: () => time });
const firstRoom = await bounded.createRoom();
await bounded.createRoom();
let capped = false;
try { await bounded.createRoom(); } catch { capped = true; }
check("room capacity enforced", capped);
time = 1001;
check("expired room cannot join", !(await bounded.join(firstRoom.code)).ok);
check("expired room makes room", !!(await bounded.createRoom()).code);
resetRoomsForTests();

if (failed) process.exit(1);
