import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

const position = () => createGameState({
  fen: '4k3/8/8/3n4/8/8/8/4K3 w - - 12 9',
  phase: 'afterMove', moveMade: true,
  hands: { white: ['dungeon'] }, decks: { white: ['peace-talks'] },
});

test('Dungeon has the printed non-Continuing metadata', () => {
  const card = CARD_CATALOG.dungeon;
  assert.equal(card?.name, 'Dungeon');
  assert.equal(card?.points, 7);
  assert.equal(card?.unique, false);
  assert.deepEqual(card?.timing, ['afterMove']);
  assert.equal(card?.continuing, false);
  assert.equal(card?.image, '/KC13_card3.png');
});
function play(state: GameState, from: SquareName = 'd5', to: SquareName = 'a8') {
  return applyAction(state, { type: 'playCard', cardId: 'dungeon', target: [{ from, to }] });
}

test('a later Dubbing authorizes movement despite the earlier regular Dungeon card', () => {
  let state = createGameState({
    fen: '7k/8/8/8/3N4/8/8/7K b - - 0 1',
    hands: { black: ['dungeon'], white: ['dubbing'] },
  });
  for (const action of [
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd4', to: 'a1' }] },
    { type: 'endTurn' },
  ] as const) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(applyAction(state, { type: 'move', from: 'a1', to: 'b3' }).ok, false);
  const result = applyAction(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'a1', to: 'b3' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.square === 'b3')?.role, 'knight');
});

function act42(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'input is immutable');
  assert.equal(result.ok, true, JSON.stringify({ action, error: result.ok ? undefined : result.error }));
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function jailed42(color: Color, cardId: string): GameState {
  const white = color === 'white';
  let state = createGameState({
    fen: white ? '7k/8/8/8/3N4/8/8/7K b - - 12 9' : '7k/8/8/3n4/8/8/8/7K w - - 12 9',
    hands: white ? { black: ['dungeon', 'chaos'], white: [cardId, cardId] }
      : { white: ['dungeon', 'chaos'], black: [cardId, cardId] },
    decks: { [color]: ['peace-talks'] },
  });
  state = act42(state, { type: 'move', from: white ? 'h8' : 'h1', to: white ? 'g8' : 'g1' });
  state = act42(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: white ? 'd4' : 'd5', to: white ? 'a1' : 'a8' }] });
  return act42(state, { type: 'endTurn' });
}

const laterMoves42 = [
  ['dubbing', 'b3', 'b6'], ['blessing', 'b2', 'b7'],
  ['masquerade', 'a3', 'a6'], ['long-jump', 'c4', 'c5'],
] as const;
for (const color of ['white', 'black'] as const) {
  for (const [cardId, whiteTo, blackTo] of laterMoves42) {
    test(`Dungeon permits only the authorized later ${color} ${cardId} movement`, () => {
      const state = jailed42(color, cardId);
      const before = structuredClone(state);
      const from = color === 'white' ? 'a1' : 'a8';
      const to = color === 'white' ? whiteTo : blackTo;
      const target = [{ from, to }];
      const prisoner = state.pieces.find(piece => piece.square === from)!;
      const selected = state.players[color].hand[1];
      assert.equal(legalDests(state).get(from)?.length ?? 0, 0);
      assert.equal(applyAction(state, { type: 'move', from, to: color === 'white' ? 'b3' : 'b6' }).ok, false);
      assert.ok(cardPlayTargets(state, cardId).some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
      const control = createGameState({ fen: state.fen, hands: { [color]: [cardId] } });
      assert.equal(applyAction(control, { type: 'playCard', cardId, target }).ok, true);
      const result = act42(state, { type: 'playCard', cardId, cardInstanceId: selected.id, target });
      assert.deepEqual(state, before);
      assert.deepEqual(result.pieces.find(piece => piece.id === prisoner.id), { ...prisoner, square: to });
      assert.deepEqual(result.effects, state.effects, 'the earlier restriction is retained');
      assert.deepEqual(result.players[color].discard, [selected]);
      assert.deepEqual(result.players[color].hand, [state.players[color].hand[0], state.players[color].deck[0]]);
      assert.equal(result.turn.cardPlays[color], 1);
      assert.equal(result.turn.moveMade, true);
      assert.equal(result.turn.phase, 'afterMove');
      assert.deepEqual(result.fen.split(' ').slice(4), ['14', '10']);
      assert.equal(applyAction(result, { type: 'move', from: to, to: from }).ok, false);
    });
  }
}

for (const [cardId, to] of laterMoves42) {
  test(`later ${cardId} still obeys a Continuing Effect immobilizer and target filtering`, () => {
    let state = createGameState({
      fen: '7k/8/8/8/3N4/8/8/1b5K b - - 0 1', phase: 'afterMove', moveMade: true,
      hands: { black: ['fatal-attraction', 'dungeon'], white: [cardId] },
    });
    for (const action of [
      { type: 'playCard', cardId: 'fatal-attraction', target: 'b1' }, { type: 'endTurn' },
      { type: 'move', from: 'h1', to: 'g1' }, { type: 'endTurn' },
      { type: 'move', from: 'h8', to: 'g8' },
      { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd4', to: 'a1' }] }, { type: 'endTurn' },
    ] as const) state = act42(state, action);
    const before = structuredClone(state);
    const target = [{ from: 'a1', to }];
    assert.equal(applyAction(state, { type: 'playCard', cardId, target }).ok, false);
    assert.ok(!cardPlayTargets(state, cardId).some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
    assert.deepEqual(state, before);
  });
}

test('a passive later card does not authorize an ordinary Dungeon move', () => {
  const state = jailed42('white', 'pacifism');
  const next = act42(state, { type: 'playCard', cardId: 'pacifism', target: 'a1' });
  assert.equal(next.turn.moveMade, false);
  assert.equal(applyAction(next, { type: 'move', from: 'a1', to: 'b3' }).ok, false);
  assert.equal(legalDests(next).get('a1')?.length ?? 0, 0);
});

test('canceling the later Dubbing restores the prisoner and ordinary prohibition', () => {
  const state = jailed42('white', 'dubbing');
  const moved = act42(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'a1', to: 'b3' }] });
  const canceled = act42(moved, { type: 'playCard', cardId: 'chaos' });
  assert.deepEqual(canceled.pieces, state.pieces);
  assert.deepEqual(canceled.effects, state.effects);
  assert.equal(canceled.turn.moveMade, false);
  assert.equal(applyAction(canceled, { type: 'move', from: 'a1', to: 'c2' }).ok, false);
  assert.equal(legalDests(canceled).get('a1')?.length ?? 0, 0);
});

