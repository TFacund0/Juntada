import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LobbyRoomInvite } from "../LobbyRoomInvite";
import type { RoomPublicState } from "@juntada/shared-types";

function makeRoom(overrides: Partial<RoomPublicState> = {}): RoomPublicState {
  return {
    code: "ABC123",
    name: "Sala de prueba",
    gameType: "impostor",
    groupCode: null,
    hostId: "p1",
    maxPlayers: 8,
    players: [],
    ...overrides,
  } as RoomPublicState;
}

describe("LobbyRoomInvite", () => {
  test("shows the room code (hidden by default, revealed after tapping the eye icon), not a group label", () => {
    render(
      <LobbyRoomInvite
        room={makeRoom()}
        activeGameLabel="Impostor"
        showQR={false}
        onShowQR={() => {}}
        showShareLink={false}
        onShowShareLink={() => {}}
      />,
    );
    expect(screen.getByTestId("code-display")).not.toHaveTextContent("ABC123");
    screen.getByLabelText("Mostrar código").click();
    expect(screen.getByTestId("code-display")).toHaveTextContent("ABC123");
  });

  test("shows the QR dialog with the room join subtitle/url when showQR is true", () => {
    render(
      <LobbyRoomInvite
        room={makeRoom()}
        activeGameLabel="Impostor"
        showQR={true}
        onShowQR={() => {}}
        showShareLink={false}
        onShowShareLink={() => {}}
      />,
    );
    expect(screen.getByText("Escaneá para unirte")).toBeInTheDocument();
    expect(screen.getByText(/Sala de prueba · Sala ABC123 · Impostor/)).toBeInTheDocument();
  });

  test("shows the share-link dialog with the room join url when showShareLink is true", () => {
    render(
      <LobbyRoomInvite
        room={makeRoom()}
        activeGameLabel="Impostor"
        showQR={false}
        onShowQR={() => {}}
        showShareLink={true}
        onShowShareLink={() => {}}
      />,
    );
    expect(screen.getByText("Compartir enlace de invitación")).toBeInTheDocument();
    expect(screen.getByText(/\/join\/ABC123\?game=impostor/)).toBeInTheDocument();
  });

  test("clicking the QR/share buttons calls the corresponding callbacks", () => {
    const onShowQR = vi.fn();
    const onShowShareLink = vi.fn();
    render(
      <LobbyRoomInvite
        room={makeRoom()}
        activeGameLabel="Impostor"
        showQR={false}
        onShowQR={onShowQR}
        showShareLink={false}
        onShowShareLink={onShowShareLink}
      />,
    );
    screen.getByText(/Ver QR/).click();
    expect(onShowQR).toHaveBeenCalledWith(true);
    screen.getByText(/Compartir enlace/).click();
    expect(onShowShareLink).toHaveBeenCalledWith(true);
  });
});
