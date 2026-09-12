import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets, legalDests, underElfHillReturnSquares } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, Color, GameAction, GameState, SquareName } from '../types.js';

const peaceTalks = (id = 'peace-talks-1'): CardInstance => ({ id, cardId: 'peace-talks' });
const continuingCard = (cardId = 'doomsayer', id = `${cardId}-1`): CardInstance => ({ id, cardId });

function readyState(owner: Color = 'white'): GameState {
  const state = createGameState({
    turn: 'white',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: ['peace-talks'] },
    decks: { white: ['panic'] },
  });
  state.effects.push({ type: 'doomsayer', owner, card: continuingCard() });
  return state;
}

function play(state: GameState, target: unknown = 'doomsayer-1') {
  return applyAction(state, {
    type: 'playCard',
    cardId: 'peace-talks',
    cardInstanceId: state.players.white.hand[0]?.id,
    target,
  });
}

function assertAtomicRejection(state: GameState, target: unknown, code: string) {
  const before = structuredClone(state);
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'peace-talks',
    cardInstanceId: state.players.white.hand[0]?.id,
    target,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, before);
}

function royalConfabulation(owner: Color, capturePrince = false): GameState {
  const opponent = owner === 'white' ? 'black' : 'white';
  const square = (name: SquareName): SquareName => owner === 'white'
    ? name : (name[0] + String(9 - Number(name[1]))) as SquareName;
  let state = createGameState({
    fen: owner === 'white'
      ? 'k2r4/8/8/8/8/8/N7/2B1K3 w - - 0 1'
      : '2b1k3/n7/8/8/8/8/8/K2R4 b - - 0 1',
    hands: { [owner]: ['confabulation', 'coup'], [opponent]: ['peace-talks'] },
  });
  const actions: GameAction[] = [
    { type: 'playCard', cardId: 'confabulation', target: [{ from: square('a2'), to: square('c1') }] },
    { type: 'endTurn' },
    { type: 'move', from: square('d8'), to: square(capturePrince ? 'f8' : 'd7') },
    { type: 'endTurn' },
    { type: 'move', from: square('e1'), to: square('f1') },
    { type: 'playCard', cardId: 'coup', target: square('c1') },
    { type: 'endTurn' },
    { type: 'move', from: square(capturePrince ? 'f8' : 'd7'), to: square(capturePrince ? 'f1' : 'd8') },
  ];
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.ok(result.ok, JSON.stringify(result.ok ? action : result.error));
    state = result.state;
  }
  return state;
}

for (const owner of ['white', 'black'] as const) {
for (const targetCard of ['confabulation', 'coup'] as const) {
test(`cancelling ${owner} royal ${targetCard} restores the Prince and ends only the dependent effects`, () => {
  const state = royalConfabulation(owner);
  const before = structuredClone(state);
  const target = `${owner}-hand-${targetCard === 'confabulation' ? 0 : 1}-${targetCard}`;
  assert.ok(cardPlayTargets(state, 'peace-talks').includes(target));
  const result = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target });
  assert.ok(result.ok);
  const next = result.state;
  assert.deepEqual(state, before);
  const retained = targetCard === 'coup' ? [state.effects[0]] : [];
  assert.deepEqual(next.effects, retained);
  const prince = next.pieces.find(piece => piece.owner === owner && piece.originalRole === 'king')!;
  assert.equal(prince.royal, true);
  assert.equal(prince.square, owner === 'white' ? 'f1' : 'f8');
  assert.equal(next.pieces.find(piece => piece.owner === owner && piece.originalRole === 'bishop')?.royal, false);
  assert.deepEqual(next.players[owner].discard, targetCard === 'coup'
    ? [{ id: `${owner}-hand-1-coup`, cardId: 'coup' }]
    : [{ id: `${owner}-hand-0-confabulation`, cardId: 'confabulation' }, { id: `${owner}-hand-1-coup`, cardId: 'coup' }]);
  assert.deepEqual(next.players[state.turn.color].discard, [state.players[state.turn.color].hand[0]]);
});

test(`${owner} ${targetCard} is immune to Peace Talks after the composite King's Prince is captured`, () => {
  const state = royalConfabulation(owner, true);
  assert.equal(state.pieces.find(piece => piece.owner === owner && piece.originalRole === 'king')?.zone, 'captured');
  const target = `${owner}-hand-${targetCard === 'confabulation' ? 0 : 1}-${targetCard}`;
  assert.equal(cardPlayTargets(state, 'peace-talks').includes(target), false);
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, before);
});
}
}

