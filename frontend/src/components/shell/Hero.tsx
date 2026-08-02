/**
 * Blobs animados de fondo de la pantalla de inicio — separados de `Hero` (no
 * anidados dentro suyo) porque `Hero` vive dentro del `<ScreenFade>` de
 * App.tsx, que anima con `transform` los primeros 0.32s de cada pantalla. Un
 * `transform` en un ancestro atrapa cualquier `position: fixed` de acá
 * adentro (lo posiciona relativo a ese ancestro en vez de al viewport)
 * durante ese instante, y cuando la animación termina y el `transform`
 * desaparece (a propósito, ver el comentario de screenTransitions.css), el
 * fixed "salta" de golpe de un marco de referencia al otro — dos
 * movimientos distintos y notorios en menos de un segundo. `App.tsx` renderiza
 * esto como hermano de `<ScreenFade>` (no como descendiente) para esquivar
 * el problema sin recurrir a un portal a document.body, que rompería el
 * z-index:-1 de acá abajo (ver por qué en el comentario de más adelante).
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}>
      <div
        className="jt-animate-drift"
        style={{
          position: "absolute",
          left: "5%",
          top: "-15%",
          width: "34vw",
          height: "34vw",
          maxWidth: 420,
          maxHeight: 420,
          minWidth: 220,
          minHeight: 220,
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--jt-accent, #7f77dd) 28%, transparent)",
          filter: "blur(90px)",
        }}
      />
      <div
        className="jt-animate-drift"
        style={{
          position: "absolute",
          right: "5%",
          top: "0%",
          width: "30vw",
          height: "30vw",
          maxWidth: 380,
          maxHeight: 380,
          minWidth: 190,
          minHeight: 190,
          borderRadius: "50%",
          background: "color-mix(in srgb, #1d9e75 24%, transparent)",
          filter: "blur(100px)",
          animationDelay: "-6s",
        }}
      />
      {/* Trama de puntos que "lava" todo el ancho de la sección, atenuada
          hacia los bordes con una máscara radial — sin esto, los dos
          blobs de arriba quedan pegados a los costados y el centro de
          pantallas anchas se ve sin color. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.35,
          backgroundImage: "radial-gradient(color-mix(in srgb, var(--jt-accent, #7f77dd) 35%, transparent) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(70% 60% at 50% 0%, black, transparent)",
          WebkitMaskImage: "radial-gradient(70% 60% at 50% 0%, black, transparent)",
        }}
      />
    </div>
  );
}

// Banner de la pantalla de inicio — encabeza la grilla de juegos (GamePicker)
// con un CTA que baja hasta la grilla. Puramente visual: no conoce reglas de
// ningún juego, solo recibe cuántos hay disponibles. Su fondo animado vive
// en `HeroBackdrop` de acá arriba, renderizado aparte por App.tsx — ver el
// comentario ahí.
export function Hero({ gameCount }: { gameCount: number }) {
  return (
    <section className="jt-hero-section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="jt-animate-rise jt-hero-copy" style={{ textAlign: "center", margin: "0 auto" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            border: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.4))",
            background: "var(--jt-card-bg, rgba(255,255,255,0.04))",
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--jt-accent-strong, #afa9ec)",
          }}
        >
          <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
            <span className="jt-animate-ping" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#5dcaa5" }} />
            <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: "#5dcaa5" }} />
          </span>
          {gameCount} juegos listos para jugar
        </span>

        <h1
          className="jt-hero-title"
          style={{
            margin: "20px 0 0",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Junten al grupo y <span className="jt-text-gradient">que empiece el juego</span>
        </h1>
        <p className="jt-hero-sub" style={{ margin: "14px 0 0", color: "var(--jt-muted-text, #a49dc9)" }}>
          Elegí un juego, compartí el código y jueguen desde donde estén. Sin descargas, sin vueltas.
        </p>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <a
            href="#jt-games"
            className="jt-cta-gradient jt-home-cta-btn jt-hero-cta"
            style={{
              display: "inline-flex",
              textDecoration: "none",
            }}
          >
            Explorar juegos
          </a>
          <span style={{ fontSize: 12, color: "var(--jt-muted-text, #6b6490)" }}>2 a 20 jugadores · partidas de 3 a 20 min</span>
        </div>
      </div>
    </section>
  );
}
