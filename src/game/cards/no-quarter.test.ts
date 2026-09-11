import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Event = State['history'][number] & { capturedId?: string };

const CARD = 'no-quarter';
const DIRECT = '4k3/r7/8/8/8/8/8/R3K3 w - - 17 42';

function game(options: Options = {}): State {
  return createGameState({
    fen: DIRECT,
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function move(state: State, from: string, to: string, promotion?: string): State {
  return applied(state, {
    type: 'move',
    from,
    to,
    ...(promotion === undefined ? {} : { promotion }),
  });
}

function capture(state = game()): State {
  return move(state, 'a1', 'a7');
}

function play(
  state: State,
  overrides: { cardInstanceId?: unknown; target?: unknown } = {},
): Result {
  const cardInstanceId = state.players[state.turn.color].hand.find(card => card.cardId === CARD)?.id;
  return applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId,
    ...overrides,
  } as Action);
}

function ok(result: Result): State {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(
  before: State,
  code: string,
  overrides: { cardInstanceId?: unknown; target?: unknown } = {},
): void {
  const snapshot = structuredClone(before);
  const result = play(before, overrides);
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before, 'rejection must return the input state');
  assert.deepEqual(before, snapshot, 'rejection must be atomic');
}

function pieceAt(state: State, square: string) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function pieceById(state: State, id: string) {
  return state.pieces.find(piece => piece.id === id);
}

function capturedPiece(state: State) {
  return state.pieces.find(piece => piece.zone === 'captured');
}

// Finding32: printed No Quarter/Plots text and rules.md §17.3 preserve the
// original ordinary capture, with the captured victim validated at execution.
describe('No Quarter through Plots Within Plots', () => {
  for (const color of ['white', 'black'] as const) for (const extra of [false, true]) {
    it(`preserves ${color}'s ordinary capture as extra ${extra ? 2 : 1}`, () => {
      const opponent = color === 'white' ? 'black' : 'white';
      const at = (square: string) => color === 'white' ? square : `${square[0]}${9 - Number(square[1])}`;
      const initial = game({
        fen: color === 'white' ? '7k/8/8/8/8/n7/1P6/R5K1 w - - 0 1' : 'r5k1/1p6/N7/8/8/8/8/7K b - - 0 1',
        hands: { [color]: ['plots-within-plots', CARD, 'crab', CARD], [opponent]: [CARD] },
        decks: { [color]: [CARD, 'dubbing', 'panic'] },
      });
      const victim = pieceAt(initial, at('a3'))!;
      const selected = initial.players[color].hand[3]!;
      const drawnCopy = initial.players[color].deck[0]!;
      let before = applied(move(initial, at('a1'), at('a3')), { type: 'playCard', cardId: 'plots-within-plots' });
      if (extra) before = applied(before, { type: 'playCard', cardId: 'crab', target: at('b2') });
      const snapshot = structuredClone(before);
      assert.ok(before.plotsAllowances?.[0].eligibleCards.includes(selected.id));
      assert.ok(cardPlayTargets(before, CARD).some(target => target === undefined));
      rejected(before, 'CARD_ALREADY_PLAYED', { cardInstanceId: drawnCopy.id });
      rejected(before, 'CARD_NOT_IN_HAND', { cardInstanceId: before.players[opponent].hand[0]!.id });
      rejected(before, 'CARD_NOT_IN_HAND', { cardInstanceId: 'missing' });
      const after = ok(play(before, { cardInstanceId: selected.id }));
      const captured = pieceById(before, victim.id)!;
      const { capturedBy: _capturedBy, ...identity } = captured;
      assert.deepEqual(pieceById(after, victim.id), { ...identity, zone: 'dead' });
      assert.deepEqual(after.pieces.filter(piece => piece.id !== victim.id), before.pieces.filter(piece => piece.id !== victim.id));
      assert.deepEqual(after.players[color].hand, [...before.players[color].hand.filter(card => card.id !== selected.id), before.players[color].deck[0]]);
      assert.deepEqual(after.players[color].deck, before.players[color].deck.slice(1));
      assert.deepEqual(after.players[color].discard, [...before.players[color].discard, selected]);
      assert.deepEqual(after.players[opponent], before.players[opponent]);
      assert.equal(after.turn.cardPlays[color], extra ? 3 : 2);
      assert.equal(after.plotsAllowances?.[0].remaining, extra ? 0 : 1);
      assert.equal(after.fen, before.fen);
      assert.deepEqual(before, snapshot);
    });
  }

  it('retains the capture when Disintegration removes the capturing Pawn', () => {
    let state = game({
      fen: '7k/8/8/8/8/3n4/2P5/6K1 w - - 0 1',
      hands: { white: ['plots-within-plots', CARD, 'disintegration'] },
    });
    const victim = pieceAt(state, 'd3')!;
    const capturer = pieceAt(state, 'c2')!;
    state = applied(move(state, 'c2', 'd3'), { type: 'playCard', cardId: 'plots-within-plots' });
    state = applied(state, { type: 'playCard', cardId: 'disintegration', target: 'd3' });
    assert.equal(pieceById(state, capturer.id)?.zone, 'dead');
    const after = ok(play(state));
    assert.equal(pieceById(after, victim.id)?.zone, 'dead');
    assert.deepEqual(pieceById(after, capturer.id), pieceById(state, capturer.id));
  });

  it('follows the saved capture after Siege moves the capturer off its arrival square', () => {
    let state = game({
      fen: '7k/8/8/8/8/n7/1P6/RN4K1 w - - 0 1',
      hands: { white: ['plots-within-plots', CARD, 'siege'] },
    });
    const victim = pieceAt(state, 'a3')!;
    const capturer = pieceAt(state, 'a1')!;
    state = applied(move(state, 'a1', 'a3'), { type: 'playCard', cardId: 'plots-within-plots' });
    state = applied(state, { type: 'playCard', cardId: 'siege', target: { rook: 'a3', knight: 'b1' } });
    assert.equal(pieceAt(state, 'b1')?.id, capturer.id);
    const after = ok(play(state));
    assert.equal(pieceById(after, victim.id)?.zone, 'dead');
    assert.equal(pieceAt(after, 'b1')?.id, capturer.id);
  });

  it('makes every captured composite component dead after Crab', () => {
    let state = game({
      fen: '7k/r7/8/8/8/n7/1P6/R5K1 b - - 0 1',
      hands: { white: ['plots-within-plots', CARD, 'crab'], black: ['confabulation'] },
    });
    const ids = ['a3', 'a7'].map(square => pieceAt(state, square)!.id);
    state = applied(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'a7', to: 'a3' }] });
    state = applied(state, { type: 'endTurn' });
    state = move(state, 'a1', 'a3');
    assert.deepEqual(new Set(state.history.at(-1)?.capturedIds), new Set(ids));
    state = applied(state, { type: 'playCard', cardId: 'plots-within-plots' });
    state = applied(state, { type: 'playCard', cardId: 'crab', target: 'b2' });
    const after = ok(play(state));
    assert.deepEqual(after.pieces.filter(piece => piece.zone === 'dead').map(piece => piece.id).sort(), ids.sort());
  });

  it('preserves an ordinary capture whose mover was captured by an arrival trap', () => {
    let state = game({
      fen: '7k/8/8/8/8/n7/1P6/R5K1 b - - 0 1',
      hands: { white: ['plots-within-plots', CARD, 'crab'], black: ['man-trap'] },
    });
    const victim = pieceAt(state, 'a3')!;
    const capturer = pieceAt(state, 'a1')!;
    state = applied(move(state, 'h8', 'g8'), { type: 'playCard', cardId: 'man-trap', target: 'a3' });
    state = move(applied(state, { type: 'endTurn' }), 'a1', 'a3');
    assert.equal(pieceById(state, capturer.id)?.zone, 'captured');
    state = applied(state, { type: 'playCard', cardId: 'plots-within-plots' });
    state = applied(state, { type: 'playCard', cardId: 'crab', target: 'b2' });
    const after = ok(play(state));
    assert.equal(pieceById(after, victim.id)?.zone, 'dead');
    assert.equal(pieceById(after, capturer.id)?.zone, 'captured');
  });

  it('retains the exact recent victim rather than an older captured piece', () => {
    let state = game({
      fen: '7k/8/3b4/2n5/3P4/8/8/7K w - - 0 1',
      hands: { white: ['plots-within-plots', CARD, 'crab'] },
    });
    const older = pieceAt(state, 'c5')!;
    const victim = pieceAt(state, 'd6')!;
    state = applied(move(state, 'd4', 'c5'), { type: 'endTurn' });
    state = applied(move(state, 'h8', 'g8'), { type: 'endTurn' });
    state = applied(move(state, 'c5', 'd6'), { type: 'playCard', cardId: 'plots-within-plots' });
    state = applied(state, { type: 'playCard', cardId: 'crab', target: 'd6' });
    const after = ok(play(state));
    assert.equal(pieceById(after, older.id)?.zone, 'captured');
    assert.equal(pieceById(after, victim.id)?.zone, 'dead');
  });

  it('accepts No Quarter through a physical Haunting Memories copying Plots', () => {
    let state = game({
      fen: '7k/8/8/8/8/n7/1P6/R5K1 b - - 0 1',
      hands: { white: ['haunting-memories', CARD, 'crab'], black: ['plots-within-plots'] },
    });
    const copy = state.players.white.hand[0]!;
    const victim = pieceAt(state, 'a3')!;
    state = applied(state, { type: 'playCard', cardId: 'plots-within-plots' });
    state = applied(move(state, 'h8', 'g8'), { type: 'endTurn' });
    state = applied(move(state, 'a1', 'a3'), { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: copy.id });
    assert.equal(state.history.at(-1)?.copiedCardId, 'plots-within-plots');
    state = applied(state, { type: 'playCard', cardId: 'crab', target: 'b2' });
    const after = ok(play(state));
    assert.equal(pieceById(after, victim.id)?.zone, 'dead');
    assert.deepEqual(after.players.white.discard[0], copy);
  });

  it('copies No Quarter for a new ordinary capture using the exact physical Haunting Memories', () => {
    let state = game({
      fen: '7k/8/8/8/8/n3p3/1P1P4/R5K1 b - - 0 1',
      hands: { white: ['haunting-memories'], black: [CARD] },
    });
    state = ok(play(move(state, 'e3', 'd2')));
    state = applied(state, { type: 'endTurn' });
    const copy = state.players.white.hand[0]!;
    const victim = pieceAt(state, 'a3')!;
    state = move(state, 'a1', 'a3');
    const after = applied(state, { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: copy.id });
    assert.equal(pieceById(after, victim.id)?.zone, 'dead');
    assert.deepEqual(after.players.white.discard, [copy]);
    assert.equal(after.history.at(-1)?.copiedCardId, CARD);
  });

  it('cannot manufacture eligibility from a quiet move or a first extra card capture', () => {
    for (const mode of ['quiet', 'card', 'before'] as const) {
      let state = game({
        fen: '7k/8/8/8/8/n7/1P6/R5K1 w - - 0 1',
        hands: { white: ['plots-within-plots', CARD, 'bombard', 'crab', 'disintegration'] },
      });
      if (mode === 'quiet') state = move(state, 'g1', 'f1');
      state = applied(state, { type: 'playCard', cardId: 'plots-within-plots' });
      assert.ok(!state.plotsAllowances?.[0].eligibleCards.includes(state.players.white.hand.find(card => card.cardId === CARD)!.id));
      state = mode === 'card'
        ? applied(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a3' }] })
        : applied(state, { type: 'playCard', cardId: mode === 'quiet' ? 'crab' : 'disintegration', target: 'b2' });
      if (mode === 'card') assert.equal(pieceById(state, 'black-knight-a3')?.zone, 'captured');
      rejected(state, 'CARD_ALREADY_PLAYED');
    }
  });

  it('rejects a duplicate No Quarter once the preserved victim is dead', () => {
    let state = game({
      fen: '7k/8/8/8/8/n7/1P6/R5K1 w - - 0 1',
      hands: { white: ['plots-within-plots', CARD, CARD] },
    });
    state = applied(move(state, 'a1', 'a3'), { type: 'playCard', cardId: 'plots-within-plots' });
    state = ok(play(state));
    rejected(state, 'INVALID_TIMING');
    assert.equal(state.plotsAllowances?.[0].remaining, 1);
  });

  it('rejects the original victim after opposing Plots and Riposte return it', () => {
    let state = game({
      fen: '7k/8/8/8/8/n7/1P6/R5K1 w - - 0 1',
      hands: { white: ['plots-within-plots', CARD], black: ['plots-within-plots', 'riposte'] },
    });
    const victim = pieceAt(state, 'a3')!;
    state = applied(move(state, 'a1', 'a3'), { type: 'playCard', cardId: 'plots-within-plots' });
    state = applied(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
    state = applied(state, { type: 'playCard', cardId: 'riposte' });
    assert.equal(pieceById(state, victim.id)?.zone, 'board');
    rejected(state, 'INVALID_TIMING');
  });

  it('cannot reuse an earlier turn capture when a later quiet move opens Plots', () => {
    let state = game({
      fen: '7k/8/8/8/8/n7/1P6/R5K1 w - - 0 1',
      hands: { white: ['plots-within-plots', CARD] },
    });
    state = applied(move(state, 'a1', 'a3'), { type: 'endTurn' });
    state = applied(move(state, 'h8', 'g8'), { type: 'endTurn' });
    state = applied(move(state, 'g1', 'f1'), { type: 'playCard', cardId: 'plots-within-plots' });
    rejected(state, 'CARD_ALREADY_PLAYED');
  });
});

