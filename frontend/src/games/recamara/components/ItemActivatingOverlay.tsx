// A brief pulse on the item's icon before its result banner shows up —
// shared by LocalGame's own-item use and RoundView's "someone just used an
// item" broadcast (see each file's activatingItem state).
export function ItemActivatingOverlay({ icon }: { icon: string }) {
  return (
    <div className="rec-overlay">
      <div className="rec-modal">
        <span className="rec-modal-icon activating">{icon}</span>
      </div>
    </div>
  );
}
