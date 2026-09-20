import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as authApi from "../api/authApi";
import type { SelfUser } from "../api/authApi";

// The access token lives ONLY in memory (this ref + mirrored React state) —
// never localStorage, never sessionStorage (design.md "Token transport": XSS
// readability is the reason). The refresh token is a browser-managed httpOnly
// cookie we never touch directly. `accessTokenRef` exists so a non-React
// consumer (multiplayerSocketService.ts, via getAccessToken()) always reads
// the latest token without re-subscribing to context on every refresh.
const accessTokenRef: { current: string | null } = { current: null };

// Exposed for the WS layer (see services/multiplayerSocketService.ts) — kept
// outside React so the socket service (a plain factory, not a hook) can read
// the current token without a context subscription.
export function getAccessToken(): string | null {
  return accessTokenRef.current;
}

// Margen antes de que el access token venza para disparar el refresh
// silencioso — no justo al filo, para no perder la ventana si el timer del
// navegador se atrasa un poco (tabs en background lo throttlean).
const REFRESH_MARGIN_SECONDS = 60;

interface AuthContextValue {
  user: SelfUser | null;
  accessToken: string | null;
  loading: boolean;
  // True right after `register()` succeeds, until `clearJustRegistered` is
  // called — the signal a brand-new account (as opposed to an existing one
  // logging in) uses to show a one-time welcome instead of the old blanket
  // "app en desarrollo" notice (see useAppOrchestration/AppOverlays).
  justRegistered: boolean;
  clearJustRegistered: () => void;
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
  const [justRegistered, setJustRegistered] = useState(false);
  const clearJustRegistered = useCallback(() => setJustRegistered(false), []);
  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dedupe: el timer proactivo y el handler reactivo (401 de una llamada
  // autenticada) pueden disparar casi al mismo tiempo — sin esto, los dos
  // pedirían un refresh_token "de un solo uso" en simultáneo y uno de los
  // dos perdería la carrera contra el otro.
  const refreshInFlightRef = useRef<Promise<string> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Programa el próximo refresh automático `REFRESH_MARGIN_SECONDS` antes de
  // que el access token actual venza — usado tras cada login/register/
  // refresh (todos devuelven un `expiresIn` nuevo, ver TokenResponse).
  const scheduleRefresh = useCallback(
    (expiresIn: number) => {
      clearRefreshTimer();
      refreshTimerRef.current = setTimeout(() => void doRefreshRef.current(), Math.max(0, expiresIn - REFRESH_MARGIN_SECONDS) * 1000);
    },
    [clearRefreshTimer],
  );

  // Ref (no useCallback) porque scheduleRefresh se define antes que
  // doRefresh pero necesita invocarlo — se asigna la implementación real
  // apenas doRefresh se crea, un par de líneas más abajo.
  const doRefreshRef = useRef<() => Promise<string>>(() => Promise.reject(new Error("doRefresh not ready")));

  // Refresca el access token, guarda el resultado, y reprograma el próximo
  // timer. Devuelve el token nuevo — tanto el timer como el handler
  // reactivo de 401 (registrado más abajo) lo llaman por igual.
  const doRefresh = useCallback((): Promise<string> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const promise = (async () => {
      try {
        const { accessToken: token, expiresIn } = await authApi.refresh();
        setAccessToken(token);
        scheduleRefresh(expiresIn);
        return token;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = promise;
    return promise;
  }, [setAccessToken, scheduleRefresh]);
  doRefreshRef.current = doRefresh;

  // Red de seguridad para cuando el timer de arriba no llegó a correr (tab en
  // segundo plano throttleada) — cualquier llamada autenticada que pegue
  // contra un token ya vencido dispara este mismo refresh en vez de tirarle
  // un error al jugador. Ver authApi.ts#authedRequest.
  useEffect(() => {
    authApi.registerUnauthorizedHandler(doRefresh);
    return () => authApi.registerUnauthorizedHandler(null);
  }, [doRefresh]);

  // Boot: try a silent refresh (the httpOnly cookie travels automatically).
  // Success means a valid session persisted across a reload — fetch the
  // profile and consider the user authenticated. Any failure (no cookie,
  // expired, revoked) just means AuthScreen shows instead; this is expected,
  // not an error to surface to the player.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { accessToken: token, expiresIn } = await authApi.refresh();
        const { user: self } = await authApi.getMe(token);
        if (!active) return;
        setAccessToken(token);
        setUser(self);
        scheduleRefresh(expiresIn);
      } catch {
        // no valid session — stay logged out
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      clearRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { user: self, accessToken: token, expiresIn } = await authApi.login(identifier, password);
      setAccessToken(token);
      setUser(self);
      scheduleRefresh(expiresIn);
    },
    [setAccessToken, scheduleRefresh],
  );

  const register = useCallback(
    async (payload: authApi.RegisterPayload) => {
      const { user: self, accessToken: token, expiresIn } = await authApi.register(payload);
      setAccessToken(token);
      setUser(self);
      scheduleRefresh(expiresIn);
      setJustRegistered(true);
    },
    [setAccessToken, scheduleRefresh],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearRefreshTimer();
      setAccessToken(null);
      setUser(null);
    }
  }, [setAccessToken, clearRefreshTimer]);

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
    <AuthContext.Provider
      value={{ user, accessToken, loading, justRegistered, clearJustRegistered, login, register, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
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
