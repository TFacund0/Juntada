const KEY = "impostorgame:playerName";

export function getStoredPlayerName(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredPlayerName(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) localStorage.setItem(KEY, trimmed);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — degrade silently */
  }
}
