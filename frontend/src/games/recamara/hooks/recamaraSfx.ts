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

// Events that count as a user gesture on every device. pointerdown is not
// one of them on touch screens (only for a mouse), which is why sound used
// to work on a computer and never on a phone.
const UNLOCK_EVENTS = ["pointerup", "touchend", "click", "keydown"] as const;

// iOS mutes Web Audio with the ringer switch unless the page asks for
// "playback" (Safari 17+; elsewhere navigator.audioSession doesn't exist).
function preferPlaybackSession(): void {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    /* unsupported — ignore */
  }
}

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
  // taps/keypresses on the page unlock the context ahead of time — every one
  // of them until it's actually running, since a resume can still be refused.
  const ensureContext = (): AudioContext | null => {
    const Ctor = audioContextCtor();
    if (!Ctor) return null;
    try {
      if (!ctxRef.current) {
        preferPlaybackSession();
        ctxRef.current = new Ctor();
      }
      if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
      return ctxRef.current;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const stop = () => UNLOCK_EVENTS.forEach(e => window.removeEventListener(e, unlock));
    function unlock() {
      const ctx = ensureContext();
      if (!ctx) return stop();
      // iOS only really starts output once something plays inside the
      // gesture itself: a one-sample silent buffer is enough.
      try {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        /* not needed (or not supported) here */
      }
      if (ctx.state === "running") stop();
    }
    UNLOCK_EVENTS.forEach(e => window.addEventListener(e, unlock));
    return () => {
      stop();
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
