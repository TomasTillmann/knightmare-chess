import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, doomsayerTargets, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Role = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen';
type Color = 'white' | 'black';
type Effect = Record<string, unknown>;

const DOOMSAYER = 'doomsayer';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [DOOMSAYER], black: [DOOMSAYER] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(state: State, action: Action, code: string): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail(`expected ${code}`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

const move = (state: State, from: string, to: string, promotion?: string) => applied(state, {
  type: 'move', from, to, ...(promotion ? { promotion } : {}),
} as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const declineDoomsayer = (state: State) => applied(state, {
  type: 'declineDoomsayer', player: state.turn.color === 'white' ? 'black' : 'white',
} as Action);
const finishMove = (state: State, from: string, to: string) => endTurn(move(state, from, to));
const play = (state: State, cardId: string, target?: unknown, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId,
  cardInstanceId: cardInstanceId
    ?? state.players[state.turn.color].hand.find(card => card.cardId === cardId)?.id,
  ...(target === undefined ? {} : { target }),
} as Action);
const playDoomsayer = (state: State, cardInstanceId?: string) =>
  play(state, DOOMSAYER, undefined, cardInstanceId);
const namePiece = (state: State, name: Role, target?: string | string[], speaker?: Color) => {
  const effects = activeDoomsayers(state);
  const newestOwner = effects.at(-1)?.owner as Color | undefined;
  const inferredSpeaker = newestOwner === state.turn.color
    ? (state.turn.color === 'white' ? 'black' : 'white')
    : state.turn.color;
  const squares = target === undefined ? [] : Array.isArray(target) ? target : [target];
  return applied(state, {
    type: 'namePiece',
    speaker: speaker ?? inferredSpeaker,
    name,
    losses: squares.map((square, index) => ({
      effectId: effectInstanceId(effects[index]!),
      pieceId: state.pieces.find(piece => piece.square === square)?.id ?? square,
    })),
  } as unknown as Action);
};
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
const activeDoomsayers = (state: State): Effect[] => state.effects.filter(effect =>
  Boolean(effect)
  && typeof effect === 'object'
  && (effect as Effect).type === DOOMSAYER,
) as Effect[];
const effectInstanceId = (effect: Effect) => effect.cardInstanceId
  ?? (effect.card && typeof effect.card === 'object' ? (effect.card as Effect).id : undefined);
const totalCards = (state: State) => (['white', 'black'] as const).reduce(
  (total, color) => total
    + state.players[color].hand.length
    + state.players[color].deck.length
    + state.players[color].discard.length,
  activeDoomsayers(state).length,
);

function knightDoomsayer(speaker: Color, neutral = true): State {
  const opponent = speaker === 'white' ? 'black' : 'white';
  let state = game({
    fen: speaker === 'white'
      ? '7k/8/2n5/8/8/8/8/K7 w - - 0 1'
      : 'k7/8/8/8/8/2N5/8/7K b - - 0 1',
    hands: { [speaker]: ['neutrality'], [opponent]: [DOOMSAYER] },
  });
  state = move(state, speaker === 'white' ? 'a1' : 'a8', speaker === 'white' ? 'a2' : 'a7');
  if (neutral) state = play(state, 'neutrality', speaker === 'white' ? 'c6' : 'c3');
  return playDoomsayer(move(endTurn(state), speaker === 'white' ? 'h8' : 'h1', speaker === 'white' ? 'h7' : 'h2'));
}

for (const speaker of ['white', 'black'] as const) {
  const opponent = speaker === 'white' ? 'black' : 'white';
  const victimId = `${opponent}-knight-${speaker === 'white' ? 'c6' : 'c3'}`;
  const effectId = `${opponent}-hand-0-doomsayer`;
  const loss: Action = {
    type: 'namePiece', speaker, name: 'knight', losses: [{ effectId, pieceId: victimId }],
  };

  test(`Doomsayer lets ${speaker} lose the opponent's neutral Knight`, () => {
    const state = knightDoomsayer(speaker);
    const snapshot = structuredClone(state);
    const result = applied(state, loss);
    assert.deepEqual(doomsayerTargets(state, speaker, 'knight').map(piece => piece.id), [victimId]);
    const victim = result.pieces.find(piece => piece.id === victimId)!;
    assert.deepEqual([victim.zone, victim.square, victim.owner, victim.role, victim.originalRole, victim.neutral],
      ['captured', null, opponent, 'knight', 'knight', false]);
    assert.deepEqual(result.players[opponent].discard, [{ id: effectId, cardId: DOOMSAYER }]);
    assert.deepEqual(result.players[speaker].discard, [{ id: `${speaker}-hand-0-neutrality`, cardId: 'neutrality' }]);
    assert.equal(result.effects.length, 0);
    assert.equal(result.pieces.length, state.pieces.length);
    assert.deepEqual(result.pieces.filter(piece => piece.id !== victimId), state.pieces.filter(piece => piece.id !== victimId));
    assert.deepEqual(result.players[speaker].hand, state.players[speaker].hand);
    assert.deepEqual(result.players[opponent].hand, state.players[opponent].hand);
    rejected(state, { ...loss, losses: [] }, 'INVALID_TARGET');
    assert.deepEqual(state, snapshot);
  });

  test(`Doomsayer still lets the ${opponent} owner lose that neutral Knight`, () => {
    const state = declineDoomsayer(knightDoomsayer(speaker));
    assert.deepEqual(doomsayerTargets(state, opponent, 'knight').map(piece => piece.id), [victimId]);
    const result = applied(state, { ...loss, speaker: opponent });
    assert.equal(result.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
    assert.equal(result.pieces.find(piece => piece.id === victimId)?.owner, opponent);
  });

  test(`Doomsayer rejects ${speaker} losing the opponent's nonneutral Knight`, () => {
    const state = knightDoomsayer(speaker, false);
    assert.deepEqual(doomsayerTargets(state, speaker, 'knight'), []);
    rejected(state, loss, 'WRONG_OWNER');
    const result = applied(state, { ...loss, losses: [] });
    assert.deepEqual(result.pieces, state.pieces);
    assert.deepEqual(result.effects, state.effects);
  });
}

test('canceling Neutrality restores the Doomsayer ownership restriction', () => {
  let state = game({
    fen: '7k/8/2n5/8/8/8/8/K7 w - - 0 1',
    hands: { white: ['neutrality'], black: [DOOMSAYER, 'fog-of-war'] },
  });
  state = play(move(state, 'a1', 'a2'), 'neutrality', 'c6');
  state = applied(state, { type: 'playCard', cardId: 'fog-of-war', cardInstanceId: 'black-hand-1-fog-of-war' });
  state = playDoomsayer(move(endTurn(state), 'h8', 'h7'));
  assert.equal(pieceAt(state, 'c6')!.neutral, false);
  assert.deepEqual(doomsayerTargets(state, 'white', 'knight'), []);
  rejected(state, {
    type: 'namePiece', speaker: 'white', name: 'knight',
    losses: [{ effectId: 'black-hand-0-doomsayer', pieceId: 'black-knight-c6' }],
  }, 'WRONG_OWNER');
});

test('Coup suspends Neutrality and excludes the royal Knight from Doomsayer', () => {
  let state = game({
    fen: '7k/8/2N5/8/8/8/8/K7 b - - 0 1',
    hands: { white: ['coup'], black: ['neutrality', DOOMSAYER] },
  });
  state = endTurn(play(move(state, 'h8', 'h7'), 'neutrality', 'c6'));
  state = endTurn(play(move(state, 'a1', 'a2'), 'coup', 'c6'));
  state = playDoomsayer(move(state, 'h7', 'h8'));
  assert.equal(pieceAt(state, 'c6')!.neutral, false);
  assert.equal(pieceAt(state, 'c6')!.royal, true);
  assert.ok(state.effects.some(effect => (effect as Effect).type === 'neutrality'));
  for (const speaker of ['white', 'black'] as const) {
    assert.deepEqual(doomsayerTargets(state, speaker, 'knight'), []);
    rejected(speaker === 'white' ? state : declineDoomsayer(state), {
      type: 'namePiece', speaker, name: 'knight',
      losses: [{ effectId: 'black-hand-1-doomsayer', pieceId: 'white-knight-c6' }],
    }, speaker === 'white' ? 'INVALID_TARGET' : 'WRONG_OWNER');
  }
});

for (const protection of ['pacifism', 'truce'] as const) {
  test(`Neutrality does not bypass ${protection} when resolving Doomsayer`, () => {
    let state = game({
      fen: '7k/8/2n5/8/8/8/8/K7 b - - 0 1',
      hands: { white: ['neutrality'], black: [protection, DOOMSAYER] },
    });
    state = protection === 'pacifism'
      ? endTurn(move(play(state, protection, 'c6'), 'h8', 'h7'))
      : endTurn(play(move(state, 'h8', 'h7'), protection));
    state = endTurn(play(move(state, 'a1', 'a2'), 'neutrality', 'c6'));
    state = playDoomsayer(move(state, 'h7', 'h8'));
    assert.equal(pieceAt(state, 'c6')!.neutral, true);
    assert.deepEqual(doomsayerTargets(state, 'white', 'knight'), []);
    rejected(state, {
      type: 'namePiece', speaker: 'white', name: 'knight',
      losses: [{ effectId: 'black-hand-1-doomsayer', pieceId: 'black-knight-c6' }],
    }, 'INVALID_TARGET');
    const result = namePiece(state, 'knight', undefined, 'white');
    assert.deepEqual(result.pieces, state.pieces);
    assert.deepEqual(result.effects, state.effects);
  });
}

test('catalog preserves the physical card metadata', () => {
  assert.deepEqual(CARD_CATALOG[DOOMSAYER], {
    id: DOOMSAYER,
    name: 'Doomsayer',
    points: 2,
    unique: false,
    image: '/KC1_card3.png',
    description: 'The next player who pronounces the name of a piece, except "King," loses one piece of that type. If he doesn\'t own a piece of that type, this card remains in effect. When you play this card, your opponent has the option to name a piece immediately.',
    timing: ['afterMove'],
    continuing: true,
  });
});

test('Doomsayer is targetless and can only be played after your move', () => {
  const before = game();
  rejected(before, {
    type: 'playCard', cardId: DOOMSAYER, cardInstanceId: before.players.white.hand[0]!.id,
  } as Action, 'INVALID_TIMING');

  const afterMove = move(before, 'e2', 'e4');
  rejected(afterMove, {
    type: 'playCard', cardId: DOOMSAYER,
    cardInstanceId: afterMove.players.white.hand[0]!.id,
    target: 'queen',
  } as Action, 'INVALID_TARGET');
  assert.equal(activeDoomsayers(playDoomsayer(afterMove)).length, 1);
});

test('successful play creates a continuing effect instead of discarding the card', () => {
  const before = game({ decks: { white: ['fanatic'], black: [] } });
  const instanceId = before.players.white.hand[0]!.id;
  const drawnId = before.players.white.deck[0]!.id;
  const state = playDoomsayer(move(before, 'e2', 'e4'));

  assert.equal(state.players.white.hand.some(card => card.id === instanceId), false);
  assert.equal(state.players.white.discard.some(card => card.id === instanceId), false);
  assert.equal(state.players.white.hand.some(card => card.id === drawnId), true);
  assert.equal(activeDoomsayers(state).length, 1);
  assert.equal(effectInstanceId(activeDoomsayers(state)[0]!), instanceId);
  assert.equal(activeDoomsayers(state)[0]!.owner, 'white');
  assert.equal(totalCards(state), totalCards(before));
});

test('the opponent may name immediately before the caster ends the turn', () => {
  const before = game();
  const queenId = pieceAt(before, 'd8')!.id;
  const state = namePiece(playDoomsayer(move(before, 'e2', 'e4')), 'queen', 'd8');

  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.pieces.find(piece => piece.id === queenId)?.zone, 'captured');
  assert.equal(activeDoomsayers(state).length, 0);
});

test('the affected player chooses which owned piece of the named type is lost', () => {
  const before = game();
  const a7 = pieceAt(before, 'a7')!.id;
  const b7 = pieceAt(before, 'b7')!.id;
  const state = namePiece(playDoomsayer(move(before, 'e2', 'e4')), 'pawn', 'b7');

  assert.equal(state.pieces.find(piece => piece.id === b7)?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === a7)?.zone, 'board');
});

