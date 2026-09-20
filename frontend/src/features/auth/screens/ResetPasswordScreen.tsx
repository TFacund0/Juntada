import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import logo from "../../../assets/brand/logo.webp";
import { ScreenFade } from "../../../components/ui/ScreenFade";
import { Btn } from "../../../components/ui/Btn";
import { completePasswordReset, AuthApiError } from "../api/authApi";
import { AuthErrorBanner } from "../components/AuthErrorBanner";
import "./AuthScreen.css";

/**
 * Standalone route (/reset/:token, see routing/appRoutes.ts) — a sibling of
 * App, not a child, so it never touches the app's game/group state machine
 * (same shape as JoinRedirect). Completes backend/src/auth/http/authRoutes.ts's
 * POST /api/auth/password-reset/complete.
 */
export function ResetPasswordScreen({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "invalid">("idle");
  const [error, setError] = useState("");

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const submit = async () => {
    if (!passwordsMatch) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setStatus("busy");
    setError("");
    try {
      await completePasswordReset(token, password);
      setStatus("done");
    } catch (err) {
      if (err instanceof AuthApiError && err.code === "invalid_reset_token") {
        setStatus("invalid");
      } else {
        setStatus("idle");
        setError("No se pudo restablecer la contraseña. Probá de nuevo.");
      }
    }
  };

  return (
    <div className={T.app}>
      <ScreenFade transitionKey="reset-password">
        <div className="jt-onboarding">
          <div aria-hidden className="jt-onboarding-glow jt-onboarding-glow--a" />
          <div aria-hidden className="jt-onboarding-glow jt-onboarding-glow--b" />
          <div className="jt-onboarding-card jt-animate-rise">
            <div className="jt-onboarding-brand">
              <img src={logo} alt="Juntada" className="jt-onboarding-logo" />
              <h1 className="jt-onboarding-title jt-text-gradient">Juntada</h1>
            </div>

            {status === "done" ? (
              <p className={clsx(T.muted, "text-center")}>Contraseña actualizada. Ya podés iniciar sesión con tu nueva contraseña.</p>
            ) : status === "invalid" ? (
              <AuthErrorBanner>Este link ya no es válido — pedí uno nuevo desde "Olvidé mi contraseña".</AuthErrorBanner>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  submit();
                }}
              >
                <p className="jt-onboarding-sub">Elegí tu nueva contraseña.</p>
                <div className="jt-onboarding-field">
                  <span className={T.label}>Nueva contraseña</span>
                  <input className={T.input} type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="jt-onboarding-field">
                  <span className={T.label}>Repetir contraseña</span>
                  <input className={T.input} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                {error && <AuthErrorBanner>{error}</AuthErrorBanner>}
                <Btn onClick={submit} disabled={status === "busy" || !passwordsMatch} className="mt-5">
                  {status === "busy" ? "Guardando…" : "Restablecer contraseña"}
                </Btn>
              </form>
            )}
          </div>
        </div>
      </ScreenFade>
    </div>
  );
}
