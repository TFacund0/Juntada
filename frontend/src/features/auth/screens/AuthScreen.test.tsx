import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../context/AuthContext";
import { AuthScreen } from "./AuthScreen";

function renderAuthScreen() {
  return render(
    <AuthProvider>
      <AuthScreen />
    </AuthProvider>,
  );
}

describe("AuthScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("login form shows the backend's invalid_credentials error inline", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/auth/refresh")) return { ok: false, status: 401, json: async () => ({ error: "no_session" }) } as Response;
        if (url.includes("/auth/login"))
          return { ok: false, status: 401, json: async () => ({ error: "invalid_credentials" }) } as Response;
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    renderAuthScreen();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument());

    await user.type(screen.getByRole("textbox"), "ana");
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    await user.type(passwordInput, "wrongpass");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByText("Usuario/email o contraseña incorrectos.")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  test("register form shows the backend's username_taken error inline and never submits without matching passwords", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/auth/refresh")) return { ok: false, status: 401, json: async () => ({ error: "no_session" }) } as Response;
      if (url.includes("/auth/register")) return { ok: false, status: 409, json: async () => ({ error: "username_taken" }) } as Response;
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAuthScreen();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Crear cuenta" })[0]).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Crear cuenta" })[0]);

    const textInputs = screen.getAllByRole("textbox");
    // Usuario, Email, Nombre, Apellido — in DOM order per RegisterForm.
    await user.type(textInputs[0], "ana123");
    await user.type(textInputs[1], "ana@example.com");
    await user.type(textInputs[2], "Ana");
    await user.type(textInputs[3], "Lopez");
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0] as HTMLInputElement, "supersecret");
    await user.type(passwordInputs[1] as HTMLInputElement, "different");

    const submitBtn = screen.getAllByRole("button", { name: "Crear cuenta" })[1];
    // Mismatched confirm-password keeps the submit disabled — register()
    // must never be called with unconfirmed passwords.
    expect(submitBtn).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/auth/register"), expect.anything());

    await user.clear(passwordInputs[1] as HTMLInputElement);
    await user.type(passwordInputs[1] as HTMLInputElement, "supersecret");
    await user.click(screen.getAllByRole("button", { name: "Crear cuenta" })[1]);

    expect(await screen.findByText("Ese nombre de usuario ya está en uso.")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
