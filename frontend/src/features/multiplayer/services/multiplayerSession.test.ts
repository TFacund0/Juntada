import { describe, it, expect, beforeEach } from "vitest";
import { SESSION_KEY, loadSession, saveSession, clearMultiplayerSession } from "./multiplayerSession";
import { reconnectDelayMs } from "./socketConfig";

describe("multiplayerSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is persisted", () => {
    expect(loadSession()).toBeNull();
  });

  it("saveSession persists under the frozen SESSION_KEY", () => {
    saveSession({ room: { playerId: "p1", roomCode: "ABCD" } });
    const raw = localStorage.getItem(SESSION_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ room: { playerId: "p1", roomCode: "ABCD" } });
  });

  it("loadSession reads back what saveSession wrote", () => {
    saveSession({ group: { playerId: "p2", groupCode: "WXYZ" } });
    expect(loadSession()).toEqual({ group: { playerId: "p2", groupCode: "WXYZ" } });
  });

  it("saveSession removes the key when session has neither room nor group", () => {
    saveSession({ room: { playerId: "p1", roomCode: "ABCD" } });
    saveSession({});
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("saveSession removes the key when passed null", () => {
    saveSession({ room: { playerId: "p1", roomCode: "ABCD" } });
    saveSession(null);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("clearMultiplayerSession removes any persisted session", () => {
    saveSession({ room: { playerId: "p1", roomCode: "ABCD" } });
    clearMultiplayerSession();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(loadSession()).toBeNull();
  });

  it("loadSession returns null on malformed JSON instead of throwing", () => {
    localStorage.setItem(SESSION_KEY, "{not-json");
    expect(loadSession()).toBeNull();
  });
});

describe("reconnectDelayMs", () => {
  it("starts at 3000ms for attempt 1", () => {
    expect(reconnectDelayMs(1)).toBe(3000);
  });

  it("grows by 600ms per attempt", () => {
    expect(reconnectDelayMs(2)).toBe(3600);
    expect(reconnectDelayMs(3)).toBe(4200);
  });

  it("caps at 8000ms", () => {
    expect(reconnectDelayMs(20)).toBe(8000);
  });
});
