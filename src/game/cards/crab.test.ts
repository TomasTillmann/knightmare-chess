import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import {
  applyAction,
  cardPlayTargets,
  isKingInCheck,
  legalDests,
  positionFor,
} from '../reducer.js';
import { createGameState } from '../state.js';
import type {
  BoardOrientation,
  Color,
  ConfabulationEffect,
  GameAction,
  GameState,
  Role,
  SquareName,
} from '../types.js';

const WHITE_CRAB_FEN = '7k/8/8/8/3P4/8/8/K7 w - - 0 1';

// FAQ p.20 explicitly resolves Paladin -> Coup; applying that movement
// conflict ruling and the later-Continuing-Effect rule to Crab is an analogy.
test('finding44c: later Coup restores an earlier Crab underlying Pawn move', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/2P5/8/7K w - - 0 1',
    hands: { white: ['crab', 'coup'] },
  });
  for (const action of [
    { type: 'move', from: 'h1', to: 'g1' },
    { type: 'playCard', cardId: 'crab', target: 'c3' },
    { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'endTurn' },
    { type: 'move', from: 'g1', to: 'h1' },
    { type: 'playCard', cardId: 'coup', target: 'c3' },
    { type: 'endTurn' },
    { type: 'move', from: 'g8', to: 'h8' },
    { type: 'endTurn' },
  ] satisfies GameAction[]) state = expectOk(state, action);
  const next = expectOk(state, { type: 'move', from: 'c3', to: 'c4' });
  assert.equal(next.pieces.find(piece => piece.id === 'white-pawn-c3')?.square, 'c4');
  expectError(state, { type: 'move', from: 'c3', to: 'b4' }, 'ILLEGAL_MOVE');
});

function coupCrabFixture({
  color = 'white', order = ['crab', 'coup'], square = 'c3',
  fen = '7k/8/8/8/8/2P5/8/7K w - - 0 1', extras = [],
  merge, orientation = 0,
}: {
  color?: Color; order?: string[]; square?: SquareName; fen?: string; extras?: string[];
  merge?: { from: SquareName; to: SquareName }; orientation?: 0 | 90;
} = {}) {
  const at = (s: SquareName): SquareName => orientation === 90
    ? `${String.fromCharCode(96 + Number(s[1]))}${s.charCodeAt(0) - 96}` as SquareName
    : color === 'white' ? s : `${s[0]}${9 - Number(s[1])}` as SquareName;
  const mirror = fen.split(' ')[0].split('/').reverse().join('/').replace(/[a-z]/gi,
    letter => letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase());
  let state = createGameState({
    fen: color === 'white' ? fen : `${mirror} b - - 0 1`, turn: color,
    hands: { [color]: [...order, ...extras] },
  });
  state.orientation = orientation;
  const cards = structuredClone(state.players[color].hand);
  let ownMoves = 0;
  let rounds = 0;
  const nextRound = (before: GameState): GameState => {
    let next = expectOk(before, { type: 'endTurn' });
    next = expectOk(next, { type: 'move', from: at(rounds % 2 ? 'g8' : 'h8'), to: at(rounds % 2 ? 'h8' : 'g8') });
    rounds += 1;
    return expectOk(next, { type: 'endTurn' });
  };
  const moveKing = (before: GameState): GameState => {
    const next = expectOk(before, { type: 'move', from: at(ownMoves % 2 ? 'g1' : 'h1'), to: at(ownMoves % 2 ? 'h1' : 'g1') });
    ownMoves += 1;
    return next;
  };
  let target = square;
  for (const cardId of order) {
    if (cardId !== 'confabulation') state = moveKing(state);
    state = expectOk(state, { type: 'playCard', cardId, target: cardId === 'confabulation'
      ? [{ from: at(merge!.from), to: at(merge!.to) }] : at(target) });
    if (cardId === 'confabulation') target = merge!.to;
    state = nextRound(state);
  }
  return { state, at, cards, nextRound, moveKing, target: at(target) };
}

