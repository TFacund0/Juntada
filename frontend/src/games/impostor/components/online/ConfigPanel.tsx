import { useEffect, useState } from "react";
import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import { maxImpostors } from "@juntada/impostor-match-rules";
import { TurnOrderEditor } from "../../../../components/game-kit/TurnOrderEditor";
import { ConfigSection } from "../config/ConfigSection";
import { ConfigTabs } from "../config/ConfigTabs";
import { CategoriesTab } from "../config/CategoriesTab";
import { RevealOnEliminationControl } from "../config/RevealOnEliminationControl";
import { ShowCategoryControl } from "../config/ShowCategoryControl";
import type { ConfigPanelProps } from "../../../gameTypes";
import type { ImpostorConfigPanelState } from "../../types/roundView";

// Host-only rules editor shown in the multiplayer lobby. Only re-renders when
// this game is active in the room (see games/registry.js contract). Every
// rule question lives inside one shared card, separated by ConfigSection
// dividers (shared with LocalGame's own "Reglas" tab).

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules" | "order">("cats");
  const config = room.config as unknown as ImpostorConfigPanelState;
  const maxImp = maxImpostors(room.players.length);
  const usedWords = room.usedWords as Record<string, string[]>;

  // Mirrors LocalGame's own clamp effect (see LocalGame.tsx) — without it,
  // a host who picks e.g. 2 impostors and then loses players keeps seeing
  // "2" selected here even though startRound would silently clamp it lower.
  useEffect(() => {
    const cap = maxImpostors(room.players.length);
    if (config.numImpostors > cap) updateConfig({ numImpostors: cap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.players.length]);

  return (
    <ConfigTabs active={tab} onChange={setTab}>
      {tab === "rules" && (
        <div>
          <ConfigSection divider={false}>
            <span className={T.label}>Impostores</span>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => updateConfig({ numImpostors: n })}
                  disabled={n > maxImp}
                  className={clsx(
                    T.btn(config.numImpostors === n ? "primary" : "ghost"),
                    "flex-1 p-2 text-[13px]",
                    n > maxImp ? "opacity-35" : "opacity-100",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {maxImp < 3 && (
              <p className={clsx(T.muted, "mt-2 leading-[1.4]")}>
                Con {room.players.length} jugadores, como máximo puede haber {maxImp} {maxImp === 1 ? "impostor" : "impostores"} — tienen
                que ser menos que los inocentes.
              </p>
            )}
          </ConfigSection>

          <ConfigSection>
            <RevealOnEliminationControl
              value={!!config.revealOnElimination}
              onChange={revealOnElimination => updateConfig({ revealOnElimination })}
            />
          </ConfigSection>

          <ConfigSection>
            <span className={T.label}>¿El impostor recibe una pista?</span>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => updateConfig({ hintsEnabled: true })}
                className={clsx(T.btn(config.hintsEnabled ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
              >
                Sí, con pista
              </button>
              <button
                onClick={() => updateConfig({ hintsEnabled: false })}
                className={clsx(T.btn(!config.hintsEnabled ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
              >
                No, a ciegas
              </button>
            </div>
            <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
              {config.hintsEnabled
                ? "El impostor ve una pista relacionada con la palabra secreta, para poder disimular."
                : "El impostor no sabe nada de la palabra secreta — tiene que improvisar."}
            </p>
          </ConfigSection>

          <ConfigSection>
            <ShowCategoryControl value={!!config.showCategory} onChange={showCategory => updateConfig({ showCategory })} />
          </ConfigSection>

          <ConfigSection>
            <span className={T.label}>¿Cómo dan su palabra los jugadores?</span>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => updateConfig({ writtenClues: true })}
                className={clsx(T.btn(config.writtenClues ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
              >
                Escrita
              </button>
              <button
                onClick={() => updateConfig({ writtenClues: false })}
                className={clsx(T.btn(!config.writtenClues ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
              >
                En voz alta
              </button>
            </div>
            <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
              {config.writtenClues
                ? "Cada uno escribe su palabra en el dispositivo por turnos, y queda visible para todos apenas la envía."
                : "Cada uno dice su palabra en voz alta, por turnos, y solo confirma en el dispositivo cuando ya la dijo."}
            </p>
          </ConfigSection>

          <ConfigSection>
            <span className={T.label}>Tiempo por turno: {config.clueTime === 0 ? "Sin límite" : `${config.clueTime}s`}</span>
            <p className={clsx(T.muted, "m-0 mt-1 leading-[1.4]")}>Cuánto tiene cada jugador para dar su palabra cuando le toca.</p>
            <input
              type="range"
              min="0"
              max="180"
              step="15"
              value={config.clueTime}
              onChange={e => updateConfig({ clueTime: +e.target.value })}
              className="mt-2 w-full"
            />
          </ConfigSection>

          <ConfigSection>
            <span className={T.label}>
              Tiempo de discusión:{" "}
              {config.discussionUnlimited
                ? "Sin límite"
                : config.discussionTime === 0
                  ? "Sin fase de discusión"
                  : `${config.discussionTime}s`}
            </span>
            <p className={clsx(T.muted, "m-0 mb-2 mt-1 leading-[1.4]")}>Cuánto dura la charla antes de pasar a la votación.</p>
            <input
              type="range"
              min="0"
              max="180"
              step="15"
              value={config.discussionTime}
              disabled={config.discussionUnlimited}
              onChange={e => updateConfig({ discussionTime: +e.target.value, discussionUnlimited: false })}
              className={clsx("w-full", config.discussionUnlimited ? "opacity-40" : "opacity-100")}
            />
            <label className="mt-3 flex cursor-pointer items-center gap-2.5">
              <div
                className={T.toggle(!!config.discussionUnlimited)}
                onClick={() => updateConfig({ discussionUnlimited: !config.discussionUnlimited })}
              >
                <div className={T.knob(!!config.discussionUnlimited)} />
              </div>
              <span
                className="text-[13px] font-semibold"
                style={{ color: config.discussionUnlimited ? "#5DCAA5" : "var(--jt-muted-text)" }}
              >
                Discusión sin límite de tiempo — pasan a votar cuando estén todos listos
              </span>
            </label>
          </ConfigSection>

          <ConfigSection>
            <span className={T.label}>¿Cómo van a discutir?</span>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => updateConfig({ discussionMode: "voice" })}
                className={clsx(T.btn(config.discussionMode !== "chat" ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
              >
                Por voz
              </button>
              <button
                onClick={() => updateConfig({ discussionMode: "chat" })}
                className={clsx(T.btn(config.discussionMode === "chat" ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
              >
                Chat de texto
              </button>
            </div>
            <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
              {config.discussionMode === "chat"
                ? "Aparece un chat de texto en la fase de discusión para escribirse entre todos."
                : "Discuten en voz alta (en persona o por llamada) — la app no necesita mostrar nada extra."}
            </p>
          </ConfigSection>
        </div>
      )}

      {tab === "cats" && (
        <CategoriesTab
          enabledCategories={config.enabledCategories || {}}
          usedWords={usedWords}
          onChange={enabledCategories => updateConfig({ enabledCategories })}
        />
      )}

      {tab === "order" && (
        <TurnOrderEditor
          bare
          players={room.players}
          turnOrder={config.turnOrder}
          onChange={turnOrder => updateConfig({ turnOrder })}
          label="Orden de turno para dar la palabra"
          helpText="Así van a ir pasando su palabra en la ronda. Los que se sumen después entran al final."
        />
      )}
    </ConfigTabs>
  );
}
