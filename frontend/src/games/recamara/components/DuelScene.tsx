import type { ComponentProps } from "react";
import type { ItemKind } from "@juntada/recamara-engine";
import { ChamberStrip } from "./ChamberStrip";
import { DuelTable } from "./DuelTable";
import { ItemTray } from "./ItemTray";

export interface SceneLogLine {
  key: string | number;
  // Already-escaped HTML from the shared engine's describe* helpers.
  html: string;
  cls?: string;
}

interface DuelSceneProps {
  table: ComponentProps<typeof DuelTable>;
  roundNumber: number;
  // It's this device's turn and nothing is playing: rivals' cards shoot on
  // tap (see DuelTable's onFire) and the self-shot button is enabled.
  canShoot: boolean;
  onSelfFire: () => void;
  // Online, while it's someone else's turn: shown where the self-shot
  // button goes. Local play is always the holder's turn, so it has none.
  waitingForTurn?: boolean;
  // The acting player's items, or null when it isn't this device's turn.
  items: ItemKind[] | null;
  itemsDisabled: boolean;
  onUseItem: (item: ItemKind) => void;
  log: SceneLogLine[];
  logVisible: boolean;
  onToggleLog: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

// The duel as the reference lays it out, shared by LocalGame and RoundView:
// no card around it — the table sits in a dim room under a warm lamp (see
// .duel-scene in scene.css), with the round/mute/direction strip above it
// and the actions and item tray below. Whose turn it is reads from the
// table itself: only that player's card glows.
export function DuelScene(props: DuelSceneProps) {
  const { table, roundNumber, canShoot, onSelfFire, waitingForTurn = false, items, itemsDisabled, onUseItem } = props;
  return (
    <div className="duel-scene">
      <ChamberStrip roundNumber={roundNumber} direction={table.direction} muted={props.muted} onToggleMute={props.onToggleMute} />

      <DuelTable {...table} />

      <div className="scene-controls">
        {/* Always there, button or not, at the button's height — so the
            self-shot button coming and going never shifts the page. */}
        <div className="controls min-h-[42px] items-center">
          {canShoot ? (
            <button className="act primary" onClick={onSelfFire}>
              Dispararme a mí
            </button>
          ) : (
            waitingForTurn && <p className="m-0 text-[0.85rem] tracking-[0.06em] text-rec-ink-faint">Esperando tu turno…</p>
          )}
        </div>
        {items && <ItemTray items={items} disabled={itemsDisabled} onUse={onUseItem} />}
      </div>

      <div className="log">
        <button type="button" className="log-toggle" onClick={props.onToggleLog}>
          {props.logVisible ? "Ocultar registro ▾" : "Mostrar registro ▸"}
        </button>
        {props.logVisible &&
          props.log.map(l => (
            <div key={l.key} className={`line${l.cls ? ` ${l.cls}` : ""}`} dangerouslySetInnerHTML={{ __html: l.html }} />
          ))}
      </div>
    </div>
  );
}
