// Man-Trap focused behavior, authored independently before implementation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer';
import { createGameState } from '../state';
import { CARD_CATALOG } from './catalog';
import type { Color, GameAction, GameState, SquareName } from '../types';

const FEN = '3r3k/8/8/8/3N4/8/8/7K w - - 0 1';
function setup(fen = FEN) {
  return createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['man-trap'] } });
}
function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'public actions preserve their inputs');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}
function trap(state = setup(), target: unknown = 'd4') {
  return act(state, { type: 'playCard', cardId: 'man-trap', target });
}
function move(state: GameState, from: SquareName, to: SquareName) {
  assert.ok(legalDests(state).get(from)?.includes(to), `${from}-${to} must be legal`);
  return act(state, { type: 'move', from, to });
}
function end(state: GameState) { return act(state, { type: 'endTurn' }); }
function at(state: GameState, square: SquareName) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}
const traps = (state: GameState) => state.effects.filter(effect => (effect as { type?: string })?.type === 'man-trap');
const play = (state: GameState, cardId: string, target?: unknown) => act(state, { type: 'playCard', cardId, target });
function mirroredFen(fen: string, color: Color) {
  if (color === 'black') return fen;
  const [board, turn, ...rest] = fen.split(' ');
  return [board.split('/').reverse().join('/').replace(/[a-z]/gi, char =>
    char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase()), turn === 'w' ? 'b' : 'w', ...rest].join(' ');
}
const mirroredSquare = (square: SquareName, color: Color): SquareName => color === 'black'
  ? square : `${square[0]}${9 - Number(square[1])}` as SquareName;

for (const color of ['black', 'white'] as const) {
  const owner = color === 'black' ? 'white' : 'black';
  const sq = (square: SquareName) => mirroredSquare(square, color);
  for (const [role, from, fen] of [
    ['King', 'd5', '8/8/8/3k4/3P4/8/8/7K w - - 12 7'],
    ['Coup Knight', 'f5', '7k/8/8/5n2/3P4/8/8/7K b - - 12 7'],
    ['Coup Bishop', 'f6', '7k/8/5b2/8/3P4/8/8/7K b - - 12 7'],
    ['Coup Pawn', 'e5', '7k/8/8/4p3/3N4/8/8/7K b - - 12 7'],
  ] as const) {
    test(`${color} ${role} captures without triggering or discarding the physical trap`, () => {
      let state = createGameState({ fen: mirroredFen(fen, color), hands: { [owner]: ['man-trap'], [color]: role === 'King' ? [] : ['coup'] } });
      const card = state.players[owner].hand[0];
      if (role !== 'King') state = end(play(move(state, sq('h8'), sq('g8')), 'coup', sq(from)));
      state = end(trap(move(state, sq('h1'), sq('g1')), sq('d4')));
      const entrant = at(state, sq(from))!;
      const victim = at(state, sq('d4'))!;
      const effects = structuredClone(state.effects);
      const fullmove = Number(state.fen.split(' ')[5]) + Number(color === 'black');
      const next = move(state, sq(from), sq('d4'));
      assert.equal(entrant.royal, true);
      assert.deepEqual(at(next, sq('d4')), { ...entrant, square: sq('d4') });
      assert.deepEqual(next.pieces.find(piece => piece.id === victim.id), { ...victim, zone: 'captured', square: null, capturedBy: color });
      assert.deepEqual(next.effects, effects);
      assert.equal(traps(next).length, 1);
      assert.deepEqual(next.players[owner], state.players[owner]);
      assert.equal(next.players[owner].discard.some(candidate => candidate.id === card.id), false);
      assert.deepEqual(next.fen.split(' ').slice(4), ['0', String(fullmove)]);
    });
  }

  for (const trapFirst of [false, true]) {
    test(`${color} Pacifism ${trapFirst ? 'after' : 'before'} Man-Trap preserves the entrant and retained card`, () => {
      let state = createGameState({ fen: mirroredFen(`7k/8/8/1n3n2/3P4/8/8/7K ${trapFirst ? 'w' : 'b'} - - 12 7`, color), hands: { [owner]: ['man-trap'], [color]: ['pacifism'] } });
      const card = state.players[owner].hand[0];
      const vulnerableId = at(state, sq('b5'))!.id;
      if (!trapFirst) state = end(move(play(state, 'pacifism', sq('f5')), sq('h8'), sq('g8')));
      state = end(trap(move(state, sq('h1'), sq('g1')), sq('d4')));
      if (trapFirst) state = play(state, 'pacifism', sq('f5'));
      state = end(move(state, sq(trapFirst ? 'h8' : 'g8'), sq(trapFirst ? 'g8' : 'h8')));
      state = end(move(state, sq('d4'), sq('d5')));
      const entrant = at(state, sq('f5'))!;
      const next = move(state, sq('f5'), sq('d4'));
      assert.deepEqual(at(next, sq('d4')), { ...entrant, square: sq('d4') });
      assert.deepEqual(next.effects, state.effects);
      assert.equal(traps(next).length, 1);
      assert.deepEqual(next.players, state.players);
      assert.equal(Number(next.fen.split(' ')[4]), Number(state.fen.split(' ')[4]) + 1);
      state = end(move(end(next), sq('g1'), sq('f1')));
      state = end(move(state, sq('d4'), sq('f5')));
      state = end(move(state, sq('f1'), sq('g1')));
      state = move(state, sq('b5'), sq('d4'));
      assert.equal(state.pieces.find(piece => piece.id === vulnerableId)?.zone, 'captured');
      assert.equal(traps(state).length, 0);
      assert.deepEqual(state.players[owner].discard.filter(candidate => candidate.id === card.id), [card]);
      assert.equal(at(state, sq('f5'))?.id, entrant.id);
    });
  }

  test(`${color} neutral Knight remains vulnerable and consumes exactly its trap card`, () => {
    let state = createGameState({ fen: mirroredFen('7k/8/8/5n2/3P4/8/8/7K w - - 0 1', color), hands: { [owner]: ['neutrality', 'man-trap'] } });
    state = end(play(move(state, sq('h1'), sq('g1')), 'neutrality', sq('f5')));
    state = end(move(state, sq('h8'), sq('g8')));
    const card = state.players[owner].hand.find(candidate => candidate.cardId === 'man-trap')!;
    state = end(trap(move(state, sq('g1'), sq('f1')), sq('d4')));
    const entrant = at(state, sq('f5'))!;
    assert.equal(entrant.neutral, true);
    state = move(state, sq('f5'), sq('d4'));
    assert.equal(state.pieces.find(piece => piece.id === entrant.id)?.zone, 'captured');
    assert.equal(traps(state).length, 0);
    assert.deepEqual(state.players[owner].discard.filter(candidate => candidate.id === card.id), [card]);
  });
}

