import { S } from "../theme/styles";

export function Btn({ children, onClick, variant = "primary", disabled, style = {} }) {
  return <button onClick={disabled ? undefined : onClick} style={{ ...S.btn(variant, disabled), ...style }}>{children}</button>;
}