test('a Doomsayer loss is captured and rescuable, never dead', () => {
  const before = game();
  const victimId = pieceAt(before, 'c7')!.id;
  const state = namePiece(playDoomsayer(move(before, 'e2', 'e4')), 'pawn', 'c7');
  const victim = state.pieces.find(piece => piece.id === victimId)!;

  assert.equal(victim.square, null);
  assert.equal(victim.zone, 'captured');
  assert.equal(state.pieces.some(piece => piece.id === victimId && piece.zone === 'dead'), false);
});

test('resolving the effect moves the exact continuing card to its owner discard', () => {
  const before = game({ hands: { white: [DOOMSAYER, DOOMSAYER], black: [] } });
  const selected = before.players.white.hand[1]!;
  let state = playDoomsayer(move(before, 'e2', 'e4'), selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === before.players.white.hand[0]!.id), true);

  state = namePiece(state, 'queen', 'd8');
  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.discard.at(-1)?.cardId, DOOMSAYER);
});

test('naming a type the player does not own records the attempt and leaves the effect active', () => {
  let state = game({
    fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1',
    hands: { white: [DOOMSAYER], black: [] },
  });
  state = playDoomsayer(move(state, 'a2', 'a3'));
  const beforeEffects = structuredClone(activeDoomsayers(state));
  state = namePiece(state, 'queen');

  assert.deepEqual(activeDoomsayers(state), beforeEffects);
  assert.equal(state.players.white.discard.length, 0);
  const event = state.history.at(-1) as unknown as Effect;
  assert.equal(event.type, 'pieceNamed');
  assert.equal(event.speaker, 'black');
  assert.equal(event.name, 'queen');
  assert.deepEqual(event.resolvedEffectIds, []);
  assert.deepEqual(event.capturedIds, []);
});

