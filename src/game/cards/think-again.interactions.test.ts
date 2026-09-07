import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction, legalDests, isKingInCheck, isPromotionSquare } from '../reducer.js';
import { parseFen } from 'chessops/fen';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action));
  return result.state;
}

function play(state: GameState, cardId: string, target?: unknown): GameState {
  const next = act(state, { type: 'playCard', cardId, target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed', `${cardId} must resolve, not fizzle`);
  return next;
}

function setup(white: string[] = [], black: string[] = ['think-again'], fen?: string): GameState {
  return createGameState({ fen, hands: { white, black }, decks: { white: ['panic', 'curse', 'crab'], black: ['panic', 'curse', 'crab'] } });
}

const move = (s: GameState, from: SquareName, to: SquareName) => act(s, { type: 'move', from, to });
const end = (s: GameState) => act(s, { type: 'endTurn' });
const discarded = (s: GameState, player: 'white' | 'black') => s.players[player].discard.map(c => c.cardId);
const held = (s: GameState, player: 'white' | 'black') => s.players[player].hand.map(c => c.cardId);
const sparse = '7k/8/8/8/8/8/PP6/RN2K3 w - - 0 1';

function physicalCards(s: GameState): string[] {
  const ids = Object.values(s.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard].map(c => c.id));
  for (const effect of s.effects) {
    const card = (effect as { card?: { id: string } }).card;
    if (card) ids.push(card.id);
  }
  return ids.sort();
}

function invariant(s: GameState, before: GameState): void {
  assert.deepEqual(s.pieces.map(p => p.id).sort(), before.pieces.map(p => p.id).sort());
  assert.deepEqual(physicalCards(s), physicalCards(before));
  assert.equal(new Set(physicalCards(s)).size, physicalCards(s).length);
  const compositeIds = new Set(s.effects.flatMap(e => (e as { pieceIds?: string[] }).pieceIds ?? []));
  const squares = s.pieces.filter(p => p.zone === 'board' && !compositeIds.has(p.id)).map(p => p.square);
  assert.equal(new Set(squares).size, squares.length);
  for (const piece of s.pieces) assert.equal(piece.square === null, piece.zone !== 'board');
  assert.equal(parseFen(s.fen).isOk, true);
  const fields = s.fen.split(' ');
  assert.match(fields[4]!, /^\d+$/);
  assert.match(fields[5]!, /^[1-9]\d*$/);
  assert.ok(['white', 'black'].includes(s.turn.color));
  assert.ok(['beforeMove', 'afterMove'].includes(s.turn.phase));
  for (const count of Object.values(s.turn.cardPlays)) assert.ok(Number.isInteger(count) && count >= 0);
}

describe('Think Again! interactions', () => {
  it('cancels an ordinary move independently of the other cancellation cards', () => {
    const initial = createGameState({ hands: { white: [], black: ['think-again'] } });
    const moved = act(initial, { type: 'move', from: 'e2', to: 'e4' });
    const restored = play(moved, 'think-again');
    assert.equal(restored.fen, initial.fen);
  });

  it('does not spend a separately owned Chaos card', () => {
    const initial = createGameState({ hands: { white: [], black: ['think-again', 'chaos'] } });
    const moved = act(initial, { type: 'move', from: 'e2', to: 'e4' });
    const restored = play(moved, 'think-again');
    assert.equal(restored.fen, initial.fen);
    assert.ok(held(restored, 'black').includes('chaos'));
    assert.deepEqual(discarded(restored, 'black'), ['think-again']);
  });

  for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
    it(`rolls back Hidden Passage with responsible-card return ${JSON.stringify(target)}`, () => {
      const initial = setup(['hidden-passage'], ['think-again'], sparse);
      const responsible = initial.players.white.hand[0]!;
      const moved = play(initial, 'hidden-passage', [{ from: 'e1', to: 'd4' }]);
      const restored = play(moved, 'think-again', target);
      assert.equal(restored.fen, initial.fen);
      const returned = target?.returnCard !== false;
      assert.equal(restored.players.white.hand.some(c => c.id === responsible.id), returned);
      assert.equal(restored.turn.cardPlays.white, returned ? 0 : 1);
      assert.equal(restored.players.white.deck.length, returned ? initial.players.white.deck.length : initial.players.white.deck.length - 1);
      invariant(restored, initial);
    });
  }

  for (const [cardId, target] of [
    ['onslaught', [{ from: 'a2', to: 'a3' }, { from: 'b2', to: 'b3' }]],
    ['confabulation', [{ from: 'a1', to: 'b1' }]],
    ['blessing', [{ from: 'b1', to: 'd3' }]],
    ['masquerade', [{ from: 'b1', to: 'd3' }]],
    ['ghostwalk', [{ from: 'a1', to: 'a4' }]],
  ] as const) {
    it(`restores the board and physical ${cardId} card`, () => {
      const initial = setup([cardId], ['think-again'], sparse);
      const moved = play(initial, cardId, target);
      const restored = play(moved, 'think-again');
      assert.equal(restored.fen, initial.fen);
      assert.deepEqual(restored.pieces, initial.pieces);
      assert.ok(held(restored, 'white').includes(cardId));
      assert.equal(restored.effects.length, initial.effects.length);
      invariant(restored, initial);
    });
  }

  it('restores a captured Crab and its retained physical card', () => {
    let s = setup(['crab', 'think-again'], [], 'r6k/8/8/8/8/8/P7/7K w - - 0 1');
    s = play(move(s, 'a2', 'a3'), 'crab', 'a3');
    s = end(s);
    const before = s;
    s = move(s, 'a8', 'a3');
    assert.equal(s.effects.length, 0);
    s = play(s, 'think-again');
    assert.equal(s.fen, before.fen);
    assert.deepEqual(s.effects, before.effects);
    assert.deepEqual(s.pieces, before.pieces);
    invariant(s, before);
  });

  it('preserves an earlier independent Truce', () => {
    let s = setup(['truce', 'think-again']);
    s = end(play(move(s, 'e2', 'e4'), 'truce'));
    const before = s;
    s = play(move(s, 'e7', 'e5'), 'think-again');
    assert.equal(s.fen, before.fen);
    assert.deepEqual(s.effects, before.effects);
  });

  it('uses the response window saved by the reacting Plots Within Plots', () => {
    let s = setup([], ['plots-within-plots', 'think-again']);
    const initial = s;
    s = move(s, 'e2', 'e4');
    s = play(s, 'plots-within-plots', { player: 'black' });
    s = play(s, 'think-again');
    assert.equal(s.fen, initial.fen);
    assert.deepEqual(discarded(s, 'black'), ['plots-within-plots', 'think-again']);
    assert.equal(s.turn.cardPlays.black, 2);
    invariant(s, initial);
  });

  it('preserves Plots and its first replacement when canceling its second', () => {
    let s = setup(['plots-within-plots', 'onslaught', 'hidden-passage'], ['think-again'], sparse);
    const initial = s;
    s = play(s, 'plots-within-plots');
    s = play(s, 'onslaught', [{ from: 'a2', to: 'a3' }]);
    const first = s;
    s = play(s, 'hidden-passage', [{ from: 'e1', to: 'd4' }]);
    s = play(s, 'think-again');
    assert.equal(s.fen, first.fen);
    assert.deepEqual(discarded(s, 'white'), ['plots-within-plots', 'onslaught']);
    assert.ok(held(s, 'white').includes('hidden-passage'));
    invariant(s, initial);
  });

  it('Fog of War cancels Think Again and restores the completed move', () => {
    const initial = setup(['fog-of-war']);
    const moved = move(initial, 'e2', 'e4');
    let s = play(moved, 'think-again');
    s = play(s, 'fog-of-war');
    assert.equal(s.fen, moved.fen);
    assert.equal(s.turn.moveMade, true);
    assert.deepEqual(discarded(s, 'white'), ['fog-of-war']);
    assert.deepEqual(discarded(s, 'black'), ['think-again']);
    invariant(s, initial);
  });

  it('Haunting Memories copies Think Again using the reacting physical owner', () => {
    let s = setup(['haunting-memories']);
    s = play(move(s, 'e2', 'e4'), 'think-again');
    s = end(move(s, 'd2', 'd4'));
    const before = s;
    s = move(s, 'e7', 'e5');
    s = play(s, 'haunting-memories');
    assert.equal(s.fen, before.fen);
    assert.equal(s.history.at(-1)?.cardId, 'haunting-memories');
    assert.equal(s.history.at(-1)?.copiedCardId, 'think-again');
    assert.deepEqual(discarded(s, 'white'), ['haunting-memories']);
    assert.deepEqual(discarded(s, 'black'), ['think-again']);
    invariant(s, before);
  });

  for (const second of ['chaos', 'knightmare']) {
    it(`chains ${second} onto the next actual move without refunding Think Again`, () => {
      let s = setup([second]);
      s = play(move(s, 'e2', 'e4'), 'think-again');
      s = end(move(s, 'd2', 'd4'));
      const before = s;
      s = play(move(s, 'e7', 'e5'), second);
      assert.equal(s.fen, before.fen);
      assert.deepEqual(discarded(s, 'black'), ['think-again']);
      assert.deepEqual(discarded(s, 'white'), [second]);
      invariant(s, before);
    });
  }
});