for (const protection of ['coup', 'pacifism'] as const) {
  test(`A composite with ${protection} on a component retains Man-Trap`, () => {
    let state = createGameState({ fen: '7k/8/3n4/5b2/3P4/8/8/7K b - - 0 1', hands: { white: ['man-trap'], black: ['confabulation', protection] } });
    if (protection === 'pacifism') {
      state = end(move(play(state, protection, 'd6'), 'h8', 'g8'));
      state = end(move(state, 'h1', 'g1'));
    }
    state = end(play(state, 'confabulation', [{ from: 'd6', to: 'f5' }]));
    state = end(trap(move(state, protection === 'pacifism' ? 'g1' : 'h1', protection === 'pacifism' ? 'f1' : 'g1')));
    if (protection === 'coup') {
      state = end(play(move(state, 'h8', 'g8'), 'coup', 'f5'));
      state = end(move(state, 'g1', 'f1'));
    }
    state = end(move(state, 'g8', 'h8'));
    state = end(move(state, 'd4', 'd5'));
    const components = state.pieces.filter(piece => piece.id === 'black-knight-d6' || piece.id === 'black-bishop-f5');
    if (protection === 'pacifism') assert.equal(components.find(piece => piece.id === 'black-knight-d6')?.zone, 'away');
    const next = move(state, 'f5', 'd4');
    assert.equal(at(next, 'd4')?.id, at(state, 'f5')?.id);
    for (const component of components) assert.deepEqual(next.pieces.find(piece => piece.id === component.id),
      { ...component, square: component.zone === 'board' ? 'd4' : component.square });
    assert.deepEqual(next.effects, state.effects);
    assert.deepEqual(next.players, state.players);
    assert.equal(traps(next).length, 1);
  });
}

test('Mystic Shield cannot rescue the vulnerable entrant after Man-Trap has captured it', () => {
  let state = createGameState({ fen: '7k/8/8/5n2/3P4/8/8/7K w - - 0 1', hands: { white: ['man-trap'], black: ['mystic-shield'] } });
  state = end(trap(move(state, 'h1', 'g1')));
  state = move(state, 'f5', 'd4');
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-f5')?.zone, 'captured');
  assert.equal(traps(state).length, 0);
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'd4' }).ok, false);
  assert.deepEqual(state, before);
});