test('declining the immediate option leaves the effect across the turn boundary', () => {
  const played = playDoomsayer(move(game(), 'e2', 'e4'));
  const state = endTurn(declineDoomsayer(played));

  assert.equal(state.turn.color, 'black');
  assert.equal(activeDoomsayers(state).length, 1);
  assert.equal(state.players.white.discard.length, 0);
});

test('the current player can name later after declining the immediate option', () => {
  const before = game();
  const knightId = pieceAt(before, 'b8')!.id;
  const state = namePiece(endTurn(declineDoomsayer(playDoomsayer(move(before, 'e2', 'e4')))), 'knight', 'b8');

  assert.equal(state.turn.color, 'black');
  assert.equal(state.pieces.find(piece => piece.id === knightId)?.zone, 'captured');
  assert.equal(activeDoomsayers(state).length, 0);
});

test('naming does not consume a move or either card allowance', () => {
  let state = endTurn(declineDoomsayer(playDoomsayer(move(game({
    hands: { white: [DOOMSAYER], black: ['disintegration'] },
  }), 'e2', 'e4'))));
  state = namePiece(state, 'pawn', 'a7');

  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
  state = play(state, 'disintegration', 'b7');
  assert.equal(state.turn.cardPlays.black, 1);
});

test('Doomsayer spends the caster own-turn card allowance', () => {
  const before = game({ hands: { white: [DOOMSAYER, 'cowardice'], black: [] } });
  const state = playDoomsayer(move(before, 'e2', 'e4'));
  rejected(state, {
    type: 'playCard',
    cardId: 'cowardice',
    cardInstanceId: state.players.white.hand.find(card => card.cardId === 'cowardice')!.id,
    target: [{ from: 'a7', to: 'a8' }],
  } as Action, 'CARD_ALREADY_PLAYED');
});