for (const color of ['white', 'black'] as const) {
  for (const order of [['coup'], ['crab', 'coup'], ['coup', 'crab']]) {
    test(`finding44c: ${color} ${order.join(' then ')} chooses movement without changing captures or royalty`, () => {
      const { state, at } = coupCrabFixture({ color, order, fen: '7k/8/8/8/1n6/2P5/8/7K w - - 0 1' });
      const crabWins = order.at(-1) === 'crab';
      const snapshot = structuredClone(state);
      assert.equal(legalDests(state).get(at('c3'))?.includes(at('c4')) ?? false, !crabWins);
      assert.equal(legalDests(state).get(at('c3'))?.includes(at('d4')) ?? false, crabWins);
      const next = expectOk(state, { type: 'move', from: at('c3'), to: at(crabWins ? 'd4' : 'c4') });
      assert.equal(pieceAt(next, at(crabWins ? 'd4' : 'c4'))?.royal, true);
      expectError(state, { type: 'move', from: at('c3'), to: at(crabWins ? 'c4' : 'd4') }, 'ILLEGAL_MOVE');
      const captured = expectOk(state, { type: 'move', from: at('c3'), to: at('b4') });
      assert.equal(captured.history.at(-1)?.capturedId, pieceAt(state, at('b4'))!.id);
      assert.deepEqual(state, snapshot);
      assert.deepEqual(next.effects, state.effects);
    });
  }

  test(`finding44c: ${color} cancelling Coup restores the exact retained Crab`, () => {
    const { state, at, cards, moveKing, nextRound } = coupCrabFixture({ color, extras: ['peace-talks'] });
    const crab = cards.find(card => card.cardId === 'crab')!;
    const coup = cards.find(card => card.cardId === 'coup')!;
    assert.deepEqual(crabEffect(state)?.card, crab);
    assert.ok(!state.players[color].discard.some(card => card.id === crab.id));
    const ready = moveKing(state);
    assert.ok(cardPlayTargets(ready, 'peace-talks').includes(coup.id));
    const cancelled = expectOk(ready, { type: 'playCard', cardId: 'peace-talks', target: coup.id });
    const next = nextRound(cancelled);
    assert.deepEqual(crabEffect(next)?.card, crab);
    assert.deepEqual(next.players[color].discard.map(card => card.id).sort(),
      [coup.id, cards.find(card => card.cardId === 'peace-talks')!.id].sort());
    assert.equal(pieceAt(next, at('c3'))?.royal, false);
    expectOk(next, { type: 'move', from: at('c3'), to: at('d4') });
    expectError(next, { type: 'move', from: at('c3'), to: at('c4') }, 'ILLEGAL_MOVE');
  });

  test(`finding44c: ${color} preexisting Crab component obeys Coup with either carrier`, () => {
    for (const hidden of [false, true]) {
      const { state, at, target, cards, nextRound, moveKing } = coupCrabFixture({ color,
        fen: hidden ? '7k/8/8/8/3N4/2P5/8/7K w - - 0 1' : '7k/8/8/8/8/2P5/8/1N5K w - - 0 1',
        order: ['crab', 'confabulation', 'coup'], extras: ['peace-talks'],
        merge: hidden ? { from: 'c3', to: 'd4' } : { from: 'b1', to: 'c3' },
      });
      const forward = at(hidden ? 'd5' : 'c4');
      assert.ok(legalDests(state).get(target)?.includes(forward));
      const moved = expectOk(state, { type: 'move', from: target, to: forward });
      assert.equal(pieceAt(moved, forward)?.royal, true);
      assert.deepEqual(moved.effects, state.effects);
      const cancelled = expectOk(moveKing(state), { type: 'playCard', cardId: 'peace-talks',
        target: cards.find(card => card.cardId === 'coup')!.id });
      const resumed = nextRound(cancelled);
      expectError(resumed, { type: 'move', from: target, to: forward }, 'ILLEGAL_MOVE');
      expectOk(resumed, { type: 'move', from: target, to: at(hidden ? 'e5' : 'd4') });
    }
  });

  test(`finding44c: ${color} later Coup restores Dark Mirror and Breakthrough targets and actions`, () => {
    for (const cardId of ['dark-mirror', 'breakthrough']) {
      const to = cardId === 'dark-mirror' ? 'b2' : 'c4';
      for (const order of [['crab', 'coup'], ['coup', 'crab']]) {
        const { state, at } = coupCrabFixture({ color, order, extras: [cardId],
          fen: cardId === 'dark-mirror' ? '7k/8/8/8/8/2P5/1n6/7K w - - 0 1'
            : '7k/8/8/8/2n5/2P5/8/7K w - - 0 1' });
        const target = [{ from: at('c3'), to: at(to) }];
        assert.equal(cardPlayTargets(state, cardId).some(value => JSON.stringify(value) === JSON.stringify(target)), order[1] === 'coup');
        if (order[1] === 'crab') expectError(state, { type: 'playCard', cardId, target }, 'INVALID_TARGET');
        else {
          const next = expectOk(state, { type: 'playCard', cardId, target });
          assert.equal(pieceAt(next, at(to))?.royal, true);
          assert.equal(next.history.at(-1)?.capturedId, pieceAt(state, at(to))!.id);
          assert.deepEqual(next.effects, state.effects);
        }
      }
    }
  });

  test(`finding44c: ${color} Coup restores en-passant but later Crab keeps its quiet route`, () => {
    for (const order of [['crab', 'coup'], ['coup', 'crab']]) {
      const { state, at, moveKing } = coupCrabFixture({ color, order, square: 'c5',
        fen: '7k/3p4/8/2P5/8/8/8/7K w - - 0 1' });
      let ready = expectOk(moveKing(state), { type: 'endTurn' });
      ready = expectOk(ready, { type: 'move', from: at('d7'), to: at('d5') });
      ready = expectOk(ready, { type: 'endTurn' });
      assert.ok(legalDests(ready).get(at('c5'))?.includes(at('d6')));
      const next = expectOk(ready, { type: 'move', from: at('c5'), to: at('d6') });
      assert.equal(Boolean(pieceAt(next, at('d5'))), order[1] === 'crab');
      assert.equal(pieceAt(next, at('d6'))?.royal, true);
    }
  });
}

test('finding44c: movement priority follows rotated Pawn direction', () => {
  const { state, at } = coupCrabFixture({ orientation: 90, fen: 'K6k/8/8/8/8/2P5/8/8 w - - 0 1' });
  expectOk(state, { type: 'move', from: at('c3'), to: at('c4') });
  expectError(state, { type: 'move', from: at('c3'), to: at('b4') }, 'ILLEGAL_MOVE');
});

test('finding44c: Coup on another piece cannot suppress an unrelated later Crab', () => {
  const { state, at, moveKing, nextRound } = coupCrabFixture({ order: ['crab'],
    fen: '7k/8/8/8/8/2P2N2/8/7K w - - 0 1', extras: ['coup'] });
  const crowned = expectOk(moveKing(state), { type: 'playCard', cardId: 'coup', target: at('f3') });
  const next = nextRound(crowned);
  expectOk(next, { type: 'move', from: at('c3'), to: at('d4') });
  expectError(next, { type: 'move', from: at('c3'), to: at('c4') }, 'ILLEGAL_MOVE');
});

test('finding44c: promotion expires Crab while preserving active or suspended Coup', () => {
  for (const color of ['white', 'black'] as const) {
    for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as const) {
      const { state, at, cards } = coupCrabFixture({ color, square: 'c7',
        fen: '7k/2P5/8/8/8/8/8/7K w - - 0 1' });
      const next = expectOk(state, { type: 'move', from: at('c7'), to: at('c8'), promotion });
      const suspended = promotion === 'queen' || promotion === 'rook';
      assert.equal(pieceAt(next, at('c8'))?.royal, !suspended);
      assert.equal(pieceAt(next, at('h1'))?.royal, suspended);
      assert.equal(crabEffect(next), undefined);
      assert.deepEqual(next.players[color].discard, [cards.find(card => card.cardId === 'crab')!]);
      const coup = next.effects.find(effect => (effect as { type?: string }).type === 'coup') as { card: unknown; suspended?: boolean };
      assert.deepEqual(coup.card, cards.find(card => card.cardId === 'coup'));
      assert.equal(Boolean(coup.suspended), suspended);
    }
  }
});

