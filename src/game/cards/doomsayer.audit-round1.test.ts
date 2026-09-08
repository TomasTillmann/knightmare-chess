import assert from 'node:assert/strict';
import test from 'node:test';

import { activeDoomsayers, applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState } from '../types.js';

type Action = Parameters<typeof applyAction>[1];

const DOOMSAYER = 'doomsayer';
const WHITE_LOCK_FEN = 'k3r3/8/8/8/4b3/8/P7/4K3 w - - 9 20';
const BLACK_LOCK_FEN = '4k3/7p/4B3/8/8/8/8/K3R3 b - - 9 20';

function applied(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejectedAtomically(state: GameState, action: Action): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail('expected action to be rejected');
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

function move(state: GameState, from: string, to: string): GameState {
  return applied(state, { type: 'move', from, to });
}

function playDoomsayer(state: GameState, instanceId?: string): GameState {
  return applied(state, {
    type: 'playCard',
    cardId: DOOMSAYER,
    cardInstanceId: instanceId ?? state.players[state.turn.color].hand.find(card => card.cardId === DOOMSAYER)?.id,
  });
}

function effectIds(state: GameState): string[] {
  return activeDoomsayers(state).map(effect => effect.card.id);
}

function pieceId(state: GameState, square: string): string {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === square);
  assert.ok(piece, `missing piece on ${square}`);
  return piece.id;
}

function name(
  state: GameState,
  speaker: Color,
  role: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen',
  losses: Array<Record<string, unknown>>,
): GameState {
  return applied(state, { type: 'namePiece', speaker, name: role, losses } as unknown as GameAction);
}