test('a missing victim choice is rejected when an eligible owned piece exists', () => {
  const state = playDoomsayer(move(game(), 'e2', 'e4'));
  rejected(state, {
    type: 'namePiece', speaker: 'black', name: 'queen',
  } as unknown as Action, 'INVALID_TARGET');
});

test('an opponent piece cannot be offered as the named player loss', () => {
  const state = playDoomsayer(move(game(), 'e2', 'e4'));
  const effectId = effectInstanceId(activeDoomsayers(state)[0]!);
  rejected(state, {
    type: 'namePiece', speaker: 'black', name: 'queen',
    losses: [{ effectId, pieceId: pieceAt(state, 'd1')!.id }],
  } as unknown as Action, 'WRONG_OWNER');
});

test('the selected victim must match the pronounced piece type', () => {
  const state = playDoomsayer(move(game(), 'e2', 'e4'));
  const effectId = effectInstanceId(activeDoomsayers(state)[0]!);
  rejected(state, {
    type: 'namePiece', speaker: 'black', name: 'rook',
    losses: [{ effectId, pieceId: pieceAt(state, 'd8')!.id }],
  } as unknown as Action, 'WRONG_ROLE');
});

test('King and malformed names are rejected atomically', () => {
  const state = playDoomsayer(move(game(), 'e2', 'e4'));
  const effectId = effectInstanceId(activeDoomsayers(state)[0]!);
  rejected(state, {
    type: 'namePiece', speaker: 'black', name: 'king',
    losses: [{ effectId, pieceId: pieceAt(state, 'e8')!.id }],
  } as unknown as Action, 'INVALID_TARGET');
  rejected(state, {
    type: 'namePiece', speaker: 'black', name: 'dragon',
    losses: [{ effectId, pieceId: pieceAt(state, 'd8')!.id }],
  } as unknown as Action, 'INVALID_TARGET');
});

test('captured and dead pieces never satisfy a later pronunciation', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1',
    hands: { white: [DOOMSAYER], black: [] },
  });
  const blackQueen = {
    id: 'black-queen-captured', owner: 'black' as const, role: 'queen' as const,
    originalRole: 'queen' as const, square: null, zone: 'captured' as const,
    promoted: false, royal: false, neutral: false,
  };
  const blackRook = { ...blackQueen, id: 'black-rook-dead', role: 'rook' as const, originalRole: 'rook' as const, zone: 'dead' as const };
  before.pieces.push(blackQueen, blackRook);
  let state = playDoomsayer(move(before, 'a2', 'a3'));

  state = namePiece(state, 'queen');
  assert.equal(state.pieces.find(piece => piece.id === blackQueen.id)?.zone, 'captured');
  assert.equal(activeDoomsayers(state).length, 1);
  state = namePiece(state, 'rook');
  assert.equal(state.pieces.find(piece => piece.id === blackRook.id)?.zone, 'dead');
  assert.equal(activeDoomsayers(state).length, 1);
});

test('a prior Disintegration death stays distinct from the Doomsayer capture', () => {
  let state = game({
    fen: '7k/pp6/8/8/8/8/P7/K7 b - - 0 1',
    hands: { white: [DOOMSAYER], black: ['disintegration'] },
  });
  const deadId = pieceAt(state, 'a7')!.id;
  const lostId = pieceAt(state, 'b7')!.id;
  state = endTurn(move(play(state, 'disintegration', 'a7'), 'h8', 'g8'));
  state = playDoomsayer(move(state, 'a2', 'a3'));
  state = declineDoomsayer(state);
  state = endTurn(state);
  state = namePiece(state, 'pawn', 'b7');

  assert.equal(state.pieces.find(piece => piece.id === deadId)?.zone, 'dead');
  assert.equal(state.pieces.find(piece => piece.id === lostId)?.zone, 'captured');
});

test('a Doomsayer loss never authorizes No Quarter', () => {
  const before = game({
    hands: { white: [DOOMSAYER], black: ['no-quarter'] },
  });
  const victimId = pieceAt(before, 'a7')!.id;
  let state = endTurn(declineDoomsayer(playDoomsayer(move(before, 'e2', 'e4'))));
  state = namePiece(state, 'pawn', 'a7');

  rejected(state, {
    type: 'playCard',
    cardId: 'no-quarter',
    cardInstanceId: state.players.black.hand[0]!.id,
  } as Action, 'INVALID_TIMING');
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
});