test('Hidden Passage uses the same royal non-trigger rule for a card move', () => {
  let state = createGameState({ fen: '7k/8/8/8/3P4/8/8/7K w - - 0 1', hands: { white: ['man-trap'], black: ['hidden-passage'] } });
  state = end(trap(move(state, 'h1', 'g1')));
  state = end(move(state, 'h8', 'g8'));
  state = end(move(state, 'd4', 'd5'));
  const next = play(state, 'hidden-passage', [{ from: 'g8', to: 'd4' }]);
  assert.equal(at(next, 'd4')?.id, 'black-king-h8');
  assert.deepEqual(traps(next), traps(state));
  assert.deepEqual(next.players.white, state.players.white);
});

test('A protected King leaves Man-Trap armed for a later vulnerable entrant', () => {
  let state = createGameState({ fen: '8/8/8/3k1n2/3P4/8/8/7K w - - 0 1', hands: { white: ['man-trap'] } });
  const kingId = at(state, 'd5')!.id;
  const knightId = at(state, 'f5')!.id;
  const card = state.players.white.hand[0];
  state = end(trap(move(state, 'h1', 'g1')));
  state = move(state, 'd5', 'd4');
  assert.equal(at(state, 'd4')?.id, kingId);
  assert.equal(traps(state).length, 1);
  assert.equal(state.players.white.discard.length, 0);
  state = end(move(end(state), 'g1', 'f1'));
  state = end(move(state, 'd4', 'c5'));
  state = end(move(state, 'f1', 'g1'));
  state = move(state, 'f5', 'd4');
  assert.equal(state.pieces.find(piece => piece.id === knightId)?.zone, 'captured');
  assert.equal(traps(state).length, 0);
  assert.deepEqual(state.players.white.discard.filter(candidate => candidate.id === card.id), [card]);
});

test('Man-Trap has the printed metadata and timing', () => {
  const card = CARD_CATALOG['man-trap'];
  assert.ok(card);
  assert.equal(card.name, 'Man-Trap');
  assert.equal(card.points, 6);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, true);
  assert.deepEqual(card.timing, ['afterMove']);
});

for (const [name, target] of [['friendly knight', 'd4'], ['friendly King', 'h1']] as const) {
  test(`Man-Trap accepts a square occupied by a ${name}`, () => {
    const state = setup();
    const next = trap(state, target);
    assert.equal(boardFen(next), boardFen(state));
    assert.equal(next.players.white.hand.length, 0);
    assert.equal(next.players.white.discard.length, 0);
    assert.equal(next.effects.length, state.effects.length + 1);
  });
}

for (const target of ['d5', 'd8', 'h8', 'z9', null, { square: 'd4' }]) {
  test(`Man-Trap rejects an ineligible target ${JSON.stringify(target)}`, () => {
    const state = setup();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'man-trap', target });
    assert.equal(result.ok, false);
    assert.deepEqual(state, before);
  });
}

test('Man-Trap legal target oracle includes exactly the friendly occupied squares', () => {
  const state = setup();
  const accepted = cardPlayTargets(state, 'man-trap').filter(target =>
    applyAction(state, { type: 'playCard', cardId: 'man-trap', target }).ok);
  assert.deepEqual(accepted.sort(), ['d4', 'h1']);
});

test('Man-Trap captures the arriving enemy after its capture, preserving both identities', () => {
  const initial = setup();
  const victim = at(initial, 'd4')!;
  const attacker = at(initial, 'd8')!;
  const armed = trap(initial);
  const snapshot = structuredClone(armed);
  const result = move(end(armed), 'd8', 'd4');
  for (const original of [victim, attacker]) {
    const piece = result.pieces.find(piece => piece.id === original.id)!;
    assert.equal(piece.zone, 'captured');
    assert.equal(piece.square, null);
    assert.equal(piece.owner, original.owner);
    assert.equal(piece.role, original.role);
  }
  assert.equal(at(result, 'd4'), undefined);
  assert.equal(boardFen(result), '7k/8/8/8/8/8/8/7K');
  assert.equal(result.fen.split(' ')[0], boardFen(result));
  assert.equal(result.effects.length, 0);
  assert.equal(result.players.white.discard.filter(card => card.cardId === 'man-trap').length, 1);
  assert.deepEqual(armed, snapshot);
});

