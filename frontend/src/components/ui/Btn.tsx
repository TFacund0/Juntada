import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { S } from "../../theme/styles";

interface BtnProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "success" | "danger" | "ghost";
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
}

/**
 * Único componente de botón por el que pasa cada variante visual de la app
 * (`primary`/`success`/`danger`/`ghost`, ver `S.btn` en `theme/styles.ts`).
 * Cambiar el look de una variante se hace ahí, una sola vez, en vez de en
 * cada lugar donde se usa un botón.
 */
export function Btn({ children, onClick, variant = "primary", disabled, style = {}, className }: BtnProps) {
  return (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={className}
      style={{ ...S.btn(variant, disabled), ...style }}
    >
      {children}
    </button>
  );
}
