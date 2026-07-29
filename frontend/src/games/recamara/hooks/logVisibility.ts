import { useState } from "react";

// Purely a per-device UI preference — whoever finds the play-by-play log
// distracting can hide it, without affecting anyone else at the table
// (local pass-and-play) or in the room (online). Persisted so it survives
// a reload/reconnect instead of resetting every round.
const KEY = "impostorgame:recamara:logVisible";

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

function writeStored(visible: boolean): void {
  try {
    localStorage.setItem(KEY, visible ? "1" : "0");
  } catch {
    /* storage unavailable — degrade silently */
  }
}

export function useLogVisible(): [boolean, () => void] {
  const [visible, setVisible] = useState(readStored);
  const toggle = () => {
    setVisible(v => {
      const next = !v;
      writeStored(next);
      return next;
    });
  };
  return [visible, toggle];
}