test('finding44c: cancelling the newest Crab exposes Coup, then the earlier Crab', () => {
  const { state, at, cards, moveKing, nextRound } = coupCrabFixture({
    order: ['crab', 'coup', 'crab'], extras: ['peace-talks', 'peace-talks'] });
  expectOk(state, { type: 'move', from: at('c3'), to: at('d4') });
  const newestCrab = cards.filter(card => card.cardId === 'crab')[1];
  const normal = nextRound(expectOk(moveKing(state), { type: 'playCard', cardId: 'peace-talks', target: newestCrab.id }));
  expectOk(normal, { type: 'move', from: at('c3'), to: at('c4') });
  expectError(normal, { type: 'move', from: at('c3'), to: at('d4') }, 'ILLEGAL_MOVE');
  const resumed = nextRound(expectOk(moveKing(normal), { type: 'playCard', cardId: 'peace-talks', target: cards.find(card => card.cardId === 'coup')!.id }));
  expectOk(resumed, { type: 'move', from: at('c3'), to: at('d4') });
  assert.deepEqual(crabEffect(resumed)?.card, cards.find(card => card.cardId === 'crab'));
});

test('finding31: a Crab merger retains its ordinary Pawn component Dark Mirror capture', () => {
  let state = createGameState({
    fen: '7k/8/8/4Pn2/3P4/8/8/7K w - - 0 1',
    hands: { white: ['crab', 'confabulation', 'dark-mirror'] },
  });
  for (const action of [
    { type: 'move', from: 'h1', to: 'g1' },
    { type: 'playCard', cardId: 'crab', target: 'd4' },
    { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'confabulation', target: [{ from: 'd4', to: 'e5' }] },
    { type: 'endTurn' },
    { type: 'move', from: 'f5', to: 'd4' },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'e5', to: 'd4' }] },
  ] satisfies GameAction[]) state = expectOk(state, action);
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-f5')?.zone, 'captured');
});

function afterMoveState({
  fen = WHITE_CRAB_FEN,
  color = 'white',
  hand = ['crab'],
  deck = [],
  orientation = 0,
}: {
  fen?: string;
  color?: Color;
  hand?: string[];
  deck?: string[];
  orientation?: BoardOrientation;
} = {}): GameState {
  const state = createGameState({
    fen,
    turn: color,
    phase: 'afterMove',
    moveMade: true,
    hands: { [color]: hand },
    decks: { [color]: deck },
  });
  state.orientation = orientation;
  return state;
}

function expectOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function expectError(state: GameState, action: GameAction, code: string): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

function pawnMerger({
  mode = 'en-passant', color = 'white', crabs = ['d4'], fen,
  king = ['h1', 'g1'], pacifism = false, vendetta = false, victimMerger = false,
  orientation = 0, rescue = false,
}: {
  mode?: 'en-passant' | 'dark-mirror' | 'breakthrough'; color?: Color; crabs?: SquareName[];
  fen?: string; king?: [SquareName, SquareName]; pacifism?: boolean;
  vendetta?: boolean; victimMerger?: boolean; orientation?: 0 | 90; rescue?: boolean;
} = {}) {
  const at = (square: SquareName) => orientation === 90
    ? `${String.fromCharCode(96 + Number(square[1]))}${square.charCodeAt(0) - 96}` as SquareName
    : color === 'white' ? square : `${square[0]}${9 - Number(square[1])}` as SquareName;
  const base = fen ?? (orientation === 90 ? 'K6k/8/8/4P3/3P2p1/8/8/8 w - - 0 1' : mode === 'en-passant'
    ? `${victimMerger ? '2b4k' : '7k'}/3p4/8/4P3/3P4/8/8/7K w - - 0 1`
    : mode === 'breakthrough' ? '7k/8/8/4P1n1/3P4/8/8/7K w - - 0 1'
    : '7k/8/8/4Pn2/3P4/8/8/7K w - - 0 1');
  const mirrored = base.split(' ')[0].split('/').reverse().join('/').replace(/[a-z]/gi,
    letter => letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase());
  const opponent = color === 'white' ? 'black' : 'white';
  let state = createGameState({
    fen: color === 'white' ? base : `${mirrored} b - - 0 1`, turn: color,
    hands: {
      [color]: [...crabs.map(() => 'crab'), ...(pacifism ? ['pacifism'] : []), 'confabulation',
        ...(mode === 'en-passant' ? [] : [mode]), ...(rescue ? ['dungeon'] : [])],
      [opponent]: [...(vendetta ? ['vendetta'] : []), ...(victimMerger ? ['confabulation'] : [])],
    },
  });
  state.orientation = orientation;
  const prep = [...crabs.map(target => ({ cardId: 'crab', target })),
    ...(pacifism ? [{ cardId: 'pacifism', target: 'd4' as SquareName }] : [])];
  for (const [index, card] of prep.entries()) {
    if (card.cardId === 'pacifism') state = expectOk(state,
      { type: 'playCard', cardId: card.cardId, target: at(card.target) });
    state = expectOk(state, { type: 'move', from: at(king[index % 2]), to: at(king[1 - index % 2]) });
    if (card.cardId !== 'pacifism') state = expectOk(state,
      { type: 'playCard', cardId: card.cardId, target: at(card.target) });
    state = expectOk(state, { type: 'endTurn' });
    state = expectOk(state, victimMerger && index === 0
      ? { type: 'playCard', cardId: 'confabulation', target: [{ from: at('c8'), to: at('d7') }] }
      : { type: 'move', from: at(index % 2 ? 'g8' : 'h8'), to: at(index % 2 ? 'h8' : 'g8') });
    state = expectOk(state, { type: 'endTurn' });
  }
  state = expectOk(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: at('d4'), to: at('e5') }] });
  state = expectOk(state, { type: 'endTurn' });
  state = expectOk(state, mode === 'en-passant'
    ? { type: 'move', from: at('d7'), to: at('d5') }
    : mode === 'breakthrough' ? { type: 'move', from: at('g5'), to: at('e6') }
    : { type: 'move', from: at('f5'), to: at('d4') });
  if (vendetta) state = expectOk(state, { type: 'playCard', cardId: 'vendetta' });
  state = expectOk(state, { type: 'endTurn' });
  return { state, at };
}