test('ending copied Confabulation preserves the opposing merge and a later independent Coup', () => {
  let state = createGameState({
    fen: '2b1k3/n2r4/8/8/8/8/N7/2B1K1N1 b - - 0 1',
    hands: { white: ['haunting-memories', 'coup', 'coup'], black: ['confabulation', 'peace-talks'] },
  });
  const actions: GameAction[] = [
    { type: 'playCard', cardId: 'confabulation', target: [{ from: 'a7', to: 'c8' }] },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'haunting-memories', target: [{ from: 'a2', to: 'c1' }] },
    { type: 'endTurn' },
    { type: 'move', from: 'd7', to: 'd8' },
    { type: 'endTurn' },
    { type: 'move', from: 'e1', to: 'f1' },
    { type: 'playCard', cardId: 'coup', target: 'c1' },
    { type: 'endTurn' },
    { type: 'move', from: 'd8', to: 'd7' },
    { type: 'endTurn' },
    { type: 'move', from: 'f1', to: 'f2' },
    { type: 'playCard', cardId: 'coup', target: 'g1' },
    { type: 'endTurn' },
    { type: 'move', from: 'd7', to: 'd8' },
  ];
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.ok(result.ok, JSON.stringify(result.ok ? action : result.error));
    state = result.state;
  }
  const opposingMerge = structuredClone(state.effects[0]);
  const result = applyAction(state, {
    type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-haunting-memories',
  });
  assert.ok(result.ok);
  assert.deepEqual(result.state.effects, [opposingMerge, {
    type: 'coup', owner: 'white', card: { id: 'white-hand-2-coup', cardId: 'coup' },
    kingId: 'white-knight-g1', princeId: 'white-king-e1', princeRole: 'king',
  }]);
  assert.deepEqual(result.state.pieces.filter(piece => piece.owner === 'white' && piece.royal).map(piece => piece.id), ['white-knight-g1']);
  assert.deepEqual(result.state.players.white.discard, [
    { id: 'white-hand-0-haunting-memories', cardId: 'haunting-memories' },
    { id: 'white-hand-1-coup', cardId: 'coup' },
  ]);
  assert.deepEqual(result.state.players.black.discard, [{ id: 'black-hand-1-peace-talks', cardId: 'peace-talks' }]);
});

test('catalog records the exact printed Peace Talks metadata', () => {
  assert.deepEqual(CARD_CATALOG['peace-talks'], {
    id: 'peace-talks',
    name: 'Peace Talks',
    points: 5,
    unique: false,
    image: '/KC9_card1.png',
    description:
      'Remove any one "continuing effect" card from play, placing it in the owner\'s discard pile. The effect of that card is immediately cancelled. If any piece is left in an illegal situation, its owner must correct the problem on his next move or lose that piece.',
    timing: ['afterMove'],
    continuing: false,
  });
});

test('targets expose each active physical Continuing Effect card deterministically', () => {
  const state = readyState();
  state.effects.push({ type: 'pacifism', owner: 'black', card: continuingCard('pacifism', 'pacifism-7'), pieceId: 'black-pawn-a7' });
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), ['doomsayer-1', 'pacifism-7']);
});

test('a successful cancellation removes only the selected effect and its exact physical card', () => {
  const state = readyState('black');
  const spentPeaceTalks = state.players.white.hand[0]!;
  const replacement = state.players.white.deck[0]!;
  const untouched: GameState['effects'][number] = { type: 'doomsayer', owner: 'white', card: continuingCard('doomsayer', 'doomsayer-2') };
  state.effects.push(untouched);
  const before = structuredClone(state);
  const result = play(state);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.state.effects, [untouched]);
  assert.deepEqual(result.state.players.black.discard, [continuingCard()]);
  assert.deepEqual(result.state.players.white.discard, [spentPeaceTalks]);
  assert.deepEqual(result.state.players.white.hand, [replacement]);
  assert.deepEqual(result.state.players.white.deck, []);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.fen, before.fen);
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.turn.color, 'white');
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
  assert.notStrictEqual(result.state, state);
  assert.deepEqual(state, before);
});

test('either owner\'s Continuing Effect can be cancelled', () => {
  for (const owner of ['white', 'black'] as const) {
    const state = readyState(owner);
    const spentPeaceTalks = state.players.white.hand[0]!;
    const result = play(state);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.state.players[owner].discard,
        owner === 'white' ? [spentPeaceTalks, continuingCard()] : [continuingCard()],
      );
    }
  }
});

