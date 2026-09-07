import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen } from '../reducer';
import { createGameState } from '../state';
import type { GameAction, GameState } from '../types';

const fixture = () => createGameState({
  fen: '7k/6n1/8/8/8/8/1P4P1/R3K3 w - - 7 3',
  hands: { white: ['plots-within-plots', 'pacifism', 'pacifism'] },
});

for (const [name, target] of [
  ['extra own property', { player: 'white', extra: true }],
  ['inherited player', Object.create({ player: 'white' })],
  ['symbol property', { player: 'white', [Symbol('extra')]: true }],
] as const) {
  test(`Plots rejects ${name} atomically`, () => {
    const before = fixture();
    const snapshot = structuredClone(before);
    const result = applyAction(before, { type: 'playCard', cardId: 'plots-within-plots', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, snapshot);
    assert.deepEqual(before, snapshot);
  });
}

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? undefined : result.error));
  return result.state;
}

function play(state: GameState, cardId: string, target?: unknown, cardInstanceId?: string): GameState {
  const next = act(state, { type: 'playCard', cardId, target, cardInstanceId });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, cardId);
  return next;
}

test('an invalid ordinary move preserves both additional plays', () => {
  const opened = play(fixture(), 'plots-within-plots');
  const rejected = applyAction(opened, { type: 'move', from: 'a1', to: 'b3' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, opened);
  const first = play(rejected.state, 'pacifism', 'b2');
  const second = play(first, 'pacifism', 'g2');
  assert.equal(second.turn.cardPlays.white, 3);
});

test('the explicitly selected physical Plots is spent', () => {
  const before = createGameState({
    fen: fixture().fen,
    hands: { white: ['plots-within-plots', 'plots-within-plots', 'pacifism'] },
  });
  const [unselected, selected] = before.players.white.hand;
  const opened = play(before, 'plots-within-plots', { player: 'white' }, selected.id);
  assert.ok(opened.players.white.discard.some(card => card.id === selected.id));
  assert.ok(opened.players.white.hand.some(card => card.id === unselected.id));
  assert.ok(!opened.players.white.hand.some(card => card.id === selected.id));
});

test('a valid nested self-check fizzle spends exactly one additional play', () => {
  const before = createGameState({
    fen: 'k3r3/8/8/8/8/8/1P2R1P1/4K3 w - - 7 3',
    hands: { white: ['plots-within-plots', 'dubbing', 'pacifism', 'pacifism'] },
  });
  const target = [{ from: 'e2', to: 'c3' }];
  const control = act(createGameState({ fen: before.fen, hands: { white: ['dubbing'] } }),
    { type: 'playCard', cardId: 'dubbing', target });
  assert.equal(control.history.at(-1)?.type, 'cardFizzled');
  assert.equal(control.history.at(-1)?.reason, 'SELF_CHECK');
  const opened = play(before, 'plots-within-plots');
  const fizzled = act(opened, { type: 'playCard', cardId: 'dubbing', target });
  assert.equal(fizzled.history.at(-1)?.type, 'cardFizzled');
  assert.equal(boardFen(fizzled), boardFen(opened));
  assert.equal(fizzled.turn.cardPlays.white, 2);
  const spent = play(fizzled, 'pacifism', 'b2');
  assert.equal(spent.turn.cardPlays.white, 3);
  const rejected = applyAction(spent, { type: 'playCard', cardId: 'pacifism', target: 'g2' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, spent);
});

test('an opposing nested reaction retains the original capture through another nested card', () => {
  const before = createGameState({
    fen: '7k/p6p/8/8/8/8/1P4P1/R3K3 w - - 7 3',
    hands: { black: ['plots-within-plots', 'revenge', 'revenge'] },
  });
  const captured = act(before, { type: 'move', from: 'a1', to: 'a7' });
  play(captured, 'revenge', 'b2');
  play(captured, 'revenge', 'g2');
  const opened = play(captured, 'plots-within-plots', { player: 'black' });
  const marked = play(opened, 'revenge', 'b2');
  const second = play(marked, 'revenge', 'g2');
  assert.equal(second.pieces.find(piece => piece.id === 'white-pawn-b2')?.zone, 'captured');
  assert.equal(second.pieces.find(piece => piece.id === 'white-pawn-g2')?.zone, 'captured');
  assert.equal(second.turn.cardPlays.black, 3);
});

function abductionPending(): GameState {
  const before = createGameState({
    fen: fixture().fen,
    hands: { white: ['plots-within-plots', 'abduction', 'crab'] },
  });
  const moved = act(before, { type: 'move', from: 'b2', to: 'b3' });
  return play(play(moved, 'plots-within-plots'), 'abduction', 'g7');
}

test('mandatory Abduction concealment blocks nested cards without spending their allowance', () => {
  const pending = abductionPending();
  assert.equal(pending.pendingAbduction?.phase, 'concealment');
  const result = applyAction(pending, { type: 'playCard', cardId: 'crab', target: 'g2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, pending);
  const revealed = act(result.state, { type: 'revealAbduction' });
  const answered = act(revealed, {
    type: 'answerAbduction', player: 'black', owner: 'black', role: 'knight', square: 'g7',
  });
  assert.ok(!answered.pendingAbduction);
  const finished = play(answered, 'crab', 'g2');
  assert.equal(finished.turn.cardPlays.white, 3);
  assert.ok(!finished.plotsExecution);
});

test('Abduction timeout resolves before remaining Plots credit and turn cleanup', () => {
  const revealed = act(abductionPending(), { type: 'revealAbduction' });
  const result = applyAction(revealed, { type: 'endTurn' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, revealed);
  const resolved = act(revealed, { type: 'abductionTimeout' });
  assert.ok(!resolved.pendingAbduction);
  const finished = play(resolved, 'crab', 'g2');
  const ended = act(finished, { type: 'endTurn' });
  assert.equal(ended.turn.color, 'black');
  assert.ok(!ended.plotsAllowances?.length);
  assert.ok(!ended.plotsExecution);
});

test('a nested Plots frame can admit a card drawn before its own opening', () => {
  const before = createGameState({
    fen: fixture().fen,
    hands: { white: ['plots-within-plots', 'plots-within-plots'] },
    decks: { white: ['pacifism'] },
  });
  const opened = play(before, 'plots-within-plots');
  const drawn = opened.players.white.hand.find(card => card.cardId === 'pacifism')!;
  assert.ok(drawn);
  const tooEarly = applyAction(opened, {
    type: 'playCard', cardId: 'pacifism', cardInstanceId: drawn.id, target: 'b2',
  });
  assert.equal(tooEarly.ok, false);
  assert.deepEqual(tooEarly.state, opened);
  const nested = play(opened, 'plots-within-plots');
  const used = play(nested, 'pacifism', 'b2', drawn.id);
  assert.equal(used.turn.cardPlays.white, 3);
});