function totalCards(state: GameState): number {
  return (['white', 'black'] as const).reduce((count, color) => {
    const player = state.players[color];
    return count + player.hand.length + player.deck.length + player.discard.length;
  }, activeDoomsayers(state).length);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function stagedFizzle(
  color: Color = 'white',
  hands: Partial<Record<Color, string[]>> = {
    white: ['anathema', DOOMSAYER],
    black: [],
  },
  decks: Partial<Record<Color, string[]>> = { white: [], black: [] },
): { before: GameState; staged: GameState } {
  const white = color === 'white';
  const before = createGameState({
    fen: white
      ? 'k6r/8/8/8/1b6/8/P7/4K3 w - - 0 1'
      : '4k3/p7/8/1B6/8/8/8/7R b - - 0 1',
    hands,
    decks,
  });
  return { before, staged: move(before, white ? 'a2' : 'a7', white ? 'a3' : 'a6') };
}

function assertCleanFizzle(before: GameState, after: GameState, spentId: string): void {
  assert.equal(after.fen, before.fen);
  assert.deepEqual(after.pieces, before.pieces);
  assert.deepEqual(after.enPassant, before.enPassant);
  assert.deepEqual(after.turn, {
    color: before.turn.color,
    phase: 'beforeMove',
    moveMade: false,
    cardPlays: { ...before.turn.cardPlays, [before.turn.color]: 1 },
  });
  assert.equal(after.pendingRescue, null);
  assert.equal(after.pendingDoomsayer, null);
  assert.deepEqual(activeDoomsayers(after), []);
  assert.deepEqual(after.history, [{
    type: 'cardFizzled',
    cardId: DOOMSAYER,
    reason: 'SELF_CHECK',
    movement: [],
    preservePreviousMove: false,
  }]);
  assert.deepEqual(after.players[before.turn.color].discard, [{ id: spentId, cardId: DOOMSAYER }]);
  assert.equal(totalCards(after), totalCards(before));
}

test('SELF_CHECK fizzle restores the provisional move and removes every Doomsayer window', () => {
  const { before, staged } = stagedFizzle();
  const spent = staged.players.white.hand.find(card => card.cardId === DOOMSAYER)!;
  assert.ok(staged.pendingRescue);

  const offered = playDoomsayer(staged, spent.id);
  assert.ok(offered.pendingDoomsayer);
  assert.ok(offered.pendingRescue);
  const after = applied(offered, { type: 'declineDoomsayer', player: 'black' });

  assertCleanFizzle(before, after, spent.id);
  assert.equal(pieceId(after, 'a2'), 'white-pawn-a2');
});

test('SELF_CHECK fizzle spends the selected duplicate identity only', () => {
  const { before, staged } = stagedFizzle('white', {
    white: [DOOMSAYER, 'anathema', DOOMSAYER], black: [],
  });
  const copies = staged.players.white.hand.filter(card => card.cardId === DOOMSAYER);
  const selected = copies[1]!;

  const offered = playDoomsayer(staged, selected.id);
  assert.ok(offered.pendingDoomsayer);
  assert.ok(offered.pendingRescue);
  const after = applied(offered, { type: 'declineDoomsayer', player: 'black' });

  assertCleanFizzle(before, after, selected.id);
  assert.deepEqual(after.players.white.hand.map(card => card.id), [copies[0]!.id, 'white-hand-1-anathema']);
  assert.equal(after.players.white.discard.some(card => card.id === copies[0]!.id), false);
});

test('SELF_CHECK fizzle draws one replacement while conserving the exact cards', () => {
  const { before, staged } = stagedFizzle(
    'white',
    { white: ['anathema', DOOMSAYER], black: [] },
    { white: ['fanatic'], black: [] },
  );
  const spentId = staged.players.white.hand.find(card => card.cardId === DOOMSAYER)!.id;
  const drawnId = staged.players.white.deck[0]!.id;

  const offered = playDoomsayer(staged, spentId);
  assert.ok(offered.pendingDoomsayer);
  assert.ok(offered.pendingRescue);
  const after = applied(offered, { type: 'declineDoomsayer', player: 'black' });

  assertCleanFizzle(before, after, spentId);
  assert.equal(after.players.white.hand.some(card => card.id === drawnId), true);
  assert.equal(after.players.white.deck.length, 0);
});

test('SELF_CHECK fizzle is color-symmetric', () => {
  const { before, staged } = stagedFizzle('black', {
    white: [], black: ['anathema', DOOMSAYER],
  }, { white: [], black: [] });
  const spentId = staged.players.black.hand.find(card => card.cardId === DOOMSAYER)!.id;

  const offered = playDoomsayer(staged, spentId);
  assert.ok(offered.pendingDoomsayer);
  assert.ok(offered.pendingRescue);
  const after = applied(offered, { type: 'declineDoomsayer', player: 'white' });

  assertCleanFizzle(before, after, spentId);
  assert.equal(pieceId(after, 'a7'), 'black-pawn-a7');
});

test('SELF_CHECK fizzle accepts frozen input and is deterministic without mutating it', () => {
  const { before, staged } = stagedFizzle();
  const spentId = staged.players.white.hand.find(card => card.cardId === DOOMSAYER)!.id;
  const snapshot = structuredClone(staged);
  deepFreeze(staged);
  const action = deepFreeze({ type: 'playCard', cardId: DOOMSAYER, cardInstanceId: spentId } as const);

  const first = applyAction(staged, action);
  const second = applyAction(staged, action);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(first.state, second.state);
  assert.deepEqual(staged, snapshot);
  assert.ok(first.state.pendingDoomsayer);
  assert.ok(first.state.pendingRescue);
  assert.ok(second.state.pendingDoomsayer);
  assert.ok(second.state.pendingRescue);
  const firstDeclined = applied(first.state, { type: 'declineDoomsayer', player: 'black' });
  const secondDeclined = applied(second.state, { type: 'declineDoomsayer', player: 'black' });
  assert.deepEqual(firstDeclined, secondDeclined);
  assert.deepEqual(staged, snapshot);
  assertCleanFizzle(before, firstDeclined, spentId);
});

function immediateLock(color: Color): { beforeSpeech: GameState; afterSpeech: GameState; victimId: string; effectId: string } {
  const white = color === 'white';
  let state = createGameState({
    fen: white ? WHITE_LOCK_FEN : BLACK_LOCK_FEN,
    hands: white ? { white: [DOOMSAYER], black: [] } : { white: [], black: [DOOMSAYER] },
  });
  state = move(state, white ? 'a2' : 'h7', white ? 'a3' : 'h6');
  state = playDoomsayer(state);
  const effectId = effectIds(state)[0]!;
  const victimId = pieceId(state, white ? 'e4' : 'e6');
  const afterSpeech = name(state, white ? 'black' : 'white', 'bishop', [{ effectId, pieceId: victimId }]);
  return { beforeSpeech: state, afterSpeech, victimId, effectId };
}

function laterLock(color: Color, rescue: boolean): { state: GameState; victimId: string; effectId: string } {
  const white = color === 'white';
  let state = createGameState({
    fen: white
      ? `k3r3/${rescue ? 'b6p' : '7p'}/8/8/4b3/8/P7/4K3 b - - 9 20`
      : `4k3/p7/4B3/8/8/${rescue ? 'B7' : '8'}/7P/K3R3 w - - 9 20`,
    hands: white
      ? { white: rescue ? ['anathema'] : [], black: [DOOMSAYER] }
      : { white: [DOOMSAYER], black: rescue ? ['anathema'] : [] },
  });
  state = move(state, white ? 'h7' : 'h2', white ? 'h6' : 'h3');
  state = playDoomsayer(state);
  state = applied(state, { type: 'declineDoomsayer', player: color });
  state = applied(state, { type: 'endTurn' });
  state = move(state, white ? 'a2' : 'a7', white ? 'a3' : 'a6');
  const effectId = effectIds(state)[0]!;
  const victimId = pieceId(state, white ? 'e4' : 'e6');
  state = name(state, white ? 'black' : 'white', 'bishop', [{ effectId, pieceId: victimId }]);
  return { state, victimId, effectId };
}

function assertSpeechMate(
  state: GameState,
  checkedColor: Color,
  victimId: string,
  effectId: string,
): void {
  assert.equal(isKingInCheck(state, checkedColor), true);
  assert.deepEqual(state.outcome, { winner: checkedColor === 'white' ? 'black' : 'white', reason: 'checkmate' });
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
  assert.deepEqual(activeDoomsayers(state), []);
  assert.equal(state.players.white.discard.concat(state.players.black.discard).filter(card => card.id === effectId).length, 1);
  assert.equal(state.history.at(-1)?.type, 'pieceNamed');
  assert.equal(state.history.at(-1)?.resolvedEffectIds?.[0], effectId);
  const ended = applyAction(state, { type: 'endTurn' });
  assert.equal(ended.ok, false);
  if (!ended.ok) assert.equal(ended.error.code, 'GAME_OVER');
}

test('immediate Black speech cannot hard-lock White after its move', () => {
  const { afterSpeech, victimId, effectId } = immediateLock('white');
  assertSpeechMate(afterSpeech, 'white', victimId, effectId);
});

test('immediate White speech cannot hard-lock Black after its move', () => {
  const { afterSpeech, victimId, effectId } = immediateLock('black');
  assertSpeechMate(afterSpeech, 'black', victimId, effectId);
});

test('a later Black pronunciation adjudicates an unrescuable White hard lock', () => {
  const { state, victimId, effectId } = laterLock('white', false);
  assertSpeechMate(state, 'white', victimId, effectId);
});

test('a later White pronunciation adjudicates an unrescuable Black hard lock', () => {
  const { state, victimId, effectId } = laterLock('black', false);
  assertSpeechMate(state, 'black', victimId, effectId);
});

test('later opposite-color speech preserves White usable after-move rescue', () => {
  let { state } = laterLock('white', true);
  assert.equal(isKingInCheck(state, 'white'), true);
  assert.equal(state.outcome, null);
  rejectedAtomically(state, { type: 'endTurn' });

  state = applied(state, {
    type: 'playCard', cardId: 'anathema', target: { bishop: 'a7', rook: 'e8' },
  });
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'black');
});