test('a suspended Continuing Effect remains targetable and cancellable', () => {
  const state = readyState('black');
  const pawn = state.pieces.find(piece => piece.id === 'black-pawn-a7');
  assert.ok(pawn);
  pawn.zone = 'captured';
  pawn.square = null;
  state.effects[0] = {
    type: 'pacifism',
    owner: 'black',
    card: continuingCard('pacifism', 'pacifism-4'),
    pieceId: pawn.id,
  };
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), ['pacifism-4']);
  const result = play(state, 'pacifism-4');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.state.effects, []);
    assert.deepEqual(result.state.players.black.discard, [continuingCard('pacifism', 'pacifism-4')]);
  }
});

test('Peace Talks is legal only after the acting player\'s move', () => {
  for (const turn of [
    { phase: 'beforeMove' as const, moveMade: false },
    { phase: 'afterMove' as const, moveMade: false },
    { phase: 'beforeMove' as const, moveMade: true },
  ]) {
    const state = readyState();
    Object.assign(state.turn, turn);
    assertAtomicRejection(state, 'doomsayer-1', 'INVALID_TIMING');
    assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  }
});

test('the one-card allowance is enforced', () => {
  const state = readyState();
  state.turn.cardPlays.white = 1;
  assertAtomicRejection(state, 'doomsayer-1', 'CARD_ALREADY_PLAYED');
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
});

test('the exact Peace Talks duplicate is spent', () => {
  const state = readyState('black');
  state.players.white.hand = [peaceTalks('peace-a'), peaceTalks('peace-b')];
  const replacement = state.players.white.deck[0]!;
  const result = applyAction(state, { type: 'playCard', cardId: 'peace-talks', cardInstanceId: 'peace-b', target: 'doomsayer-1' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.state.players.white.hand, [peaceTalks('peace-a'), replacement]);
    assert.deepEqual(result.state.players.white.discard, [peaceTalks('peace-b')]);
  }
});

test('a missing or stale physical target is rejected atomically', () => {
  for (const target of [undefined, 'missing-card', 'doomsayer-old']) {
    assertAtomicRejection(readyState(), target, 'INVALID_TARGET');
  }
});

test('a regular card and malformed target shapes are rejected atomically', () => {
  const regular = readyState();
  regular.effects[0] = { type: 'panic', owner: 'black', card: continuingCard('panic', 'panic-1') } as unknown as GameState['effects'][number];
  assertAtomicRejection(regular, 'panic-1', 'INVALID_TARGET');

  for (const target of [null, 1, {}, [], { cardInstanceId: 'doomsayer-1' }]) {
    assertAtomicRejection(readyState(), target, 'INVALID_TARGET');
  }
});

test('an effect with malformed physical-card identity is not targetable', () => {
  for (const effect of [
    { type: 'doomsayer', owner: 'white' },
    { type: 'doomsayer', owner: 'white', card: { id: 4, cardId: 'doomsayer' } },
    { type: 'doomsayer', owner: 'white', card: { id: 'doomsayer-1', cardId: 'panic' } },
    { type: 'doomsayer', owner: 'green', card: continuingCard() },
  ]) {
    const state = readyState();
    state.effects = [effect as unknown as GameState['effects'][number]];
    assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
    assertAtomicRejection(state, 'doomsayer-1', 'INVALID_TARGET');
  }
});

test('ambiguous duplicate physical-card identities are rejected atomically', () => {
  const state = readyState();
  state.effects.push({ type: 'doomsayer', owner: 'black', card: continuingCard() });
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  assertAtomicRejection(state, 'doomsayer-1', 'INVALID_TARGET');
});

test('game-over state rejects cancellation and exposes no targets', () => {
  const state = readyState();
  state.outcome = { winner: 'white', reason: 'checkmate' };
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  assertAtomicRejection(state, 'doomsayer-1', 'GAME_OVER');
});

