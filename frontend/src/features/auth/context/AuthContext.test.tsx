import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const { user, loading, accessToken } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `logged-in:${user.username}:${accessToken}` : "logged-out"}</div>;
}

describe("AuthProvider — boot-time silent refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("a valid refresh cookie resolves to a logged-in user without any user action", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes("/auth/refresh")) {
        return { ok: true, status: 200, json: async () => ({ accessToken: "tok-1", expiresIn: 900 }) } as Response;
      }
      if (url.includes("/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { id: "u1", username: "Ana", email: "a@a.com", firstName: "Ana", lastName: "L" } }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("logged-in:Ana:tok-1")).toBeInTheDocument());

    // The refresh cookie travels via credentials: "include" — never a
    // manually-attached header or a token read from storage.
    const refreshCall = fetchMock.mock.calls.find(([url]) => url.includes("/auth/refresh"))!;
    expect(refreshCall[1]?.credentials).toBe("include");
    vi.unstubAllGlobals();
  });

  test("no valid session (refresh fails) resolves to logged-out, not an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "no_session" }) }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("logged-out")).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  test("login() stores the access token in memory only — never in localStorage/sessionStorage", async () => {
    localStorage.clear();
    sessionStorage.clear();
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        call++;
        if (url.includes("/auth/refresh")) return { ok: false, status: 401, json: async () => ({ error: "no_session" }) } as Response;
        if (url.includes("/auth/login")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: "u1", username: "Ana", email: "a@a.com", firstName: "Ana", lastName: "L" },
              accessToken: "tok-login",
              expiresIn: 900,
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch ${url} (${call})`);
      }),
    );

    function LoginProbe() {
      const { user, login } = useAuth();
      return (
        <div>
          <button onClick={() => login("Ana", "pw")}>go</button>
          {user && <span>{user.username}</span>}
        </div>
      );
    }

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("go")).toBeInTheDocument());
    await act(async () => {
      screen.getByText("go").click();
    });
    await waitFor(() => expect(screen.getByText("Ana")).toBeInTheDocument());

    expect(localStorage.getItem("impostorgame:playerName")).toBeNull();
    expect(Object.keys(localStorage)).not.toContain("accessToken");
    vi.unstubAllGlobals();
  });
});