for (const color of ['white', 'black'] as const) {
  for (const crab of ['d4', 'e5'] as const) {
    test(`finding31: ${color} Dark Mirror survives Crab on ${crab === 'e5' ? 'carrier' : 'hidden component'}`, () => {
      const { state, at } = pawnMerger({ color, crabs: [crab], mode: 'dark-mirror' });
      const target = [{ from: at('e5'), to: at('d4') }];
      assert.ok(cardPlayTargets(state, 'dark-mirror').some(value => JSON.stringify(value) === JSON.stringify(target)));
      const next = expectOk(state, { type: 'playCard', cardId: 'dark-mirror', target });
      assert.equal(next.history.at(-1)?.capturedId, pieceAt(state, at('d4'))!.id);
      assert.equal(pieceAt(next, at('d4'))!.id, pieceAt(state, at('e5'))!.id);
      assert.deepEqual(next.effects, state.effects);
      assert.equal(next.fen.split(' ')[4], '0');
    });

    test(`finding31: ${color} Crab on ${crab} retains both en-passant capture and quiet choices`, () => {
      const { state, at } = pawnMerger({ color, crabs: [crab] });
      const action: GameAction = { type: 'move', from: at('e5'), to: at('d6') };
      const victim = pieceAt(state, at('d5'))!;
      assert.ok(legalDests(state).get(at('e5'))?.includes(at('d6')));
      const captured = expectOk(state, action);
      assert.equal(captured.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
      assert.equal(captured.history.at(-1)?.capturedId, victim.id);
      const quiet = expectOk(state, { ...action, enPassant: false } as GameAction);
      assert.equal(pieceAt(quiet, at('d5'))?.id, victim.id);
      assert.equal(quiet.history.at(-1)?.capturedId, undefined);
      for (const next of [captured, quiet]) {
        assert.equal(pieceAt(next, at('d6'))?.id, pieceAt(state, at('e5'))?.id);
        assert.deepEqual(next.effects, state.effects);
        assert.deepEqual(next.enPassant, []);
        assert.equal(next.fen.split(' ')[4], '0');
      }
    });
  }

  test(`finding31: ${color} plain Pawns capture while all-Crab controls retain only their quiet move`, () => {
    for (const crabs of [[], ['d4', 'e5'], ['e5', 'd4']] as SquareName[][]) {
      const { state, at } = pawnMerger({ color, crabs });
      const next = expectOk(state, { type: 'move', from: at('e5'), to: at('d6') });
      assert.equal(Boolean(pieceAt(next, at('d5'))), crabs.length > 0);
      if (!crabs.length) expectError(state,
        { type: 'move', from: at('e5'), to: at('d6'), enPassant: false } as GameAction, 'ILLEGAL_MOVE');
      const mirror = pawnMerger({ color, crabs, mode: 'dark-mirror' });
      const action: GameAction = { type: 'playCard', cardId: 'dark-mirror', target: [{ from: at('e5'), to: at('d4') }] };
      // Retain the qualified continuing-effect conflict interpretation for all-Crab Dark Mirror.
      if (crabs.length) expectError(mirror.state, action, 'INVALID_TARGET');
      else assert.equal(expectOk(mirror.state, action).history.at(-1)?.capturedId,
        pieceAt(mirror.state, at('d4'))?.id);
    }
  });
}

test('finding31: Pacifism blocks both captures without blocking the Crab quiet route', () => {
  const { state } = pawnMerger({ pacifism: true });
  expectError(state, { type: 'move', from: 'e5', to: 'd6', enPassant: true } as GameAction, 'ILLEGAL_MOVE');
  const next = expectOk(state, { type: 'move', from: 'e5', to: 'd6', enPassant: false } as GameAction);
  assert.equal(pieceAt(next, 'd5')?.id, pieceAt(state, 'd5')?.id);
  const mirror = pawnMerger({ pacifism: true, mode: 'dark-mirror' });
  expectError(mirror.state, { type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'e5', to: 'd4' }] }, 'INVALID_TARGET');
});

test('finding31: legal destinations retain a safe quiet choice when en-passant exposes the King', () => {
  const { state } = pawnMerger({ fen: '7k/3p4/8/r3P3/3P3K/8/8/8 w - - 0 1', king: ['h4', 'h5'] });
  assert.ok(legalDests(state, false).get('e5')?.includes('d6'));
  expectError(state, { type: 'move', from: 'e5', to: 'd6' }, 'ILLEGAL_MOVE');
  const next = expectOk(state, { type: 'move', from: 'e5', to: 'd6', enPassant: false } as GameAction);
  assert.equal(isKingInCheck(next, 'white'), false);
});

test('finding31: en-passant can be the legal check escape while the quiet choice is illegal', () => {
  const { state } = pawnMerger({ fen: '7k/3p4/8/4P3/3P4/4K3/8/8 w - - 0 1', king: ['e3', 'e4'] });
  assert.equal(isKingInCheck(state, 'white'), true);
  assert.ok(legalDests(state, false).get('e5')?.includes('d6'));
  expectError(state, { type: 'move', from: 'e5', to: 'd6', enPassant: false } as GameAction, 'ILLEGAL_MOVE');
  assert.equal(isKingInCheck(expectOk(state, { type: 'move', from: 'e5', to: 'd6' }), 'white'), false);
});

