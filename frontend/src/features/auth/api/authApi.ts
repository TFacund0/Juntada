// Thin fetch wrapper around backend/src/auth/http/authRoutes.ts. Mirrors the
// exact request/response shapes documented in sdd/user-accounts — see
// design.md's "HTTP Endpoints" table. Every call sends `credentials:
// "include"` so the httpOnly refresh cookie (scoped to /api/auth) travels
// automatically; nothing here ever reads or writes that cookie directly.

// Same origin/port convention as services/socketConfig.ts (WS_URL) — in dev
// Vite (5173) and the backend (3001) are separate servers, in production one
// server serves both.
const API_BASE = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}/api`
  : "/api";

export interface SelfUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PublicUser {
  id: string;
  username: string;
}

export class AuthApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function parseErrorCode(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error ?? `http_${res.status}`;
  } catch {
    return `http_${res.status}`;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new AuthApiError(res.status, await parseErrorCode(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface RegisterPayload {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  /** Segundos hasta que este access token expire — ver ACCESS_TOKEN_TTL_SECONDS en tokenService.ts (backend). AuthContext lo usa para programar el próximo refresh silencioso antes de que venza. */
  expiresIn: number;
}

export function register(payload: RegisterPayload) {
  return request<{ user: SelfUser } & TokenResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(identifier: string, password: string) {
  return request<{ user: SelfUser } & TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export function logout() {
  return request<void>("/auth/logout", { method: "POST" });
}

export function refresh() {
  return request<TokenResponse>("/auth/refresh", { method: "POST" });
}

// AuthContext registra acá su propio refresh (el único que sabe cómo pedir
// un access token nuevo y reprogramar el próximo timer) — así una llamada
// autenticada que pega contra un access token vencido (la pestaña estuvo en
// segundo plano más de ACCESS_TOKEN_TTL_SECONDS y el refresh proactivo no
// llegó a correr) se recupera sola en vez de tirarle un error al jugador.
let onUnauthorized: (() => Promise<string>) | null = null;

export function registerUnauthorizedHandler(handler: (() => Promise<string>) | null): void {
  onUnauthorized = handler;
}

// Reintenta UNA sola vez con un token fresco — nunca en loop, y solo para
// llamadas ya autenticadas (getMe/updateMe), nunca para register/login/
// refresh en sí (esos 401 son de credenciales reales, no de token vencido).
async function authedRequest<T>(path: string, init: RequestInit, accessToken: string): Promise<T> {
  try {
    return await request<T>(path, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) } });
  } catch (err) {
    if (err instanceof AuthApiError && err.status === 401 && onUnauthorized) {
      const freshToken = await onUnauthorized();
      return request<T>(path, { ...init, headers: { Authorization: `Bearer ${freshToken}`, ...(init.headers ?? {}) } });
    }
    throw err;
  }
}

export function getMe(accessToken: string) {
  return authedRequest<{ user: SelfUser }>("/me", { method: "GET" }, accessToken);
}

export interface UpdateProfilePayload {
  username?: string;
  firstName?: string;
  lastName?: string;
}

export function updateMe(accessToken: string, payload: UpdateProfilePayload) {
  return authedRequest<{ user: SelfUser }>("/me", { method: "PATCH", body: JSON.stringify(payload) }, accessToken);
}

export function requestPasswordReset(email: string) {
  return request<{ ok: true }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function completePasswordReset(token: string, password: string) {
  return request<void>("/auth/password-reset/complete", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