for (const owner of ['white', 'black'] as const) {
for (const [role, letter] of [['knight', 'N'], ['bishop', 'B'], ['pawn', 'P']] as const) {
test(`Peace Talks cancels ${owner} Coup while its ${role} is temporarily away`, () => {
  const opponent = owner === 'white' ? 'black' : 'white';
  const square = (name: SquareName): SquareName => owner === 'white'
    ? name : (name[0] + String(9 - Number(name[1]))) as SquareName;
  let state = createGameState({
    fen: owner === 'white'
      ? `8/7k/8/8/8/2${letter}5/8/6K1 w - - 4 2`
      : `6k1/8/2${letter.toLowerCase()}5/8/8/8/7K/8 b - - 4 2`,
    hands: { [owner]: ['coup', 'under-elf-hill'], [opponent]: ['peace-talks'] },
  });
  const coup = state.players[owner].hand[0]!;
  const princeId = `${owner}-king-${square('g1')}`;
  const replacementId = `${owner}-${role}-${square('c3')}`;
  const act = (action: GameAction) => {
    const result = applyAction(state, action);
    assert.ok(result.ok, JSON.stringify(result.ok ? action : result.error));
    state = result.state;
  };
  for (const action of [
    { type: 'move', from: square('g1'), to: square('f1') },
    { type: 'playCard', cardId: 'coup', target: square('c3') },
    { type: 'endTurn' },
    { type: 'move', from: square('h7'), to: square('g6') },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'under-elf-hill' },
    { type: 'endTurn' },
    { type: 'move', from: square('g6'), to: square('h7') },
  ] as GameAction[]) act(action);
  assert.ok(cardPlayTargets(state, 'peace-talks').includes(coup.id));
  act({ type: 'playCard', cardId: 'peace-talks', target: coup.id });
  assert.equal(state.effects.length, 0);
  assert.equal(state.pieces.find(piece => piece.id === princeId)?.royal, true);
  const replacement = state.pieces.find(piece => piece.id === replacementId)!;
  assert.equal(replacement.royal, false);
  assert.equal(replacement.zone, 'away');
  assert.equal(replacement.square, null);
  assert.equal(replacement.role, role);
  assert.equal(state.underElfHill?.[0]?.pieceId, replacementId);
  assert.deepEqual(underElfHillReturnSquares(state), []);
  act({ type: 'endTurn' });
  assert.ok(underElfHillReturnSquares(state).includes(square('a4')));
  assert.equal(applyAction(state, { type: 'move', from: square('f1'), to: square('e1') }).ok, false);
  act({ type: 'returnKing', to: square('a4') });
  const returned = state.pieces.find(piece => piece.id === replacementId)!;
  assert.equal(returned.square, square('a4'));
  assert.equal(returned.zone, 'board');
  assert.equal(returned.royal, false);
  assert.equal(returned.role, role);
  assert.equal(legalDests(state).get(square('a4'))?.length ?? 0, 0);
  act({ type: 'move', from: square('f1'), to: square('e1') });
  act({ type: 'endTurn' });
  act({ type: 'move', from: square('h7'), to: square('g6') });
  act({ type: 'endTurn' });
  assert.ok((legalDests(state).get(square('a4'))?.length ?? 0) > 0);
});
}
}

test('Coup cannot be cancelled after the original Prince is lost', () => {
  const state = readyState();
  state.effects[0] = {
    type: 'coup',
    owner: 'black',
    card: continuingCard('coup', 'coup-3'),
    princeId: 'black-king-e8',
    kingId: 'black-rook-a8',
  } as unknown as GameState['effects'][number];
  const prince = state.pieces.find(piece => piece.id === 'black-king-e8');
  assert.ok(prince);
  prince.zone = 'dead';
  prince.square = null;
  prince.royal = false;
  const replacement = state.pieces.find(piece => piece.id === 'black-rook-a8');
  assert.ok(replacement);
  replacement.royal = true;

  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  assertAtomicRejection(state, 'coup-3', 'INVALID_TARGET');
});

test('cancelling Coup is allowed while restoring the living original King', () => {
  const state = readyState();
  state.effects[0] = {
    type: 'coup',
    owner: 'black',
    card: continuingCard('coup', 'coup-3'),
    princeId: 'black-king-e8',
    kingId: 'black-rook-a8',
  } as unknown as GameState['effects'][number];
  const prince = state.pieces.find(piece => piece.id === 'black-king-e8');
  const replacement = state.pieces.find(piece => piece.id === 'black-rook-a8');
  assert.ok(prince && replacement);
  prince.royal = false;
  replacement.royal = true;

  const result = play(state, 'coup-3');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.state.pieces.find(piece => piece.id === prince.id)?.royal, true);
    assert.equal(result.state.pieces.find(piece => piece.id === replacement.id)?.royal, false);
  }
});
