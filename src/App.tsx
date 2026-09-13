import { useCallback, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';

import { ChessBoard } from './ChessBoard.js';
import { CARD_CATALOG } from './game/cards/catalog.js';
import { applyAction, isPromotionSquare } from './game/reducer.js';
import { createGameState } from './game/state.js';
import type { Color, SquareName } from './game/types.js';

// Fixed hands for this visual phase; card play is the next step.
const hands = {
  white: ['hidden-passage', 'fireball', 'mystic-shield', 'curse', 'ghostwalk'],
  black: ['think-again', 'riposte', 'dark-mirror', 'fortification', 'chaos'],
};

export default function App() {
  const [game, setGame] = useState(() => createGameState());
  const [preview, setPreview] = useState<string | null>(null);

  const move = useCallback((from: SquareName, to: SquareName) => {
    const moving = game.pieces.find(piece => piece.zone === 'board' && piece.square === from);
    const promotes = moving?.role === 'pawn' && isPromotionSquare(game, moving.owner, to);
    const promotion = promotes
      ? window.prompt('Promote to queen, rook, bishop, or knight:', 'queen')
      : undefined;
    if (promotion === null) return false;

    const moved = applyAction(game, { type: 'move', from, to, ...(promotion ? { promotion } : {}) });
    if (!moved.ok) return false;
    const ended = applyAction(moved.state, { type: 'endTurn' });
    if (!ended.ok) return false;

    flushSync(() => setGame(ended.state));
    return true;
  }, [game]);

  function hand(color: Color) {
    const active = game.turn.color === color && !game.outcome;
    return (
      <section className="hand-area" data-player={color} aria-label={`${color} cards`}>
        <div className="hand" data-active={active}>
          {hands[color].map((id, index) => {
            const card = CARD_CATALOG[id];
            const position = index / (hands[color].length - 1) * 2 - 1;
            return (
              <button
                key={id}
                type="button"
                className="hand-card"
                style={{ '--fan-angle': `${position * 7}deg`, '--fan-drop': `${position * position * 12}px` } as CSSProperties}
                disabled={!active}
                aria-label={`${card.name}: ${card.description}`}
                onPointerEnter={() => setPreview(id)}
                onPointerLeave={() => setPreview(null)}
                onFocus={() => setPreview(id)}
                onBlur={() => setPreview(null)}
              >
                <img src={card.image} alt={card.name} width="898" height="1500" draggable={false} />
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <main className="table" data-mode="debug" aria-label="Knightmare Chess, debug table">
      {hand('black')}
      <div className="board-center">
        <ChessBoard onMove={move} state={game} />
        <aside className="card-preview" data-active={preview !== null} aria-label="Card preview">
          {preview ? (
            <img className="preview-image" src={CARD_CATALOG[preview].image} alt={CARD_CATALOG[preview].name} />
          ) : (
            <div className="card-back" role="img" aria-label="Knightmare Chess card back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v5m-2.5-2.5h5M6 19h12M7 16h10l2-7-4 2-3-3-3 3-4-2 2 7Z" />
              </svg>
              <span>Knightmare<br />Chess</span>
            </div>
          )}
        </aside>
      </div>
      {hand('white')}
      <p className="sr-only" role="status">{game.outcome ? 'Game over.' : `${game.turn.color === 'white' ? 'White' : 'Black'} to move.`}</p>
      <p className="sr-only" id="board-position">{game.pieces.filter(piece => piece.zone === 'board').map(piece => `${piece.owner} ${piece.role} on ${piece.square}`).join(', ')}.</p>
    </main>
  );
}
