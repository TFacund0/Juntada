import { describe, test, expect, vi } from "vitest";
import type { RoomPublicState, GroupPublicState } from "@juntada/shared-types";
import { buildRoomScreenChannels, buildGroupChannel, buildRoomChannel } from "../chatChannels";

function makeRoom(overrides: Partial<RoomPublicState> = {}): RoomPublicState {
  return {
    code: "ROOM1",
    name: "Sala",
    hostId: "p1",
    gameType: "impostor",
    groupCode: null,
    phase: "lobby",
    players: [{ id: "p1", name: "Ana", ready: false, online: true, hasVoted: false }],
    maxPlayers: 8,
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
    ...overrides,
  } as RoomPublicState;
}

function makeGroup(overrides: Partial<GroupPublicState> = {}): GroupPublicState {
  return {
    code: "GRPCD",
    name: "Grupo",
    hostId: "p1",
    members: [{ id: "p1", name: "Ana", online: true }],
    instances: [],
    chat: [],
    ...overrides,
  } as GroupPublicState;
}

describe("buildRoomScreenChannels", () => {
  test("returns only the room channel when room.groupCode is null", () => {
    const send = vi.fn();
    const channels = buildRoomScreenChannels({
      room: makeRoom({ groupCode: null }),
      group: makeGroup(),
      groupMe: { playerId: "p1" },
      me: { playerId: "p1" },
      send,
      roomTitle: "Chat de la sala",
    });
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe("room");
  });

  test("returns only the room channel when group is null even if room.groupCode is set", () => {
    const send = vi.fn();
    const channels = buildRoomScreenChannels({
      room: makeRoom({ groupCode: "GRPCD" }),
      group: null,
      groupMe: null,
      me: { playerId: "p1" },
      send,
      roomTitle: "Chat de la sala",
    });
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe("room");
  });

  test("returns group channel first, then room channel, when both are present", () => {
    const send = vi.fn();
    const channels = buildRoomScreenChannels({
      room: makeRoom({ groupCode: "GRPCD" }),
      group: makeGroup(),
      groupMe: { playerId: "p1" },
      me: { playerId: "p1" },
      send,
      roomTitle: "Chat de la sala",
    });
    expect(channels).toHaveLength(2);
    expect(channels[0].id).toBe("group");
    expect(channels[1].id).toBe("room");
  });

  test("passes roomTitle through to the room channel title (lobby value)", () => {
    const send = vi.fn();
    const channels = buildRoomScreenChannels({
      room: makeRoom(),
      group: null,
      groupMe: null,
      me: { playerId: "p1" },
      send,
      roomTitle: "Chat de la sala",
    });
    expect(channels[0].title).toBe("Chat de la sala");
  });

  test("passes roomTitle through to the room channel title (round value)", () => {
    const send = vi.fn();
    const channels = buildRoomScreenChannels({
      room: makeRoom(),
      group: null,
      groupMe: null,
      me: { playerId: "p1" },
      send,
      roomTitle: "Truco",
    });
    expect(channels[0].title).toBe("Truco");
  });

  test("maps myPlayerId from me/groupMe on the corresponding channel", () => {
    const send = vi.fn();
    const channels = buildRoomScreenChannels({
      room: makeRoom({ groupCode: "GRPCD" }),
      group: makeGroup(),
      groupMe: { playerId: "gp1" },
      me: { playerId: "rp1" },
      send,
      roomTitle: "Chat de la sala",
    });
    expect(channels[0].myPlayerId).toBe("gp1");
    expect(channels[1].myPlayerId).toBe("rp1");
  });

  test("room channel onSend emits send_room_chat with the given text", () => {
    const send = vi.fn();
    const channels = buildRoomScreenChannels({
      room: makeRoom(),
      group: null,
      groupMe: null,
      me: { playerId: "p1" },
      send,
      roomTitle: "Chat de la sala",
    });
    channels[0].onSend("hola");
    expect(send).toHaveBeenCalledWith({ type: "send_room_chat", text: "hola" });
  });

  test("group channel onSend emits send_group_chat with the given text", () => {
    const send = vi.fn();
    const channels = buildRoomScreenChannels({
      room: makeRoom({ groupCode: "GRPCD" }),
      group: makeGroup(),
      groupMe: { playerId: "gp1" },
      me: { playerId: "rp1" },
      send,
      roomTitle: "Chat de la sala",
    });
    channels[0].onSend("che");
    expect(send).toHaveBeenCalledWith({ type: "send_group_chat", text: "che" });
  });
});

describe("buildGroupChannel / buildRoomChannel (moved verbatim)", () => {
  test("buildGroupChannel builds the expected shape", () => {
    const send = vi.fn();
    const channel = buildGroupChannel(makeGroup(), { playerId: "p1" }, send);
    expect(channel.id).toBe("group");
    expect(channel.title).toBe("Chat del grupo");
  });

  test("buildRoomChannel builds the expected shape", () => {
    const send = vi.fn();
    const channel = buildRoomChannel(makeRoom(), "Chat de la sala", { playerId: "p1" }, send);
    expect(channel.id).toBe("room");
    expect(channel.title).toBe("Chat de la sala");
  });
});
