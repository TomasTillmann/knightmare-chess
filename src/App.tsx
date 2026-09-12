import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';

import { ChessBoard } from './ChessBoard.js';
import { applyAction, isPromotionSquare } from './game/reducer.js';
import { createGameState } from './game/state.js';
import type { SquareName } from './game/types.js';

export default function App() {
  const [game, setGame] = useState(() => createGameState());

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

  return (
    <main className="board-only" aria-label="Game board">
      <ChessBoard onMove={move} state={game} />
    </main>
  );
}
