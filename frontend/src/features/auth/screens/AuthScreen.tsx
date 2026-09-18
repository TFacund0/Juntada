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
  invalid_request: "Datos inválidos. Verificá los campos ingresados.",
  validation_error: "Datos inválidos. Verificá los campos ingresados.",
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
            <div className="jt-onboarding-brand">
              <img src={logo} alt="Juntada" className="jt-onboarding-logo" />
              <h1 className="jt-onboarding-title jt-text-gradient">Juntada</h1>
              <p className="jt-onboarding-sub">Juegos multijugador para jugar en grupo</p>
            </div>

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
    if (!identifier.trim() || !password) {
      setError("Completá tu usuario o email y la contraseña.");
      return;
    }
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
        <input
          className={T.input}
          autoFocus
          placeholder="ej. nacho_23 o tu@email.com"
          value={identifier}
          onChange={e => {
            setIdentifier(e.target.value);
            if (error) setError("");
          }}
        />
      </div>
      <div className="jt-onboarding-field">
        <span className={T.label}>Contraseña</span>
        <input
          className={T.input}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
        />
      </div>
      {error && <p className={clsx(T.muted, "text-center mt-3", "text-[#F09595]")}>{error}</p>}
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

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const isUsernameValid = USERNAME_REGEX.test(username.trim());
  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const isFirstNameValid = firstName.trim().length > 0;
  const isLastNameValid = lastName.trim().length > 0;
  const isPasswordLengthValid = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const canSubmit = isUsernameValid && isEmailValid && isFirstNameValid && isLastNameValid && isPasswordLengthValid && passwordsMatch;

  const submit = async () => {
    if (!canSubmit) {
      if (!username.trim()) {
        setError("Ingresá un nombre de usuario.");
        return;
      }
      if (!isUsernameValid) {
        setError("El usuario debe tener entre 3 y 20 caracteres (solo letras, números, _ y -).");
        return;
      }
      if (!email.trim() || !isEmailValid) {
        setError("Ingresá un email válido.");
        return;
      }
      if (!isFirstNameValid || !isLastNameValid) {
        setError("Completá tu nombre y apellido.");
        return;
      }
      if (!isPasswordLengthValid) {
        setError("La contraseña debe tener al menos 8 caracteres.");
        return;
      }
      if (!passwordsMatch) {
        setError("Las contraseñas no coinciden.");
        return;
      }
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

  const hasStartedTyping = Boolean(username || email || firstName || lastName || password || confirmPassword);

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="jt-onboarding-field">
        <span className={T.label}>Usuario</span>
        <input
          className={T.input}
          autoFocus
          placeholder="ej. nacho_23"
          value={username}
          onChange={e => {
            setUsername(e.target.value);
            if (error) setError("");
          }}
        />
        {username.trim().length > 0 && !isUsernameValid ? (
          <p className="jt-onboarding-field-error">
            {username.trim().length < 3
              ? "Mínimo 3 caracteres."
              : username.trim().length > 20
                ? "Máximo 20 caracteres."
                : "Solo se permiten letras, números, _ o - (sin espacios)."}
          </p>
        ) : (
          <p className={clsx(T.muted, "jt-onboarding-hint")}>Así te van a ver los demás jugadores. 3–20 caracteres.</p>
        )}
      </div>

      <div className="jt-onboarding-field">
        <span className={T.label}>Email</span>
        <input
          className={T.input}
          type="email"
          placeholder="ej. tu_email@ejemplo.com"
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
        />
        {email.trim().length > 0 && !isEmailValid && <p className="jt-onboarding-field-error">Ingresá un formato de email válido.</p>}
      </div>

      <div className="jt-onboarding-field">
        <span className={T.label}>Nombre</span>
        <input
          className={T.input}
          placeholder="ej. Facundo"
          value={firstName}
          onChange={e => {
            setFirstName(e.target.value);
            if (error) setError("");
          }}
        />
      </div>

      <div className="jt-onboarding-field">
        <span className={T.label}>Apellido</span>
        <input
          className={T.input}
          placeholder="ej. Gómez"
          value={lastName}
          onChange={e => {
            setLastName(e.target.value);
            if (error) setError("");
          }}
        />
      </div>

      <div className="jt-onboarding-field">
        <span className={T.label}>Contraseña</span>
        <input
          className={T.input}
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={e => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
        />
        {password.length > 0 && !isPasswordLengthValid ? (
          <p className="jt-onboarding-field-error">Mínimo 8 caracteres (ingresaste {password.length}).</p>
        ) : password.length >= 8 ? (
          <p className="jt-onboarding-field-success">✓ Longitud válida</p>
        ) : null}
      </div>

      <div className="jt-onboarding-field">
        <span className={T.label}>Repetir contraseña</span>
        <input
          className={T.input}
          type="password"
          placeholder="Repetí tu contraseña"
          value={confirmPassword}
          onChange={e => {
            setConfirmPassword(e.target.value);
            if (error) setError("");
          }}
        />
        {confirmPassword.length > 0 && !passwordsMatch ? (
          <p className="jt-onboarding-field-error">Las contraseñas no coinciden.</p>
        ) : confirmPassword.length > 0 && passwordsMatch ? (
          <p className="jt-onboarding-field-success">✓ Las contraseñas coinciden</p>
        ) : null}
      </div>

      {error && <p className={clsx(T.muted, "text-center mt-3", "text-[#F09595]")}>{error}</p>}

      {!canSubmit && hasStartedTyping && (
        <p className={clsx(T.muted, "text-center text-xs mt-3")}>
          {!isUsernameValid
            ? "Verificá el formato de usuario (3–20 caracteres)."
            : !isEmailValid
              ? "Ingresá un email válido."
              : !isFirstNameValid || !isLastNameValid
                ? "Completá nombre y apellido."
                : !isPasswordLengthValid
                  ? "La contraseña debe tener al menos 8 caracteres."
                  : !passwordsMatch
                    ? "Las contraseñas deben coincidir."
                    : "Completá todos los campos para crear tu cuenta."}
        </p>
      )}

      <Btn onClick={submit} disabled={busy || !canSubmit} style={{ marginTop: 20 }}>
        {busy ? "Creando cuenta…" : "Crear cuenta"}
      </Btn>
    </form>
  );
}
