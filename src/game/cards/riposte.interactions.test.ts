import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState, type CreateGameOptions } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, `${JSON.stringify(action)}: ${!result.ok ? result.error.message : ''}`);
  return result.state;
}
const move = (state: GameState, from: SquareName, to: SquareName) => act(state, { type: 'move', from, to });
const end = (state: GameState) => act(state, { type: 'endTurn' });
const play = (state: GameState, cardId: string, target?: unknown) => act(state, { type: 'playCard', cardId, ...(target === undefined ? {} : { target }) });
const board = (state: GameState, id: string) => state.pieces.find(piece => piece.id === id)!;
const ordinary = (hands: CreateGameOptions['hands'] = {}) => createGameState({
  fen: '7k/8/8/8/n7/8/8/R6K w - - 7 12', hands: { ...hands, black: ['riposte', ...(hands.black ?? [])] },
});
const captured = (hands: Parameters<typeof ordinary>[0] = {}) => move(ordinary(hands), 'a1', 'a4');
const reversed = (hands: Parameters<typeof ordinary>[0] = {}) => play(captured(hands), 'riposte');

function reject(state: GameState, action: GameAction) {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
}

test('Riposte restores the captured defender and forfeits the reacting turn', () => {
  const initial = createGameState({ fen: '7k/8/8/8/n7/8/8/R6K w - - 7 12', hands: { black: ['riposte'] } });
  const capture = applyAction(initial, { type: 'move', from: 'a1', to: 'a4' });
  assert.equal(capture.ok, true);
  const reaction = applyAction(capture.state, { type: 'playCard', cardId: 'riposte' });
  assert.equal(reaction.ok, true);
  const next = applyAction(reaction.state, { type: 'endTurn' });
  assert.equal(next.ok, true);
  assert.equal([...legalDests(next.state, false).values()].flat().length, 0);
});

test('Black forfeiture advances clocks once and creates no move event', () => {
  const reaction = reversed();
  const before = reaction.history.filter(event => event.type === 'move').length;
  const skipped = end(reaction);
  assert.deepEqual(skipped.fen.split(' ').slice(1), ['w', '-', '-', '1', '13']);
  assert.equal(skipped.turn.phase, 'afterMove');
  assert.equal(skipped.turn.moveMade, true);
  assert.equal(skipped.history.filter(event => event.type === 'move').length, before);
  assert.equal(end(skipped).fen.split(' ')[5], '13');
});

test('White forfeiture does not add a second Black fullmove increment', () => {
  const start = createGameState({ fen: 'r6k/8/8/N7/8/8/8/7K b - - 7 12', hands: { white: ['riposte'] } });
  const reaction = play(move(start, 'a8', 'a5'), 'riposte');
  assert.deepEqual(reaction.fen.split(' ').slice(1), ['w', '-', '-', '0', '13']);
  const skipped = end(reaction);
  assert.deepEqual(skipped.fen.split(' ').slice(1), ['b', '-', '-', '1', '13']);
  assert.equal(skipped.turn.phase, 'afterMove');
});

test('forfeiture expires before the following reacting turn', () => {
  const skipped = end(reversed());
  reject(skipped, { type: 'move', from: 'a4', to: 'b6' });
  const white = end(skipped);
  const black = end(move(white, 'h1', 'g1'));
  assert.equal(black.turn.phase, 'beforeMove');
  assert.equal(move(black, 'a4', 'b6').turn.moveMade, true);
});

test('the forfeited turn resets card allowance and permits an after-move card', () => {
  const start = createGameState({ fen: '7k/8/8/8/n7/8/1P6/R6K w - - 0 1', hands: { black: ['riposte', 'neutrality'] } });
  const skipped = end(play(move(start, 'a1', 'a4'), 'riposte'));
  assert.equal(skipped.turn.cardPlays.black, 0);
  const marked = play(skipped, 'neutrality', 'b2');
  assert.equal(board(marked, 'white-pawn-b2').neutral, true);
  assert.equal(marked.turn.cardPlays.black, 1);
  assert.equal(end(marked).turn.color, 'white');
});

for (const cardId of ['hidden-passage', 'mystic-shield', 'fireball', 'merciless']) {
  test(`forfeiture does not authorize ${cardId}`, () => {
    const skipped = end(reversed({ black: [cardId] }));
    assert.deepEqual(cardPlayTargets(skipped, cardId), []);
    reject(skipped, { type: 'playCard', cardId, ...(cardId === 'hidden-passage' ? { target: [{ from: 'h8', to: 'g7' }] } : {}) });
  });
}

