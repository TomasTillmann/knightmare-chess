import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameState, PieceState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const validTarget = { knight: 'd4', targets: ['b5', 'f5'] };
test('Split Knight: catalog describes a seven-point non-unique regular replacement card', () => {
  const card = CARD_CATALOG['split-knight'];
  assert.ok(card);
  assert.equal(card.points, 7);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['beforeMove']);
  assert.equal(card.image, '/KC15_card2.png');
});
const cases = [
  ['two legal captures', validTarget, true],
  ['one target', { knight: 'd4', targets: ['b5'] }, false],
  ['no targets', { knight: 'd4', targets: [] }, false],
  ['duplicate target', { knight: 'd4', targets: ['b5', 'b5'] }, false],
  ['empty target', { knight: 'd4', targets: ['b5', 'f3'] }, false],
  ['illegal capture square', { knight: 'd4', targets: ['b5', 'h8'] }, false],
  ['empty source', { knight: 'e4', targets: ['b5', 'f5'] }, false],
  ['opposing source', { knight: 'b5', targets: ['d4', 'f5'] }, false],
  ['royal source', { knight: 'a1', targets: ['b5', 'f5'] }, false],
  ['source as target', { knight: 'd4', targets: ['b5', 'd4'] }, false],
] as const;

for (const [name, target, succeeds] of cases) {
  test(`Split Knight: ${name}`, () => {
    const state = createGameState({ fen: '7k/8/8/1p3p2/3N4/8/8/K7 w - - 11 3', hands: { white: ['split-knight'] } });
    const result = applyAction(state, { type: 'playCard', cardId: 'split-knight', target });
    if (succeeds) {
      assert.equal(result.ok, true);
      assert.ok(result.state.history.some(event => event.type === 'cardPlayed' && event.cardId === 'split-knight'));
      for (const square of ['d4', 'b5', 'f5']) {
        const id = state.pieces.find(piece => piece.square === square)!.id;
        const captured: PieceState = result.state.pieces.find(piece => piece.id === id)!;
        assert.equal(captured.zone, 'captured');
        assert.equal(captured.square, null);
      }
      assert.deepEqual(result.state.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square).sort(), ['a1', 'h8']);
    } else {
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, state);
    }
  });
}

const play = (state: GameState, target: unknown = validTarget) => applyAction(state, { type: 'playCard', cardId: 'split-knight', target });
const setup = (fen = '7k/8/8/1p3p2/3N4/8/8/K7 w - - 11 3') => createGameState({ fen, hands: { white: ['split-knight'], black: ['split-knight'] } });
const assertPlayed = (state: GameState) => assert.ok(state.history.some(event => event.type === 'cardPlayed' && event.cardId === 'split-knight'));

test('Split Knight: spends and replaces exactly one physical card and consumes the move', () => {
  const state = createGameState({ fen: '7k/8/8/1p3p2/3N4/8/8/K7 w - - 11 3', hands: { white: ['split-knight', 'split-knight'] }, decks: { white: ['truce', 'pacifism'] } });
  const before = structuredClone(state);
  const result = play(state);
  assert.equal(result.ok, true);
  assertPlayed(result.state);
  assert.deepEqual(state, before);
  assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['split-knight', 'truce']);
  assert.deepEqual(result.state.players.white.discard, [state.players.white.hand[0]]);
  assert.deepEqual(result.state.players.white.deck.map(card => card.cardId), ['pacifism']);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.deepEqual(result.state.fen.split(' ').slice(4), ['0', '3']);
});

test('Split Knight: Black captures reset halfmove and advance fullmove once', () => {
  const result = play(setup('7k/8/8/1P3P2/3n4/8/8/K7 b - - 11 3'));
  assert.equal(result.ok, true);
  assertPlayed(result.state);
  assert.equal(result.state.turn.cardPlays.black, 1);
  assert.equal(result.state.turn.moveMade, true);
  assert.deepEqual(result.state.fen.split(' ').slice(4), ['0', '4']);
});

