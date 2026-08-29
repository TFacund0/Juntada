import type { GroupPublicState, RoomPublicState } from "@juntada/shared-types";
import type { ChatChannel } from "../components/FloatingChat";

// Shared by the group/lobby/round FloatingChat subtitles below — kept as one
// spot instead of repeating the singular/plural ternary at each call site.
export function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

// The two chat channels FloatingChat can show — built here (not inside
// MultiplayerGame) since neither needs anything from render scope beyond its
// own arguments, and keeping them free functions makes the "what goes into a
// channel" logic testable/reusable independent of where each is mounted
// (group screen has only one; lobby/round can have both at once).
export function buildGroupChannel(
  group: GroupPublicState,
  groupMe: { playerId: string } | null,
  send: (msg: Record<string, unknown>) => void,
): ChatChannel {
  return {
    id: "group",
    tabLabel: "Grupo",
    title: "Chat del grupo",
    subtitle: `${group.name} · ${countLabel(group.members.length, "persona", "personas")}`,
    accent: "group",
    messages: group.chat,
    myPlayerId: groupMe?.playerId,
    onSend: text => send({ type: "send_group_chat", text }),
  };
}

export function buildRoomChannel(
  room: RoomPublicState,
  roomTitle: string,
  me: { playerId: string } | null,
  send: (msg: Record<string, unknown>) => void,
): ChatChannel {
  return {
    id: "room",
    tabLabel: "Sala",
    title: roomTitle,
    subtitle: `${room.name} · ${countLabel(room.players.length, "jugador", "jugadores")}`,
    accent: "room",
    messages: room.chat,
    myPlayerId: me?.playerId,
    onSend: text => send({ type: "send_room_chat", text }),
    quickReactions: true,
  };
}

interface RoomScreenChannelsArgs {
  room: RoomPublicState;
  group: GroupPublicState | null;
  groupMe: { playerId: string } | null;
  me: { playerId: string } | null;
  send: (msg: Record<string, unknown>) => void;
  roomTitle: string;
}

/**
 * The FloatingChat channels array previously duplicated verbatim at the
 * lobby and round call sites in MultiplayerGame.tsx — group channel first
 * (when the room belongs to a group) followed by the room channel.
 */
export function buildRoomScreenChannels({ room, group, groupMe, me, send, roomTitle }: RoomScreenChannelsArgs): ChatChannel[] {
  return [...(room.groupCode && group ? [buildGroupChannel(group, groupMe, send)] : []), buildRoomChannel(room, roomTitle, me, send)];
}
