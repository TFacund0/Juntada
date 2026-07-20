// jsqr ships no bundled types and there's no @types/jsqr package — just the
// minimal shape QRScannerDialog.tsx actually calls.
declare module "jsqr" {
  interface QRCode {
    data: string;
  }

  function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
  ): QRCode | null;

  export default jsQR;
}
