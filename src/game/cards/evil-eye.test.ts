import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { createGameState } from '../state.js';
import { applyAction, boardFen, legalDests, cardPlayTargets, isKingInCheck } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const fixture = () => createGameState({
  fen: '7k/6n1/8/8/R2n4/8/1P4P1/4K3 w - - 7 3',
  hands: { white: ['evil-eye'] }, decks: { white: ['crab', 'curse'] },
});
const play = (state: GameState, target: unknown = { attacker: 'a4', victim: 'd4' }) =>
  applyAction(state, { type: 'playCard', cardId: 'evil-eye', target });
function success(state = fixture(), target: unknown = { attacker: 'a4', victim: 'd4' }) {
  const result = play(state, target);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'evil-eye').length, 1);
  return result.state;
}

function step(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action));
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

for (const [color, opponent, fen, attacker, victim, replyFrom, replyTo] of [
  ['white', 'black', '4r2k/8/8/4n3/3K4/8/8/8 w - - 0 1', 'd4', 'e5', 'h8', 'h7'],
  ['black', 'white', '8/8/8/3k4/4N3/8/8/4R2K b - - 0 1', 'd5', 'e4', 'h1', 'h2'],
] as const) {
  test(`Evil Eye permits the FAQ ${color} King to capture a protected Knight while remaining safe`, () => {
    const state = createGameState({ fen, hands: { [color]: ['evil-eye', 'evil-eye'] }, decks: { [color]: ['crab', 'curse'] } });
    const before = structuredClone(state);
    const target = { attacker, victim };
    const king = state.pieces.find(piece => piece.square === attacker)!;
    const knight = state.pieces.find(piece => piece.square === victim)!;
    assert.equal(legalDests(state, false).get(attacker)?.includes(victim) ?? false, false);
    assert.ok(cardPlayTargets(state, 'evil-eye').some(offered => isDeepStrictEqual(offered, target)));
    const after = step(state, { type: 'playCard', cardId: 'evil-eye', target, cardInstanceId: state.players[color].hand[1].id });
    assert.equal(after.pieces.find(piece => piece.id === knight.id)?.zone, 'captured');
    assert.deepEqual(after.pieces.filter(piece => piece.id !== knight.id), before.pieces.filter(piece => piece.id !== knight.id));
    assert.deepEqual(after.pieces.find(piece => piece.id === king.id), king);
    assert.equal(isKingInCheck(after, color), false);
    assert.deepEqual(after.players[color].discard, [before.players[color].hand[1]]);
    assert.deepEqual(after.players[color].hand, [before.players[color].hand[0], before.players[color].deck[0]]);
    assert.deepEqual(after.players[color].deck, [before.players[color].deck[1]]);
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays[color], 1);
    assert.equal(after.fen.split(' ')[5], color === 'black' ? '2' : '1');
    step(after, { type: 'endTurn' });
    assert.deepEqual(state, before);
  });

  test(`Evil Eye ${color} royal attacker still respects actual victim Pacifism`, () => {
    let state = createGameState({ fen, turn: opponent, hands: { [color]: ['evil-eye'], [opponent]: ['pacifism'] } });
    state = step(state, { type: 'playCard', cardId: 'pacifism', target: victim });
    state = step(state, { type: 'move', from: replyFrom, to: replyTo });
    state = step(state, { type: 'endTurn' });
    const before = structuredClone(state);
    const target = { attacker, victim };
    assert.equal(cardPlayTargets(state, 'evil-eye').some(offered => isDeepStrictEqual(offered, target)), false);
    const result = play(state, target);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

for (const [color, fen, attacker, victim, beganChecked] of [
  ['white', '7k/8/5b2/4n3/3K4/8/8/8 w - - 0 1', 'd4', 'e5', false],
  ['black', '8/8/8/3k4/4N3/5B2/8/7K b - - 0 1', 'd5', 'e4', false],
  ['white', '3r3k/8/8/4n3/3K4/8/8/8 w - - 0 1', 'd4', 'e5', true],
] as const) test(`Evil Eye preserves final ${color} stationary King safety, initially checked=${beganChecked}`, () => {
  const state = createGameState({ fen, hands: { [color]: ['evil-eye'] } });
  const before = structuredClone(state);
  const target = { attacker, victim };
  assert.equal(isKingInCheck(state, color), beganChecked);
  assert.equal(cardPlayTargets(state, 'evil-eye').some(offered => isDeepStrictEqual(offered, target)), false);
  const result = play(state, target);
  assert.equal(result.ok, true);
  assert.ok(result.state.history.some(event => event.type === 'cardFizzled' && event.cardId === 'evil-eye' && event.reason === 'SELF_CHECK'));
  assert.equal(boardFen(result.state), boardFen(before));
  assert.equal(result.state.turn.moveMade, !beganChecked);
  assert.deepEqual(result.state.players[color].discard, before.players[color].hand);
  assert.deepEqual(state, before);
});

for (const [color, fen, attacker, victim, kingFrom, kingTo, replyFrom, replyTo] of [
  ['white', '2r4k/8/2p5/8/3N4/8/8/K7 w - - 0 1', 'd4', 'c6', 'a1', 'a2', 'h8', 'h7'],
  ['black', 'k7/8/8/3n4/8/2P5/8/2R4K b - - 0 1', 'd5', 'c3', 'a8', 'a7', 'h1', 'h2'],
] as const) test(`Evil Eye permits the current ${color} Coup Knight King to capture a protected victim`, () => {
  let state = createGameState({ fen, hands: { [color]: ['coup', 'evil-eye'] } });
  state = step(state, { type: 'move', from: kingFrom, to: kingTo });
  state = step(state, { type: 'playCard', cardId: 'coup', target: attacker });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: replyFrom, to: replyTo });
  state = step(state, { type: 'endTurn' });
  const before = structuredClone(state);
  const king = state.pieces.find(piece => piece.square === attacker)!;
  assert.equal(king.royal, true);
  assert.equal(legalDests(state, false).get(attacker)?.includes(victim) ?? false, false);
  assert.ok(cardPlayTargets(state, 'evil-eye').some(offered => isDeepStrictEqual(offered, { attacker, victim })));
  const after = success(state, { attacker, victim });
  assert.deepEqual(after.pieces.find(piece => piece.id === king.id), king);
  assert.equal(after.pieces.find(piece => piece.id === state.pieces.find(piece => piece.square === victim)!.id)?.zone, 'captured');
  assert.deepEqual(after.effects, before.effects);
  assert.equal(isKingInCheck(after, color), false);
  assert.deepEqual(state, before);
});

