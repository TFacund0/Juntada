import { S } from "../theme/styles";

// Renders a game's `rules` field (see games/registry.js) — a plain array of
// strings, one paragraph per entry, where an entry starting with "- " joins
// the previous run of bullets into a <ul>. No markdown parser needed for
// something this simple, and every game just writes plain sentences.
export function GameRules({ rules }) {
  if (!rules || rules.length === 0) return null;

  const blocks = [];
  for (const line of rules) {
    if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (Array.isArray(last)) last.push(line.slice(2));
      else blocks.push([line.slice(2)]);
    } else {
      blocks.push(line);
    }
  }

  return (
    <div style={S.card}>
      <span style={S.label}>Cómo se juega</span>
      {blocks.map((block, i) =>
        Array.isArray(block) ? (
          <ul key={i} style={{ margin: "0 0 10px", paddingLeft: 18 }}>
            {block.map((item, j) => (
              <li key={j} style={{ fontSize: 13, color: "#b8b0d4", marginBottom: 4, lineHeight: 1.4 }}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i} style={{ fontSize: 13, color: "#b8b0d4", margin: "0 0 10px", lineHeight: 1.5 }}>{block}</p>
        )
      )}
    </div>
  );
}