describe('Think Again! seeded legal continuations', () => {
  for (let seed = 1; seed <= 20; seed++) {
    it(`seed ${seed}: actual randomized replacement and four further plies`, () => {
      let randomState = seed;
      const random = () => {
        randomState ^= randomState << 13;
        randomState ^= randomState >>> 17;
        randomState ^= randomState << 5;
        return (randomState >>> 0) / 0x100000000;
      };
      let s = setup(seed % 2 ? ['onslaught'] : []);
      const initial = s;
      s = seed % 2 ? play(s, 'onslaught', [{ from: 'a2', to: 'a3' }, { from: 'b2', to: 'b3' }]) : move(s, 'e2', 'e4');
      s = play(s, 'think-again');
      assert.equal(s.fen, initial.fen);
      invariant(s, initial);
      let plies = 0;
      for (; plies < 5; plies++) {
        const choices = [...legalDests(s, false)].flatMap(([from, tos]) => tos.map(to => ({ from, to })));
        assert.ok(choices.length > 0, `seed ${seed}, ply ${plies}: continuation exists`);
        const choice = choices[Math.floor(random() * choices.length)]!;
        const mover = s.turn.color;
        const piece = s.pieces.find(p => p.square === choice.from && p.zone === 'board')!;
        const promotion = piece.role === 'pawn' && isPromotionSquare(s, piece.owner, choice.to) ? 'queen' : undefined;
        s = act(s, { type: 'move', ...choice, promotion });
        assert.equal(isKingInCheck(s, mover), false);
        invariant(s, initial);
        s = end(s);
        invariant(s, initial);
      }
      assert.equal(plies, 5, 'canceled move is excluded from actual continuation count');
    });
  }
});