test('an ordinarily promoted Pawn answers only to its current promoted role', () => {
  const queenState = game();
  const queenPawn = pieceAt(queenState, 'a7')!;
  queenPawn.role = 'queen';
  queenPawn.originalRole = 'pawn';
  queenPawn.promoted = true;
  const captured = namePiece(playDoomsayer(move(queenState, 'e2', 'e4')), 'queen', 'a7');
  assert.equal(captured.pieces.find(piece => piece.id === queenPawn.id)?.zone, 'captured');

  const pawnState = game({ fen: '7k/p7/8/8/8/8/4P3/4K3 w - - 0 1' });
  const promoted = pieceAt(pawnState, 'a7')!;
  promoted.role = 'queen';
  promoted.originalRole = 'pawn';
  promoted.promoted = true;
  const unchanged = namePiece(playDoomsayer(move(pawnState, 'e2', 'e4')), 'pawn');
  assert.equal(unchanged.pieces.find(piece => piece.id === promoted.id)?.zone, 'board');
  assert.equal(activeDoomsayers(unchanged).length, 1);
});

test('Doomsayer permits choosing either an owned Knight or an opposing neutral Knight', () => {
  let state = game({
    fen: '7k/8/2n5/8/8/2N5/8/K7 w - - 0 1',
    hands: { white: ['neutrality'], black: [DOOMSAYER] },
  });
  state = endTurn(play(move(state, 'a1', 'a2'), 'neutrality', 'c6'));
  state = playDoomsayer(move(state, 'h8', 'h7'));
  assert.deepEqual(doomsayerTargets(state, 'white', 'knight').map(piece => piece.id).sort(),
    ['black-knight-c6', 'white-knight-c3']);
  for (const square of ['c3', 'c6']) {
    const result = namePiece(state, 'knight', square, 'white');
    assert.equal(result.pieces.find(piece => piece.id === pieceAt(state, square)!.id)?.zone, 'captured');
    assert.equal(pieceAt(result, square === 'c3' ? 'c6' : 'c3')?.zone, 'board');
  }
});

test('a royal non-King cannot be lost through a piece-name capture', () => {
  const before = game();
  const royalPawn = pieceAt(before, 'a7')!;
  royalPawn.royal = true;
  const state = playDoomsayer(move(before, 'e2', 'e4'));
  const effectId = effectInstanceId(activeDoomsayers(state)[0]!);

  rejected(state, {
    type: 'namePiece', speaker: 'black', name: 'pawn',
    losses: [{ effectId, pieceId: royalPawn.id }],
  } as unknown as Action, 'INVALID_TARGET');
  assert.equal(pieceAt(state, 'a7')?.royal, true);
});

test('loss of a blocker may give check because Doomsayer is a continuing effect', () => {
  let state = game({
    fen: '4k3/4r3/8/8/8/8/P7/K3R3 w - - 0 1',
    hands: { white: [DOOMSAYER], black: [] },
  });
  state = playDoomsayer(move(state, 'a2', 'a3'));
  state = namePiece(state, 'rook', 'e7');

  assert.equal(isKingInCheck(state, 'black'), true);
  assert.equal(state.outcome, null);
  assert.equal(endTurn(state).turn.color, 'black');
});

const DOOM_MATE_FEN = 'R5rk/8/6Q1/8/8/8/1p5K/1r6 w - - 0 1';

test('Doomsayer may create apparent mate and a before-move card can rescue it', () => {
  let state = game({
    fen: DOOM_MATE_FEN,
    hands: { white: [DOOMSAYER], black: ['lost-castle'] },
  });
  state = playDoomsayer(move(state, 'h2', 'h3'));
  state = namePiece(state, 'rook', 'g8');
  assert.equal(isKingInCheck(state, 'black'), true);

  state = endTurn(state);
  assert.equal(state.outcome, null);
  state = play(state, 'lost-castle', { own: 'b1', opponent: 'a8' });
  assert.equal(isKingInCheck(state, 'black'), false);
  assert.equal(pieceAt(state, 'a8')?.owner, 'black');
});

test('Doomsayer-created mate becomes final only on the affected player turn', () => {
  let state = game({
    fen: DOOM_MATE_FEN,
    hands: { white: [DOOMSAYER], black: [] },
  });
  state = playDoomsayer(move(state, 'h2', 'h3'));
  state = namePiece(state, 'rook', 'g8');
  assert.equal(state.outcome, null);

  state = endTurn(state);
  assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
});

test('duplicate copies coexist across turns without being discarded', () => {
  let state = game({ hands: { white: [DOOMSAYER, DOOMSAYER], black: [] } });
  state = endTurn(declineDoomsayer(playDoomsayer(move(state, 'e2', 'e4'))));
  state = finishMove(state, 'g8', 'f6');
  state = playDoomsayer(move(state, 'd2', 'd3'));

  assert.equal(activeDoomsayers(state).length, 2);
  assert.equal(state.players.white.discard.length, 0);
  assert.equal(new Set(activeDoomsayers(state).map(effectInstanceId)).size, 2);
});