test('Forced March shares the override in its direct handler and target enumeration', () => {
  let state = createGameState({ fen: '7k/8/8/8/3P4/8/8/7K b - - 0 1', hands: { black: ['dungeon'], white: ['forced-march'] } });
  for (const action of [
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd4', to: 'a1' }] }, { type: 'endTurn' },
  ] as const) state = act42(state, action);
  const target = [{ from: 'a1', to: 'b1' }];
  assert.ok(cardPlayTargets(state, 'forced-march').some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
  const next = act42(state, { type: 'playCard', cardId: 'forced-march', target });
  assert.equal(next.pieces.find(piece => piece.square === 'b1')?.role, 'pawn');
  assert.deepEqual(next.effects, state.effects);
});

test('a Dungeon prisoner can supply the only later-card check rescue', () => {
  let state = createGameState({
    fen: '8/8/8/8/3N4/5kb1/8/1r5K b - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { black: ['dungeon'], white: ['long-jump'] },
  });
  state = act42(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd4', to: 'a1' }] });
  state = act42(state, { type: 'endTurn' });
  assert.equal(isKingInCheck(state, 'white'), true);
  assert.equal(legalDests(state).size, 0);
  assert.equal(state.outcome, null, 'the later card must remain available as a rescue');
  const rescued = act42(state, { type: 'playCard', cardId: 'long-jump', target: [{ from: 'a1', to: 'f1' }] });
  assert.equal(isKingInCheck(rescued, 'white'), false);
  assert.equal(rescued.outcome, null);
  act42(rescued, { type: 'endTurn' });
});

test('a later movement card still fizzles if it fails to remove check', () => {
  let state = createGameState({
    fen: '6kr/8/8/8/3N4/8/8/7K b - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { black: ['dungeon'], white: ['long-jump'] }, decks: { white: ['peace-talks'] },
  });
  state = act42(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd4', to: 'a1' }] });
  state = act42(state, { type: 'endTurn' });
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'long-jump', target: [{ from: 'a1', to: 'c4' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.deepEqual(result.state.effects, state.effects);
  assert.equal(result.state.turn.moveMade, false);
  assert.deepEqual(result.state.players.white.discard, state.players.white.hand);
  assert.deepEqual(result.state.players.white.hand, state.players.white.deck);
  assert.deepEqual(state, before);
});

for (const corner of ['a1', 'a8', 'h1', 'h8'] as const) {
  test(`Dungeon relocates an enemy to fixed corner ${corner}`, () => {
    const state = position();
    const piece = state.pieces.find(piece => piece.square === 'd5')!;
    const result = play(state, 'd5', corner);
    assert.equal(result.ok, true);
    assert.deepEqual(result.state.pieces.find(candidate => candidate.id === piece.id), { ...piece, square: corner });
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  });
}

test('Dungeon spends and replaces exactly one card', () => {
  const result = play(position());
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['peace-talks']);
  assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['dungeon']);
  assert.equal(result.state.players.white.deck.length, 0);
  assert.equal(result.state.turn.cardPlays.white, 1);
});

test('Dungeon is unavailable before the regular move', () => {
  const state = position();
  state.turn.phase = 'beforeMove'; state.turn.moveMade = false;
  const result = play(state);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
  assert.deepEqual(result.state, state);
});

for (const target of [undefined, [], [{ from: 'd5', to: 'b8' }], [{ from: 'd5', to: 'a8' }, { from: 'e8', to: 'h8' }], [{ from: 'd4', to: 'a8' }]]) {
  test(`Dungeon rejects malformed or invalid target ${JSON.stringify(target)}`, () => {
    const state = position();
    const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

test('Dungeon rejects a royal target', () => {
  assert.equal(play(position(), 'e8').ok, false);
});

test('Dungeon rejects an owned non-neutral target', () => {
  const state = position();
  state.pieces.find(piece => piece.square === 'd5')!.owner = 'white';
  assert.equal(play(state).ok, false);
});

test('Dungeon preserves clocks and regular-move state', () => {
  const state = position();
  const result = play(state);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.fen.split(' ').slice(4), state.fen.split(' ').slice(4));
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
});

test('Dungeon offers all four empty fixed corners', () => {
  const offered = cardPlayTargets(position(), 'dungeon');
  for (const corner of ['a1', 'a8', 'h1', 'h8']) {
    assert.ok(offered.some(target => JSON.stringify(target) === JSON.stringify([{ from: 'd5', to: corner }])));
  }
});

test('Dungeon prevents the opponent regular move of the imprisoned piece', () => {
  const jailed = play(position());
  assert.equal(jailed.ok, true);
  const next = applyAction(jailed.state, { type: 'endTurn' });
  assert.equal(next.ok, true);
  assert.equal(legalDests(next.state).get('a8')?.length ?? 0, 0);
  assert.equal(applyAction(next.state, { type: 'move', from: 'a8', to: 'b6' }).ok, false);
});

test('Dungeon accepts a neutral piece even when owned by the actor', () => {
  const state = position();
  const piece = state.pieces.find(piece => piece.square === 'd5')!;
  piece.owner = 'white';
  piece.neutral = true;
  const result = play(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.pieces.find(candidate => candidate.id === piece.id), { ...piece, square: 'a8' });
});

test('Dungeon cannot capture an occupant of the chosen corner', () => {
  const state = createGameState({
    fen: 'r3k3/8/8/3n4/8/8/8/4K3 w - - 12 9',
    phase: 'afterMove', moveMade: true, hands: { white: ['dungeon'] },
  });
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
  assert.ok(!cardPlayTargets(state, 'dungeon').some(target => JSON.stringify(target) === JSON.stringify([{ from: 'd5', to: 'a8' }])));
});

test('Dungeon relocates a Pawn onto its last rank without promoting it', () => {
  const state = createGameState({
    fen: '4k3/8/8/3p4/8/8/8/4K3 w - - 12 9',
    phase: 'afterMove', moveMade: true, hands: { white: ['dungeon'] },
  });
  const result = play(state, 'd5', 'a1');
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  const pawn = state.pieces.find(piece => piece.square === 'd5')!;
  assert.deepEqual(result.state.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: 'a1' });
  assert.equal(result.state.pieces.find(piece => piece.id === pawn.id)?.role, 'pawn');
  assert.equal(result.state.pieces.find(piece => piece.id === pawn.id)?.promoted, false);
});

test('Dungeon ban expires after the opponent completes their following turn', () => {
  let result = play(position());
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  for (const action of [
    { type: 'endTurn' },
    { type: 'move', from: 'e8', to: 'f7' },
    { type: 'endTurn' },
    { type: 'move', from: 'e1', to: 'f2' },
    { type: 'endTurn' },
  ] as const) {
    result = applyAction(result.state, action);
    assert.equal(result.ok, true, JSON.stringify(action));
  }
  assert.ok(legalDests(result.state).get('a8')?.includes('b6'));
  assert.equal(applyAction(result.state, { type: 'move', from: 'a8', to: 'b6' }).ok, true);
});

for (const fixture of [
  { name: 'direct mate', fen: '5K1k/6r1/5QB1/8/8/8/8/8 w - - 0 1', from: 'g7', to: 'a1' },
  { name: 'self-check', fen: '4r2k/8/8/8/4n3/8/8/4K3 w - - 0 1', from: 'e4', to: 'a8' },
] as const) {
  test(`Dungeon fizzles when removing a blocker creates ${fixture.name}`, () => {
    const state = createGameState({
      fen: fixture.fen, phase: 'afterMove', moveMade: true,
      hands: { white: ['dungeon'] }, decks: { white: ['peace-talks'] },
    });
    assert.equal(isKingInCheck(state, 'white'), false, 'actor begins safe');
    assert.equal(isKingInCheck(state, 'black'), false, 'opponent begins safe');
    const staged = structuredClone(state);
    staged.pieces.find(piece => piece.square === fixture.from)!.square = fixture.to;
    if (fixture.name === 'direct mate') {
      assert.equal(positionFor(staged, 'black').isCheckmate(), true, 'fixture creates direct mate');
    } else {
      assert.equal(isKingInCheck(staged, 'white'), true, 'fixture exposes acting King');
    }
    const result = play(state, fixture.from, fixture.to);
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.deepEqual(result.state.pieces, state.pieces);
    assert.equal(result.state.fen, state.fen);
    assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['dungeon']);
    assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['peace-talks']);
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.equal(result.state.turn.phase, 'afterMove');
    assert.equal(result.state.turn.moveMade, true);
  });
}