test('later opposite-color speech preserves Black usable after-move rescue', () => {
  let { state } = laterLock('black', true);
  assert.equal(isKingInCheck(state, 'black'), true);
  assert.equal(state.outcome, null);
  rejectedAtomically(state, { type: 'endTurn' });

  state = applied(state, {
    type: 'playCard', cardId: 'anathema', target: { bishop: 'a3', rook: 'e1' },
  });
  assert.equal(isKingInCheck(state, 'black'), false);
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'white');
});

test('Doomsayer continuing-effect mate resolves instead of fizzling', () => {
  const { beforeSpeech, afterSpeech, victimId, effectId } = immediateLock('white');
  assert.equal(beforeSpeech.history.at(-1)?.type, 'cardPlayed');
  assert.equal(afterSpeech.history.some(event => event.type === 'cardFizzled'), false);
  assert.equal(afterSpeech.history.at(-1)?.capturedIds?.[0], victimId);
  assert.equal(afterSpeech.history.at(-1)?.resolvedEffectIds?.[0], effectId);
  assert.deepEqual(afterSpeech.outcome, { winner: 'black', reason: 'checkmate' });
});

function twoEffects(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'): GameState {
  let state = createGameState({
    fen,
    hands: { white: [DOOMSAYER], black: [DOOMSAYER] },
    decks: { white: [], black: [] },
  });
  state = playDoomsayer(move(state, 'e2', 'e4'));
  state = applied(state, { type: 'declineDoomsayer', player: 'black' });
  state = applied(state, { type: 'endTurn' });
  state = playDoomsayer(move(state, 'e7', 'e5'));
  assert.deepEqual(activeDoomsayers(state).map(effect => effect.owner), ['white', 'black']);
  return state;
}