test('one pronunciation resolves one of two effects when only one matching piece exists', () => {
  let state = game({
    fen: '3q3k/8/8/8/8/8/PP6/K7 w - - 0 1',
    hands: { white: [DOOMSAYER, DOOMSAYER], black: [] },
  });
  state = endTurn(declineDoomsayer(playDoomsayer(move(state, 'a2', 'a3'))));
  state = finishMove(state, 'h8', 'h7');
  state = playDoomsayer(move(state, 'b2', 'b3'));
  state = namePiece(state, 'queen', 'd8');

  assert.equal(state.pieces.find(piece => piece.id === 'black-queen-d8')?.zone, 'captured');
  assert.equal(activeDoomsayers(state).length, 1);
  assert.equal(state.players.white.discard.filter(card => card.cardId === DOOMSAYER).length, 1);
});

test('a no-match pronunciation leaves every duplicate effect active', () => {
  let state = game({
    fen: '7k/8/8/8/8/8/PP6/K7 w - - 0 1',
    hands: { white: [DOOMSAYER, DOOMSAYER], black: [] },
  });
  state = endTurn(declineDoomsayer(playDoomsayer(move(state, 'a2', 'a3'))));
  state = finishMove(state, 'h8', 'h7');
  state = playDoomsayer(move(state, 'b2', 'b3'));
  state = namePiece(state, 'queen');

  assert.equal(activeDoomsayers(state).length, 2);
  assert.equal(state.players.white.discard.length, 0);
});

test('Doomsayers owned by opposite players coexist independently', () => {
  let state = game();
  state = endTurn(declineDoomsayer(playDoomsayer(move(state, 'e2', 'e4'))));
  state = playDoomsayer(move(state, 'e7', 'e5'));

  assert.deepEqual(activeDoomsayers(state).map(effect => effect.owner).sort(), ['black', 'white']);
  assert.equal(state.players.white.discard.length, 0);
  assert.equal(state.players.black.discard.length, 0);
});

test('history distinguishes playing the card from intentionally naming a piece', () => {
  const before = game();
  const played = playDoomsayer(move(before, 'e2', 'e4'));
  assert.deepEqual(played.history.at(-1), {
    type: 'cardPlayed', cardId: DOOMSAYER, movement: [], preservePreviousMove: true,
  });

  const lostId = pieceAt(played, 'd8')!.id;
  const resolved = namePiece(played, 'queen', 'd8');
  const event = resolved.history.at(-1) as unknown as Effect;
  assert.equal(event.type, 'pieceNamed');
  assert.equal(event.speaker, 'black');
  assert.equal(event.name, 'queen');
  assert.deepEqual(event.capturedIds, [lostId]);
  assert.deepEqual(event.resolvedEffectIds, [effectInstanceId(activeDoomsayers(played)[0]!)]);
});

test('deterministic role cases capture only the selected identity and conserve pieces', async t => {
  const targets: Array<[Role, string]> = [
    ['pawn', 'a7'], ['knight', 'b8'], ['bishop', 'c8'], ['rook', 'a8'], ['queen', 'd8'],
  ];
  for (const [role, square] of targets) {
    await t.test(role, () => {
      const before = game();
      const ids = before.pieces.map(piece => piece.id).sort();
      const victimId = pieceAt(before, square)!.id;
      const state = namePiece(playDoomsayer(move(before, 'e2', 'e4')), role, square);
      assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
      assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
      assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, 1);
    });
  }
});

interface CardFixture {
  id: string;
  name: string;
  fen?: string;
  white: (state: State) => State;
  black: (state: State) => State;
  whiteDoomMove?: [string, string];
  blackDoomMove?: [string, string];
  verifyWhite: (state: State) => void;
  verifyBlack: (state: State) => void;
}

const afterMove = (state: State, from: string, to: string, cardId: string, target: unknown) =>
  play(move(state, from, to), cardId, target);