test('forfeiture is not an opposing move for Chaos', () => {
  const skipped = end(reversed({ white: ['chaos'] }));
  assert.deepEqual(cardPlayTargets(skipped, 'chaos'), []);
  reject(skipped, { type: 'playCard', cardId: 'chaos' });
});

test('Plots Within Plots preserves the physical original capture window', () => {
  const window = play(captured({ black: ['plots-within-plots'] }), 'plots-within-plots', { player: 'black' });
  const reaction = play(window, 'riposte');
  assert.equal(board(reaction, 'black-knight-a4').square, 'a4');
  assert.equal(board(reaction, 'white-rook-a1').zone, 'captured');
  assert.deepEqual(reaction.players.black.discard.map(card => card.cardId), ['plots-within-plots', 'riposte']);
  assert.equal(end(reaction).turn.phase, 'afterMove');
});

test('Fog restores the original capture and removes the dependent forfeiture', () => {
  const original = captured({ white: ['fog-of-war'] });
  const fogged = play(play(original, 'riposte'), 'fog-of-war');
  assert.equal(fogged.fen, original.fen);
  assert.equal(board(fogged, 'black-knight-a4').zone, 'captured');
  assert.equal(board(fogged, 'white-rook-a1').square, 'a4');
  assert.equal(fogged.players.black.discard.filter(card => card.cardId === 'riposte').length, 1);
  assert.equal(fogged.players.white.discard.filter(card => card.cardId === 'fog-of-war').length, 1);
  const black = end(fogged);
  assert.equal(black.turn.phase, 'beforeMove');
  assert.equal(move(black, 'h8', 'g8').turn.moveMade, true);
});

test('Chaos canceling the capture closes eligibility for that capture', () => {
  const cancelled = play(captured({ black: ['chaos'] }), 'chaos');
  assert.equal(board(cancelled, 'black-knight-a4').zone, 'board');
  reject(cancelled, { type: 'playCard', cardId: 'riposte' });
});

test('en-passant reversal restores the victim on its original square', () => {
  const start = createGameState({ fen: '7k/8/8/3pP3/8/8/8/7K w - d6 0 12', hands: { black: ['riposte'] } });
  const reaction = play(move(start, 'e5', 'd6'), 'riposte');
  assert.equal(board(reaction, 'black-pawn-d5').square, 'd5');
  assert.equal(board(reaction, 'white-pawn-e5').zone, 'captured');
  assert.equal(reaction.pieces.some(piece => piece.square === 'd6'), false);
  assert.deepEqual(reaction.enPassant, []);
  assert.equal(end(reaction).turn.phase, 'afterMove');
});

test('promotion capture reversal captures the original Pawn without promotion', () => {
  const start = createGameState({ fen: 'r6k/1P6/8/8/8/8/8/7K w - - 0 12', hands: { black: ['riposte'] } });
  const capture = act(start, { type: 'move', from: 'b7', to: 'a8', promotion: 'queen' });
  const reaction = play(capture, 'riposte');
  assert.equal(board(reaction, 'white-pawn-b7').zone, 'captured');
  assert.equal(board(reaction, 'white-pawn-b7').role, 'pawn');
  assert.equal(board(reaction, 'white-pawn-b7').promoted, false);
  assert.equal(board(reaction, 'black-rook-a8').square, 'a8');
  assert.equal(end(reaction).turn.phase, 'afterMove');
});

test('restoring a defender Rook restores its castling right', () => {
  const start = createGameState({ fen: 'r3k3/8/8/8/8/8/8/R6K w q - 0 1', hands: { black: ['riposte'] } });
  const reaction = play(move(start, 'a1', 'a8'), 'riposte');
  assert.equal(reaction.fen.split(' ')[2], 'q');
  assert.equal(board(reaction, 'black-rook-a8').square, 'a8');
});

test('defender Neutrality and its retained physical card are restored', () => {
  let state = ordinary({ white: ['neutrality'] });
  state = play(move(state, 'h1', 'g1'), 'neutrality', 'a4');
  state = end(move(end(state), 'h8', 'g8'));
  const effects = structuredClone(state.effects);
  const reaction = play(move(state, 'a1', 'a4'), 'riposte');
  assert.equal(board(reaction, 'black-knight-a4').neutral, true);
  assert.deepEqual(reaction.effects, effects);
  assert.equal(reaction.players.white.discard.some(card => card.cardId === 'neutrality'), false);
});

