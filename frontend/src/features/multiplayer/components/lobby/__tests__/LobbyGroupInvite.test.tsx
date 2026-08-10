import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LobbyGroupInvite } from "../LobbyGroupInvite";

describe("LobbyGroupInvite", () => {
  test("shows the group code with the GRUPO label", () => {
    render(<LobbyGroupInvite groupCode="GRP789" showQR={false} onShowQR={() => {}} showShareLink={false} onShowShareLink={() => {}} />);
    expect(screen.getByTestId("code-display")).toHaveTextContent("GRP789");
    expect(screen.getByText((_, element) => element?.textContent === "CÓDIGO DE GRUPO")).toBeInTheDocument();
  });

  test("shows the QR dialog with the group join subtitle/url when showQR is true", () => {
    render(<LobbyGroupInvite groupCode="GRP789" showQR={true} onShowQR={() => {}} showShareLink={false} onShowShareLink={() => {}} />);
    expect(screen.getByText("Escaneá para unirte al grupo")).toBeInTheDocument();
    expect(screen.getByText("Grupo GRP789")).toBeInTheDocument();
  });

  test("shows the share-link dialog with the group join url when showShareLink is true", () => {
    render(<LobbyGroupInvite groupCode="GRP789" showQR={false} onShowQR={() => {}} showShareLink={true} onShowShareLink={() => {}} />);
    expect(screen.getByText("Compartir enlace de invitación")).toBeInTheDocument();
    expect(screen.getByText(/\/join\/GRP789\?kind=group/)).toBeInTheDocument();
  });

  test("clicking the QR/share buttons calls the corresponding callbacks", () => {
    const onShowQR = vi.fn();
    const onShowShareLink = vi.fn();
    render(
      <LobbyGroupInvite groupCode="GRP789" showQR={false} onShowQR={onShowQR} showShareLink={false} onShowShareLink={onShowShareLink} />,
    );
    screen.getByText(/Ver QR/).click();
    expect(onShowQR).toHaveBeenCalledWith(true);
    screen.getByText(/Compartir enlace/).click();
    expect(onShowShareLink).toHaveBeenCalledWith(true);
  });
});
