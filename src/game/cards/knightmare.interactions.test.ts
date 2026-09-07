import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function play(state: GameState, cardId: string, target?: unknown): GameState {
  const played = act(state, { type: 'playCard', cardId, target });
  assert.equal(played.history.at(-1)?.type, 'cardPlayed');
  assert.equal(played.history.at(-1)?.cardId, cardId);
  return played;
}

function move(state: GameState, from: SquareName, to: SquareName): GameState {
  return act(state, { type: 'move', from, to });
}

function physicalCards(state: GameState): string[] {
  return Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard])
    .map(card => `${card.id}:${card.cardId}`).sort();
}

for (const cardId of ['dubbing', 'hidden-passage']) {
  for (const returnCard of [undefined, true, false]) {
    test(`Knightmare restores ${cardId}; returnCard=${returnCard}`, () => {
      const before = createGameState({
        fen: '4k3/8/8/8/8/8/8/4K2R w K - 7 9',
        hands: { white: [cardId], black: ['knightmare'] },
        decks: { white: ['blessing'], black: ['dubbing'] },
      });
      const moved = act(before, { type: 'playCard', cardId,
        target: [{ from: cardId === 'dubbing' ? 'h1' : 'e1', to: cardId === 'dubbing' ? 'f2' : 'a1' }] });
      assert.equal(moved.history.at(-1)?.type, 'cardPlayed');
      const restored = play(moved, 'knightmare', returnCard === undefined ? undefined : { returnCard });
      assert.equal(restored.history.at(-1)?.type, 'cardPlayed');
      assert.equal(restored.fen, before.fen);
      assert.deepEqual(restored.pieces, before.pieces);
      assert.equal(restored.players.white.hand.some(card => card.cardId === cardId), returnCard !== false);
      assert.equal(restored.turn.cardPlays.white, returnCard !== false ? 0 : 1);
      assert.equal(restored.players.black.discard.at(-1)?.cardId, 'knightmare');
      assert.deepEqual(physicalCards(restored), physicalCards(before));
      if (returnCard !== false) {
        assert.deepEqual(restored.players.white.deck, before.players.white.deck);
        assert.ok(!cardPlayTargets(restored, cardId).some(target => JSON.stringify(target) === JSON.stringify([
          { from: cardId === 'dubbing' ? 'h1' : 'e1', to: cardId === 'dubbing' ? 'f2' : 'a1' },
        ])));
      }
    });
  }
}

