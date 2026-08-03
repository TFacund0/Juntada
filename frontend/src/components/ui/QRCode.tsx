import { useEffect, useRef, useState } from "react";
import QRCodeLib from "qrcode";
import { ErrorBanner } from "./ErrorBanner";

interface QRCodeProps {
  value: string;
  size?: number;
}

/**
 * Renderiza `value` como código QR en un canvas. La generación ocurre
 * enteramente del lado del cliente (sin llamada de red a un servicio de
 * imágenes QR), así funciona offline y nunca filtra el código de sala/URL a
 * un tercero.
 */
export function QRCode({ value, size = 220 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Se incrementa en cada intento de generación fallido (incluso un
  // reintento que falla con el mismo mensaje exacto) para que la animación
  // de destello de ErrorBanner se repita en vez de no hacer nada en
  // silencio.
  const [errorKey, setErrorKey] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    // A fast-changing `value`/`size` (e.g. a room code still resolving) can
    // fire this twice in quick succession — without this flag, an older
    // toCanvas call resolving/rejecting after a newer one would stomp the
    // error state (or draw a stale QR into a canvas that no longer matches
    // this effect's own value) with its own outdated result.
    let cancelled = false;
    setError(null);
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#171329", light: "#f2f0fb" },
    }).catch(() => {
      if (cancelled) return;
      setError("No se pudo generar el QR");
      setErrorKey(k => k + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) return <ErrorBanner message={error} flashKey={errorKey} variant="inline" />;
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 12, display: "block" }} />;
}
