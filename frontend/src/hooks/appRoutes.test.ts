import { describe, test, expect } from "vitest";
import { parseRoute, buildPath } from "./appRoutes";

describe("appRoutes", () => {
  describe("parseRoute", () => {
    test("home", () => {
      expect(parseRoute("/")).toEqual({ gameId: null, mode: null, groupFlow: false, code: null });
    });

    test("game picked, no mode yet", () => {
      expect(parseRoute("/game/impostor")).toEqual({ gameId: "impostor", mode: null, groupFlow: false, code: null });
    });

    test("game in local mode", () => {
      expect(parseRoute("/game/impostor/local")).toEqual({ gameId: "impostor", mode: "local", groupFlow: false, code: null });
    });

    test("room without a code yet (still on the create/join form)", () => {
      expect(parseRoute("/room/impostor")).toEqual({ gameId: "impostor", mode: "multi", groupFlow: false, code: null });
    });

    test("room with a code", () => {
      expect(parseRoute("/room/impostor/ABC12")).toEqual({ gameId: "impostor", mode: "multi", groupFlow: false, code: "ABC12" });
    });

    test("group without a code yet", () => {
      expect(parseRoute("/group")).toEqual({ gameId: null, mode: "multi", groupFlow: true, code: null });
    });

    test("group with a code", () => {
      expect(parseRoute("/group/XYZ89")).toEqual({ gameId: null, mode: "multi", groupFlow: true, code: "XYZ89" });
    });

    test("an unrecognized path falls back to home", () => {
      expect(parseRoute("/something/else")).toEqual({ gameId: null, mode: null, groupFlow: false, code: null });
    });

    test("a trailing slash is treated the same as the same path without it", () => {
      expect(parseRoute("/room/impostor/ABC12/")).toEqual({ gameId: "impostor", mode: "multi", groupFlow: false, code: "ABC12" });
      expect(parseRoute("/game/impostor/local/")).toEqual({ gameId: "impostor", mode: "local", groupFlow: false, code: null });
      expect(parseRoute("/group/")).toEqual({ gameId: null, mode: "multi", groupFlow: true, code: null });
      expect(parseRoute("/")).toEqual({ gameId: null, mode: null, groupFlow: false, code: null }); // root alone stays untouched
    });
  });

  describe("buildPath", () => {
    test("home", () => {
      expect(buildPath(null, null, false, null, null)).toBe("/");
    });

    test("game picked, no mode", () => {
      expect(buildPath("impostor", null, false, null, null)).toBe("/game/impostor");
    });

    test("local mode", () => {
      expect(buildPath("impostor", "local", false, null, null)).toBe("/game/impostor/local");
    });

    test("multi mode, room not yet coded", () => {
      expect(buildPath("impostor", "multi", false, null, null)).toBe("/room/impostor");
    });

    test("multi mode, room coded", () => {
      expect(buildPath("impostor", "multi", false, "ABC12", null)).toBe("/room/impostor/ABC12");
    });

    test("group flow, not yet coded", () => {
      expect(buildPath(null, "multi", true, null, null)).toBe("/group");
    });

    test("group flow, coded", () => {
      expect(buildPath(null, "multi", true, null, "XYZ89")).toBe("/group/XYZ89");
    });

    test("group flow wins over gameId/roomCode if both are somehow set", () => {
      expect(buildPath("impostor", "multi", true, "ABC12", "XYZ89")).toBe("/group/XYZ89");
    });

    test("round-trips through parseRoute for every shape above", () => {
      const paths = ["/", "/game/impostor", "/game/impostor/local", "/room/impostor", "/room/impostor/ABC12", "/group", "/group/XYZ89"];
      for (const path of paths) {
        const parsed = parseRoute(path);
        expect(buildPath(parsed.gameId, parsed.mode, parsed.groupFlow, parsed.code, parsed.code)).toBe(path);
      }
    });

    // useAppNavigation keeps roomCode/groupCode as two independent pieces of
    // state, not one shared "code" like the generic round-trip above passes
    // to both params — a player who was in a standalone room earlier in the
    // session, then switches to the group flow, can have both populated at
    // once for real. groupFlow winning (see the test above) has to hold with
    // two actually-different codes, not just when they happen to be equal.
    test("group flow wins with independently different roomCode/groupCode still set", () => {
      expect(buildPath("impostor", "multi", true, "ABC12", "XYZ89")).toBe("/group/XYZ89");
      expect(parseRoute(buildPath("impostor", "multi", true, "ABC12", "XYZ89"))).toEqual({
        gameId: null,
        mode: "multi",
        groupFlow: true,
        code: "XYZ89",
      });
    });
  });
});
