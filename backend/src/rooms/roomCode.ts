import type { Room, Group } from "@juntada/shared-types";

const { rooms, groups } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  groups: Map<string, Group>;
};

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusión al leerlo en voz alta

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

// Rooms (game instances) and groups share one code space so a code always
// unambiguously means one or the other, never both.
function codeTaken(code: string): boolean {
  return rooms.has(code) || groups.has(code);
}

function generateUniqueRoomCode(): string {
  let code: string;
  do {
    code = generateCode();
  } while (codeTaken(code));
  return code;
}

module.exports = { generateUniqueRoomCode };