test('finding31: Vendetta requires the actual capture, not the identical quiet destination', () => {
  const { state } = pawnMerger({ vendetta: true });
  assert.deepEqual(legalDests(state).get('e5'), ['d6']);
  expectError(state, { type: 'move', from: 'e5', to: 'd6', enPassant: false } as GameAction, 'ILLEGAL_MOVE');
  assert.equal(expectOk(state, { type: 'move', from: 'e5', to: 'd6' }).history.at(-1)?.capturedId,
    pieceAt(state, 'd5')?.id);
});

test('finding31: en-passant removes the whole victim merger and records both physical identities', () => {
  const { state } = pawnMerger({ victimMerger: true });
  const victim = state.effects.find((effect): effect is ConfabulationEffect =>
    typeof effect === 'object' && effect !== null && 'type' in effect && effect.type === 'confabulation'
    && 'owner' in effect && effect.owner === 'black');
  assert.ok(victim?.type === 'confabulation');
  const next = expectOk(state, { type: 'move', from: 'e5', to: 'd6', enPassant: true } as GameAction);
  assert.deepEqual(next.history.at(-1)?.capturedIds, victim.pieceIds);
  for (const id of victim.pieceIds) assert.equal(next.pieces.find(piece => piece.id === id)?.zone, 'captured');
  assert.equal(next.effects.filter(effect => typeof effect === 'object' && effect !== null
    && 'type' in effect && effect.type === 'confabulation').length, 1);
});

test('finding31: malformed or stale en-passant selection rejects atomically; quiet ordinary defaults survive', () => {
  let { state } = pawnMerger();
  for (const enPassant of [null, 'true', 0, {}, []]) expectError(state,
    { type: 'move', from: 'e5', to: 'd6', enPassant } as GameAction, 'ILLEGAL_MOVE');
  expectError(state, { type: 'move', from: 'e5', to: 'f6', enPassant: true } as GameAction, 'ILLEGAL_MOVE');
  state = expectOk(state, { type: 'move', from: 'g1', to: 'h1' });
  state = expectOk(state, { type: 'endTurn' });
  state = expectOk(state, { type: 'move', from: 'g8', to: 'h8' });
  state = expectOk(state, { type: 'endTurn' });
  expectError(state, { type: 'move', from: 'e5', to: 'd6', enPassant: true } as GameAction, 'ILLEGAL_MOVE');
  assert.ok(pieceAt(expectOk(state, { type: 'move', from: 'e5', to: 'd6' }), 'd5'));
});

test('finding31: rotated mixed Pawn movement retains both en-passant outcomes', () => {
  const { state, at } = pawnMerger({ orientation: 90 });
  for (const enPassant of [true, false]) {
    const next = expectOk(state, { type: 'move', from: at('e5'), to: at('d6'), enPassant });
    assert.equal(Boolean(pieceAt(next, at('d5'))), !enPassant);
  }
});

test('finding31: shared Breakthrough handler preserves the other Pawn component power', () => {
  for (const crab of ['d4', 'e5'] as SquareName[]) {
    const { state } = pawnMerger({ mode: 'breakthrough', crabs: [crab] });
    const target = [{ from: 'e5', to: 'e6' }];
    assert.ok(cardPlayTargets(state, 'breakthrough').some(value => JSON.stringify(value) === JSON.stringify(target)));
    const next = expectOk(state, { type: 'playCard', cardId: 'breakthrough', target });
    assert.equal(next.history.at(-1)?.capturedId, pieceAt(state, 'e6')?.id);
    assert.deepEqual(next.effects, state.effects);
  }
});

