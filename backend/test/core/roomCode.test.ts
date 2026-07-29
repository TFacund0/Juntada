const { test } = require("node:test");
const assert = require("node:assert/strict");
const { rooms } = require("../../src/state/roomStore");
const { generateUniqueRoomCode } = require("../../src/rooms/roomCode");

const VALID_CHARS = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

test("generateUniqueRoomCode returns a 5-char code from the allowed alphabet", () => {
  rooms.clear();
  const code = generateUniqueRoomCode();
  assert.match(code, VALID_CHARS);
});

test("generateUniqueRoomCode excludes ambiguous characters (0/O/1/I)", () => {
  rooms.clear();
  for (let i = 0; i < 200; i++) {
    const code = generateUniqueRoomCode();
    assert.ok(!/[01OI]/.test(code), `code "${code}" contains an excluded character`);
  }
});

test("generateUniqueRoomCode never returns a code already taken in rooms", () => {
  rooms.clear();
  // Occupy one code up front; the generator must keep retrying past it
  // instead of ever handing it back out.
  const taken = "AAAAA";
  rooms.set(taken, {});
  for (let i = 0; i < 500; i++) {
    const code = generateUniqueRoomCode();
    assert.notEqual(code, taken);
  }
  rooms.clear();
});
