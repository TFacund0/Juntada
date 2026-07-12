import type { Room } from "@juntada/shared-types";

const { rooms } = require("../state/roomStore") as { rooms: Map<string, Room> };

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusión al leerlo en voz alta

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

function generateUniqueRoomCode(): string {
  let code: string;
  do {
    code = generateCode();
  } while (rooms.has(code));
  return code;
}

module.exports = { generateUniqueRoomCode };