for (const [label, fen, from, to, promotion] of [
  ['ordinary capture', '4k3/8/8/8/n7/8/8/R3K3 w - - 8 10', 'a1', 'a4', undefined],
  ['en passant capture', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 10', 'e5', 'd6', undefined],
  ['promotion capture', '1r2k3/P7/8/8/8/8/8/4K3 w - - 6 10', 'a7', 'b8', 'knight'],
  ['castling', '4k3/8/8/8/8/8/8/4K2R w K - 8 10', 'e1', 'g1', undefined],
  ['black double pawn move', '4k3/3p4/8/8/8/8/8/4K3 b - - 8 10', 'd7', 'd5', undefined],
] as const) {
  test(`Knightmare restores all physical consequences of ${label}`, () => {
    const mover: Color = fen.split(' ')[1] === 'w' ? 'white' : 'black';
    const reactor: Color = mover === 'white' ? 'black' : 'white';
    const before = createGameState({ fen, hands: { [reactor]: ['knightmare'] }, decks: { [reactor]: ['chaos'] } });
    const moved = act(before, { type: 'move', from, to, promotion });
    const restored = play(moved, 'knightmare');
    assert.deepEqual(restored.pieces, before.pieces);
    assert.equal(restored.fen, before.fen);
    assert.deepEqual(restored.enPassant, before.enPassant);
    assert.equal(restored.turn.color, mover);
    assert.equal(restored.turn.moveMade, false);
    assert.equal(restored.players[reactor].discard[0]?.id, before.players[reactor].hand[0]?.id);
    const repeat = applyAction(restored, { type: 'move', from, to, promotion });
    assert.equal(repeat.ok, false);
    assert.deepEqual(repeat.state, restored);
  });
}

test('Knightmare cancellation is countered by Fog of War during the mover own turn', () => {
  const before = createGameState({ hands: { white: ['fog-of-war'], black: ['knightmare'] },
    decks: { white: ['dubbing'], black: ['chaos'] } });
  const moved = move(before, 'e2', 'e4');
  const restored = play(moved, 'knightmare');
  const countered = play(restored, 'fog-of-war');
  assert.equal(countered.fen, moved.fen);
  assert.deepEqual(countered.pieces, moved.pieces);
  assert.equal(countered.turn.moveMade, true);
  assert.equal(countered.players.black.discard[0]?.cardId, 'knightmare');
  assert.equal(countered.players.white.discard[0]?.cardId, 'fog-of-war');
  assert.deepEqual(physicalCards(countered), physicalCards(before));
});

for (const returnCard of [true, false]) {
  test(`Knightmare preserves Plots and its first independent replacement; return=${returnCard}`, () => {
    const before = createGameState({ fen: '4k3/8/8/8/8/8/8/4K2R w K - 4 12',
      hands: { white: ['plots-within-plots', 'dubbing', 'hidden-passage'], black: ['knightmare'] },
      decks: { white: ['blessing', 'chaos', 'fog-of-war'], black: ['dubbing'] } });
    const plots = play(before, 'plots-within-plots');
    const first = play(plots, 'dubbing', [{ from: 'h1', to: 'f2' }]);
    const second = play(first, 'hidden-passage', [{ from: 'e1', to: 'a1' }]);
    const restored = play(second, 'knightmare', { returnCard });
    assert.equal(restored.fen, first.fen);
    assert.deepEqual(restored.pieces, first.pieces);
    assert.equal(restored.players.white.discard.some(card => card.cardId === 'plots-within-plots'), true);
    assert.equal(restored.players.white.discard.some(card => card.cardId === 'dubbing'), true);
    assert.equal(restored.players.white.hand.some(card => card.cardId === 'hidden-passage'), returnCard);
    assert.deepEqual(physicalCards(restored), physicalCards(before));
  });
}

test('reacting Plots preserves the Knightmare response and its physical expenditure', () => {
  const before = createGameState({ hands: { black: ['plots-within-plots', 'knightmare'] },
    decks: { black: ['dubbing', 'chaos'] } });
  const moved = move(before, 'e2', 'e4');
  const plots = play(moved, 'plots-within-plots', { player: 'black' });
  const restored = play(plots, 'knightmare');
  assert.equal(restored.fen, before.fen);
  assert.deepEqual(restored.players.black.discard.map(card => card.cardId), ['plots-within-plots', 'knightmare']);
  assert.equal(restored.turn.cardPlays.black, 2);
  assert.deepEqual(physicalCards(restored), physicalCards(before));
});

test('a reaction allowance does not consume the reactor next-turn allowance', () => {
  const before = createGameState({ hands: { black: ['knightmare', 'dubbing'] } });
  const restored = play(move(before, 'e2', 'e4'), 'knightmare');
  const next = act(move(restored, 'd2', 'd4'), { type: 'endTurn' });
  assert.equal(next.turn.color, 'black');
  const dubbed = play(next, 'dubbing', [{ from: 'e7', to: 'f5' }]);
  assert.equal(dubbed.history.at(-1)?.cardId, 'dubbing');
});

test('a returned movement card can choose a genuinely different physical move', () => {
  const before = createGameState({ hands: { white: ['dubbing'], black: ['knightmare'] } });
  const restored = play(play(before, 'dubbing', [{ from: 'e2', to: 'f4' }]), 'knightmare');
  const replacement = play(restored, 'dubbing', [{ from: 'e2', to: 'd4' }]);
  assert.equal(replacement.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'd4');
  assert.equal(replacement.players.white.discard[0]?.cardId, 'dubbing');
});

test('Knightmare and Chaos chained cancellations retain each independent physical card', () => {
  const before = createGameState({ hands: { black: ['knightmare'], white: ['chaos'] },
    decks: { black: ['dubbing'], white: ['hidden-passage'] } });
  const restored = play(move(before, 'e2', 'e4'), 'knightmare');
  const blackTurn = act(move(restored, 'd2', 'd4'), { type: 'endTurn' });
  const canceledBlack = play(move(blackTurn, 'e7', 'e5'), 'chaos');
  assert.equal(canceledBlack.fen, blackTurn.fen);
  assert.equal(canceledBlack.players.black.discard[0]?.cardId, 'knightmare');
  assert.equal(canceledBlack.players.white.discard[0]?.cardId, 'chaos');
  assert.deepEqual(physicalCards(canceledBlack), physicalCards(before));
});

test('Haunting Memories copies the Knightmare effect while preserving physical IDs', () => {
  const before = createGameState({ hands: { black: ['knightmare'], white: ['haunting-memories'] },
    decks: { black: ['dubbing'], white: ['hidden-passage'] } });
  const restored = play(move(before, 'e2', 'e4'), 'knightmare');
  const blackTurn = act(move(restored, 'd2', 'd4'), { type: 'endTurn' });
  const copied = play(move(blackTurn, 'e7', 'e5'), 'haunting-memories');
  assert.equal(copied.fen, blackTurn.fen);
  assert.equal(copied.history.at(-1)?.copiedCardId, 'knightmare');
  assert.equal(copied.players.white.discard[0]?.id, before.players.white.hand[0]?.id);
  assert.equal(copied.players.black.discard[0]?.id, before.players.black.hand[0]?.id);
  assert.deepEqual(physicalCards(copied), physicalCards(before));
});

function advertisedMoves(state: GameState): Array<{ from: SquareName; to: SquareName }> {
  return [...legalDests(state, false)].flatMap(([from, targets]) => targets.map(to => ({ from, to })));
}

function invariants(state: GameState, initial: GameState): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), initial.pieces.map(piece => piece.id).sort());
  const occupied = state.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square);
  assert.equal(new Set(occupied).size, occupied.length);
  assert.ok(!occupied.includes(null));
  for (const color of ['white', 'black'] as const) {
    assert.equal(state.pieces.filter(piece => piece.owner === color && piece.royal && piece.zone === 'board').length, 1);
  }
  assert.deepEqual(physicalCards(state), physicalCards(initial));
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Knightmare seeded continuation ${seed}`, () => {
    let random = seed;
    const pick = (length: number) => {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      return random % length;
    };
    const mover: Color = seed % 2 ? 'white' : 'black';
    const reactor: Color = mover === 'white' ? 'black' : 'white';
    const initial = createGameState({
      fen: `4k2r/3pp3/8/8/8/8/3PP3/R3K3 ${mover === 'white' ? 'w' : 'b'} - - 5 17`,
      hands: { [reactor]: ['knightmare'] }, decks: { [reactor]: ['dubbing', 'chaos'] },
    });
    const options = advertisedMoves(initial);
    const original = options[pick(options.length)]!;
    const moved = act(initial, { type: 'move', ...original });
    const restored = play(moved, 'knightmare');
    assert.equal(restored.fen, initial.fen);
    assert.deepEqual(restored.pieces, initial.pieces);
    const replacements = advertisedMoves(restored);
    assert.ok(replacements.length > 0);
    assert.ok(!replacements.some(candidate => candidate.from === original.from && candidate.to === original.to));
    const replacement = replacements[pick(replacements.length)]!;
    let current = act(restored, { type: 'move', ...replacement });
    assert.equal(isKingInCheck(current, mover), false);
    invariants(current, initial);
    current = act(current, { type: 'endTurn' });
    for (let ply = 0; ply < 4; ply++) {
      const legal = advertisedMoves(current);
      assert.ok(legal.length > 0, `seed ${seed}, ply ${ply}: no advertised continuation`);
      const candidate = legal[pick(legal.length)]!;
      const physical = current.pieces.find(piece => piece.zone === 'board' && piece.square === candidate.from)!;
      const capture = current.pieces.some(piece => piece.zone === 'board' && piece.square === candidate.to);
      const [half, full] = current.fen.split(' ').slice(4).map(Number) as [number, number];
      const active = current.turn.color;
      current = act(current, { type: 'move', ...candidate });
      assert.equal(isKingInCheck(current, active), false);
      assert.equal(Number(current.fen.split(' ')[4]), physical.originalRole === 'pawn' || capture ? 0 : half + 1);
      assert.equal(Number(current.fen.split(' ')[5]), full + (active === 'black' ? 1 : 0));
      invariants(current, initial);
      current = act(current, { type: 'endTurn' });
    }
  });
}
