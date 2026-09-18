import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomPublicState, GroupPublicState, PublicPlayer } from "@juntada/shared-types";
import type { RoomSession, GroupSession } from "../../services/multiplayerSession";
import type { MultiplayerGameProps } from "../../MultiplayerGame";
import { getGame } from "../../../../games/registry";
import { useMultiplayerGameShell } from "../useMultiplayerGameShell";

// Single mock boundary per spec — every other collaborator hook runs for real.
const h = vi.hoisted(() => ({ socket: null as any }));
vi.mock("../useMultiplayerSocket", () => ({
  useMultiplayerSocket: () => h.socket,
}));

function makeSocket(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    connectionPhase: "menu",
    setConnectionPhase: vi.fn(),
    me: null,
    room: null,
    groupMe: null,
    group: null,
    myRole: null,
    wordReveal: null,
    roomPreview: null,
    setRoomPreview: vi.fn(),
    error: "",
    errorKey: 0,
    setError: vi.fn(),
    reconnecting: false,
    reconnectAttempt: 0,
    reconnectFailed: false,
    justReconnected: false,
    overlayMode: "none",
    confirmRejoin: false,
    maxReconnectAttempts: 5,
    connect: vi.fn(),
    retryConnection: vi.fn(),
    send: vi.fn(),
    leave: vi.fn(),
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return { id: "p1", accountId: "p1", name: "Ana", ready: false, online: true, hasVoted: false, ...overrides };
}

function makeRoom(overrides: Partial<RoomPublicState> = {}): RoomPublicState {
  return {
    code: "ROOM1",
    name: "Sala",
    hostId: "p1",
    gameType: "impostor",
    groupCode: null,
    phase: "lobby",
    players: [makePlayer()],
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
    members: [],
    instances: [],
    chat: [],
    ...overrides,
  } as GroupPublicState;
}

function makeMe(overrides: Partial<RoomSession> = {}): RoomSession {
  return { playerId: "p1", roomCode: "ROOM1", ...overrides };
}

function makeGroupMe(overrides: Partial<GroupSession> = {}): GroupSession {
  return { playerId: "p1", groupCode: "GRPCD", ...overrides };
}

function setup(overrides: Partial<MultiplayerGameProps> = {}) {
  const ws = { send: vi.fn() };
  h.socket.connect = vi.fn((onOpen?: (ws: { send: ReturnType<typeof vi.fn> }) => void) => onOpen?.(ws));

  const props: MultiplayerGameProps = {
    entryKind: "room",
    gameId: "impostor",
    playerName: "Ana",
    onChangeName: vi.fn(),
    onGameTypeChange: vi.fn(),
    onRoomPhaseChange: vi.fn(),
    onRoomCodeChange: vi.fn(),
    onGroupCodeChange: vi.fn(),
    onLeaveGroup: vi.fn(),
    onGroupAttachedChange: vi.fn(),
    onExposeReturnToGroup: vi.fn(),
    onTransitionSettled: vi.fn(),
    ...overrides,
  } as MultiplayerGameProps;

  const { result, rerender } = renderHook((p: MultiplayerGameProps) => useMultiplayerGameShell(p), {
    initialProps: props,
  });

  return { result, rerender, ws, socket: h.socket, props };
}

