import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";

// The card's rule text stays collapsed until someone asks for it — shared by
// every mode (local circle, local reveal, online) instead of showing it
// automatically, since most groups already know the rules by heart and
// don't want it shoved in their face every single card.
export function DescriptionToggle({ description }: { description: string }) {
  const [show, setShow] = useState(false);
  if (!description) return null;
  return (
    <div className="text-center mb-3">
      <button onClick={() => setShow(v => !v)} className={clsx(T.btn("ghost"), "w-auto! px-4 py-2 text-xs")}>
        {show ? "Ocultar significado" : "Ver significado"}
      </button>
      {show && <p className="text-[13px] text-[#b8b0d4] mt-2.5">"{description}"</p>}
    </div>
  );
}
