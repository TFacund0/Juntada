import { createRef } from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppOverlays } from "../AppOverlays";
import type { GameTheme } from "../../../theme/gameThemes";

function renderAppOverlays(overrides: Partial<React.ComponentProps<typeof AppOverlays>> = {}) {
  const props: React.ComponentProps<typeof AppOverlays> = {
    curtain: "none",
    activeTheme: null,
    accentColor: "#7F77DD",
    showWelcome: false,
    playerName: "Tobi",
    dismissWelcome: vi.fn(),
    kickedNotice: null,
    dismissKickedNotice: vi.fn(),
    showBackConfirm: false,
    isOnlineRoom: false,
    confirmGoBack: vi.fn(),
    setShowBackConfirm: vi.fn(),
    showLocalResetConfirm: false,
    setShowLocalResetConfirm: vi.fn(),
    localGameResetRef: createRef<() => void>(),
    showExitConfirm: false,
    groupAttached: false,
    goHome: vi.fn(),
    setShowExitConfirm: vi.fn(),
    showReturnToGroupConfirm: false,
    setShowReturnToGroupConfirm: vi.fn(),
    returnToGroupRef: createRef<() => void>(),
    ...overrides,
  };

  return render(<AppOverlays {...props} />);
}

describe("AppOverlays", () => {
  test("always renders the backdrop curtain when curtain is active", () => {
    const { container } = renderAppOverlays({ curtain: "in" });
    expect(container.querySelector(".app-curtain.in")).not.toBeNull();
  });

  test("renders the theme backdrop emoji when activeTheme has one", () => {
    const activeTheme = { backdropEmoji: "🎲" } as unknown as GameTheme;
    renderAppOverlays({ activeTheme });
    expect(screen.getByText("🎲")).toBeTruthy();
  });

  test("showWelcome=false hides the welcome dialog", () => {
    renderAppOverlays({ showWelcome: false });
    expect(screen.queryByText(/¡Bienvenido\/a,/)).toBeNull();
  });

  test("showWelcome=true shows the welcome dialog with the player's name", () => {
    renderAppOverlays({ showWelcome: true, playerName: "Tobi" });
    expect(screen.getByText("¡Bienvenido/a, Tobi!")).toBeTruthy();
  });

  test("kickedNotice=null hides the kicked dialog", () => {
    renderAppOverlays({ kickedNotice: null });
    expect(screen.queryByText("Expulsado")).toBeNull();
  });

  test("kickedNotice set shows the kicked dialog with its message", () => {
    renderAppOverlays({ kickedNotice: "Fuiste expulsado del grupo" });
    expect(screen.getByText("Expulsado")).toBeTruthy();
    expect(screen.getByText("Fuiste expulsado del grupo")).toBeTruthy();
  });

  test("dismissing the kicked dialog calls dismissKickedNotice", () => {
    const dismissKickedNotice = vi.fn();
    renderAppOverlays({ kickedNotice: "Fuiste expulsado del grupo", dismissKickedNotice });
    fireEvent.click(screen.getByText("Entendido"));
    expect(dismissKickedNotice).toHaveBeenCalledTimes(1);
  });

  test("showBackConfirm=true shows the back confirm dialog", () => {
    renderAppOverlays({ showBackConfirm: true });
    expect(screen.getByText("¿Volver atrás?")).toBeTruthy();
  });

  test("showBackConfirm=false hides the back confirm dialog", () => {
    renderAppOverlays({ showBackConfirm: false });
    expect(screen.queryByText("¿Volver atrás?")).toBeNull();
  });

  test("confirming the back dialog calls confirmGoBack", () => {
    const confirmGoBack = vi.fn();
    renderAppOverlays({ showBackConfirm: true, confirmGoBack });
    fireEvent.click(screen.getByText("Sí, volver"));
    expect(confirmGoBack).toHaveBeenCalledTimes(1);
  });

  test("cancelling the back dialog calls setShowBackConfirm(false)", () => {
    const setShowBackConfirm = vi.fn();
    renderAppOverlays({ showBackConfirm: true, setShowBackConfirm });
    fireEvent.click(screen.getByText("Seguir jugando"));
    expect(setShowBackConfirm).toHaveBeenCalledWith(false);
  });

  test("back dialog warns about losing local progress when isOnlineRoom is false", () => {
    renderAppOverlays({ showBackConfirm: true, isOnlineRoom: false });
    expect(screen.getByText(/Vas a salir del juego actual y perder el progreso/)).toBeTruthy();
  });

  test("back dialog says the rest can keep playing when isOnlineRoom is true", () => {
    renderAppOverlays({ showBackConfirm: true, isOnlineRoom: true });
    expect(screen.getByText(/El resto puede seguir jugando sin vos/)).toBeTruthy();
  });

  test("showLocalResetConfirm=true shows the local reset confirm dialog", () => {
    renderAppOverlays({ showLocalResetConfirm: true });
    expect(screen.getByText("¿Volver a jugadores?")).toBeTruthy();
  });

  test("showLocalResetConfirm=false hides the local reset confirm dialog", () => {
    renderAppOverlays({ showLocalResetConfirm: false });
    expect(screen.queryByText("¿Volver a jugadores?")).toBeNull();
  });

  test("confirming the local reset dialog hides it and invokes localGameResetRef", () => {
    const setShowLocalResetConfirm = vi.fn();
    const localGameResetRef = { current: vi.fn() };
    renderAppOverlays({ showLocalResetConfirm: true, setShowLocalResetConfirm, localGameResetRef });
    fireEvent.click(screen.getByText("Sí, volver"));
    expect(setShowLocalResetConfirm).toHaveBeenCalledWith(false);
    expect(localGameResetRef.current).toHaveBeenCalledTimes(1);
  });

  test("cancelling the local reset dialog calls setShowLocalResetConfirm(false)", () => {
    const setShowLocalResetConfirm = vi.fn();
    renderAppOverlays({ showLocalResetConfirm: true, setShowLocalResetConfirm });
    fireEvent.click(screen.getByText("Seguir jugando"));
    expect(setShowLocalResetConfirm).toHaveBeenCalledWith(false);
  });

  test("showExitConfirm=true shows the exit confirm dialog", () => {
    renderAppOverlays({ showExitConfirm: true });
    expect(screen.getByText("¿Volver al menú principal?")).toBeTruthy();
  });

  test("showExitConfirm=false hides the exit confirm dialog", () => {
    renderAppOverlays({ showExitConfirm: false });
    expect(screen.queryByText("¿Volver al menú principal?")).toBeNull();
  });

  test("confirming the exit dialog calls goHome", () => {
    const goHome = vi.fn();
    renderAppOverlays({ showExitConfirm: true, goHome });
    fireEvent.click(screen.getByText("Sí, salir"));
    expect(goHome).toHaveBeenCalledTimes(1);
  });

  test("cancelling the exit dialog calls setShowExitConfirm(false)", () => {
    const setShowExitConfirm = vi.fn();
    renderAppOverlays({ showExitConfirm: true, setShowExitConfirm });
    fireEvent.click(screen.getByText("Seguir jugando"));
    expect(setShowExitConfirm).toHaveBeenCalledWith(false);
  });

  test("showReturnToGroupConfirm=true shows the return-to-group confirm dialog", () => {
    renderAppOverlays({ showReturnToGroupConfirm: true });
    expect(screen.getByText("¿Volver al grupo?")).toBeTruthy();
  });

  test("showReturnToGroupConfirm=false renders no confirm dialogs at all", () => {
    const { container } = renderAppOverlays({ showReturnToGroupConfirm: false });
    expect(container.querySelectorAll(".jt-dialog-overlay").length).toBe(0);
  });

  test("confirming the return-to-group dialog hides it and invokes returnToGroupRef", () => {
    const setShowReturnToGroupConfirm = vi.fn();
    const returnToGroupRef = { current: vi.fn() };
    renderAppOverlays({
      showReturnToGroupConfirm: true,
      setShowReturnToGroupConfirm,
      returnToGroupRef,
    });
    fireEvent.click(screen.getByText("Sí, volver"));
    expect(setShowReturnToGroupConfirm).toHaveBeenCalledWith(false);
    expect(returnToGroupRef.current).toHaveBeenCalledTimes(1);
  });

  test("cancelling the return-to-group dialog calls setShowReturnToGroupConfirm(false)", () => {
    const setShowReturnToGroupConfirm = vi.fn();
    renderAppOverlays({ showReturnToGroupConfirm: true, setShowReturnToGroupConfirm });
    fireEvent.click(screen.getByText("Cancelar"));
    expect(setShowReturnToGroupConfirm).toHaveBeenCalledWith(false);
  });
});
