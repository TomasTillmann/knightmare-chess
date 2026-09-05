import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, isKingInCheck, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

const EN_PASSANT_FEN = 'r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 17 42';

for (const fixture of [
  { name: 'clears en passant when the turn override conflicts with FEN', turn: 'black' as const, fen: 'r3k2r/8/8/3pP3/8/8/8/R3K2R b KQkq - 17 42', enPassant: [] },
  { name: 'preserves en passant when the turn override matches FEN', turn: 'white' as const, fen: EN_PASSANT_FEN, enPassant: [{ target: 'd6', pawnId: 'black-pawn-d5' }] },
  { name: 'preserves en passant without a turn override', turn: undefined, fen: EN_PASSANT_FEN, enPassant: [{ target: 'd6', pawnId: 'black-pawn-d5' }] },
]) {
  test(`createGameState ${fixture.name}`, () => {
    const baseline = createGameState({ fen: EN_PASSANT_FEN });
    const state = createGameState({ fen: EN_PASSANT_FEN, ...(fixture.turn && { turn: fixture.turn }) });

    assert.equal(state.fen, fixture.fen);
    assert.deepEqual(state.enPassant, fixture.enPassant);
    assert.doesNotThrow(() => positionFor(state));
    assert.deepEqual(state, {
      ...baseline,
      fen: fixture.fen,
      enPassant: fixture.enPassant,
      turn: { ...baseline.turn, color: fixture.turn ?? 'white' },
    });
  });
}

test('positionFor remains a self-consistent mutable chessops projection', () => {
  const seeded = createGameState({ fen: 'k7/8/8/8/8/8/4R3/4K3 w - - 0 1' });
  const state = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'e2'
      ? { ...piece, neutral: true }
      : piece),
  };
  const position = positionFor(state, 'white');
  const clone = position.clone();

  assert.equal(isKingInCheck(state, 'white'), true, 'the neutral Rook attacks its owner');
  assert.equal(position.isCheck(), !position.ctx().checkers.isEmpty());
  assert.equal(position.isCheck(), false, 'the raw chessops projection keeps orthodox ownership');
  assert.equal(position.isCheckmate(), false);

  position.play({ from: 4, to: 3 }); // e1-d1

  assert.equal(position.isCheck(), !position.ctx().checkers.isEmpty());
  assert.equal(position.isCheck(), false, 'play must not retain check from the source GameState');
  assert.equal(position.isCheckmate(), false);
  assert.equal(clone.isCheck(), !clone.ctx().checkers.isEmpty());
  assert.equal(clone.isCheck(), false, 'the clone remains at the original projection');
});

test('turn adjudication allows a defender-controlled neutral reply to apparent mate', () => {
  const seeded = createGameState({ fen: '8/8/8/8/8/6k1/p7/1r5K w - - 0 1' });
  const before = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'a2'
      ? { ...piece, neutral: true }
      : piece),
    turn: {
      color: 'black' as const,
      phase: 'afterMove' as const,
      moveMade: true,
      cardPlays: { white: 0, black: 0 },
    },
  };
  const ended = applyAction(before, { type: 'endTurn' });

  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  assert.equal(positionFor(ended.state, 'white').isCheckmate(), true, 'orthodox projection sees mate');
  assert.equal(ended.state.outcome, null, 'neutral Pawn capture is an authoritative defense');

  const defended = applyAction(ended.state, {
    type: 'move', from: 'a2', to: 'b1', promotion: 'bishop',
  });
  assert.equal(defended.ok, true);
});

test('same-origin ordinary pieces attack a neutral royal and constrain legal replies', () => {
  const friendly = createGameState({ fen: '4k3/8/8/8/8/8/P3R3/4K3 w - - 0 1' });
  const neutral = {
    ...friendly,
    pieces: friendly.pieces.map(piece => piece.square === 'e1'
      ? { ...piece, neutral: true }
      : piece),
  };

  assert.equal(isKingInCheck(friendly, 'white'), false, 'ordinary allies do not attack each other');
  assert.equal(isKingInCheck(neutral, 'white'), true, 'the White Rook attacks the neutral White royal');
  assert.equal(legalDests(friendly).get('a2')?.includes('a3'), true);
  assert.equal(legalDests(neutral).get('a2')?.includes('a3') ?? false, false, 'unrelated moves cannot ignore check');
  assert.equal(legalDests(neutral).get('e2')?.includes('d2'), true, 'moving the attacker away resolves check');

  const escaped = applyAction(neutral, { type: 'move', from: 'e2', to: 'd2' });
  assert.equal(escaped.ok, true);
  if (!escaped.ok) return;
  assert.equal(isKingInCheck(escaped.state, 'white'), false);
});

test('same-origin attack on a neutral royal participates in checkmate adjudication', () => {
  const seeded = createGameState({
    fen: '8/8/8/8/8/5n1P/5kPR/7K w - - 0 1',
    hands: { white: [], black: [] },
    decks: { white: [], black: [] },
  });
  const checked = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'h1'
      ? { ...piece, neutral: true }
      : piece),
  };

  assert.equal(isKingInCheck(checked, 'white'), true, 'the White Rook on h2 checks the neutral White royal');
  assert.equal(legalDests(checked).size, 0);

  const ended = applyAction({
    ...checked,
    turn: { ...checked.turn, color: 'black' as const, phase: 'afterMove' as const, moveMade: true },
  }, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  assert.deepEqual(ended.state.outcome, { winner: 'black', reason: 'checkmate' });
});
