import { useEffect, useRef, useState } from "react";

// Per-device sound + vibration for a game whose sounds are synthesized with
// Web Audio (no audio files). Muting is a local preference persisted under
// the game's own storage key, and only silences sound — vibration keeps
// working, the same way a phone on silent still buzzes. Generalized from
// recamara's useRecamaraSfx once rayado-libre needed the same unlock/mute
// plumbing; each game keeps its own synths and just hands them to `play`.

function readMuted(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeMuted(key: string, muted: boolean): void {
  try {
    localStorage.setItem(key, muted ? "1" : "0");
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

/**
 * Short vibration — always an extra, never information on its own: iPhone
 * has no `navigator.vibrate` at all, and some browsers throw when called
 * outside a gesture.
 */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported — ignore */
  }
}

/** Schedules one sound on the (already unlocked) context. */
export type AudioRun = (ac: AudioContext) => void;

export interface GameAudio {
  muted: boolean;
  toggleMuted: () => void;
  /** Runs `run` on the shared context unless muted or Web Audio is missing. Never throws. */
  play: (run: AudioRun) => void;
  vibrate: (pattern: number | number[]) => void;
}

export function useGameAudio(storageKey: string): GameAudio {
  const [muted, setMuted] = useState(() => readMuted(storageKey));
  const mutedRef = useRef(muted);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Browsers only let audio start after a user gesture. Online, the first
  // sound you hear is often caused by someone else (no click of yours behind
  // it), so taps/keypresses on the page unlock the context ahead of time —
  // every one of them until it's actually running, since a resume can still
  // be refused.
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
    // ensureContext only touches refs — registering once per mount is the point.
  }, []);

  return {
    muted,
    toggleMuted: () =>
      setMuted(m => {
        writeMuted(storageKey, !m);
        return !m;
      }),
    play: run => {
      if (mutedRef.current) return;
      const ctx = ensureContext();
      if (!ctx) return;
      try {
        run(ctx);
      } catch {
        /* a failed sound must never break the game */
      }
    },
    vibrate,
  };
}
