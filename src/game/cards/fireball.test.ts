import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState, SquareName } from '../types.js';

const initial = () => createGameState({ fen: '7k/8/8/8/8/8/3R4/K7 w - - 17 24', hands: { white: ['fireball'] } });
function move(state: GameState, from: SquareName, to: SquareName): GameState {
  const result = applyAction(state, { type: 'move', from, to });
  assert.equal(result.ok, true);
  return result.state;
}
function blast(state: GameState, target: SquareName) {
  return applyAction(state, { type: 'playCard', cardId: 'fireball', target });
}
function resolved(state: GameState, target: SquareName): GameState {
  const result = blast(state, target);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

test('Fireball has printed metadata', () => {
  assert.equal(CARD_CATALOG.fireball?.points, 10);
  assert.equal(CARD_CATALOG.fireball?.unique, false);
  assert.equal(CARD_CATALOG.fireball?.continuing, false);
  assert.deepEqual(CARD_CATALOG.fireball?.timing, ['afterMove']);
  assert.equal(CARD_CATALOG.fireball?.image, '/KC19_card4.png');
});

for (const target of ['a1', 'd2', 'e4', 'h8'] as const) {
  test(`rejects ineligible center ${target} atomically`, () => {
    const state = move(initial(), 'd2', 'd4');
    const before = structuredClone(state);
    const result = blast(state, target);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('rejects before the move', () => {
  const state = initial();
  assert.equal(blast(state, 'd2').ok, false);
});

test('an after-move flag alone does not supply a move trigger', () => {
  const state = createGameState({ fen: initial().fen, hands: { white: ['fireball'] }, phase: 'afterMove', moveMade: true });
  assert.equal(blast(state, 'd2').ok, false);
});

test('fabricated move history cannot supply the trigger', () => {
  const state = createGameState({ fen: initial().fen, hands: { white: ['fireball'] }, phase: 'afterMove', moveMade: true });
  state.history.push({ type: 'move', player: 'white', movedPieceId: 'white-rook-d2', from: 'd1', to: 'd2' });
  const before = structuredClone(state);
  const result = blast(state, 'd2');
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('malformed centers are rejected atomically', () => {
  const state = move(initial(), 'd2', 'd4');
  const before = structuredClone(state);
  for (const target of [null, undefined, '', 'z9', { from: 'd2', to: 'd4' }, ['d4']]) {
    const result = applyAction(state, { type: 'playCard', cardId: 'fireball', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('captures the moved physical center', () => {
  const state = move(initial(), 'd2', 'd4');
  const center = state.pieces.find(piece => piece.square === 'd4')!;
  const result = blast(state, 'd4');
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === center.id)?.zone, 'captured');
});

test('spends and replaces the card once', () => {
  const state = initial();
  state.players.white.deck.push({ id: 'replacement', cardId: 'hidden-passage' });
  const result = blast(move(state, 'd2', 'd4'), 'd4');
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['hidden-passage']);
  assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['fireball']);
  assert.equal(result.state.turn.cardPlays.white, 1);
});

test('keeps the completed move and resets only the halfmove clock', () => {
  const state = move(initial(), 'd2', 'd4');
  const result = blast(state, 'd4');
  assert.equal(result.ok, true);
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
  assert.deepEqual(result.state.fen.split(' ').slice(4), ['0', '24']);
  assert.equal(applyAction(result.state, { type: 'move', from: 'a1', to: 'b1' }).ok, false);
});

test('captures all eight adjacent squares simultaneously regardless of ownership', () => {
  const state = createGameState({ fen: '7k/8/8/2PpP3/2p1p3/1NPpP3/8/K7 w - - 0 1', hands: { white: ['fireball'] } });
  const moved = move(state, 'b3', 'd4');
  const expected = moved.pieces.filter(piece => !piece.royal).map(piece => piece.id).sort();
  const result = resolved(moved, 'd4');
  assert.deepEqual(result.pieces.filter(piece => piece.zone === 'captured').map(piece => piece.id).sort(), expected);
  assert.ok(result.pieces.filter(piece => piece.zone === 'captured').every(piece => piece.square === null));
  assert.equal(result.pieces.filter(piece => piece.zone === 'board').length, 2);
});

test('corner blast does not wrap across board edges', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/PpN4P/1P5K w - - 0 1', hands: { white: ['fireball'] } });
  const result = resolved(move(state, 'c2', 'a1'), 'a1');
  assert.deepEqual(result.pieces.filter(piece => piece.zone === 'captured').map(piece => piece.id).sort(), ['white-knight-c2', 'white-pawn-a2', 'black-pawn-b2', 'white-pawn-b1'].sort());
  assert.equal(result.pieces.find(piece => piece.id === 'white-pawn-h2')?.square, 'h2');
});

test('adjacent Kings survive the explosion', () => {
  const state = createGameState({ fen: '8/8/8/4k3/8/1NK5/8/8 w - - 0 1', hands: { white: ['fireball'] } });
  const result = resolved(move(state, 'b3', 'd4'), 'd4');
  assert.deepEqual(result.pieces.filter(piece => piece.royal).map(piece => [piece.square, piece.zone]), [['c3', 'board'], ['e5', 'board']]);
});

test('a moved King is not an eligible center', () => {
  const state = move(initial(), 'a1', 'b1');
  const before = structuredClone(state);
  assert.equal(blast(state, 'b1').ok, false);
  assert.deepEqual(state, before);
});

for (const color of ['white', 'black'] as const) {
  for (const replacement of [false, true]) {
    for (const center of [false, true]) {
      test(`Fireball ${center ? 'rejects' : 'spares'} ${color}'s ${replacement ? 'replacement Bishop' : 'original King'} Prince`, () => {
        const square = (value: SquareName) => (color === 'white' ? value : `${value[0]}${9 - Number(value[1])}`) as SquareName;
        let state = createGameState({
          fen: color === 'white' ? '7k/8/8/8/8/8/P7/2B1K1N1 w - - 0 1' : '2b1k1n1/p7/8/8/8/8/8/7K b - - 0 1',
          hands: { [color]: replacement ? ['coup', 'coup', 'fireball'] : ['coup', 'fireball'] },
        });
        const act = (action: GameAction) => {
          const result = applyAction(state, action);
          assert.equal(result.ok, true, JSON.stringify(action));
          if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
          state = result.state;
        };
        state = move(state, square('g1'), square('f3'));
        act({ type: 'playCard', cardId: 'coup', target: square(replacement ? 'c1' : 'a2') });
        act({ type: 'endTurn' });
        state = move(state, square('h8'), square('h7'));
        act({ type: 'endTurn' });
        if (replacement) {
          state = move(state, square('a2'), square('a3'));
          act({ type: 'playCard', cardId: 'coup', target: square('a3') });
          act({ type: 'endTurn' });
          state = move(state, square('h7'), square('h8'));
          act({ type: 'endTurn' });
        }
        const princeSquare = square(replacement ? 'c1' : 'e1');
        const prince = state.pieces.find(piece => piece.square === princeSquare)!;
        assert.equal(prince.royal, false);
        assert.equal(prince.role, 'king');
        state = move(state, center ? princeSquare : square('f3'), square('d2'));
        if (center) {
          const before = structuredClone(state);
          const result = blast(state, square('d2'));
          assert.equal(result.ok, false);
          assert.deepEqual(result.state, before);
          assert.deepEqual(cardPlayTargets(state, 'fireball'), []);
          assert.deepEqual(state, before);
        } else {
          assert.deepEqual(cardPlayTargets(state, 'fireball'), [square('d2')]);
          const result = resolved(state, square('d2'));
          assert.deepEqual(result.pieces.find(piece => piece.id === prince.id), prince);
          assert.deepEqual(result.pieces.filter(piece => piece.zone === 'captured').map(piece => piece.id).sort(),
            [`${color}-knight-${square('g1')}`, ...(!replacement ? [`${color}-bishop-${square('c1')}`] : [])].sort());
          assert.deepEqual(result.effects, state.effects);
        }
      });
    }
  }
}

for (const [fen, from, to] of [
  ['7k/8/8/8/3p4/8/3R4/K7 w - - 0 1', 'd2', 'd4'],
  ['7k/8/8/3pP3/8/8/8/K7 w - d6 0 1', 'e5', 'd6'],
] as const) {
  test(`opposing capture ${from}-${to} prevents the trigger`, () => {
    const state = move(createGameState({ fen, hands: { white: ['fireball'] } }), from, to);
    const before = structuredClone(state);
    const result = blast(state, to);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Black can explode its moved piece without incrementing fullmove twice', () => {
  const state = createGameState({ fen: '7k/3r4/8/8/8/8/8/K7 b - - 17 24', hands: { black: ['fireball'] } });
  const moved = move(state, 'd7', 'd5');
  const result = resolved(moved, 'd5');
  assert.equal(result.pieces.find(piece => piece.id === 'black-rook-d7')?.zone, 'captured');
  assert.deepEqual(result.fen.split(' ').slice(4), ['0', '25']);
  assert.equal(result.turn.color, 'black');
});

for (const [name, fen, from, to] of [
  ['self-check', '4r2k/8/8/8/8/8/4R3/4K3 w - - 17 24', 'e2', 'e3'],
  ['new direct checkmate', 'k7/2K5/P7/8/8/1N6/8/R7 w - - 17 24', 'b3', 'a5'],
] as const) {
  test(`${name} restores the pre-card board while spending and replacing Fireball`, () => {
    const state = createGameState({ fen, hands: { white: ['fireball'] }, decks: { white: ['hidden-passage'] } });
    const moved = move(state, from, to);
    const before = structuredClone(moved);
    const result = blast(moved, to);
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.deepEqual(result.state.pieces, before.pieces);
    assert.equal(result.state.fen, before.fen);
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.turn.phase, 'afterMove');
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['hidden-passage']);
    assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['fireball']);
  });
}
