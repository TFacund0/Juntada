const { rooms } = require("../state/roomStore");

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusión al leerlo en voz alta

function generateCode() {
  let code = "";
  for (let i = 0; i < 5; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

function generateUniqueRoomCode() {
  let code;
  do { code = generateCode(); } while (rooms.has(code));
  return code;
}

module.exports = { generateUniqueRoomCode };