describe('No Quarter contract', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'No Quarter',
      points: 4,
      unique: false,
      image: '/KC5_card4.png',
      description:
        'Play this card after you capture any enemy piece without using a card. The captured piece is now dead and cannot be brought back into play with another card.',
      timing: ['afterMove'],
      continuing: false,
    });
  });

  it('records the exact physical victim on an ordinary capture', () => {
    const before = game();
    const victim = pieceAt(before, 'a7');
    assert.ok(victim);
    assert.deepEqual(capture(before).history.at(-1), {
      type: 'move',
      from: 'a1',
      to: 'a7',
      capturedId: victim.id,
    });
  });

  it('moves the just-captured enemy piece from captured to dead', () => {
    const before = capture();
    const victim = capturedPiece(before);
    assert.ok(victim);
    const after = ok(play(before));

    const { capturedBy: _capturedBy, ...identity } = victim;
    assert.deepEqual(pieceById(after, victim.id), { ...identity, zone: 'dead' });
    assert.deepEqual(after.history, [
      ...before.history,
      { type: 'cardPlayed', cardId: CARD, movement: [], preservePreviousMove: true },
    ]);
  });

  it('makes the exact Coup Prince captured by a regular move dead', () => {
    const before = game({ fen: '4k3/p7/8/8/8/8/4R3/4K3 w - - 0 1' });
    const prince = pieceAt(before, 'e8');
    const replacement = pieceAt(before, 'a7');
    assert.ok(prince && replacement);
    prince.royal = false;
    replacement.royal = true;
    const initialSnapshot = structuredClone(before);

    const captured = move(before, 'e2', 'e8');
    assert.deepEqual(before, initialSnapshot, 'capture must not mutate its input');
    assert.deepEqual(pieceById(captured, prince.id), { ...prince, square: null, zone: 'captured', capturedBy: before.turn.color });
    assert.deepEqual(captured.history, [{
      type: 'move',
      from: 'e2',
      to: 'e8',
      capturedId: prince.id,
    }]);
    const capturedSnapshot = structuredClone(captured);

    const after = ok(play(captured));
    assert.deepEqual(captured, capturedSnapshot, 'No Quarter must not mutate its input');
    assert.deepEqual(pieceById(after, prince.id), { ...prince, square: null, zone: 'dead' });
    assert.deepEqual(after.history, [
      ...captured.history,
      { type: 'cardPlayed', cardId: CARD, movement: [], preservePreviousMove: true },
    ]);
  });

  it('works after Black makes an ordinary capture', () => {
    const initial = game({
      fen: 'r3k3/8/8/8/8/8/R7/4K3 b - - 23 42',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const victim = pieceAt(initial, 'a2');
    assert.ok(victim);
    const after = ok(play(move(initial, 'a8', 'a2')));
    assert.equal(pieceById(after, victim.id)?.zone, 'dead');
  });

  it('accepts an ordinary en-passant capture', () => {
    const initial = game({ fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 10' });
    const victim = pieceAt(initial, 'd5');
    assert.ok(victim);
    const after = ok(play(move(initial, 'e5', 'd6')));
    assert.deepEqual(pieceById(after, victim.id), { ...victim, square: null, zone: 'dead' });
  });

  it('accepts an ordinary promotion capture', () => {
    const initial = game({ fen: '4k2r/6P1/8/8/8/8/8/4K3 w - - 0 20' });
    const victim = pieceAt(initial, 'h8');
    assert.ok(victim);
    const moved = move(initial, 'g7', 'h8', 'queen');
    const after = ok(play(moved));
    assert.equal(pieceById(after, victim.id)?.zone, 'dead');
    assert.equal(pieceAt(after, 'h8')?.role, 'queen');
  });

  it('preserves every identity and effect field on a neutral transformed victim', () => {
    const seeded = game();
    const victim = pieceAt(seeded, 'a7');
    assert.ok(victim);
    const initial: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.id === victim.id
        ? { ...piece, role: 'bishop', originalRole: 'knight', promoted: true, neutral: true }
        : piece),
    };
    const before = capture(initial);
    const transformed = pieceById(before, victim.id);
    assert.ok(transformed);
    const after = ok(play(before));
    const { capturedBy: _capturedBy, ...identity } = transformed;
    assert.deepEqual(pieceById(after, victim.id), { ...identity, zone: 'dead' });
  });

  it('spends the exact selected duplicate, discards and replaces it exactly once', () => {
    const initial = game({
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    });
    const before = capture(initial);
    const kept = before.players.white.hand[0]!;
    const selected = before.players.white.hand[2]!;
    const drawn = before.players.white.deck[0]!;
    const after = ok(play(before, { cardInstanceId: selected.id }));

    assert.equal(after.players.white.hand.some(card => card.id === kept.id), true);
    assert.equal(after.players.white.hand.some(card => card.id === selected.id), false);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.deepEqual(after.players.white.discard.map(card => card.id), [selected.id]);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('changes no board or turn-progress state except the victim zone and card lifecycle', () => {
    const moved = capture(game({
      fen: 'r3k2r/r7/8/8/8/8/8/R3K2R w KQkq - 17 42',
      hands: { white: [CARD], black: [] },
    }));
    const victim = capturedPiece(moved);
    assert.ok(victim);
    const before: State = {
      ...moved,
      effects: [{ retained: true }],
      enPassant: [{ target: 'd6', pawnId: 'retained-opportunity' }],
    };
    const after = ok(play(before));

    assert.equal(after.fen, before.fen);
    assert.equal(after.orientation, before.orientation);
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.deepEqual(after.effects, before.effects);
    assert.equal(after.outcome, before.outcome);
    assert.deepEqual(after.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } });
    assert.deepEqual(
      after.pieces.filter(piece => piece.id !== victim.id),
      before.pieces.filter(piece => piece.id !== victim.id),
    );
  });

  it('does not fizzle when the ordinary capture delivered check or checkmate', () => {
    const fixtures = [
      { fen: '4k2r/6P1/8/8/8/8/8/4K3 w - - 0 20', from: 'g7', to: 'h8', promotion: 'queen' },
      { fen: '7k/7p/6K1/3B4/8/8/8/7R w - - 0 1', from: 'h1', to: 'h7' },
    ];
    for (const fixture of fixtures) {
      const before = move(game({ fen: fixture.fen }), fixture.from, fixture.to, fixture.promotion);
      const victim = capturedPiece(before);
      assert.ok(victim);
      const after = ok(play(before));
      assert.equal(pieceById(after, victim.id)?.zone, 'dead');
      assert.deepEqual(after.history.at(-1), {
        type: 'cardPlayed',
        cardId: CARD,
        movement: [],
        preservePreviousMove: true,
      });
    }
  });
});

