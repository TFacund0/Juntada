import { useState } from "react";
import { S } from "../../theme/styles";

// The card's rule text stays collapsed until someone asks for it — shared by
// every mode (local circle, local reveal, online) instead of showing it
// automatically, since most groups already know the rules by heart and
// don't want it shoved in their face every single card.
export function DescriptionToggle({ description }: { description: string }) {
  const [show, setShow] = useState(false);
  if (!description) return null;
  return (
    <div style={{ textAlign: "center", marginBottom: 12 }}>
      <button onClick={() => setShow(v => !v)} style={{ ...S.btn("ghost"), width: "auto", padding: "8px 16px", fontSize: 12 }}>
        {show ? "Ocultar significado" : "Ver significado"}
      </button>
      {show && <p style={{ fontSize: 13, color: "#b8b0d4", margin: "10px 0 0" }}>"{description}"</p>}
    </div>
  );
}
