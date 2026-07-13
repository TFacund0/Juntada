import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { S } from "../theme/styles";

interface BtnProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "success" | "danger" | "ghost";
  disabled?: boolean;
  style?: CSSProperties;
}

export function Btn({ children, onClick, variant = "primary", disabled, style = {} }: BtnProps) {
  return (
    <button disabled={disabled} onClick={disabled ? undefined : onClick} style={{ ...S.btn(variant, disabled), ...style }}>
      {children}
    </button>
  );
}