describe('No Quarter eligibility and validation', () => {
  it('rejects play before the regular move', () => {
    rejected(game(), 'INVALID_TIMING');
  });

  it('rejects an immediately preceding non-capturing move', () => {
    const before = move(
      game({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1' }),
      'a1',
      'a2',
    );
    rejected(before, 'INVALID_TIMING');
  });

  it('rejects a stale capture from the previous turn', () => {
    const captured = capture(game({ hands: { white: [CARD], black: [CARD] } }));
    const nextTurn = applied(captured, { type: 'endTurn' });
    const stale: State = {
      ...nextTurn,
      turn: { ...nextTurn.turn, phase: 'afterMove', moveMade: true },
    };
    rejected(stale, 'INVALID_TIMING');
  });

  it('rejects a capture attributed to a card rather than a regular move', () => {
    const captured = capture();
    const before: State = {
      ...captured,
      history: [{ type: 'cardPlayed', cardId: 'capture-card' }],
    };
    rejected(before, 'INVALID_TIMING');
  });

  it('allows an omitted instance ID and rejects malformed or nonmatching supplied IDs', () => {
    const initial = game({
      hands: { white: [CARD, 'fanatic'], black: [CARD] },
    });
    const before = capture(initial);
    const selected = before.players.white.hand[0]!;
    const victim = capturedPiece(before);
    assert.ok(victim);
    for (const result of [
      play(before, { cardInstanceId: undefined }),
      applyAction(before, { type: 'playCard', cardId: CARD }),
    ]) {
      const after = ok(result);
      assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
      assert.equal(pieceById(after, victim.id)?.zone, 'dead');
    }

    const foreign = before.players.black.hand[0]!.id;
    const wrongCard = before.players.white.hand[1]!.id;
    for (const cardInstanceId of ['missing', foreign, wrongCard, null, 42, {}, []]) {
      rejected(before, 'CARD_NOT_IN_HAND', { cardInstanceId });
    }
  });

  it('rejects a second card play in the turn', () => {
    const captured = capture();
    const before: State = {
      ...captured,
      turn: { ...captured.turn, cardPlays: { white: 1, black: 0 } },
    };
    rejected(before, 'CARD_ALREADY_PLAYED');
  });

  it('is targetless and rejects every supplied target value', () => {
    const before = capture();
    for (const target of [null, 'a7', {}, []]) rejected(before, 'INVALID_TARGET', { target });
  });

  it('rejects missing, unknown, board, or already-dead captured identities', () => {
    const captured = capture();
    const victim = capturedPiece(captured);
    const boardPiece = pieceAt(captured, 'a7');
    assert.ok(victim && boardPiece);
    const histories: Event[][] = [
      [{ type: 'move', from: 'a1', to: 'a7' }],
      [{ type: 'move', from: 'a1', to: 'a7', capturedId: 'missing' }],
      [{ type: 'move', from: 'a1', to: 'a7', capturedId: boardPiece.id }],
    ];
    for (const history of histories) rejected({ ...captured, history }, 'INVALID_TIMING');

    const dead: State = {
      ...captured,
      pieces: captured.pieces.map(piece => piece.id === victim.id ? { ...piece, zone: 'dead' } : piece),
    };
    rejected(dead, 'INVALID_TIMING');
  });

  it('rejects play after game-over', () => {
    const captured = capture();
    const finished: State = {
      ...captured,
      outcome: { winner: 'white', reason: 'checkmate' },
    };
    rejected(finished, 'GAME_OVER');
  });

  it('cannot gain eligibility by attempting to capture a King', () => {
    const before = game({ fen: 'k7/8/8/8/8/8/8/R3K3 w - - 0 1' });
    const result = applyAction(before, { type: 'move', from: 'a1', to: 'a8' });
    if (result.ok) assert.fail('Kings must never be captured');
    assert.equal(result.error.code, 'ILLEGAL_MOVE');
    assert.strictEqual(result.state, before);
    rejected(before, 'INVALID_TIMING');
  });
});
