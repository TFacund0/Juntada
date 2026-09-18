import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";
import { requestPasswordReset } from "../api/authApi";

/**
 * Pide el email de recuperación — respuesta siempre genérica (ver
 * backend's password-reset/request, siempre 202) para no filtrar si la
 * cuenta existe.
 */
export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div>
        <p className={clsx(T.muted, "text-center")}>Si ese email tiene una cuenta, te mandamos un link para restablecer la contraseña.</p>
        <Btn onClick={onBack} variant="ghost" style={{ marginTop: 20 }}>
          Volver a iniciar sesión
        </Btn>
      </div>
    );
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="jt-onboarding-sub">Te mandamos un link para restablecer tu contraseña.</p>
      <div className="jt-onboarding-field">
        <span className={T.label}>Email</span>
        <input
          className={T.input}
          type="email"
          autoFocus
          placeholder="ej. tu_email@ejemplo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <Btn onClick={submit} disabled={busy || !email.trim()} style={{ marginTop: 20 }}>
        {busy ? "Enviando…" : "Enviar link"}
      </Btn>
      <button
        type="button"
        onClick={onBack}
        className={clsx(T.muted, "mt-3 w-full cursor-pointer border-none bg-transparent text-center underline")}
      >
        Volver
      </button>
    </form>
  );
}
