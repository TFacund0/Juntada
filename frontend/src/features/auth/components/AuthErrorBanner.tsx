/**
 * Alerta de error para las pantallas de auth (login/registro/reset) — antes
 * era un párrafo de texto rojo suelto entre el resto de la copy, fácil de
 * pasar por alto. Banner con fondo/borde/ícono para que un error de
 * usuario/contraseña salte a la vista en vez de mezclarse con los hints.
 */
export function AuthErrorBanner({ children }: { children: string }) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-center gap-2 rounded-xl border border-jt-danger-border bg-jt-danger-bg px-3.5 py-2.5 text-[13px] font-semibold text-jt-danger-text"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" className="shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1" fill="currentColor" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