test('finding31: quiet choice can await a card rescue while capturing immediately removes check', () => {
  const { state } = pawnMerger({ fen: '7k/3p4/8/4P3/3P4/4K3/8/8 w - - 0 1', king: ['e3', 'e4'], rescue: true });
  const capture = expectOk(state, { type: 'move', from: 'e5', to: 'd6' });
  assert.equal(Boolean(capture.pendingRescue), false);
  const quiet = expectOk(state, { type: 'move', from: 'e5', to: 'd6', enPassant: false });
  assert.ok(quiet.pendingRescue);
  const rescued = expectOk(quiet, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd5', to: 'a8' }] });
  assert.equal(Boolean(rescued.pendingRescue), false);
  assert.equal(isKingInCheck(rescued, 'white'), false);
});

function transformedCrab({
  fen = WHITE_CRAB_FEN,
  color = 'white',
  square = 'd4',
  orientation = 0,
  deck = [],
}: {
  fen?: string;
  color?: Color;
  square?: SquareName;
  orientation?: BoardOrientation;
  deck?: string[];
} = {}): GameState {
  const played = expectOk(afterMoveState({ fen, color, orientation, deck }), {
    type: 'playCard',
    cardId: 'crab',
    target: square,
  });
  return {
    ...played,
    turn: {
      ...played.turn,
      color,
      phase: 'beforeMove',
      moveMade: false,
      cardPlays: { ...played.turn.cardPlays, [color]: 0 },
    },
  };
}

function pieceAt(state: GameState, square: SquareName) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function crabEffect(state: GameState) {
  return state.effects.find(effect => (
    typeof effect === 'object' && effect !== null && 'type' in effect && effect.type === 'crab'
  )) as undefined | {
    type: 'crab';
    owner: Color;
    card: { id: string; cardId: string };
    pieceId: string;
  };
}

function physicalCardCount(state: GameState, id: string): number {
  const heldCards = Object.values(state.players).flatMap(player => [
    ...player.hand, ...player.deck, ...player.discard,
  ]);
  const effectCards = state.effects.flatMap(effect => (
    typeof effect === 'object' && effect !== null && 'card' in effect ? [effect.card] : []
  ));
  return [...heldCards, ...effectCards].filter(instance => (
    typeof instance === 'object' && instance !== null && 'id' in instance && instance.id === id
  )).length;
}

const HOSTAGE_CRAB_CASES: Array<{
  color: Color;
  fen: string;
  king: [SquareName, SquareName];
  capture: [SquareName, SquareName];
  substitute: SquareName;
  diagonals: SquareName[];
  straight: SquareName[];
  wrongGeometry: SquareName[];
}> = [
  {
    color: 'white', fen: '7k/8/8/8/1p6/2P5/5P2/K7 w - - 0 1',
    king: ['a1', 'a2'], capture: ['b4', 'c3'], substitute: 'f2',
    diagonals: ['e3', 'g3'], straight: ['f3', 'f4'],
    wrongGeometry: ['e2', 'g2', 'e1', 'g1', 'd4', 'h4'],
  },
  {
    color: 'black', fen: 'k7/5p2/2p5/1P6/8/8/8/7K b - - 0 1',
    king: ['a8', 'a7'], capture: ['b5', 'c6'], substitute: 'f7',
    diagonals: ['e6', 'g6'], straight: ['f6', 'f5'],
    wrongGeometry: ['e7', 'g7', 'e8', 'g8', 'd5', 'h5'],
  },
];

function hostageReturnedCrab(fixture: typeof HOSTAGE_CRAB_CASES[number]) {
  const { color, fen, king, capture, substitute } = fixture;
  const before = createGameState({ fen, turn: color, hands: { [color]: ['crab', 'hostage'] } });
  const pawn = pieceAt(before, capture[1])!;
  const substitutePawn = pieceAt(before, substitute)!;
  const captor = pieceAt(before, capture[0])!;
  const card = before.players[color].hand.find(instance => instance.cardId === 'crab')!;
  let state = expectOk(before, { type: 'move', from: king[0], to: king[1] });
  state = expectOk(state, { type: 'playCard', cardId: 'crab', target: capture[1] });
  state = expectOk(state, { type: 'endTurn' });
  state = expectOk(state, { type: 'move', from: capture[0], to: capture[1] });
  assert.equal(state.pieces.find(piece => piece.id === pawn.id)?.zone, 'captured');
  state = expectOk(state, {
    type: 'playCard', cardId: 'hostage', target: { pieceId: pawn.id, pawn: substitute },
  });
  state = expectOk(state, { type: 'endTurn' });
  assert.equal(state.turn.color, color);
  return { state, pawn, substitutePawn, captor, card };
}

for (const fixture of HOSTAGE_CRAB_CASES) {
  const { color, capture, substitute, diagonals, straight, wrongGeometry } = fixture;

  test(`${color} Crab rescued immediately by Hostage keeps both quiet forward diagonals`, () => {
    const { state } = hostageReturnedCrab(fixture);
    assert.deepEqual([...(legalDests(state).get(substitute) ?? [])].sort(), diagonals);
  });

  for (const to of diagonals) {
    test(`${color} Hostage-returned Crab can actually move quietly to ${to}`, () => {
      const { state, pawn } = hostageReturnedCrab(fixture);
      const moved = expectOk(state, { type: 'move', from: substitute, to });
      assert.equal(pieceAt(moved, to)?.id, pawn.id);
      assert.equal(crabEffect(moved)?.pieceId, pawn.id);
    });
  }

  for (const to of straight) {
    test(`${color} Hostage-returned Crab rejects ordinary Pawn movement to ${to}`, () => {
      const { state } = hostageReturnedCrab(fixture);
      expectError(state, { type: 'move', from: substitute, to }, 'ILLEGAL_MOVE');
    });
  }

  test(`${color} Hostage-returned Crab still rejects sideways, backward, and distant diagonals`, () => {
    const { state } = hostageReturnedCrab(fixture);
    for (const to of wrongGeometry) {
      expectError(state, { type: 'move', from: substitute, to }, 'ILLEGAL_MOVE');
    }
  });

  test(`${color} Hostage rescue preserves physical Pawn identity and leaves the captor in place`, () => {
    const { state, pawn, substitutePawn, captor } = hostageReturnedCrab(fixture);
    const returned = pieceAt(state, substitute)!;
    assert.equal(returned.id, pawn.id);
    assert.equal(returned.owner, pawn.owner);
    assert.equal(returned.role, pawn.role);
    assert.equal(returned.originalRole, pawn.originalRole);
    assert.equal(returned.promoted, pawn.promoted);
    assert.equal(pieceAt(state, capture[1])?.id, captor.id);
    assert.equal(state.pieces.find(piece => piece.id === substitutePawn.id)?.zone, 'captured');
    assert.equal(state.pieces.filter(piece => piece.id === pawn.id).length, 1);
  });

  test(`${color} Hostage rescue restores exactly the original physical Crab card`, () => {
    const { state, pawn, card } = hostageReturnedCrab(fixture);
    assert.equal(physicalCardCount(state, card.id), 1);
    assert.equal(state.players[color].discard.filter(instance => instance.cardId === 'hostage').length, 1);
    assert.equal(crabEffect(state)?.owner, color);
    assert.equal(crabEffect(state)?.pieceId, pawn.id);
    assert.deepEqual(crabEffect(state)?.card, card);
  });
}

test('Crab exposes its exact printed metadata', () => {
  assert.deepEqual(CARD_CATALOG.crab, {
    id: 'crab',
    name: 'Crab',
    points: 5,
    unique: false,
    image: '/KC7_card1.png',
    description: 'One of your Pawns becomes a Crab for the rest of the game. Place a marker underneath it as a reminder. A Crab moves and captures diagonally, like a Bishop, but only forward and only one square at a time. If a Crab reaches the last rank, it is promoted like a regular Pawn.',
    timing: ['afterMove'],
    continuing: true,
  });
});

test('playing Crab after your move attaches the physical card and draws a replacement', () => {
  const before = afterMoveState({ deck: ['toll'] });
  const snapshot = structuredClone(before);
  const card = before.players.white.hand[0]!;
  const pawn = pieceAt(before, 'd4')!;
  const state = expectOk(before, { type: 'playCard', cardId: 'crab', target: 'd4' });

  assert.deepEqual(before, snapshot);
  assert.deepEqual(crabEffect(state), { type: 'crab', owner: 'white', card, pieceId: pawn.id });
  assert.deepEqual(state.players.white.hand.map(instance => instance.cardId), ['toll']);
  assert.deepEqual(state.players.white.deck, []);
  assert.deepEqual(state.players.white.discard, []);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardPlayed',
    cardId: 'crab',
    target: 'd4',
    movement: [],
    preservePreviousMove: true,
  });
});