function canonicalKnightLosses(state: GameState): Array<{ effectId: string; pieceId: string }> {
  const ids = effectIds(state);
  return [
    { effectId: ids[0]!, pieceId: pieceId(state, 'b1') },
    { effectId: ids[1]!, pieceId: pieceId(state, 'g1') },
  ];
}

test('canonical mappings resolve exact effects in activation order to their owners discards', () => {
  const before = twoEffects();
  const losses = canonicalKnightLosses(before);

  const after = name(before, 'white', 'knight', losses);

  assert.deepEqual(after.history.at(-1)?.resolvedEffectIds, losses.map(loss => loss.effectId));
  assert.deepEqual(after.history.at(-1)?.capturedIds, losses.map(loss => loss.pieceId));
  assert.equal(after.players.white.discard.at(-1)?.id, losses[0]!.effectId);
  assert.equal(after.players.black.discard.at(-1)?.id, losses[1]!.effectId);
  assert.deepEqual(activeDoomsayers(after), []);
});

test('multiple effects with one victim consume only the oldest exact effect', () => {
  const before = twoEffects('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1');
  const ids = effectIds(before);
  const victimId = pieceId(before, 'b1');

  const after = name(before, 'white', 'knight', [{ effectId: ids[0]!, pieceId: victimId }]);

  assert.deepEqual(effectIds(after), [ids[1]!]);
  assert.deepEqual(after.history.at(-1)?.resolvedEffectIds, [ids[0]!]);
  assert.deepEqual(after.history.at(-1)?.capturedIds, [victimId]);
  assert.equal(after.players.white.discard.at(-1)?.id, ids[0]);
  assert.equal(after.players.black.discard.length, 0);
});

