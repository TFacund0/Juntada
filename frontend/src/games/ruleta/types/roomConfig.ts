// Online-mode entry shape (string id) — distinct from LocalGame.tsx's own
// Entry (numeric id), which never crosses the wire and doesn't need one.
export interface Entry {
  id: string;
  name: string;
  description: string;
}