test('Split Knight: any subset of available captures leaves unselected victims intact', () => {
  const state = setup('7k/8/2p5/1p3p2/3N4/8/8/K7 w - - 11 3');
  const survivor = state.pieces.find(piece => piece.square === 'c6');
  const result = play(state);
  assert.equal(result.ok, true);
  assertPlayed(result.state);
  assert.deepEqual(result.state.pieces.find(piece => piece.id === survivor!.id), survivor);
});

test('Split Knight: captures more than two victims in one resolution', () => {
  const result = play(setup('7k/8/2p1p3/1p3p2/3N4/8/8/K7 w - - 11 3'), { knight: 'd4', targets: ['c6', 'e6', 'b5', 'f5'] });
  assert.equal(result.ok, true);
  assertPlayed(result.state);
  assert.equal(result.state.pieces.filter(piece => piece.zone === 'captured').length, 5);
});

test('Split Knight: clears old en passant availability', () => {
  const state = setup('7k/8/8/1pPp1p2/3N4/8/8/K7 w - d6 11 3');
  assert.equal(state.enPassant.length, 1);
  const result = play(state);
  assert.equal(result.ok, true);
  assertPlayed(result.state);
  assert.deepEqual(result.state.enPassant, []);
  assert.equal(result.state.fen.split(' ')[3], '-');
});

for (const [name, change] of [
  ['friendly victim', (_state: GameState) => {}],
  ['royal victim', (state: GameState) => { state.pieces.find(piece => piece.square === 'h8')!.royal = false; state.pieces.find(piece => piece.square === 'b5')!.royal = true; }],
  ['royal Knight', (state: GameState) => { state.pieces.find(piece => piece.square === 'a1')!.royal = false; state.pieces.find(piece => piece.square === 'd4')!.royal = true; }],
  ['already moved', (state: GameState) => { state.turn.moveMade = true; state.turn.phase = 'afterMove'; }],
] as const) {
  test(`Split Knight: rejects ${name} atomically`, () => {
    const state = name === 'friendly victim' ? setup('7k/8/8/1P3p2/3N4/8/8/K7 w - - 11 3') : setup();
    change(state);
    const before = structuredClone(state);
    const result = play(state);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });
}

test('Split Knight: current Knight qualifies after promotion', () => {
  const state = setup();
  const knight = state.pieces.find(piece => piece.square === 'd4')!;
  knight.originalRole = 'pawn';
  knight.promoted = true;
  const result = play(state);
  assert.equal(result.ok, true);
  assertPlayed(result.state);
  assert.equal(result.state.pieces.find(piece => piece.id === knight.id)!.zone, 'captured');
});

test('Split Knight: transformed original Knight captures using its current powers', () => {
  const state = setup('7k/8/8/8/1p1R1p2/8/8/K7 w - - 11 3');
  state.pieces.find(piece => piece.square === 'd4')!.originalRole = 'knight';
  const result = play(state, { knight: 'd4', targets: ['b4', 'f4'] });
  assert.equal(result.ok, true);
  assertPlayed(result.state);
  assert.equal(result.state.pieces.filter(piece => piece.zone === 'captured').length, 3);
});

for (const [reason, fen, target] of [
  ['SELF_CHECK', '1r5k/8/8/1p3p2/3N4/8/8/1K6 w - - 0 1', validTarget],
  ['DIRECT_MATE', '1Q3b1k/3N1K1p/5p2/8/8/8/8/8 w - - 0 1', { knight: 'd7', targets: ['f8', 'f6'] }],
] as const) {
  test(`Split Knight: complete-result ${reason} fizzles and spends the replacement move`, () => {
    const state = setup(fen);
    const result = play(state, target);
    assert.equal(result.ok, true);
    assert.deepEqual(result.state.pieces, state.pieces);
    assert.equal(result.state.fen.split(' ')[0], state.fen.split(' ')[0]);
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.deepEqual(result.state.players.white.discard, state.players.white.hand);
    assert.ok(result.state.history.some(event => event.type === 'cardFizzled' && event.reason === reason));
  });
}
