import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck } from '../reducer.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const target = { pieceId: 'black-knight-d4', pawn: 'b7' };
test('Hostage fizzles instead of checking the mover after its completed move', () => {
  const initial = createGameState({ fen: '7k/1q6/8/p7/8/8/8/KR6 w - - 0 1', hands: { black: ['hostage'] }, decks: { black: ['crab'] } });
  const capture = applyAction(initial, { type: 'move', from: 'b1', to: 'b7' });
  assert.equal(capture.ok, true);
  const result = applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-queen-b7', pawn: 'a5' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.deepEqual(result.state.pieces, capture.state.pieces);
  assert.equal(result.state.fen, capture.state.fen);
  assert.equal(result.state.outcome, null);
  assert.equal(isKingInCheck(result.state, 'white'), false);
  assert.deepEqual(result.state.players.black.hand.map(c => c.cardId), ['crab']);
  assert.deepEqual(result.state.players.black.discard.map(c => c.cardId), ['hostage']);
  assert.deepEqual(result.state.turn, { ...capture.state.turn, cardPlays: { white: 0, black: 1 } });
  assert.equal(applyAction(result.state, { type: 'endTurn' }).ok, true);
});
test('Hostage has the printed regular reaction card metadata', () => {
  const card = CARD_CATALOG.hostage;
  assert.ok(card);
  assert.equal(card.points, 9);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC17_card4.png');
  assert.deepEqual(new Set(card.timing), new Set(['afterOpponentMove', 'afterOpponentCard']));
});
function captured(): GameState {
  const initial = createGameState({ fen: '7k/1p4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] }, decks: { black: ['crab'] } });
  const result = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(result.ok, true, 'ordinary capture fixture');
  assert.equal(result.state.pieces.find(p => p.id === target.pieceId)?.zone, 'captured');
  return result.state;
}
function play(state = captured(), value: unknown = target): GameState {
  const result = applyAction(state, { type: 'playCard', cardId: 'hostage', target: value });
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'hostage');
  return result.state;
}

test('Hostage returns the captured identity to the substitute square', () => {
  const state = play();
  const piece = state.pieces.find(p => p.id === target.pieceId);
  assert.equal(piece?.zone, 'board');
  assert.equal(piece?.square, 'b7');
  assert.equal(piece?.owner, 'black');
  assert.equal(piece?.role, 'knight');
  assert.equal(piece?.originalRole, 'knight');
});
test('Hostage captures the substitute original Pawn', () => {
  const pawn = play().pieces.find(p => p.id === 'black-pawn-b7');
  assert.equal(pawn?.zone, 'captured');
  assert.equal(pawn?.square, null);
});
test('Hostage leaves the original capturer in place', () => {
  assert.equal(play().pieces.find(p => p.id === 'white-rook-a4')?.square, 'd4');
});
test('Hostage preserves the active turn phase and move status', () => {
  const before = captured();
  const after = play(before);
  assert.equal(after.turn.color, before.turn.color);
  assert.equal(after.turn.phase, before.turn.phase);
  assert.equal(after.turn.moveMade, before.turn.moveMade);
});
test('Hostage spends only the reactor allowance and physical card', () => {
  const state = play();
  assert.deepEqual(state.turn.cardPlays, { white: 0, black: 1 });
  assert.deepEqual(state.players.black.hand.map(c => c.cardId), ['crab']);
  assert.deepEqual(state.players.black.discard.map(c => c.cardId), ['hostage']);
  assert.deepEqual(state.players.white.discard, []);
});
test('Hostage preserves active color and fullmove number and resets halfmove', () => {
  const before = captured();
  const state = play(before);
  assert.deepEqual(state.fen.split(' ').slice(4), ['0', '3']);
  assert.equal(state.fen.split(' ')[1], before.fen.split(' ')[1]);
});
test('Hostage enumerates each eligible pawn with the captured physical ID', () => {
  assert.deepEqual(new Set(cardPlayTargets(captured(), 'hostage')), new Set([target, { pieceId: target.pieceId, pawn: 'g7' }]));
});
test('Hostage cannot answer a capture after endTurn', () => {
  const ended = applyAction(captured(), { type: 'endTurn' });
  assert.equal(ended.ok, true);
  assert.equal(applyAction(ended.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage rejects unavailable or nonpawn target squares', () => {
  for (const pawn of ['b6', 'd4', 'h8', 'g2']) {
    const state = captured();
    const snapshot = structuredClone(state);
    assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', target: { ...target, pawn } }).ok, false);
    assert.deepEqual(state, snapshot);
  }
  const initial = createGameState({ fen: '7k/1p4p1/5n2/8/R2n4/8/6N1/7K b - - 7 3', hands: { black: ['coup', 'hostage'] } });
  const moved = applyAction(initial, { type: 'move', from: 'f6', to: 'h5' });
  assert.equal(moved.ok, true);
  const crowned = applyAction(moved.state, { type: 'playCard', cardId: 'coup', target: 'b7' });
  assert.equal(crowned.ok, true);
  assert.equal(crowned.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(crowned.state.history.at(-1)?.cardId, 'coup');
  assert.deepEqual(crowned.state.pieces.filter(p => p.owner === 'black' && p.royal).map(p => p.square), ['b7']);
  const ended = applyAction(crowned.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  const capture = applyAction(ended.state, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  assert.equal(capture.state.pieces.find(p => p.id === target.pieceId)?.zone, 'captured');
  const before = structuredClone(capture.state);
  assert.equal(applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
  assert.deepEqual(capture.state, before);
});
test('Hostage rejects malformed or noncaptured physical identity targets', () => {
  for (const value of [undefined, null, 'b7', {}, { ...target, pieceId: 'white-knight-g2' }, { ...target, pieceId: 'missing' }, { ...target, extra: true }]) {
    assert.equal(applyAction(captured(), { type: 'playCard', cardId: 'hostage', target: value }).ok, false);
  }
});
test('Hostage permits either eligible pawn and leaves the other alone', () => {
  const state = play(captured(), { ...target, pawn: 'g7' });
  assert.equal(state.pieces.find(p => p.id === target.pieceId)?.square, 'g7');
  assert.equal(state.pieces.find(p => p.id === 'black-pawn-b7')?.square, 'b7');
  assert.equal(state.pieces.find(p => p.id === 'black-pawn-g7')?.zone, 'captured');
});
test('Hostage does not consume the reacting player upcoming regular move', () => {
  const ended = applyAction(play(), { type: 'endTurn' });
  assert.equal(ended.ok, true);
  assert.equal(ended.state.turn.color, 'black');
  assert.equal(ended.state.turn.moveMade, false);
  const moved = applyAction(ended.state, { type: 'move', from: 'b7', to: 'c5' });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.pieces.find(p => p.id === target.pieceId)?.square, 'c5');
});
test('Hostage fizzles when substitution directly mates the capturing opponent', () => {
  const initial = createGameState({ fen: '8/6p1/8/8/R2b4/5p2/5k1P/7K w - - 7 3', hands: { black: ['hostage'] } });
  assert.equal(isKingInCheck(initial, 'white'), false);
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  const before = capture.state;
  const result = applyAction(before, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-bishop-d4', pawn: 'f3' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.cardId, 'hostage');
  assert.equal(result.state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.fen, before.fen);
  assert.deepEqual(result.state.turn, { ...before.turn, cardPlays: { white: 0, black: 1 } });
  assert.deepEqual(result.state.players.black.discard.map(c => c.cardId), ['hostage']);
});
test('Hostage fizzles when a returned neutral piece newly checks its reacting owner', () => {
  const initial = createGameState({ fen: '8/1p5k/8/8/R2r4/8/6N1/K7 w - - 7 3', hands: { black: ['hostage'] } });
  initial.pieces.find(p => p.id === 'black-rook-d4')!.neutral = true;
  assert.equal(isKingInCheck(initial, 'white'), false);
  assert.equal(isKingInCheck(initial, 'black'), false);
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  const before = capture.state;
  assert.equal(isKingInCheck(before, 'black'), false);
  const result = applyAction(before, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-rook-d4', pawn: 'b7' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.cardId, 'hostage');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.fen, before.fen);
  assert.deepEqual(result.state.turn, { ...before.turn, cardPlays: { white: 0, black: 1 } });
  assert.deepEqual(result.state.players.black.discard.map(c => c.cardId), ['hostage']);
});
test('Hostage cannot return a physical piece from the dead or away zone', () => {
  for (const zone of ['dead', 'away'] as const) {
    const state = captured();
    state.pieces.find(p => p.id === target.pieceId)!.zone = zone;
    const before = structuredClone(state);
    assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
    assert.deepEqual(state, before);
  }
});
test('Hostage requires an immediate capture event', () => {
  const initial = createGameState({ fen: '7k/1p4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  assert.equal(applyAction(initial, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage cannot substitute a nonneutral opponent pawn', () => {
  const initial = createGameState({ fen: '7k/1P4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  assert.equal(applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage can substitute a neutral pawn originally owned by the opponent', () => {
  const initial = createGameState({ fen: '7k/1P4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  initial.pieces.find(p => p.id === 'white-pawn-b7')!.neutral = true;
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  const state = play(capture.state);
  assert.equal(state.pieces.find(p => p.id === 'white-pawn-b7')?.zone, 'captured');
  assert.equal(state.pieces.find(p => p.id === target.pieceId)?.owner, 'black');
});
test('Hostage rejects a promoted original Pawn as substitute', () => {
  const initial = createGameState({ fen: '7k/1q4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  const pawn = initial.pieces.find(p => p.id === 'black-queen-b7')!;
  pawn.originalRole = 'pawn';
  pawn.promoted = true;
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  assert.equal(applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage accepts a transformed unpromoted original Pawn as substitute', () => {
  const initial = createGameState({ fen: '7k/1n4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  initial.pieces.find(p => p.id === 'black-knight-b7')!.originalRole = 'pawn';
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  const state = play(capture.state);
  assert.equal(state.pieces.find(p => p.id === 'black-knight-b7')?.zone, 'captured');
});
test('Hostage rejects a nonpawn physical substitute even if it occupies the requested square', () => {
  const initial = createGameState({ fen: '7k/1n4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  assert.equal(applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage cannot reuse an already returned physical piece', () => {
  const state = captured();
  state.players.black.hand.push({ id: 'second-hostage', cardId: 'hostage' });
  const first = play(state);
  const before = structuredClone(first);
  const second = applyAction(first, { type: 'playCard', cardId: 'hostage', cardInstanceId: 'second-hostage', target: { ...target, pawn: 'g7' } });
  assert.equal(second.ok, false);
  assert.deepEqual(first, before);
});
test('Hostage consumes exactly the selected physical hand instance', () => {
  const state = captured();
  state.players.black.hand.push({ id: 'second-hostage', cardId: 'hostage' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', cardInstanceId: 'missing-hostage', target }).ok, false);
  const result = applyAction(state, { type: 'playCard', cardId: 'hostage', cardInstanceId: 'second-hostage', target });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'hostage');
  assert.deepEqual(result.state.players.black.discard.map(c => c.id), ['second-hostage']);
  assert.ok(result.state.players.black.hand.some(c => c.id === state.players.black.hand[0]!.id));
});
test('Hostage respects an already spent reactor card allowance', () => {
  const state = captured();
  state.turn.cardPlays.black = 1;
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
  assert.deepEqual(state, before);
});

// FAQ p.4: a regular reaction cannot check the mover after its completed move.
function reactionAct(state: GameState, action: GameAction): GameState {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, snapshot);
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  return result.state;
}

function reactionFixture(mover: Color, card: 'hostage' | 'revenge', role = 'queen', hand = [card] as string[]) {
  const reactor: Color = mover === 'white' ? 'black' : 'white';
  const square = (s: string) => (mover === 'white' ? s : s[0] + (9 - Number(s[1]))) as SquareName;
  let board = card === 'hostage' ? `7k/1${role === 'queen' ? 'q' : 'r'}6/8/p1p5/8/8/8/KR6`
    : 'r6k/1p1p4/8/8/8/8/P1P5/KR6';
  if (mover === 'black') board = board.split('/').reverse().join('/').replace(/[a-zA-Z]/g,
    c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
  const initial = createGameState({ fen: `${board} ${mover[0]} - - 7 3`,
    hands: { [reactor]: hand }, decks: { [reactor]: ['crab', 'panic', 'truce', 'pacifism'] } });
  const state = reactionAct(initial, { type: 'move', from: square('b1'), to: square('b7') });
  const victim = `${reactor}-${card === 'hostage' ? role : 'pawn'}-${square('b7')}`;
  const targetFor = (safe: boolean) => card === 'hostage'
    ? { pieceId: victim, pawn: square(safe ? 'c5' : 'a5') } : square(safe ? 'c2' : 'a2');
  return { state, reactor, square, victim, targetFor };
}

function assertReactionSpent(before: GameState, after: GameState, reactor: Color, physicalId: string, fizzled: boolean) {
  const selected = before.players[reactor].hand.find(c => c.id === physicalId)!;
  assert.deepEqual(after.players[reactor].discard, [...before.players[reactor].discard, selected]);
  assert.deepEqual(after.players[reactor].hand, [...before.players[reactor].hand.filter(c => c.id !== physicalId), before.players[reactor].deck[0]]);
  assert.deepEqual(after.players[reactor].deck, before.players[reactor].deck.slice(1));
  assert.deepEqual(after.players[before.turn.color], before.players[before.turn.color]);
  assert.equal(after.playedCards?.filter(c => c.cardInstanceId === physicalId).length, 1);
  assert.deepEqual(after.turn, { ...before.turn, cardPlays: { ...before.turn.cardPlays, [reactor]: before.turn.cardPlays[reactor] + 1 } });
  assert.equal(after.outcome, null);
  assert.equal(after.pendingRescue, null);
  assert.equal(isKingInCheck(after, before.turn.color), false);
  assert.equal(after.history.at(-1)?.type, fizzled ? 'cardFizzled' : 'cardPlayed');
  if (fizzled) {
    assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, before.fen);
    assert.deepEqual(after.effects, before.effects);
    assert.deepEqual(after.enPassant, before.enPassant);
  } else assert.deepEqual(after.fen.split(' ').slice(1), before.fen.split(' ').slice(1));
  const ended = reactionAct(after, { type: 'endTurn' });
  assert.equal(ended.turn.color, reactor);
  assert.equal(ended.turn.moveMade, false);
}

for (const mover of ['white', 'black'] as const) {
  for (const [card, role] of [['hostage', 'queen'], ['hostage', 'rook'], ['revenge', 'pawn']] as const) {
    test(`${card} ${role}: ${mover} completed-turn safety and safe control`, () => {
      for (const safe of [false, true]) {
        const f = reactionFixture(mover, card, role, [card, card]);
        const physical = f.state.players[f.reactor].hand[1]!;
        const after = reactionAct(f.state, { type: 'playCard', cardId: card, cardInstanceId: physical.id, target: f.targetFor(safe) });
        assertReactionSpent(f.state, after, f.reactor, physical.id, !safe);
        assert.equal(after.pieces.find(p => p.id === f.victim)?.zone, safe && card === 'hostage' ? 'board' : 'captured');
        assert.equal(after.pieces.find(p => p.id === `${mover}-rook-${f.square('b1')}`)?.square, f.square('b7'));
        const pawnId = `${card === 'hostage' ? f.reactor : mover}-pawn-${f.square(card === 'hostage' ? safe ? 'c5' : 'a5' : safe ? 'c2' : 'a2')}`;
        assert.equal(after.pieces.find(p => p.id === pawnId)?.zone, safe ? 'captured' : 'board');
      }
    });
  }
}

for (const card of ['hostage', 'revenge'] as const) {
  test(`Haunting Memories keeps ${card} completed-turn safety and physical identity in both colors`, () => {
    for (const mover of ['white', 'black'] as const) {
      const f = reactionFixture(mover, card, 'queen', [card, 'haunting-memories']);
      let state: GameState;
      if (card === 'hostage') {
        // A live opposing Hostage supplies the copy: its neutral substitute
        // belongs to the mover, who can rescue that Pawn with the copy.
        let board = '7k/1p6/8/8/8/8/2P4P/KR6';
        if (mover === 'black') board = board.split('/').reverse().join('/').replace(/[a-zA-Z]/g,
          c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
        state = createGameState({ fen: `${board} ${f.reactor[0]} - - 7 3`,
          hands: { [mover]: ['haunting-memories'], [f.reactor]: ['neutrality', 'hostage'] }, decks: { [mover]: ['crab'] } });
        state = reactionAct(state, { type: 'move', from: f.square('h8'), to: f.square('g8') });
        state = reactionAct(state, { type: 'playCard', cardId: 'neutrality', target: f.square('h2') });
        state = reactionAct(state, { type: 'endTurn' });
        state = reactionAct(state, { type: 'move', from: f.square('b1'), to: f.square('b7') });
        state = reactionAct(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: `${f.reactor}-pawn-${f.square('b7')}`, pawn: f.square('h2') } });
        const physical = state.players[mover].hand.find(c => c.cardId === 'haunting-memories')!;
        const after = reactionAct(state, { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: physical.id,
          target: { pieceId: `${mover}-pawn-${f.square('h2')}`, pawn: f.square('c2') } });
        assert.equal(after.history.at(-1)?.type, 'cardPlayed');
        assert.equal(after.history.at(-1)?.copiedCardId, 'hostage');
        assert.equal(after.pieces.find(p => p.id === `${mover}-pawn-${f.square('h2')}`)?.square, f.square('c2'));
        assert.deepEqual(after.players[mover].discard, [physical]);
        assert.deepEqual(after.players[mover].hand, state.players[mover].deck);
        assert.equal(after.turn.moveMade, true);
        assert.equal(after.outcome, null);
        assert.equal(isKingInCheck(after, mover), false);
        assert.equal(reactionAct(after, { type: 'endTurn' }).turn.color, f.reactor);
        continue;
      } else {
        state = reactionAct(f.state, { type: 'playCard', cardId: card, target: f.targetFor(true) });
        assert.equal(state.history.at(-1)?.type, 'cardPlayed');
        state = reactionAct(state, { type: 'endTurn' });
        state = reactionAct(state, { type: 'move', from: f.square('h8'), to: f.square('g8') });
        state = reactionAct(state, { type: 'endTurn' });
        state = reactionAct(state, { type: 'move', from: f.square('b7'), to: f.square('d7') });
      }
      const physical = state.players[f.reactor].hand.find(c => c.cardId === 'haunting-memories')!;
      const after = reactionAct(state, { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: physical.id, target: f.targetFor(false) });
      assertReactionSpent(state, after, f.reactor, physical.id, true);
      assert.equal(after.history.at(-1)?.cardId, 'haunting-memories');
      assert.equal(after.history.at(-1)?.copiedCardId, card);
    }
  });

  test(`Plots spends a fizzled ${card} once and preserves its next safe reaction`, () => {
    const f = reactionFixture('white', card, 'queen', ['plots-within-plots', card, card]);
    let state = reactionAct(f.state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: f.reactor } });
    const physical = state.players[f.reactor].hand.find(c => c.cardId === card)!;
    const after = reactionAct(state, { type: 'playCard', cardId: card, cardInstanceId: physical.id, target: f.targetFor(false) });
    assertReactionSpent(state, after, f.reactor, physical.id, true);
    assert.equal(after.plotsAllowances?.[0].remaining, 1);
    state = reactionAct(after, { type: 'playCard', cardId: card, target: f.targetFor(true) });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.plotsAllowances?.[0].remaining, 0);
    assert.equal(reactionAct(state, { type: 'endTurn' }).turn.color, f.reactor);
  });

  test(`${card} preserves a staged mover check with a genuine remaining rescue`, () => {
    let state = createGameState({ fen: '4r2k/1p6/8/8/8/8/2P1p3/4K3 w - - 0 1',
      hands: { white: ['mystic-shield'], black: [card] } });
    state = reactionAct(state, { type: 'move', from: 'e1', to: 'e2' });
    assert.ok(state.pendingRescue);
    assert.equal(isKingInCheck(state, 'white'), true);
    const pending = structuredClone(state.pendingRescue);
    state = reactionAct(state, { type: 'playCard', cardId: card, target: card === 'hostage'
      ? { pieceId: 'black-pawn-e2', pawn: 'b7' } : 'c2' });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.deepEqual(state.pendingRescue, pending);
    assert.equal(state.outcome, null);
    state = reactionAct(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e2' });
    assert.equal(isKingInCheck(state, 'white'), false);
    assert.equal(state.pendingRescue, null);
    assert.equal(reactionAct(state, { type: 'endTurn' }).turn.color, 'black');
  });
}
