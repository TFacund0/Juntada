import { Btn } from "../ui/Btn";
import { DialogFrame } from "../dialogs/DialogFrame";
import "./WelcomeDialog.css";

interface WelcomeDialogProps {
  playerName: string;
  onClose: () => void;
}

const TITLE_ID = "jt-welcome-title-label";

/** Bienvenida única, mostrada solo la primera vez que una cuenta se registra. */
export function WelcomeDialog({ playerName, onClose }: WelcomeDialogProps) {
  return (
    <DialogFrame
      onClose={onClose}
      titleId={TITLE_ID}
      maxWidth={380}
      closeOnOverlayClick={false}
      textAlign="center"
      cardClassName="jt-welcome-card jt-card-glow"
    >
      <div className="jt-welcome-badge">🎉</div>
      <p id={TITLE_ID} className="jt-welcome-title">
        ¡Bienvenido/a, {playerName}!
      </p>
      <p className="jt-welcome-message">
        Tu cuenta ya está lista. Creá una sala o un grupo, invitá a tus amigos y arrancá a jugar cuando quieras.
      </p>
      <p className="jt-welcome-notice">
        🚧 Juntada todavía está en desarrollo: puede que te encuentres con algún error o desconexión de vez en cuando. ¡Gracias por tu
        paciencia y por darle una oportunidad!
      </p>
      <Btn onClick={onClose}>¡A jugar!</Btn>
    </DialogFrame>
  );
}
