import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { useLayoutEffect, useRef } from 'react';

import { boardFen, legalDests, positionFor } from './game/reducer.js';
import type { GameState, SquareName } from './game/types.js';

interface Props {
  state: GameState;
  targeting: boolean;
  selectedTarget?: SquareName | null;
  onMove: (from: SquareName, to: SquareName) => void;
  onTarget: (square: SquareName) => void;
}

export function ChessBoard({ state, targeting, selectedTarget, onMove, onTarget }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const api = useRef<Api>(null);

  useLayoutEffect(() => {
    if (!element.current) return;
    api.current = Chessground(element.current);
    return () => api.current?.destroy();
  }, []);

  useLayoutEffect(() => {
    const ground = api.current;
    if (!ground) return;
    const opponent = state.turn.color === 'white' ? 'black' : 'white';
    const checked = positionFor(state, state.turn.color).isCheck()
      ? state.turn.color
      : positionFor(state, opponent).isCheck()
        ? opponent
        : false;

    ground.set({
      fen: boardFen(state),
      orientation: 'white',
      turnColor: state.turn.color,
      check: checked,
      coordinates: true,
      animation: { enabled: true, duration: 180 },
      draggable: { enabled: !targeting },
      selectable: { enabled: true },
      movable: {
        color: targeting ? undefined : state.turn.color,
        dests: targeting ? new Map() : legalDests(state),
        free: false,
        showDests: true,
        rookCastle: true,
        events: {
          after: (from, to) => onMove(from as SquareName, to as SquareName),
        },
      },
    });
    if (targeting) ground.selectSquare(selectedTarget ?? null);
  }, [onMove, onTarget, selectedTarget, state, targeting]);

  return (
    <div
      className="cg-wrap"
      data-orientation="white"
      data-testid="chessboard"
      onClickCapture={event => {
        if (!targeting) return;
        const box = event.currentTarget.getBoundingClientRect();
        const file = Math.min(7, Math.max(0, Math.floor(((event.clientX - box.left) * 8) / box.width)));
        const rank = 7 - Math.min(7, Math.max(0, Math.floor(((event.clientY - box.top) * 8) / box.height)));
        onTarget(`${String.fromCharCode(97 + file)}${rank + 1}` as SquareName);
      }}
      ref={element}
    />
  );
}
