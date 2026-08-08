import { describe, test, expect } from "vitest";
import { buildGroupJoinUrl, buildRoomJoinUrl, parseJoinLink, extractScannedCode } from "../joinLink";

describe("joinLink", () => {
  describe("buildGroupJoinUrl / buildRoomJoinUrl", () => {
    test("group link uses /join/CODE with kind=group", () => {
      const url = new URL(buildGroupJoinUrl("abc12"));
      expect(url.pathname).toBe("/join/abc12");
      expect(url.searchParams.get("kind")).toBe("group");
    });

    test("room link uses /join/CODE with the gameId", () => {
      const url = new URL(buildRoomJoinUrl("impostor", "xyz89"));
      expect(url.pathname).toBe("/join/xyz89");
      expect(url.searchParams.get("game")).toBe("impostor");
    });
  });

  describe("parseJoinLink", () => {
    test("no code at all is not a link", () => {
      expect(parseJoinLink(null, new URLSearchParams())).toBeNull();
      expect(parseJoinLink(undefined, new URLSearchParams())).toBeNull();
    });

    test("kind=group wins regardless of any game param", () => {
      const link = parseJoinLink("abc12", new URLSearchParams("kind=group"));
      expect(link).toEqual({ code: "ABC12", kind: "group" });
    });

    test("no kind and no game also resolves to a group link", () => {
      const link = parseJoinLink("abc12", new URLSearchParams());
      expect(link).toEqual({ code: "ABC12", kind: "group" });
    });

    test("a game param with no kind resolves to a room link", () => {
      const link = parseJoinLink("xyz89", new URLSearchParams("game=impostor"));
      expect(link).toEqual({ code: "XYZ89", kind: "room", gameId: "impostor" });
    });
  });

  describe("extractScannedCode", () => {
    test("reads the code out of a new-format /join/CODE link on this app's own origin", () => {
      expect(extractScannedCode(`${window.location.origin}/join/abc12?kind=group`)).toBe("ABC12");
    });

    test("reads the code out of a legacy ?join=CODE link on this app's own origin", () => {
      expect(extractScannedCode(`${window.location.origin}/?join=xyz89&kind=group`)).toBe("XYZ89");
    });

    test("rejects a same-shaped link on a different origin", () => {
      expect(extractScannedCode("https://not-this-app.example.com/join/abc12")).toBeNull();
      expect(extractScannedCode("https://not-this-app.example.com/?join=abc12")).toBeNull();
    });

    test("accepts a bare code with no URL at all", () => {
      expect(extractScannedCode("abc12")).toBe("ABC12");
    });

    test("rejects garbage input", () => {
      expect(extractScannedCode("")).toBeNull();
      expect(extractScannedCode("   ")).toBeNull();
      expect(extractScannedCode("not a code at all!!")).toBeNull();
      expect(extractScannedCode(`${window.location.origin}/some/unrelated/path`)).toBeNull();
    });
  });
});
