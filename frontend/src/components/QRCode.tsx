import { useEffect, useRef, useState } from "react";
import QRCodeLib from "qrcode";

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

  useEffect(() => {
    if (!canvasRef.current) return;
    setError(null);
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#171329", light: "#f2f0fb" },
    }).catch(() => setError("No se pudo generar el QR"));
  }, [value, size]);

  if (error) return <p style={{ color: "#F09595", fontSize: 13 }}>{error}</p>;
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 12, display: "block" }} />;
}
