import { Btn } from "../ui/Btn";
import { BackArrowIcon, AlertIcon } from "../ui/icons";
import { DialogFrame } from "./DialogFrame";
import "./ConfirmDialog.css";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * "exit" (por defecto, rojo + ícono de alerta): dejar el flujo actual del
   * todo (salir al menú principal, salir de un grupo) — irreversible sin
   * repetir un código. "back" (ámbar + ícono de flecha): retroceder un paso
   * dentro del mismo flujo (volver atrás en la partida, volver a jugadores,
   * volver al grupo) — se puede volver a entrar sin fricción. Antes ambos
   * casos compartían el mismo rojo/ícono de alerta, así que "¿Volver
   * atrás?" y "¿Volver al menú principal?" se veían idénticos pese a ser
   * severidades bien distintas.
   */
  tone?: "exit" | "back";
}

/**
 * Diálogo genérico de "¿estás seguro?" con confirmar/cancelar — usado en
 * toda la app (salir de una partida, del grupo, etc.). Centrado, con un
 * ícono arriba y texto más chico que antes: el título/mensaje grandes y
 * alineados a la izquierda leían más como un encabezado de pantalla que
 * como un aviso puntual. Ver `tone` arriba para la diferencia visual entre
 * "salir del todo" y "retroceder un paso".
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  tone = "exit",
}: ConfirmDialogProps) {
  const toneClass = tone === "back" ? "jt-confirm-card--back" : "";
  return (
    <DialogFrame onClose={onCancel} textAlign="center" cardClassName={`jt-confirm-card jt-card-glow ${toneClass}`.trim()}>
      <div className="jt-confirm-badge-wrap">
        <div className="jt-confirm-badge-ping jt-animate-ping" />
        <div className="jt-confirm-badge">
          {tone === "back" ? <BackArrowIcon size={22} color="#E8C868" /> : <AlertIcon size={22} color="#F09595" />}
        </div>
      </div>
      <p className="jt-confirm-title">{title}</p>
      <p className="jt-confirm-message">{message}</p>
      <div className="jt-confirm-actions">
        <Btn variant="ghost" onClick={onCancel} style={{ fontSize: 13, padding: "11px 20px" }}>
          {cancelLabel}
        </Btn>
        <Btn variant="danger" onClick={onConfirm} style={{ fontSize: 13, padding: "11px 20px" }}>
          {confirmLabel}
        </Btn>
      </div>
    </DialogFrame>
  );
}
