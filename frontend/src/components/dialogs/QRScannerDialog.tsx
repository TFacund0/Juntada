import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Btn } from "../ui/Btn";
import { DialogFrame } from "./DialogFrame";
import { ErrorBanner } from "../ui/ErrorBanner";
import "./QRScannerDialog.css";

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
const TITLE_ID = "jt-qr-scan-title-label";

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
    <DialogFrame
      onClose={onClose}
      titleId={TITLE_ID}
      maxWidth={340}
      overlayOpacity={0.85}
      textAlign="center"
      cardClassName="jt-qr-scan-card"
      cardStyle={{ position: "relative", overflow: "hidden" }}
    >
      <p id={TITLE_ID} className="jt-text-gradient jt-qr-scan-title">
        {title}
      </p>
      {error ? (
        <ErrorBanner message={error} flashKey={0} variant="inline" />
      ) : (
        <div className="jt-qr-scan-frame">
          <video ref={videoRef} muted playsInline className="jt-qr-scan-video" />
          <div className="jt-qr-scan-corner jt-qr-scan-corner--tl" />
          <div className="jt-qr-scan-corner jt-qr-scan-corner--tr" />
          <div className="jt-qr-scan-corner jt-qr-scan-corner--bl" />
          <div className="jt-qr-scan-corner jt-qr-scan-corner--br" />
          <div className="jt-qr-scan-line" />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <p className="jt-qr-scan-hint">Apuntá la cámara al código QR</p>
      <Btn variant="ghost" onClick={onClose} style={{ marginTop: 14, position: "relative" }}>
        Cancelar
      </Btn>
    </DialogFrame>
  );
}
