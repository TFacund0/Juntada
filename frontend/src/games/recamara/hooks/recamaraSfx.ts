import { useEffect, useRef, useState } from "react";
import { playSfx, type SfxName } from "../utils/sfx";

// Per-device sound + vibration for Recámara. Muting is a local preference
// (like the log toggle, see logVisibility.ts) and only silences sound —
// vibration keeps working, the same way a phone on silent still buzzes.
const KEY = "impostorgame:recamara:muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    /* storage unavailable — degrade silently */
  }
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

export interface RecamaraSfx {
  muted: boolean;
  toggleMuted: () => void;
  play: (name: SfxName, delaySeconds?: number) => void;
  vibrate: (pattern: number | number[]) => void;
}

export function useRecamaraSfx(): RecamaraSfx {
  const [muted, setMuted] = useState(readMuted);
  const mutedRef = useRef(muted);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Browsers only let audio start after a user gesture. Online, the first
  // shot you hear is often someone else's (no click of yours behind it), so
  // any tap/keypress on the page unlocks the context ahead of time.
  const ensureContext = (): AudioContext | null => {
    const Ctor = audioContextCtor();
    if (!Ctor) return null;
    try {
      ctxRef.current ??= new Ctor();
      if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
      return ctxRef.current;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const unlock = () => {
      ensureContext();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  return {
    muted,
    toggleMuted: () =>
      setMuted(m => {
        writeMuted(!m);
        return !m;
      }),
    play: (name, delaySeconds = 0) => {
      if (mutedRef.current) return;
      const ctx = ensureContext();
      if (!ctx) return;
      try {
        playSfx(ctx, name, delaySeconds);
      } catch {
        /* a failed sound must never break the game */
      }
    },
    vibrate: pattern => {
      try {
        navigator.vibrate?.(pattern);
      } catch {
        /* unsupported — ignore */
      }
    },
  };
}