describe("useMultiplayerGameShell", () => {
  beforeEach(() => {
    h.socket = makeSocket();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createRoom", () => {
    test("room entry sends create_room with selectedGame label and gameType", () => {
      const { result, ws } = setup({ entryKind: "room", gameId: "impostor" });

      act(() => result.current.createRoom());

      const payload = JSON.parse(ws.send.mock.calls[0][0]);
      expect(payload).toEqual({
        type: "create_room",
        playerName: "Ana",
        roomName: getGame("impostor")?.label,
        gameType: "impostor",
      });
    });

    test("group entry sends create_group with trimmed roomName as groupName, undefined when blank", () => {
      const { result, ws } = setup({ entryKind: "group" });

      // Blank roomName (default state) -> groupName undefined. This is the
      // discriminating counter-case against the "always includes groupName"
      // mutation: if the `.trim() || undefined` guard were removed, this
      // assertion would fail with groupName: "".
      act(() => result.current.createRoom());
      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: "create_group",
        playerName: "Ana",
        groupName: undefined,
      });

      act(() => result.current.setRoomName("  Mi Grupo  "));
      act(() => result.current.createRoom());
      expect(JSON.parse(ws.send.mock.calls[1][0])).toEqual({
        type: "create_group",
        playerName: "Ana",
        groupName: "Mi Grupo",
      });
    });

    test("armSubmitTimeout surfaces a mode-specific error after 8s with no server response", () => {
      const { result, socket } = setup({ entryKind: "group" });

      act(() => result.current.createRoom());
      act(() => vi.advanceTimersByTime(8000));

      expect(socket.setError).toHaveBeenCalledWith("No se pudo crear el grupo — probá de nuevo");
    });

    test("room entry's timeout message differs from group entry's (discriminating case)", () => {
      const { result, socket } = setup({ entryKind: "room" });

      act(() => result.current.createRoom());
      act(() => vi.advanceTimersByTime(8000));

      expect(socket.setError).toHaveBeenCalledWith("No se pudo crear la partida — probá de nuevo");
    });
  });

  describe("joinRoom", () => {
    test("blank code sets an error and never opens a connection", () => {
      const { result, socket } = setup({ entryKind: "room" });

      act(() => result.current.joinRoom());

      expect(socket.setError).toHaveBeenCalledWith("Ingresá el código");
      expect(socket.connect).not.toHaveBeenCalled();
    });

    test("non-blank code (room) sends join_room with uppercased trimmed code", () => {
      const { result, ws } = setup({ entryKind: "room" });

      act(() => result.current.setJoinCode(" abcde "));
      act(() => result.current.joinRoom());

      // calls[0] is the live-preview effect's own check_room_code (fired as
      // soon as joinCode reaches 5 trimmed chars); joinRoom's own send is
      // the next one.
      const payload = JSON.parse(ws.send.mock.calls[1][0]);
      expect(payload).toEqual({ type: "join_room", code: "ABCDE", playerName: "Ana" });
    });

    test("non-blank code (group) sends join_group instead of join_room (discriminating case)", () => {
      const { result, ws } = setup({ entryKind: "group" });

      act(() => result.current.setJoinCode("abcde"));
      act(() => result.current.joinRoom());

      // entryKind "group" skips the live-preview effect entirely, so
      // joinRoom's send is the only one.
      const payload = JSON.parse(ws.send.mock.calls[0][0]);
      expect(payload).toEqual({ type: "join_group", code: "ABCDE", playerName: "Ana" });
    });
  });

  describe("updateConfig", () => {
    test("is a no-op when there is no active room", () => {
      const { result, socket } = setup();

      act(() => result.current.updateConfig({ foo: "bar" }));

      expect(socket.send).not.toHaveBeenCalled();
    });

    test("sends update_config when a room is present (discriminating case)", () => {
      const { result, rerender, socket, props } = setup();
      socket.room = makeRoom();
      rerender(props);

      act(() => result.current.updateConfig({ foo: "bar" }));

      expect(socket.send).toHaveBeenCalledWith({ type: "update_config", config: { foo: "bar" } });
    });
  });

  describe("mount-only auto-join effect", () => {
    test("initialJoinCode set: connects and sets connectionPhase to join, guarded against re-fire", () => {
      const { ws, socket, rerender, props } = setup({ initialJoinCode: "abcde", entryKind: "room" });

      expect(socket.setConnectionPhase).toHaveBeenCalledWith("join");
      const payload = JSON.parse(ws.send.mock.calls[0][0]);
      expect(payload).toEqual({ type: "join_room", code: "ABCDE", playerName: "Ana" });
      expect(socket.connect).toHaveBeenCalledTimes(1);

      // Unrelated rerender (mount-only guard, autoJoiningRef): must not re-fire.
      rerender({ ...props, playerName: "Ana" });
      expect(socket.connect).toHaveBeenCalledTimes(1);
    });

    test("initialGroupIntent set: sets connectionPhase to the intent, no connect", () => {
      const { socket } = setup({ initialGroupIntent: "create", entryKind: "group" });

      expect(socket.setConnectionPhase).toHaveBeenCalledWith("create");
      expect(socket.connect).not.toHaveBeenCalled();
    });

    test("neither set: no auto-join side effect at all (discriminating counter-case)", () => {
      const { socket } = setup({ entryKind: "room" });

      expect(socket.setConnectionPhase).not.toHaveBeenCalled();
      expect(socket.connect).not.toHaveBeenCalled();
    });
  });

  describe("live-preview effect", () => {
    test("stays gated below 5 characters, fires check_room_code at exactly 5", () => {
      const { result, ws, socket } = setup({ entryKind: "room" });
      socket.setRoomPreview.mockClear();

      act(() => result.current.setJoinCode("abcd"));
      expect(socket.setRoomPreview).toHaveBeenCalledWith(null);
      expect(socket.connect).not.toHaveBeenCalled();

      act(() => result.current.setJoinCode("abcde"));
      const payload = JSON.parse(ws.send.mock.calls[0][0]);
      expect(payload).toEqual({ type: "check_room_code", code: "ABCDE" });
    });

    test("entryKind group skips the preview even at 5 characters (discriminating case)", () => {
      const { result, socket } = setup({ entryKind: "group" });

      act(() => result.current.setJoinCode("abcde"));

      expect(socket.connect).not.toHaveBeenCalled();
    });

    test("auto-joining in progress (initialJoinCode) suppresses the duplicate preview connect", () => {
      const { socket } = setup({ initialJoinCode: "abcde", entryKind: "room" });

      // Only the mount auto-join's own connect call, not a second one from
      // the live-preview effect racing on the same 5-char joinCode.
      expect(socket.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('"ya está en uso" recovery effect', () => {
    test("matching error opens name editing and settles the curtain", () => {
      const onTransitionSettled = vi.fn();
      const { socket, rerender, props } = setup({ onTransitionSettled });

      socket.error = "Ese nombre ya está en uso";
      rerender(props);

      expect(onTransitionSettled).toHaveBeenCalled();
    });

    test("non-matching error settles the curtain but does not open name editing (discriminating case)", () => {
      const onTransitionSettled = vi.fn();
      const { result, socket, rerender, props } = setup({ onTransitionSettled });

      socket.error = "La sala está llena";
      rerender(props);

      expect(onTransitionSettled).toHaveBeenCalled();
      expect(result.current.editingName).toBe(false);
    });

    test("matching error actually flips editingName to true (positive assertion, paired with the case above)", () => {
      const { result, socket, rerender, props } = setup();

      socket.error = "Ese nombre ya está en uso";
      rerender(props);

      expect(result.current.editingName).toBe(true);
    });
  });

  describe("justEnteredRound", () => {
    test("lobby -> round edge is detected true, then falls back to false on the next render", () => {
      const { result, socket, rerender, props } = setup();
      socket.connectionPhase = "lobby";
      rerender(props);
      expect(result.current.justEnteredRound).toBe(false);

      socket.connectionPhase = "round";
      rerender(props);
      expect(result.current.justEnteredRound).toBe(true);

      rerender(props);
      expect(result.current.justEnteredRound).toBe(false);
    });

    test("menu -> round is not treated as entering a round (discriminating counter-case)", () => {
      const { result, socket, rerender, props } = setup();
      socket.connectionPhase = "menu";
      rerender(props);

      socket.connectionPhase = "round";
      rerender(props);

      expect(result.current.justEnteredRound).toBe(false);
    });
  });

  describe("leaveInstance exposure effect", () => {
    test("exposes a callable leaveInstance function that sends leave_instance", () => {
      const onExposeReturnToGroup = vi.fn();
      setup({ onExposeReturnToGroup });

      expect(onExposeReturnToGroup).toHaveBeenCalledTimes(1);
      const exposedFn = onExposeReturnToGroup.mock.calls[0][0];
      expect(typeof exposedFn).toBe("function");

      act(() => exposedFn());

      expect(h.socket.send).toHaveBeenCalledWith({ type: "leave_instance" });
    });
  });

  describe("saveName + derived reconnectContext/rejoinHostName", () => {
    test("saveName forwards the new name and clears the error", () => {
      const onChangeName = vi.fn();
      const { result, socket } = setup({ onChangeName });

      act(() => result.current.saveName("Beto"));

      expect(onChangeName).toHaveBeenCalledWith("Beto");
      expect(socket.setError).toHaveBeenCalledWith("");
    });

    test("reconnectContext is 'grupo' when groupMe is set", () => {
      const { result, socket, rerender, props } = setup();
      socket.groupMe = makeGroupMe();
      rerender(props);

      expect(result.current.reconnectContext).toBe("grupo");
    });

    test("reconnectContext is 'sala' when groupMe is absent (discriminating case)", () => {
      const { result } = setup();

      expect(result.current.reconnectContext).toBe("sala");
    });

    test("rejoinHostName resolves the host player's name when a room is present", () => {
      const { result, socket, rerender, props } = setup();
      socket.room = makeRoom({
        hostId: "p1",
        players: [makePlayer({ id: "p1", accountId: "p1", name: "Carla" }), makePlayer({ id: "p2", accountId: "p2", name: "Dani" })],
      });
      rerender(props);

      expect(result.current.rejoinHostName).toBe("Carla");
    });

    test("rejoinHostName is undefined without a room (discriminating case)", () => {
      const { result } = setup();

      expect(result.current.rejoinHostName).toBeUndefined();
    });
  });
});
