// "180s"/"173s" no entra prolijo en un chip chico — a partir del minuto se
// muestra "m:ss" (formato reloj), igual que cualquier cronómetro.
export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