test('Evil Eye royal attacker still respects actual Truce capture restrictions', () => {
  let state = createGameState({ fen: '4r2k/8/8/4n3/3K4/8/8/8 b - - 0 1', hands: { white: ['evil-eye'], black: ['truce'] } });
  state = step(state, { type: 'move', from: 'h8', to: 'h7' });
  state = step(state, { type: 'playCard', cardId: 'truce' });
  state = step(state, { type: 'endTurn' });
  const before = structuredClone(state);
  assert.deepEqual(cardPlayTargets(state, 'evil-eye'), []);
  const result = play(state, { attacker: 'd4', victim: 'e5' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Evil Eye royal protected capture fulfills Vendetta even when another ordinary capture exists', () => {
  let state = createGameState({ fen: '4r2k/8/8/4n3/3K4/1p6/P7/8 b - - 0 1', hands: { white: ['evil-eye'], black: ['vendetta'] } });
  state = step(state, { type: 'move', from: 'h8', to: 'h7' });
  state = step(state, { type: 'playCard', cardId: 'vendetta' });
  state = step(state, { type: 'endTurn' });
  const before = structuredClone(state);
  assert.ok(legalDests(state, false).get('a2')?.includes('b3'));
  const target = { attacker: 'd4', victim: 'e5' };
  assert.ok(cardPlayTargets(state, 'evil-eye').some(offered => isDeepStrictEqual(offered, target)));
  const after = success(state, target);
  assert.equal(after.pieces.find(piece => piece.id === 'black-knight-e5')?.zone, 'captured');
  assert.equal(after.pieces.find(piece => piece.id === 'white-king-d4')?.square, 'd4');
  assert.equal(isKingInCheck(after, 'white'), false);
  assert.deepEqual(after.effects, before.effects);
  assert.deepEqual(state, before);
});

test('Evil Eye has the printed regular-card metadata', () => {
  const card = CARD_CATALOG['evil-eye'];
  assert.ok(card);
  assert.equal(card.points, 9);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['beforeMove']);
  assert.equal(card.image, '/KC17_card3.png');
});

for (const target of [
  { attacker: 'a4', victim: 'd4', extra: true },
  { attacker: 'a4' },
  ['a4', 'd4'],
  { attacker: 'A4', victim: 'd4' },
]) test(`Evil Eye requires the strict occupied-square pair ${JSON.stringify(target)}`, () => {
  const state = fixture();
  const result = play(state, target);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

for (const timing of ['afterMove', 'cardUsed'] as const) test(`Evil Eye rejects ${timing}`, () => {
  let state = fixture();
  if (timing === 'afterMove') {
    const moved = applyAction(state, { type: 'move', from: 'b2', to: 'b3' });
    assert.equal(moved.ok, true);
    state = moved.state;
  } else {
    state.players.white.hand.push({ id: 'white-hand-pacifism', cardId: 'pacifism' });
    const played = applyAction(state, { type: 'playCard', cardId: 'pacifism', target: 'a4' });
    assert.equal(played.ok, true);
    assert.ok(played.state.history.some(event => event.type === 'cardPlayed' && event.cardId === 'pacifism'));
    state = played.state;
  }
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Evil Eye cannot capture a friendly piece', () => {
  const state = fixture();
  state.pieces.find(piece => piece.square === 'd4')!.owner = 'white';
  state.fen = [boardFen(state), ...state.fen.split(' ').slice(1)].join(' ');
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Evil Eye requires a legal capture, excluding a pinned attacker', () => {
  const state = createGameState({ fen: '4r2k/6n1/8/8/8/8/4Rn2/4K3 w - - 7 3', hands: { white: ['evil-eye'] } });
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(legalDests(state).get('e2')?.includes('f2') ?? false, false);
  const result = play(state, { attacker: 'e2', victim: 'f2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Evil Eye allows a King with a legal ordinary capture', () => {
  const state = createGameState({ fen: '7k/6n1/8/8/8/8/4n3/4K3 w - - 7 3', hands: { white: ['evil-eye'] } });
  assert.ok(legalDests(state).get('e1')?.includes('e2'));
  const after = success(state, { attacker: 'e1', victim: 'e2' });
  assert.equal(after.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'e1');
  assert.equal(after.pieces.find(piece => piece.id === 'black-knight-e2')?.zone, 'captured');
});

test('Evil Eye cannot target an opposing royal piece', () => {
  const state = fixture();
  state.pieces.find(piece => piece.square === 'd4')!.royal = true;
  state.pieces.find(piece => piece.id === 'black-king-h8')!.royal = false;
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Evil Eye selects the physical en-passant victim and clears the opportunity', () => {
  const state = createGameState({ fen: '7k/6n1/8/3pP3/8/8/1P4P1/4K3 w - d6 7 3', hands: { white: ['evil-eye'] } });
  assert.ok(legalDests(state).get('e5')?.includes('d6'));
  const emptyTarget = play(state, { attacker: 'e5', victim: 'd6' });
  assert.equal(emptyTarget.ok, false);
  const after = success(state, { attacker: 'e5', victim: 'd5' });
  assert.equal(after.pieces.find(piece => piece.id === 'white-pawn-e5')?.square, 'e5');
  assert.equal(after.pieces.find(piece => piece.id === 'black-pawn-d5')?.zone, 'captured');
  assert.deepEqual(after.enPassant, []);
  assert.equal(after.fen.split(' ')[3], '-');
});

test('Evil Eye advances Black fullmove exactly once', () => {
  const state = createGameState({ fen: '4k3/1p4p1/8/r2N4/8/8/6N1/7K b - - 7 3', hands: { black: ['evil-eye'] } });
  assert.ok(legalDests(state).get('a5')?.includes('d5'));
  const after = success(state, { attacker: 'a5', victim: 'd5' });
  assert.equal(after.fen.split(' ')[4], '0');
  assert.equal(after.fen.split(' ')[5], '4');
  assert.equal(after.turn.moveMade, true);
});

test('Evil Eye direct-mate fizzle consumes a move only if the acting King began safe', () => {
  const state = createGameState({ fen: 'R5nk/7p/5K2/8/8/8/8/8 w - - 7 3', hands: { white: ['evil-eye'] }, decks: { white: ['crab'] } });
  assert.equal(isKingInCheck(state, 'white'), true);
  assert.ok(legalDests(state).get('a8')?.includes('g8'));
  const result = play(state, { attacker: 'a8', victim: 'g8' });
  assert.equal(result.ok, true);
  assert.equal(boardFen(result.state), boardFen(state));
  assert.ok(result.state.history.some(event => event.type === 'cardFizzled' && event.cardId === 'evil-eye' && event.reason === 'DIRECT_MATE'));
  assert.equal(result.state.turn.moveMade, false);
  assert.equal(result.state.fen, state.fen);
  assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['crab']);
  assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['evil-eye']);

  const safe = createGameState({ fen: '7k/5K1p/6B1/8/8/8/8/7R w - - 7 3', hands: { white: ['evil-eye'] }, decks: { white: ['crab'] } });
  assert.equal(isKingInCheck(safe, 'white'), false);
  assert.ok(legalDests(safe).get('g6')?.includes('h7'));
  const safeResult = play(safe, { attacker: 'g6', victim: 'h7' });
  assert.equal(safeResult.ok, true);
  assert.equal(boardFen(safeResult.state), boardFen(safe));
  assert.ok(safeResult.state.history.some(event => event.type === 'cardFizzled' && event.cardId === 'evil-eye' && event.reason === 'DIRECT_MATE'));
  assert.equal(safeResult.state.turn.moveMade, true);
  assert.equal(safeResult.state.fen.split(' ')[4], '8');
  assert.equal(safeResult.state.fen.split(' ')[5], '3');
  assert.deepEqual(safeResult.state.players.white.hand.map(card => card.cardId), ['crab']);
  assert.deepEqual(safeResult.state.players.white.discard.map(card => card.cardId), ['evil-eye']);
});

test('Evil Eye stationary capture may expose self-check even when ordinary capture is legal', () => {
  const state = createGameState({ fen: '7k/6n1/8/8/3R4/8/1P4P1/K2n3r w - - 7 3', hands: { white: ['evil-eye'] } });
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.ok(legalDests(state).get('d4')?.includes('d1'));
  const result = play(state, { attacker: 'd4', victim: 'd1' });
  assert.equal(result.ok, true);
  assert.equal(boardFen(result.state), boardFen(state));
  assert.ok(result.state.history.some(event => event.type === 'cardFizzled' && event.cardId === 'evil-eye' && event.reason === 'SELF_CHECK'));
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.players.white.discard.length, 1);
});

test('Evil Eye target enumeration includes the ordinary threat', () => {
  assert.ok(cardPlayTargets(fixture(), 'evil-eye').some(target => isDeepStrictEqual(target, { attacker: 'a4', victim: 'd4' })));
});
test('Evil Eye captures the victim without moving the attacker', () => {
  assert.ok(legalDests(fixture()).get('a4')?.includes('d4'));
  const state = success();
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a4')?.square, 'a4');
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-d4')?.zone, 'captured');
  assert.equal(boardFen(state).split(' ')[0], '7k/6n1/8/8/R7/8/1P4P1/4K3');
});
test('Evil Eye spends and draws exactly one physical card', () => {
  const state = success();
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['evil-eye']);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['crab']);
  assert.deepEqual(state.players.white.deck.map(card => card.cardId), ['curse']);
});
test('Evil Eye consumes the move and resets the capture clock', () => {
  const state = success();
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.fen.split(' ')[4], '0');
  assert.equal(state.fen.split(' ')[5], '3');
});
for (const [name, target] of [
  ['missing target', undefined],
  ['same square', { attacker: 'a4', victim: 'a4' }],
  ['empty attacker', { attacker: 'a3', victim: 'd4' }],
  ['empty victim', { attacker: 'a4', victim: 'd3' }],
  ['wrong owner attacker', { attacker: 'd4', victim: 'a4' }],
  ['unthreatened victim', { attacker: 'a4', victim: 'g7' }],
] as const) test(`Evil Eye rejects ${name} without consumption`, () => {
  const state = fixture();
  const result = applyAction(state, { type: 'playCard', cardId: 'evil-eye', target });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});
