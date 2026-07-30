import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Btn } from "./Btn";
import { DialogFrame } from "./DialogFrame";
import { ErrorBanner } from "./ErrorBanner";

interface QRScannerDialogProps {
  title: string;
  onScan: (raw: string) => void;
  onClose: () => void;
}

/**
 * Abre la cámara propia del dispositivo dentro de la app (sin necesidad de
 * salir del juego para usar una app de cámara/QR separada) y decodifica los
 * frames localmente con `jsQR` — nunca se sube nada, el video nunca sale
 * del dispositivo. `onScan` se dispara una vez con el texto crudo
 * decodificado; quien lo usa (la pantalla de unirse) es quien sabe cómo
 * convertir eso en un código de sala/grupo.
 */
export function QRScannerDialog({ title, onScan, onClose }: QRScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>(0);
  const scannedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara acá");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        if (!cancelled) setError("No se pudo acceder a la cámara — revisá los permisos");
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || scannedRef.current) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code?.data) {
            scannedRef.current = true;
            onScan(code.data);
            return;
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DialogFrame onClose={onClose} maxWidth={340} overlayOpacity={0.85} textAlign="center">
      <p style={{ fontWeight: 800, fontSize: 17, margin: "0 0 14px" }}>{title}</p>
      {error ? (
        <ErrorBanner message={error} flashKey={0} variant="inline" />
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 14,
            overflow: "hidden",
            background: "#000",
          }}
        >
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 24,
              border: "3px solid rgba(255,255,255,0.6)",
              borderRadius: 12,
              pointerEvents: "none",
            }}
          />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <p style={{ ...(error ? {} : { marginTop: 14 }), color: "#a49dc9", fontSize: 13 }}>Apuntá la cámara al código QR</p>
      <Btn variant="ghost" onClick={onClose} style={{ marginTop: 10 }}>
        Cancelar
      </Btn>
    </DialogFrame>
  );
}
