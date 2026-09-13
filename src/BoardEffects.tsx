import { CARD_CATALOG } from './game/cards/catalog.js';
import type { GameState, SquareName } from './game/types.js';

const point = (square: SquareName) => ({ x: (square.charCodeAt(0) - 97 + .5) * 12.5, y: (8.5 - Number(square[1])) * 12.5 });

export function BoardEffects({ state, onPreview }: { state: GameState; onPreview: (cardId: string | null) => void }) {
  const effects = state.effects.filter(effect => effect.type === 'curse' || effect.type === 'mystic-shield' || effect.type === 'fortification');
  return <>
    <div className="board-effects" aria-hidden="true">
      {effects.map((effect, index) => {
        if (effect.type === 'fortification') {
          const a = point(effect.from), b = point(effect.to);
          const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
          const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
          return <svg key={index} className="effect-wall" viewBox="0 0 100 100"><line x1={x - dy / length * 5} y1={y + dx / length * 5} x2={x + dy / length * 5} y2={y - dx / length * 5} /></svg>;
        }
        const piece = state.pieces.find(piece => piece.id === effect.pieceId);
        if (piece?.zone !== 'board' || !piece.square) return null;
        const { x, y } = point(piece.square);
        const offset = effects.slice(0, index).filter(other => 'pieceId' in other && other.pieceId === effect.pieceId).length;
        return <span key={index} className="piece-effect" data-effect={effect.type} style={{ left: `${x}%`, top: `${y + 4}%`, marginTop: -offset * 14 }}>{effect.type === 'curse' ? 'Curse' : 'Shield'}</span>;
      })}
    </div>
    {effects.length > 0 && <div className="effects-tray" aria-label="Active effects">
      {effects.map((effect, index) => {
        const cardId = 'card' in effect ? effect.card.cardId : effect.type;
        const card = CARD_CATALOG[cardId];
        const target = effect.type === 'fortification' ? `${effect.from}–${effect.to}` : state.pieces.find(piece => piece.id === effect.pieceId)?.square ?? 'off board';
        const duration = effect.type === 'mystic-shield' ? `Until ${effect.player === 'white' ? 'Black' : 'White'} finishes` : 'Continuing';
        return <button type="button" className="effect-entry" key={index} aria-label={`${card.name}, ${target}, ${duration}`} onPointerEnter={() => onPreview(cardId)} onPointerLeave={() => onPreview(null)} onFocus={() => onPreview(cardId)} onBlur={() => onPreview(null)}>
          <img src={card.image} alt="" /><span>{card.name}<small>{target} · {duration}</small></span>
        </button>;
      })}
    </div>}
  </>;
}
