// Room codes avoid 0/O and 1/I so they can be read aloud.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function roomCode(random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

export function isRoomCode(code: string): boolean {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code);
}
