import { useState } from "react";
import { ITEM_LABEL, type ItemKind, type Player } from "@juntada/recamara-engine";

interface ItemUseModalProps {
  item: ItemKind;
  // Alive opponents of whoever is using the item — only relevant for 🧤,
  // which lets you look at a rival's items before picking exactly one.
  opponents: Player[];
  onClose: () => void;
  onUseSimple: () => void;
  onSteal: (targetId: number, stolenItem: ItemKind) => void;
  onStealNoTarget: () => void;
}

export function ItemUseModal({ item, opponents, onClose, onUseSimple, onSteal, onStealNoTarget }: ItemUseModalProps) {
  const [victimId, setVictimId] = useState<number | null>(null);
  const eligible = opponents.filter(p => p.items.length > 0);

  if (item !== "🧤") {
    return (
      <div className="rec-overlay" onClick={onClose}>
        <div className="rec-modal" onClick={e => e.stopPropagation()}>
          <span className="rec-modal-icon">{item}</span>
          <p className="rec-modal-desc">{ITEM_LABEL[item]}</p>
          <div className="rec-modal-actions">
            <button className="act primary" onClick={onUseSimple}>
              Usar
            </button>
            <button className="act" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (eligible.length === 0) {
    return (
      <div className="rec-overlay" onClick={onClose}>
        <div className="rec-modal" onClick={e => e.stopPropagation()}>
          <span className="rec-modal-icon">{item}</span>
          <p className="rec-modal-desc">Nadie tiene ítems para robar ahora mismo.</p>
          <div className="rec-modal-actions">
            <button className="act primary" onClick={onStealNoTarget}>
              Usar igual
            </button>
            <button className="act" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const victim = victimId != null ? eligible.find(p => p.id === victimId) : undefined;

  if (!victim) {
    return (
      <div className="rec-overlay" onClick={onClose}>
        <div className="rec-modal" onClick={e => e.stopPropagation()}>
          <span className="rec-modal-icon">{item}</span>
          <p className="rec-modal-desc">{ITEM_LABEL[item]} Elegí a quién robarle:</p>
          <div className="rec-modal-list">
            {eligible.map(p => (
              <button key={p.id} className="rec-modal-list-item" onClick={() => setVictimId(p.id)}>
                {p.name} <span className="mono">({p.items.length} ítems)</span>
              </button>
            ))}
          </div>
          <div className="rec-modal-actions">
            <button className="act" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rec-overlay" onClick={onClose}>
      <div className="rec-modal" onClick={e => e.stopPropagation()}>
        <span className="rec-modal-icon">{item}</span>
        <p className="rec-modal-desc">
          Ítems de <b>{victim.name}</b> — elegí cuál robarle:
        </p>
        <div className="rec-modal-list">
          {victim.items.map((it, i) => (
            <button key={i} className="rec-modal-list-item" onClick={() => onSteal(victim.id, it)}>
              <span className="icon">{it}</span> {ITEM_LABEL[it]}
            </button>
          ))}
        </div>
        <div className="rec-modal-actions">
          <button className="act" onClick={() => setVictimId(null)}>
            ‹ Volver
          </button>
          <button className="act" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
