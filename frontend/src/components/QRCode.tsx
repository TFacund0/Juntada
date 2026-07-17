import { useEffect, useRef, useState } from "react";
import QRCodeLib from "qrcode";
import { ErrorBanner } from "./ErrorBanner";

interface QRCodeProps {
  value: string;
  size?: number;
}

// Renders `value` as a QR code onto a canvas. Generation happens fully
// client-side (no network call to a QR image service), so it works offline
// and never leaks the room code/URL to a third party.
export function QRCode({ value, size = 220 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every failed generation attempt (even a retry that fails with
  // the exact same message) so ErrorBanner's flash animation replays instead
  // of silently doing nothing.
  const [errorKey, setErrorKey] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    setError(null);
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#171329", light: "#f2f0fb" },
    }).catch(() => {
      setError("No se pudo generar el QR");
      setErrorKey(k => k + 1);
    });
  }, [value, size]);

  if (error) return <ErrorBanner message={error} flashKey={errorKey} variant="inline" />;
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 12, display: "block" }} />;
}
