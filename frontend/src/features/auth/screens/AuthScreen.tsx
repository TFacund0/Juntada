import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import logo from "../../../assets/brand/logo.webp";
import { ScreenFade } from "../../../components/ui/ScreenFade";
import { Btn } from "../../../components/ui/Btn";
import { useAuth } from "../context/AuthContext";
import { AuthApiError } from "../api/authApi";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import "./AuthScreen.css";

// Maps backend error codes (see backend/src/auth/http/authRoutes.ts) to
// user-facing copy. Anything unrecognized falls back to a generic message
// rather than leaking a raw error code into the UI.
const ERROR_COPY: Record<string, string> = {
  username_taken: "Ese nombre de usuario ya está en uso.",
  email_taken: "Ese email ya tiene una cuenta.",
  invalid_credentials: "Usuario/email o contraseña incorrectos.",
  http_429: "Demasiados intentos — esperá un momento y volvé a intentar.",
};

function errorMessage(err: unknown): string {
  if (err instanceof AuthApiError) return ERROR_COPY[err.code] ?? "Algo salió mal. Probá de nuevo.";
  return "No se pudo conectar con el servidor.";
}

type Tab = "login" | "register" | "forgot";

/**
 * Lo primerísimo que se muestra cuando no hay una sesión de cuenta válida —
 * reemplaza a NameOnboardingScreen (nombre libre) ahora que la identidad
 * depende de una cuenta con usuario/contraseña. Mismo lenguaje visual (blobs
 * difuminados + card flotante, ver NameOnboardingScreen.css) para que se
 * sienta parte de la misma app.
 */
export function AuthScreen() {
  const [tab, setTab] = useState<Tab>("login");

  return (
    <div className={T.app}>
      <ScreenFade transitionKey="auth">
        <div className="jt-onboarding">
          <div aria-hidden className="jt-onboarding-glow jt-onboarding-glow--a" />
          <div aria-hidden className="jt-onboarding-glow jt-onboarding-glow--b" />

          <div className="jt-onboarding-card jt-animate-rise">
            <img src={logo} alt="Juntada" className="jt-onboarding-logo" />
            <h1 className="jt-onboarding-title jt-text-gradient">Juntada</h1>

            {tab === "forgot" ? (
              <ForgotPasswordScreen onBack={() => setTab("login")} />
            ) : (
              <>
                <div className={T.segmentedControl}>
                  <button className={T.segmentedOption(tab === "login")} onClick={() => setTab("login")}>
                    Iniciar sesión
                  </button>
                  <button className={T.segmentedOption(tab === "register")} onClick={() => setTab("register")}>
                    Crear cuenta
                  </button>
                </div>
                {tab === "login" ? <LoginForm onForgot={() => setTab("forgot")} /> : <RegisterForm />}
              </>
            )}
          </div>
        </div>
      </ScreenFade>
    </div>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!identifier.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="jt-onboarding-field">
        <span className={T.label}>Usuario o email</span>
        <input className={T.input} autoFocus value={identifier} onChange={e => setIdentifier(e.target.value)} />
      </div>
      <div className="jt-onboarding-field">
        <span className={T.label}>Contraseña</span>
        <input className={T.input} type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      {error && <p className={clsx(T.muted, "text-center", "text-[#F09595]")}>{error}</p>}
      <Btn onClick={submit} disabled={busy || !identifier.trim() || !password} style={{ marginTop: 20 }}>
        {busy ? "Ingresando…" : "Ingresar"}
      </Btn>
      <button
        type="button"
        onClick={onForgot}
        className={clsx(T.muted, "mt-3 w-full cursor-pointer border-none bg-transparent text-center underline")}
      >
        Olvidé mi contraseña
      </button>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = username.trim() && email.trim() && firstName.trim() && lastName.trim() && passwordsMatch;

  const submit = async () => {
    if (!canSubmit) {
      if (password !== confirmPassword) setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="jt-onboarding-field">
        <span className={T.label}>Usuario</span>
        <input className={T.input} autoFocus value={username} onChange={e => setUsername(e.target.value)} />
        <p className={clsx(T.muted, "jt-onboarding-hint")}>Así te van a ver los demás jugadores. 3–20 caracteres.</p>
      </div>
      <div className="jt-onboarding-field">
        <span className={T.label}>Email</span>
        <input className={T.input} type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="jt-onboarding-field">
        <span className={T.label}>Nombre</span>
        <input className={T.input} value={firstName} onChange={e => setFirstName(e.target.value)} />
      </div>
      <div className="jt-onboarding-field">
        <span className={T.label}>Apellido</span>
        <input className={T.input} value={lastName} onChange={e => setLastName(e.target.value)} />
      </div>
      <div className="jt-onboarding-field">
        <span className={T.label}>Contraseña</span>
        <input className={T.input} type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div className="jt-onboarding-field">
        <span className={T.label}>Repetir contraseña</span>
        <input className={T.input} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
      </div>
      {error && <p className={clsx(T.muted, "text-center", "text-[#F09595]")}>{error}</p>}
      <Btn onClick={submit} disabled={busy || !canSubmit} style={{ marginTop: 20 }}>
        {busy ? "Creando cuenta…" : "Crear cuenta"}
      </Btn>
    </form>
  );
}
