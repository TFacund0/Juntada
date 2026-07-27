// The name/word rows shown for everyone else at the table — identical
// markup whether it's local pass-and-play's own turn screen or the online
// RoundView's "assign"/"playing" phases, just fed a different word source
// (the shared board vs. this player's own wordsVisibleToMe).
export function OthersWordsList({ entries }: { entries: { id: string; name: string; word: string | undefined }[] }) {
  return (
    <>
      {entries.map(({ id, name, word }) => (
        <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 }}>
          <span style={{ color: "#b8b0d4" }}>{name}</span>
          <span style={{ fontWeight: 700 }}>{word ?? "—"}</span>
        </div>
      ))}
    </>
  );
}
