// Banner de la pantalla de inicio — encabeza la grilla de juegos (GamePicker)
// con blobs animados de fondo y un CTA que baja hasta la grilla. Puramente
// visual: no conoce reglas de ningún juego, solo recibe cuántos hay
// disponibles.
export function Hero({ gameCount }: { gameCount: number }) {
  return (
    <section className="jt-hero-section" style={{ position: "relative", overflow: "hidden" }}>
      {/* fixed (no absolute) para que el fondo cubra toda la ventana de
          punta a punta, no solo el ancho angosto del texto del Hero
          (jt-home-wrap lo centra). inset:0 solo (sin width/height en vw)
          a propósito: "vw" incluye el ancho del scrollbar en la mayoría de
          los navegadores, así que 100vw es más ancho que lo que realmente
          se ve y corre todo unos px de más — inset:0 en un elemento fixed
          ya cubre el viewport real sin ese problema. */}
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
