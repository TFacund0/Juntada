import { useRef, useState } from "react";
import { useClickOutside } from "./useClickOutside";

/**
 * Toggles de UI del header (dropdown de perfil / reglas) — extraído de
 * useAppNavigation.ts. Separado de useAppDialogs porque no son
 * confirmaciones, son simples toggles de visibilidad.
 */
export function useHeaderUI() {
  // Despite the name, this drives the profile/avatar dropdown in the header
  // (AppHeader's jt-home-profile-wrap/ProfilePanel) — the actual "crear/
  // unirme a un grupo" menu is GroupMenuDropdown, a self-contained sibling
  // component with its own state. Two unrelated triggers sitting next to
  // each other in the same navbar, easy to conflate by name alone.
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [showRules, setShowRules] = useState(false);

  useClickOutside(profileMenuRef, showProfileMenu, () => setShowProfileMenu(false));

  return {
    showProfileMenu,
    setShowProfileMenu,
    profileMenuRef,
    showRules,
    setShowRules,
  };
}
