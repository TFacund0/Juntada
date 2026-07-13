import { Btn } from "./Btn";

interface DevNoticeDialogProps {
  onClose: () => void;
}

export function DevNoticeDialog({ onClose }: DevNoticeDialogProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,12,29,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#171329",
          border: "1px solid rgba(127,119,221,0.3)",
          borderRadius: 16,
          padding: "24px 20px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>🚧</div>
        <p style={{ fontWeight: 800, fontSize: 17, margin: "0 0 8px" }}>Juntada está en desarrollo</p>
        <p style={{ color: "#a49dc9", fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
          Esta es una versión de prueba. Podés encontrarte con errores, desconexiones o cambios repentinos mientras seguimos mejorándola.
          ¡Gracias por tu paciencia y por probarla!
        </p>
        <Btn onClick={onClose}>Entendido, ¡a jugar!</Btn>
      </div>
    </div>
  );
}