test('The trap remains on a vacated square and captures a noncapturing arrival', () => {
  let state = end(trap());
  state = end(move(state, 'h8', 'g8'));
  state = end(move(state, 'd4', 'f5'));
  const attackerId = at(state, 'd8')!.id;
  state = move(state, 'd8', 'd4');
  assert.equal(state.pieces.find(piece => piece.id === attackerId)!.zone, 'captured');
  assert.ok(at(state, 'f5'));
});

test('Passing through the vacated trap does not spring it', () => {
  let state = end(trap());
  state = end(move(state, 'h8', 'g8'));
  state = end(move(state, 'd4', 'f5'));
  state = move(state, 'd8', 'd2');
  assert.equal(at(state, 'd2')?.role, 'rook');
  assert.equal(state.effects.length, 1);
  assert.equal(state.players.white.discard.length, 0);
});

test('A friendly piece can return to the trap without springing it', () => {
  let state = end(trap());
  state = end(move(state, 'd8', 'a8'));
  state = end(move(state, 'd4', 'f5'));
  state = end(move(state, 'a8', 'b8'));
  state = move(state, 'f5', 'd4');
  assert.equal(at(state, 'd4')?.owner, 'white');
  assert.equal(state.effects.length, 1);
});

test('An enemy King captures normally and leaves the trap armed', () => {
  const initial = setup('8/8/8/4k3/3N4/8/8/7K w - - 0 1');
  const king = at(initial, 'e5')!;
  const victim = at(initial, 'd4')!;
  const result = move(end(trap(initial)), 'e5', 'd4');
  assert.equal(at(result, 'd4')?.id, king.id);
  assert.equal(result.pieces.find(piece => piece.id === victim.id)!.zone, 'captured');
  assert.equal(result.effects.length, 1);
  assert.equal(result.players.white.discard.filter(card => card.cardId === 'man-trap').length, 0);
});

test('Only the first opposing arrival is captured', () => {
  let state = end(trap(setup('3r3k/8/8/8/r2N4/8/8/7K w - - 0 1')));
  state = end(move(state, 'd8', 'd4'));
  state = end(move(state, 'h1', 'h2'));
  state = move(state, 'a4', 'd4');
  assert.equal(at(state, 'd4')?.owner, 'black');
  assert.equal(state.effects.length, 0);
  assert.equal(state.players.white.discard.length, 1);
});

test('Arming the trap does not publish its secret coordinate in card history', () => {
  const state = setup();
  const result = trap(state);
  const events = result.history.slice(state.history.length);
  assert.ok(events.some(event => event.type === 'cardPlayed' && event.cardId === 'man-trap'));
  assert.equal(JSON.stringify(events).includes('d4'), false);
});

test('Arming is immutable and a rejected replacement cannot change the sealed square', () => {
  const state = setup();
  const before = structuredClone(state);
  const armed = trap(state);
  assert.deepEqual(state, before);
  const snapshot = structuredClone(armed);
  const rejected = applyAction(armed, { type: 'playCard', cardId: 'man-trap', target: 'h1' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(armed, snapshot);
  const result = move(end(armed), 'd8', 'd4');
  assert.equal(at(result, 'd4'), undefined);
});

test('Man-Trap rejects a friendly occupied target before the regular move', () => {
  const state = createGameState({ hands: { white: ['man-trap'] } });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'man-trap', target: 'e2' }).ok, false);
});

test('Positive movement fixtures are independently legal without a trap', () => {
  const cases: Array<[string, Array<[SquareName, SquareName]>]> = [
    [FEN, [['d8', 'd4']]],
    [FEN, [['h8', 'g8'], ['d4', 'f5'], ['d8', 'd4']]],
    [FEN, [['h8', 'g8'], ['d4', 'f5'], ['d8', 'd2']]],
    [FEN, [['d8', 'a8'], ['d4', 'f5'], ['a8', 'b8'], ['f5', 'd4']]],
    ['8/8/8/4k3/3N4/8/8/7K b - - 0 1', [['e5', 'd4']]],
    ['3r3k/8/8/8/r2N4/8/8/7K b - - 0 1', [['d8', 'd4'], ['h1', 'h2']]],
    ['7k/8/8/8/r7/8/7K/8 b - - 0 1', [['a4', 'd4']]],
  ];
  for (const [fen, moves] of cases) {
    let state = createGameState({ fen, turn: 'black' });
    for (const [from, to] of moves) state = end(move(state, from, to));
  }
});
