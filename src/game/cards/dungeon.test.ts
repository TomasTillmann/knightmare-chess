import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';

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