const fixtures: CardFixture[] = [
  {
    id: 'assassin', name: 'Assassin',
    white: state => play(state, 'assassin', [{ from: 'b1', to: 'd2' }]),
    black: state => play(state, 'assassin', [{ from: 'b8', to: 'd7' }]),
    verifyWhite: state => assert.equal(pieceAt(state, 'd2')?.role, 'knight'),
    verifyBlack: state => assert.equal(pieceAt(state, 'd7')?.role, 'knight'),
  },
  {
    id: 'disintegration', name: 'Disintegration',
    white: state => move(play(state, 'disintegration', 'a2'), 'e2', 'e4'),
    black: state => play(state, 'disintegration', 'a7'),
    verifyWhite: state => assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-a2')?.zone, 'dead'),
    verifyBlack: state => assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-a7')?.zone, 'dead'),
  },
  {
    id: 'fanatic', name: 'Fanatic',
    white: state => play(state, 'fanatic', 'a2'),
    black: state => play(state, 'fanatic', 'a7'),
    verifyWhite: state => assert.equal(pieceAt(state, 'a5')?.owner, 'white'),
    verifyBlack: state => assert.equal(pieceAt(state, 'a4')?.owner, 'black'),
  },
  {
    id: 'annexation', name: 'Annexation',
    white: state => play(state, 'annexation', [{ from: 'a2', to: 'a4' }]),
    black: state => play(state, 'annexation', [{ from: 'a7', to: 'a5' }]),
    verifyWhite: state => assert.equal(pieceAt(state, 'a4')?.owner, 'white'),
    verifyBlack: state => assert.equal(pieceAt(state, 'a5')?.owner, 'black'),
  },
  {
    id: 'forced-march', name: 'Forced March',
    fen: 'rnbqkbnr/p1pppppp/8/8/8/8/P1PPPPPP/RNBQKBNR w KQkq - 0 1',
    white: state => play(state, 'forced-march', [{ from: 'a2', to: 'b2' }]),
    black: state => play(state, 'forced-march', [{ from: 'a7', to: 'b7' }]),
    verifyWhite: state => assert.equal(pieceAt(state, 'b2')?.owner, 'white'),
    verifyBlack: state => assert.equal(pieceAt(state, 'b7')?.owner, 'black'),
  },
  {
    id: 'cowardice', name: 'Cowardice',
    fen: '1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kk - 0 1',
    white: state => afterMove(state, 'e2', 'e4', 'cowardice', [{ from: 'a7', to: 'a8' }]),
    black: state => afterMove(state, 'e7', 'e5', 'cowardice', [{ from: 'a2', to: 'a1' }]),
    verifyWhite: state => assert.equal(pieceAt(state, 'a8')?.owner, 'black'),
    verifyBlack: state => assert.equal(pieceAt(state, 'a1')?.owner, 'white'),
  },
  {
    id: 'holy-war', name: 'Holy War',
    white: state => afterMove(state, 'e2', 'e4', 'holy-war', { knight: 'b1', bishop: 'c1' }),
    black: state => afterMove(state, 'e7', 'e5', 'holy-war', { knight: 'b8', bishop: 'c8' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'c1')?.role, 'knight'),
    verifyBlack: state => assert.equal(pieceAt(state, 'c8')?.role, 'knight'),
  },
  {
    id: 'anathema', name: 'Anathema',
    white: state => afterMove(state, 'e2', 'e4', 'anathema', { bishop: 'c8', rook: 'a8' }),
    black: state => afterMove(state, 'e7', 'e5', 'anathema', { bishop: 'c1', rook: 'a1' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'a8')?.role, 'bishop'),
    verifyBlack: state => assert.equal(pieceAt(state, 'a1')?.role, 'bishop'),
  },
  {
    id: 'evangelists', name: 'Evangelists',
    white: state => play(state, 'evangelists', { own: 'c1', opponent: 'c8' }),
    black: state => play(state, 'evangelists', { own: 'c8', opponent: 'c1' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'c8')?.owner, 'white'),
    verifyBlack: state => assert.equal(pieceAt(state, 'c1')?.owner, 'black'),
  },
  {
    id: 'tournament', name: 'Tournament',
    white: state => play(state, 'tournament', { own: 'b1', opponent: 'b8' }),
    black: state => play(state, 'tournament', { own: 'b8', opponent: 'b1' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'b8')?.owner, 'white'),
    verifyBlack: state => assert.equal(pieceAt(state, 'b1')?.owner, 'black'),
  },
  {
    id: 'cathedral', name: 'Cathedral',
    white: state => afterMove(state, 'e2', 'e4', 'cathedral', { rook: 'a1', bishop: 'c1' }),
    black: state => afterMove(state, 'e7', 'e5', 'cathedral', { rook: 'a8', bishop: 'c8' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'c1')?.role, 'rook'),
    verifyBlack: state => assert.equal(pieceAt(state, 'c8')?.role, 'rook'),
  },
  {
    id: 'lost-castle', name: 'Lost Castle',
    white: state => play(state, 'lost-castle', { own: 'a1', opponent: 'a8' }),
    black: state => play(state, 'lost-castle', { own: 'a8', opponent: 'a1' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'a8')?.owner, 'white'),
    verifyBlack: state => assert.equal(pieceAt(state, 'a1')?.owner, 'black'),
  },
  {
    id: 'siege', name: 'Siege',
    white: state => afterMove(state, 'e2', 'e4', 'siege', { knight: 'b1', rook: 'a1' }),
    black: state => afterMove(state, 'e7', 'e5', 'siege', { knight: 'b8', rook: 'a8' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'a1')?.role, 'knight'),
    verifyBlack: state => assert.equal(pieceAt(state, 'a8')?.role, 'knight'),
  },
  {
    id: 'holy-quest', name: 'Holy Quest',
    white: state => afterMove(state, 'e2', 'e4', 'holy-quest', { bishop: 'c8', knight: 'b8' }),
    black: state => afterMove(state, 'e7', 'e5', 'holy-quest', { bishop: 'c1', knight: 'b1' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'b8')?.role, 'bishop'),
    verifyBlack: state => assert.equal(pieceAt(state, 'b1')?.role, 'bishop'),
  },
  {
    id: 'treason', name: 'Treason',
    white: state => afterMove(state, 'e2', 'e4', 'treason', { rook: 'a8', knight: 'b8' }),
    black: state => afterMove(state, 'e7', 'e5', 'treason', { rook: 'a1', knight: 'b1' }),
    verifyWhite: state => assert.equal(pieceAt(state, 'b8')?.role, 'rook'),
    verifyBlack: state => assert.equal(pieceAt(state, 'b1')?.role, 'rook'),
  },
  {
    id: 'onslaught', name: 'Onslaught',
    white: state => play(state, 'onslaught', [{ from: 'a2', to: 'a3' }, { from: 'b2', to: 'b3' }]),
    black: state => play(state, 'onslaught', [{ from: 'a7', to: 'a6' }, { from: 'b7', to: 'b6' }]),
    verifyWhite: state => assert.equal(pieceAt(state, 'b3')?.owner, 'white'),
    verifyBlack: state => assert.equal(pieceAt(state, 'b6')?.owner, 'black'),
  },
  {
    id: 'long-jump', name: 'Long Jump',
    white: state => play(state, 'long-jump', [{ from: 'b1', to: 'a3' }]),
    black: state => play(state, 'long-jump', [{ from: 'b8', to: 'a6' }]),
    verifyWhite: state => assert.equal(pieceAt(state, 'a3')?.role, 'knight'),
    verifyBlack: state => assert.equal(pieceAt(state, 'a6')?.role, 'knight'),
  },
  {
    id: 'dubbing', name: 'Dubbing',
    white: state => play(state, 'dubbing', [{ from: 'a2', to: 'b4' }]),
    black: state => play(state, 'dubbing', [{ from: 'a7', to: 'b5' }]),
    verifyWhite: state => assert.equal(pieceAt(state, 'b4')?.role, 'pawn'),
    verifyBlack: state => assert.equal(pieceAt(state, 'b5')?.role, 'pawn'),
  },
  {
    id: 'squaring-the-circle', name: 'Squaring the Circle',
    fen: 'r5k1/8/8/8/8/4B3/8/R3K2R w - - 0 1',
    white: state => play(state, 'squaring-the-circle', [{ from: 'e3', to: 'h8' }]),
    black: state => play(state, 'squaring-the-circle', [{ from: 'a8', to: 'h8' }]),
    whiteDoomMove: ['e1', 'e2'],
    blackDoomMove: ['g8', 'f7'],
    verifyWhite: state => assert.equal(pieceAt(state, 'h8')?.role, 'bishop'),
    verifyBlack: state => assert.equal(pieceAt(state, 'h8')?.role, 'rook'),
  },
  {
    id: 'no-quarter', name: 'No Quarter',
    fen: '7k/8/8/3pp3/3PP3/8/8/7K w - - 0 1',
    white: state => play(move(state, 'e4', 'd5'), 'no-quarter'),
    black: state => play(move(state, 'e5', 'd4'), 'no-quarter'),
    whiteDoomMove: ['h1', 'g1'],
    blackDoomMove: ['h8', 'g8'],
    verifyWhite: state => assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d5')?.zone, 'dead'),
    verifyBlack: state => assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-d4')?.zone, 'dead'),
  },
];