test('attacker Neutrality expires on the reversed capture', () => {
  let state = createGameState({ fen: '7k/8/8/8/n7/8/8/R6K b - - 0 1', hands: { black: ['neutrality', 'riposte'] } });
  state = end(play(move(state, 'h8', 'g8'), 'neutrality', 'a1'));
  const reaction = play(move(state, 'a1', 'a4'), 'riposte');
  assert.equal(board(reaction, 'white-rook-a1').zone, 'captured');
  assert.equal(board(reaction, 'white-rook-a1').neutral, false);
  assert.equal(reaction.effects.length, 0);
  assert.equal(reaction.players.black.discard.filter(card => card.cardId === 'neutrality').length, 1);
});

test('a captured Confabulation defender returns with both physical components', () => {
  let state = createGameState({ fen: '7k/8/8/1b6/n7/8/8/R6K b - - 0 1', hands: { black: ['confabulation', 'riposte'] } });
  state = end(play(state, 'confabulation', [{ from: 'b5', to: 'a4' }]));
  const effects = structuredClone(state.effects);
  const components = ['black-bishop-b5', 'black-knight-a4'].map(id => structuredClone(board(state, id)));
  const reaction = play(move(state, 'a1', 'a4'), 'riposte');
  for (const component of components) assert.deepEqual(board(reaction, component.id), component);
  assert.deepEqual(reaction.effects, effects);
});

test('a Confabulation attacker loses both physical components and its effect', () => {
  let state = createGameState({ fen: '7k/8/8/8/n7/8/1B6/R6K w - - 0 1', hands: { white: ['confabulation'], black: ['riposte'] } });
  state = end(play(state, 'confabulation', [{ from: 'b2', to: 'a1' }]));
  state = end(move(state, 'h8', 'g8'));
  const reaction = play(move(state, 'a1', 'a4'), 'riposte');
  for (const id of ['white-rook-a1', 'white-bishop-b2']) assert.equal(board(reaction, id).zone, 'captured');
  assert.equal(reaction.effects.length, 0);
  assert.equal(reaction.players.white.discard.filter(card => card.cardId === 'confabulation').length, 1);
});

test('a Queen inside the attacker Confabulation prevents Riposte', () => {
  let state = createGameState({ fen: '7k/8/8/8/n7/8/Q7/R6K w - - 0 1', hands: { white: ['confabulation'], black: ['riposte'] } });
  state = end(play(state, 'confabulation', [{ from: 'a2', to: 'a1' }]));
  state = end(move(state, 'h8', 'g8'));
  const capture = move(state, 'a1', 'a4');
  assert.deepEqual(cardPlayTargets(capture, 'riposte'), []);
  reject(capture, { type: 'playCard', cardId: 'riposte' });
});

test('an unrelated Pacifism card before an ordinary capture does not exclude Riposte', () => {
  let state = createGameState({ fen: '7k/8/8/8/n7/8/1P6/R6K w - - 0 1', hands: { white: ['pacifism'], black: ['riposte'] } });
  state = play(state, 'pacifism', 'b2');
  const effects = structuredClone(state.effects);
  const reaction = play(move(state, 'a1', 'a4'), 'riposte');
  assert.deepEqual(reaction.effects, effects);
  assert.equal(board(reaction, 'white-rook-a1').zone, 'captured');
});

test('Peace Talks cannot select the non-Continuing forfeiture obligation', () => {
  const skipped = end(reversed({ black: ['peace-talks'] }));
  assert.deepEqual(cardPlayTargets(skipped, 'peace-talks'), []);
  reject(skipped, { type: 'playCard', cardId: 'peace-talks', target: 'riposte' });
  assert.equal(skipped.turn.phase, 'afterMove');
});

test('Legacy responds to the attacker captured by Riposte without removing the penalty', () => {
  let state = ordinary({ white: ['hidden-passage', 'legacy'] });
  const passage = state.players.white.hand.find(card => card.cardId === 'hidden-passage')!.id;
  state = end(play(state, 'hidden-passage', [{ from: 'h1', to: 'g1' }]));
  state = end(move(state, 'h8', 'g8'));
  state = play(move(state, 'a1', 'a4'), 'riposte');
  const retrieved = play(state, 'legacy', passage);
  assert.equal(retrieved.players.white.hand.some(card => card.id === passage), true);
  assert.equal(board(retrieved, 'white-rook-a1').zone, 'captured');
  assert.equal(end(retrieved).turn.phase, 'afterMove');
});

