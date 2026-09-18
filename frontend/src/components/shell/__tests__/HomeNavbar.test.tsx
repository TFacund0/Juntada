import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef, type ReactElement } from "react";
import { HomeNavbar } from "../HomeNavbar";
import { AuthProvider } from "../../../features/auth/context/AuthContext";

// ProfilePanel (rendered when showProfileMenu is true) reads useAuth() —
// stub fetch so AuthProvider's boot-time silent refresh resolves to
// "no session" instead of leaving a dangling network call in these tests.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "no_session" }) }));
});

function renderWithAuth(ui: ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

const baseProps = {
  mutedColor: "#999",
  playerName: "Ana",
  onSavePlayerName: () => {},
  showProfileMenu: false,
  onToggleProfileMenu: () => {},
  profileMenuRef: createRef<HTMLDivElement>(),
  onStartGroupFlow: vi.fn(),
};

describe("HomeNavbar", () => {
  test("renders the greeting with the player name", () => {
    renderWithAuth(<HomeNavbar {...baseProps} />);
    expect(screen.getByText("Hola, Ana")).toBeTruthy();
  });

  test('calls onStartGroupFlow("join") when "Unirme" is clicked', () => {
    const onStartGroupFlow = vi.fn();
    renderWithAuth(<HomeNavbar {...baseProps} onStartGroupFlow={onStartGroupFlow} />);
    fireEvent.click(screen.getByText("Unirme"));
    expect(onStartGroupFlow).toHaveBeenCalledWith("join");
  });

  test('calls onStartGroupFlow("create") when "Crear grupo" is clicked', () => {
    const onStartGroupFlow = vi.fn();
    renderWithAuth(<HomeNavbar {...baseProps} onStartGroupFlow={onStartGroupFlow} />);
    fireEvent.click(screen.getByText("Crear grupo"));
    expect(onStartGroupFlow).toHaveBeenCalledWith("create");
  });

  test("does not show ProfilePanel when showProfileMenu is false", () => {
    const { container } = renderWithAuth(<HomeNavbar {...baseProps} showProfileMenu={false} />);
    expect(container.querySelector(".jt-profile-trigger")).not.toBeNull();
    expect(screen.queryByText("Guardar")).toBeNull();
  });

  test("shows ProfilePanel when showProfileMenu is true", () => {
    renderWithAuth(<HomeNavbar {...baseProps} showProfileMenu={true} />);
    expect(screen.getByText("Guardar")).toBeTruthy();
  });
});
