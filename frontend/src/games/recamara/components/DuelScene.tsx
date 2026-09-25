import type { ComponentProps } from "react";
import type { ItemKind, ShellKind } from "@juntada/recamara-engine";
import type { StatusSegment } from "../utils/statusLine";
import { ChamberStrip } from "./ChamberStrip";
import { DuelTable } from "./DuelTable";
import { ItemTray } from "./ItemTray";
import { SoundToggle } from "./SoundToggle";

export interface SceneLogLine {
  key: string | number;
  // Already-escaped HTML from the shared engine's describe* helpers.
  html: string;
  cls?: string;
}

interface DuelSceneProps {
  table: ComponentProps<typeof DuelTable>;
  roundNumber: number;
  shellsTotal: number;
  shellsLeft: number;
  known: ShellKind | null;
  status: StatusSegment[];
  // It's this device's turn and nothing is playing: rivals' cards shoot on
  // tap (see DuelTable's onFire) and the self-shot button is enabled.
  canShoot: boolean;
  onSelfFire: () => void;
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
// .duel-scene in scene.css), with the title and sound toggle on top, the
// chamber strip and a narrative status line above the table, and the
// actions and item tray below.
export function DuelScene(props: DuelSceneProps) {
  const { table, roundNumber, shellsTotal, shellsLeft, known, status, canShoot, onSelfFire, items, itemsDisabled, onUseItem } = props;
  return (
    <div className="duel-scene">
      <header className="scene-header">
        <span className="scene-logo display">Recámara</span>
        <SoundToggle muted={props.muted} onToggle={props.onToggleMute} />
      </header>

      <ChamberStrip roundNumber={roundNumber} shellsTotal={shellsTotal} shellsLeft={shellsLeft} known={known} direction={table.direction} />

      <DuelTable {...table} />

      <div className="scene-controls">
        <p className="scene-status" aria-live="polite">
          {status.map((s, i) => (s.bold ? <b key={i}>{s.text}</b> : <span key={i}>{s.text}</span>))}
        </p>
        {canShoot && (
          <div className="controls">
            <button className="act primary" onClick={onSelfFire}>
              Dispararme a mí
            </button>
          </div>
        )}
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