test('a no-match canonical pronunciation leaves all effects and cards in place', () => {
  const before = twoEffects('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1');
  const ids = effectIds(before);

  const after = name(before, 'white', 'queen', []);

  assert.deepEqual(effectIds(after), ids);
  assert.deepEqual(after.history.at(-1)?.resolvedEffectIds, []);
  assert.deepEqual(after.history.at(-1)?.capturedIds, []);
  assert.equal(after.players.white.discard.length, 0);
  assert.equal(after.players.black.discard.length, 0);
  assert.equal(after.pendingDoomsayer, null);
});

test('a stale resolved effect identity is rejected atomically', () => {
  const before = twoEffects('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1');
  const staleId = effectIds(before)[0]!;
  const once = name(before, 'white', 'knight', [{ effectId: staleId, pieceId: pieceId(before, 'b1') }]);

  rejectedAtomically(once, {
    type: 'namePiece', speaker: 'white', name: 'pawn',
    losses: [{ effectId: staleId, pieceId: pieceId(once, 'a2') }],
  } as unknown as GameAction);
});

const malformedMappingCases: Array<{
  label: string;
  losses: (state: GameState) => unknown;
}> = [
  {
    label: 'unknown effect identity',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [{ ...losses[0], effectId: 'unknown-doomsayer' }, losses[1]];
    },
  },
  {
    label: 'duplicate effect identity',
    losses: state => {
      const [first] = effectIds(state);
      return [
        { effectId: first, pieceId: pieceId(state, 'b1') },
        { effectId: first, pieceId: pieceId(state, 'g1') },
      ];
    },
  },
  {
    label: 'reordered effects',
    losses: state => canonicalKnightLosses(state).reverse(),
  },
  {
    label: 'duplicate stable piece identity',
    losses: state => effectIds(state).map(effectId => ({ effectId, pieceId: pieceId(state, 'b1') })),
  },
  {
    label: 'unknown piece identity',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [{ ...losses[0], pieceId: 'white-knight-missing' }, losses[1]];
    },
  },
  {
    label: 'square alias in pieceId',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [{ ...losses[0], pieceId: 'b1' }, losses[1]];
    },
  },
  {
    label: 'legacy square field',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [{ effectId: losses[0]!.effectId, square: 'b1' }, losses[1]];
    },
  },
  {
    label: 'missing effect identity',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [{ pieceId: losses[0]!.pieceId }, losses[1]];
    },
  },
  {
    label: 'non-string effect identity',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [{ ...losses[0], effectId: 7 }, losses[1]];
    },
  },
  {
    label: 'contradictory square alias',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [{ ...losses[0], square: 'g1' }, { ...losses[1], pieceId: losses[0]!.pieceId }];
    },
  },
  {
    label: 'contradictory victim identity',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [
        { ...losses[0], victimId: losses[1]!.pieceId },
        { ...losses[1], pieceId: losses[0]!.pieceId },
      ];
    },
  },
  {
    label: 'otherwise harmless extra field',
    losses: state => {
      const losses = canonicalKnightLosses(state);
      return [{ ...losses[0], note: 'first knight' }, losses[1]];
    },
  },
];

for (const fixture of malformedMappingCases) {
  test(`rejects ${fixture.label} atomically`, () => {
    const state = twoEffects();
    deepFreeze(state);
    rejectedAtomically(state, {
      type: 'namePiece', speaker: 'white', name: 'knight', losses: fixture.losses(state),
    } as unknown as GameAction);
  });
}

test('rejects an extra canonical mapping beyond the active-effect count', () => {
  const two = twoEffects();
  const first = name(two, 'white', 'queen', [{
    effectId: effectIds(two)[0]!, pieceId: pieceId(two, 'd1'),
  }]);
  const activeId = effectIds(first)[0]!;

  rejectedAtomically(first, {
    type: 'namePiece', speaker: 'white', name: 'rook',
    losses: [
      { effectId: activeId, pieceId: pieceId(first, 'a1') },
      { effectId: activeId, pieceId: pieceId(first, 'h1') },
    ],
  } as unknown as GameAction);
});