test('Crab preserves the Pawn physical identity and both role identities', () => {
  const before = afterMoveState();
  const pawn = pieceAt(before, 'd4')!;
  const state = expectOk(before, { type: 'playCard', cardId: 'crab', target: 'd4' });
  const transformed = pieceAt(state, 'd4')!;

  assert.equal(transformed.id, pawn.id);
  assert.equal(transformed.role, 'pawn');
  assert.equal(transformed.originalRole, 'pawn');
  assert.equal(transformed.promoted, false);
  assert.equal(crabEffect(state)?.pieceId, transformed.id);
});

test('only an owned on-board Pawn is a legal Crab target', () => {
  const ownPawn = afterMoveState({ fen: '7k/8/8/3p4/3P4/8/2N5/K7 w - - 0 1' });
  assert.deepEqual(cardPlayTargets(ownPawn, 'crab'), ['d4']);
  expectError(ownPawn, { type: 'playCard', cardId: 'crab', target: 'd5' }, 'WRONG_OWNER');
  expectError(ownPawn, { type: 'playCard', cardId: 'crab', target: 'c2' }, 'WRONG_ROLE');
  expectError(ownPawn, { type: 'playCard', cardId: 'crab', target: 'e4' }, 'INVALID_TARGET');
});

test('Crab resolves the selected physical copy when duplicate cards are held', () => {
  const before = afterMoveState({ hand: ['crab', 'crab'] });
  const selected = before.players.white.hand[1]!;
  const state = expectOk(before, {
    type: 'playCard',
    cardId: 'crab',
    cardInstanceId: selected.id,
    target: 'd4',
  });

  assert.equal(crabEffect(state)?.card.id, selected.id);
  assert.deepEqual(state.players.white.hand.map(card => card.id), [before.players.white.hand[0]!.id]);
});

test('Crab is illegal before the move and failed play is atomic', () => {
  const before = createGameState({ fen: WHITE_CRAB_FEN, hands: { white: ['crab'] } });
  expectError(before, { type: 'playCard', cardId: 'crab', target: 'd4' }, 'INVALID_TIMING');
});

test('white and black Crabs move and capture one square diagonally forward', () => {
  const cases: Array<{ color: Color; fen: string; square: SquareName; expected: SquareName[] }> = [
    { color: 'white', fen: WHITE_CRAB_FEN, square: 'd4', expected: ['c5', 'e5'] },
    { color: 'black', fen: '7k/8/8/3p4/8/8/8/K7 b - - 0 1', square: 'd5', expected: ['c4', 'e4'] },
  ];
  for (const { color, fen, square, expected } of cases) {
    const state = transformedCrab({ color, fen, square });
    assert.deepEqual([...(legalDests(state).get(square) ?? [])].sort(), expected);
  }
});

test('Crab forward diagonals rotate with all four board orientations', () => {
  const cases: Array<[BoardOrientation, SquareName[]]> = [
    [0, ['c5', 'e5']],
    [90, ['e3', 'e5']],
    [180, ['c3', 'e3']],
    [270, ['c3', 'c5']],
  ];
  for (const [orientation, expected] of cases) {
    const state = transformedCrab({ orientation });
    assert.deepEqual([...(legalDests(state).get('d4') ?? [])].sort(), expected);
  }
});

test('Crab forbids straight, sideways, backward-diagonal, and distant moves', () => {
  const state = transformedCrab();
  const legal = new Set(legalDests(state).get('d4') ?? []);
  for (const square of ['d5', 'd3', 'c4', 'e4', 'c3', 'e3', 'b6', 'f6'] as SquareName[]) {
    assert.equal(legal.has(square), false, `${square} must be illegal`);
  }
  expectError(state, { type: 'move', from: 'd4', to: 'b6' }, 'ILLEGAL_MOVE');
});

test('friendly occupancy blocks either forward diagonal', () => {
  const state = transformedCrab({ fen: '7k/8/8/2N1N3/3P4/8/8/K7 w - - 0 1' });
  assert.deepEqual(legalDests(state).get('d4') ?? [], []);
});

test('enemy occupancy is capturable only on one-step forward diagonals', () => {
  const state = transformedCrab({
    fen: '7k/8/1n6/2n1n3/3P4/2n1n3/8/K7 w - - 0 1',
  });
  assert.deepEqual([...(legalDests(state).get('d4') ?? [])].sort(), ['c5', 'e5']);
});

test('moving a Crab relocates the same physical Pawn and carries its effect', () => {
  const state = transformedCrab();
  const pawn = pieceAt(state, 'd4')!;
  const moved = expectOk(state, { type: 'move', from: 'd4', to: 'c5' });

  assert.equal(pieceAt(moved, 'c5')?.id, pawn.id);
  assert.equal(pieceAt(moved, 'c5')?.originalRole, 'pawn');
  assert.equal(crabEffect(moved)?.pieceId, pawn.id);
  assert.deepEqual(moved.players.white.discard, []);
});

