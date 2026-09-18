import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as authApi from "../api/authApi";
import type { SelfUser } from "../api/authApi";

// The access token lives ONLY in memory (this ref + mirrored React state) —
// never localStorage, never sessionStorage (design.md "Token transport": XSS
// readability is the reason). The refresh token is a browser-managed httpOnly
// cookie we never touch directly. `accessTokenRef` exists so a non-React
// consumer (multiplayerSocketService.ts, via getAccessToken()) always reads
// the latest token without re-subscribing to context on every refresh.
let accessTokenRef: { current: string | null } = { current: null };

// Exposed for the WS layer (see services/multiplayerSocketService.ts) — kept
// outside React so the socket service (a plain factory, not a hook) can read
// the current token without a context subscription.
export function getAccessToken(): string | null {
  return accessTokenRef.current;
}

interface AuthContextValue {
  user: SelfUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: authApi.RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: authApi.UpdateProfilePayload) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SelfUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  // Boot: try a silent refresh (the httpOnly cookie travels automatically).
  // Success means a valid session persisted across a reload — fetch the
  // profile and consider the user authenticated. Any failure (no cookie,
  // expired, revoked) just means AuthScreen shows instead; this is expected,
  // not an error to surface to the player.
  useEffect(() => {
    (async () => {
      try {
        const { accessToken: token } = await authApi.refresh();
        const { user: self } = await authApi.getMe(token);
        if (!mountedRef.current) return;
        setAccessToken(token);
        setUser(self);
      } catch {
        // no valid session — stay logged out
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [setAccessToken]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { user: self, accessToken: token } = await authApi.login(identifier, password);
      setAccessToken(token);
      setUser(self);
    },
    [setAccessToken],
  );

  const register = useCallback(
    async (payload: authApi.RegisterPayload) => {
      const { user: self, accessToken: token } = await authApi.register(payload);
      setAccessToken(token);
      setUser(self);
    },
    [setAccessToken],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, [setAccessToken]);

  const updateProfile = useCallback(async (payload: authApi.UpdateProfilePayload): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!accessTokenRef.current) return { ok: false, error: "not_authenticated" };
    try {
      const { user: self } = await authApi.updateMe(accessTokenRef.current, payload);
      setUser(self);
      return { ok: true };
    } catch (err) {
      if (err instanceof authApi.AuthApiError) return { ok: false, error: err.code };
      return { ok: false, error: "unknown_error" };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout, updateProfile }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Test-only escape hatch to reset the module-level token ref between tests
// (React state resets naturally on remount, but the plain module variable
// does not).
export function __resetAccessTokenForTests(): void {
  accessTokenRef.current = null;
}
