import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Btn } from "./Btn";
import { ErrorBanner } from "./ErrorBanner";

interface QRScannerDialogProps {
  title: string;
  onScan: (raw: string) => void;
  onClose: () => void;
}

// Opens the device's own camera in-app (no need to leave the game to use a
// separate camera/QR app) and decodes frames locally with jsQR — nothing is
// ever uploaded, the video never leaves the device. `onScan` fires once with
// the raw decoded text; the caller (join screen) is the one that knows how
// to turn that into a room/group code.
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
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,12,29,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#171329",
          border: "1px solid rgba(127,119,221,0.3)",
          borderRadius: 16,
          padding: "24px 20px",
          maxWidth: 340,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          textAlign: "center",
        }}
      >
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
      </div>
    </div>
  );
}