test('a Crab captures on its forward diagonal and remains transformed', () => {
  const state = transformedCrab({ fen: '7k/8/8/2n5/3P4/8/8/K7 w - - 0 1' });
  const crab = pieceAt(state, 'd4')!;
  const victim = pieceAt(state, 'c5')!;
  const moved = expectOk(state, { type: 'move', from: 'd4', to: 'c5' });

  assert.equal(pieceAt(moved, 'c5')?.id, crab.id);
  assert.equal(moved.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(crabEffect(moved)?.pieceId, crab.id);
});

test('capture preserves the physical Crab Pawn for a possible rescue', () => {
  const played = expectOk(afterMoveState({
    fen: '7k/3r4/8/8/3P4/8/8/K7 w - - 0 1',
  }), { type: 'playCard', cardId: 'crab', target: 'd4' });
  const crab = pieceAt(played, 'd4')!;
  const blackTurn = expectOk(played, { type: 'endTurn' });
  const captured = expectOk(blackTurn, { type: 'move', from: 'd7', to: 'd4' });

  assert.equal(captured.pieces.find(piece => piece.id === crab.id)?.zone, 'captured');
});

test('a Crab promotes to every ordinary Pawn promotion choice and keeps its identity', () => {
  for (const role of ['queen', 'rook', 'bishop', 'knight'] as Role[]) {
    const state = transformedCrab({
      fen: '8/3P4/7k/8/8/8/8/K7 w - - 0 1',
      square: 'd7',
    });
    const crab = pieceAt(state, 'd7')!;
    const promoted = expectOk(state, {
      type: 'move',
      from: 'd7',
      to: 'c8',
      promotion: role,
    });
    const piece = pieceAt(promoted, 'c8')!;

    assert.equal(piece.id, crab.id);
    assert.equal(piece.role, role);
    assert.equal(piece.originalRole, 'pawn');
    assert.equal(piece.promoted, true);
    assert.equal(crabEffect(promoted), undefined);
    assert.deepEqual(promoted.players.white.discard.map(card => card.cardId), ['crab']);
  }
});

test('a transformed Crab remains eligible for cards that name a Pawn', () => {
  const cases: Array<{ cardId: string; target: unknown; destination: SquareName }> = [
    { cardId: 'fanatic', target: 'd4', destination: 'd7' },
    { cardId: 'forced-march', target: [{ from: 'd4', to: 'c4' }], destination: 'c4' },
    { cardId: 'onslaught', target: [{ from: 'd4', to: 'd5' }], destination: 'd5' },
  ];
  for (const { cardId, target, destination } of cases) {
    const state = transformedCrab({ deck: [cardId] });
    const crab = pieceAt(state, 'd4')!;
    const targets = cardPlayTargets(state, cardId);
    assert.ok(targets.some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
    const moved = expectOk(state, { type: 'playCard', cardId, target });
    assert.equal(pieceAt(moved, destination)?.id, crab.id);
    assert.equal(crabEffect(moved)?.pieceId, crab.id);
  }
});

test('a neutral Pawn may become a Crab for either player but keeps its original owner direction', () => {
  const before = afterMoveState({ fen: '7k/8/8/8/3p4/8/8/K7 w - - 0 1' });
  const pawn = pieceAt(before, 'd4')!;
  pawn.neutral = true;

  assert.deepEqual(cardPlayTargets(before, 'crab'), ['d4']);
  const played = expectOk(before, { type: 'playCard', cardId: 'crab', target: 'd4' });
  assert.equal(crabEffect(played)?.owner, 'white');
  assert.equal(crabEffect(played)?.pieceId, pawn.id);

  const moveState: GameState = {
    ...played,
    turn: {
      ...played.turn,
      phase: 'beforeMove',
      moveMade: false,
      cardPlays: { ...played.turn.cardPlays, white: 0 },
    },
  };
  assert.deepEqual([...(legalDests(moveState).get('d4') ?? [])].sort(), ['c3', 'e3']);
});

test('Crab targets original Pawn identity and its later effect overrides transformed Bishop range', () => {
  const before = afterMoveState({ fen: '8/7k/8/8/3P4/8/8/K7 w - - 0 1' });
  const pawn = pieceAt(before, 'd4')!;
  pawn.role = 'bishop';
  const identity = {
    id: pawn.id,
    owner: pawn.owner,
    role: pawn.role,
    originalRole: pawn.originalRole,
    promoted: pawn.promoted,
  };

  assert.deepEqual(cardPlayTargets(before, 'crab'), ['d4']);
  const played = expectOk(before, { type: 'playCard', cardId: 'crab', target: 'd4' });
  const transformed = pieceAt(played, 'd4')!;
  assert.deepEqual({
    id: transformed.id,
    owner: transformed.owner,
    role: transformed.role,
    originalRole: transformed.originalRole,
    promoted: transformed.promoted,
  }, identity);
  assert.equal(crabEffect(played)?.pieceId, pawn.id);

  const moveState: GameState = {
    ...played,
    turn: {
      ...played.turn,
      phase: 'beforeMove',
      moveMade: false,
      cardPlays: { ...played.turn.cardPlays, white: 0 },
    },
  };
  assert.deepEqual([...(legalDests(moveState).get('d4') ?? [])].sort(), ['c5', 'e5']);
});

test('Crab movement cannot expose its own King to check', () => {
  const state = transformedCrab({
    fen: '3r3k/8/8/8/8/8/3P4/3K4 w - - 0 1',
    square: 'd2',
  });

  assert.deepEqual(legalDests(state).get('d2') ?? [], []);
  expectError(state, { type: 'move', from: 'd2', to: 'c3' }, 'ILLEGAL_MOVE');
});

test('a Crab Regular Move may give check', () => {
  const state = transformedCrab({
    fen: '8/8/1k6/8/3P4/8/8/K7 w - - 0 1',
  });
  const moved = expectOk(state, { type: 'move', from: 'd4', to: 'c5' });

  assert.equal(isKingInCheck(moved, 'black'), true);
  assert.equal(crabEffect(moved)?.pieceId, pieceAt(moved, 'c5')?.id);
});

test('a Crab Continuing Effect may participate in checkmate', () => {
  const state = transformedCrab({
    fen: 'k7/2K5/2P5/2B5/8/8/8/8 w - - 0 1',
    square: 'c6',
  });
  const moved = expectOk(state, { type: 'move', from: 'c6', to: 'b7' });

  assert.equal(positionFor(moved, 'black').isCheckmate(), true);
  assert.equal(crabEffect(moved)?.pieceId, pieceAt(moved, 'b7')?.id);
});
