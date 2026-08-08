import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { HomeNavbar } from "../HomeNavbar";

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
    render(<HomeNavbar {...baseProps} />);
    expect(screen.getByText("Hola, Ana")).toBeTruthy();
  });

  test('calls onStartGroupFlow("join") when "Unirme" is clicked', () => {
    const onStartGroupFlow = vi.fn();
    render(<HomeNavbar {...baseProps} onStartGroupFlow={onStartGroupFlow} />);
    fireEvent.click(screen.getByText("Unirme"));
    expect(onStartGroupFlow).toHaveBeenCalledWith("join");
  });

  test('calls onStartGroupFlow("create") when "Crear grupo" is clicked', () => {
    const onStartGroupFlow = vi.fn();
    render(<HomeNavbar {...baseProps} onStartGroupFlow={onStartGroupFlow} />);
    fireEvent.click(screen.getByText("Crear grupo"));
    expect(onStartGroupFlow).toHaveBeenCalledWith("create");
  });

  test("does not show ProfilePanel when showProfileMenu is false", () => {
    const { container } = render(<HomeNavbar {...baseProps} showProfileMenu={false} />);
    expect(container.querySelector(".jt-profile-trigger")).not.toBeNull();
    expect(screen.queryByText("Guardar")).toBeNull();
  });

  test("shows ProfilePanel when showProfileMenu is true", () => {
    render(<HomeNavbar {...baseProps} showProfileMenu={true} />);
    expect(screen.getByText("Guardar")).toBeTruthy();
  });
});