test('every implemented card composes before Doomsayer on the following turn', async t => {
  for (const fixture of fixtures) {
    await t.test(fixture.name, () => {
      let state = game({
        ...(fixture.fen ? { fen: fixture.fen } : {}),
        hands: { white: [fixture.id], black: [DOOMSAYER] },
      });
      state = fixture.white(state);
      fixture.verifyWhite(state);
      state = endTurn(state);
      const [from, to] = fixture.blackDoomMove ?? ['h7', 'h6'];
      state = playDoomsayer(move(state, from, to));

      assert.equal(activeDoomsayers(state).length, 1);
      assert.equal(state.history.some(event => event.type === 'cardPlayed' && event.cardId === fixture.id), true);
      assert.equal(state.history.at(-1)?.cardId, DOOMSAYER);
    });
  }
});

test('every implemented card composes after an unresolved Doomsayer', async t => {
  for (const fixture of fixtures) {
    await t.test(fixture.name, () => {
      let state = game({
        ...(fixture.fen ? { fen: fixture.fen } : {}),
        hands: { white: [DOOMSAYER], black: [fixture.id] },
      });
      const [from, to] = fixture.whiteDoomMove ?? ['e2', 'e4'];
      state = endTurn(declineDoomsayer(playDoomsayer(move(state, from, to))));
      state = fixture.black(state);
      fixture.verifyBlack(state);

      assert.equal(activeDoomsayers(state).length, 1, `${fixture.name} must not count as intentional speech`);
      assert.equal(state.history.some(event => event.type === 'cardPlayed' && event.cardId === DOOMSAYER), true);
      assert.equal(state.history.at(-1)?.cardId, fixture.id);
    });
  }
});