test('a checked captor may close its turn and answer check after the forfeiture', () => {
  const start = createGameState({ fen: '7k/8/8/8/r6K/8/8/R7 w - - 0 1', hands: { black: ['riposte'] } });
  const reaction = play(move(start, 'a1', 'a4'), 'riposte');
  assert.equal(isKingInCheck(reaction, 'white'), true);
  const skipped = end(reaction);
  assert.equal(skipped.turn.color, 'black');
  assert.equal(skipped.turn.phase, 'afterMove');
  const white = end(skipped);
  assert.equal(isKingInCheck(move(white, 'h4', 'h5'), 'white'), false);
});

test('Haunting Memories copies the last Riposte on a later actual capture', () => {
  let state = createGameState({ fen: '7k/3p4/8/8/n7/8/8/RR5K w - - 0 1', hands: { black: ['riposte', 'haunting-memories'] } });
  state = end(end(play(move(state, 'a1', 'a4'), 'riposte')));
  state = end(move(state, 'b1', 'b4'));
  state = end(move(state, 'a4', 'b6'));
  const reaction = play(move(state, 'b4', 'b6'), 'haunting-memories');
  assert.equal(board(reaction, 'black-knight-a4').square, 'b6');
  assert.equal(board(reaction, 'white-rook-b1').zone, 'captured');
  assert.deepEqual(reaction.players.black.discard.map(card => card.cardId), ['riposte', 'haunting-memories']);
  assert.equal(end(reaction).turn.phase, 'afterMove');
});

// Exactly twenty independent seeds; the forfeited turn is closed before any counted ply.
for (let seed = 1; seed <= 20; seed++) {
  test(`seed ${seed}: four actual legal plies after Riposte preserve engine invariants`, () => {
    let random = seed;
    const initial = ordinary();
    const identity = (state: GameState) => state.pieces.map(({ id, owner, role, originalRole }) => ({ id, owner, role, originalRole })).sort((a, b) => a.id.localeCompare(b.id));
    const cards = (state: GameState) => Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]).map(card => card.id).sort();
    const piecesBefore = identity(initial);
    const cardsBefore = cards(initial);
    const reaction = play(move(initial, 'a1', 'a4'), 'riposte');
    assert.ok(reaction.history.some(event => event.type === 'cardPlayed' && event.cardId === 'riposte'));
    assert.equal(reaction.history.some(event => event.type === 'cardFizzled' && event.cardId === 'riposte'), false);
    let state = end(end(reaction));
    const count = state.history.filter(event => event.type === 'move').length;
    for (let ply = 0; ply < 4; ply++) {
      const destinations = [...legalDests(state, false)].flatMap(([from, squares]) => squares.map(to => ({ from, to })));
      assert.ok(destinations.length > 0, `seed ${seed}, ply ${ply}`);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const choice = destinations[random % destinations.length]!;
      const player = state.turn.color;
      state = move(state, choice.from, choice.to);
      assert.equal(isKingInCheck(state, player), false);
      assert.deepEqual(identity(state), piecesBefore);
      assert.deepEqual(cards(state), cardsBefore);
      assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
      for (const piece of state.pieces) if (piece.zone !== 'board') assert.equal(piece.square, null);
      const occupied = state.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square);
      assert.equal(new Set(occupied).size, occupied.length);
      const ranks = state.fen.split(' ')[0]!.split('/');
      assert.equal(ranks.length, 8);
      for (const rank of ranks) assert.equal([...rank].reduce((width, cell) => width + (/^[1-8]$/.test(cell) ? Number(cell) : 1), 0), 8);
      assert.equal((state.fen.split(' ')[0]!.match(/K/g) ?? []).length, 1);
      assert.equal((state.fen.split(' ')[0]!.match(/k/g) ?? []).length, 1);
      assert.equal(state.history.filter(event => event.type === 'move').length, count + ply + 1);
      assert.equal(state.players.black.discard.filter(card => card.cardId === 'riposte').length, 1);
      if (ply < 3) state = end(state);
    }
  });
}
