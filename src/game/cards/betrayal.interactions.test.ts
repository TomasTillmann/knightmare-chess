import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

const target = { pieceId: 'white-pawn-e4', to: 'd4' };
function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions must not mutate their input state');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}
function fixture(white: string[] = ['betrayal'], black: string[] = []): GameState {
  let state = createGameState({ fen: '7k/p7/8/8/3pP2r/8/P7/K7 b - - 0 1', hands: { white, black } });
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  return act(state, { type: 'endTurn' });
}
function betray(state: GameState): GameState {
  const next = act(state, { type: 'playCard', cardId: 'betrayal', target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.pieces.find(piece => piece.id === target.pieceId)?.square, 'd4');
  assert.equal(next.pieces.find(piece => piece.id === 'black-pawn-d4')?.zone, 'dead');
  return next;
}

test('Betrayal leaves a legal ordinary Pawn move available', () => {
  const state = betray(fixture());
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.ok(legalDests(state).get('d4')?.includes('d5'));
  const moved = act(state, { type: 'move', from: 'd4', to: 'd5' });
  assert.equal(moved.turn.phase, 'afterMove');
});

function played(state: GameState, cardId: string, cardTarget?: unknown): GameState {
  const next = act(state, { type: 'playCard', cardId, target: cardTarget });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed', `${cardId} fixture must resolve`);
  return next;
}
function protectedFixture(cardId: 'pacifism' | 'truce' | 'crab'): GameState {
  let state = createGameState({ fen: '7k/p7/8/8/3pP2r/8/P7/K7 b - - 0 1', hands: { white: ['betrayal'], black: [cardId] } });
  if (cardId === 'pacifism') state = played(state, cardId, 'd4');
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  if (cardId !== 'pacifism') state = played(state, cardId, cardId === 'crab' ? 'd4' : undefined);
  return act(state, { type: 'endTurn' });
}

test('Pacifism capture immunity does not prevent death and replacement', () => {
  const state = protectedFixture('pacifism');
  assert.ok(state.effects.some(effect => (effect as { type?: string }).type === 'pacifism'));
  betray(state);
});

test('Pacifism transfers its physical attachment and preserves the black card owner', () => {
  const state = betray(protectedFixture('pacifism'));
  const pacifism = state.effects.find(effect => (effect as { type?: string }).type === 'pacifism') as { pieceId: string; owner: string; card: { id: string } };
  assert.equal(pacifism.pieceId, target.pieceId);
  assert.equal(pacifism.owner, 'black');
  assert.equal(pacifism.card.id, 'black-hand-0-pacifism');
  assert.equal(state.players.black.discard.length, 0);
});

test('the inherited Pacifist replacement cannot capture', () => {
  const before = protectedFixture('pacifism');
  before.pieces.push({ id: 'black-pawn-c5', owner: 'black', role: 'pawn', originalRole: 'pawn', square: 'c5', zone: 'board', promoted: false, royal: false, neutral: false });
  const state = betray(before);
  assert.ok(!legalDests(state).get('d4')?.includes('c5'));
  assert.ok(legalDests(state).get('d4')?.includes('d5'));
});

test('Truce permits Betrayal while continuing to forbid captures', () => {
  const state = betray(protectedFixture('truce'));
  assert.ok(state.effects.some(effect => (effect as { type?: string }).type === 'truce'));
  assert.equal(state.history.at(-1)?.capturedId, undefined);
  assert.equal(state.history.at(-1)?.capturedIds, undefined);
  assert.ok(legalDests(state).get('d4')?.includes('d5'));
});

test('a victim Crab does not transfer Crab movement to the replacement', () => {
  const state = betray(protectedFixture('crab'));
  assert.ok(legalDests(state).get('d4')?.includes('d5'));
  assert.ok(!legalDests(state).get('d4')?.includes('c5'));
});

function capturedCrab(): GameState {
  let state = createGameState({ fen: '7k/p7/8/8/3pP2r/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['crab', 'betrayal'] } });
  state = played(state, 'crab', 'e4');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  return act(state, { type: 'endTurn' });
}

function capturedCursedPawn(): GameState {
  let state = createGameState({ fen: '7k/p7/8/8/3pR2r/8/P7/K7 b - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['betrayal'], black: ['curse'] } });
  state.pieces.find(piece => piece.id === 'white-rook-e4')!.originalRole = 'pawn';
  state = played(state, 'curse', 'e4');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'b1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  return act(state, { type: 'endTurn' });
}

for (const delayed of [false, true]) {
  test(`${delayed ? 'late' : 'immediate'} return restores the captured transformed Pawn without expired Curse`, () => {
    let state = capturedCursedPawn();
    if (delayed) {
      state = act(state, { type: 'move', from: 'b1', to: 'c1' });
      state = act(state, { type: 'endTurn' });
      state = act(state, { type: 'move', from: 'h8', to: 'g8' });
      state = act(state, { type: 'endTurn' });
    }
    state = played(state, 'betrayal', { pieceId: 'white-rook-e4', to: 'd4' });
    assert.equal(state.pieces.find(piece => piece.id === 'white-rook-e4')?.role, delayed ? 'pawn' : 'rook');
    assert.equal(state.pieces.find(piece => piece.id === 'white-rook-e4')?.square, 'd4');
    assert.ok(!state.effects.some(effect => (effect as { type?: string }).type === 'curse'));
    assert.ok(legalDests(state).get('d4')?.includes('d5'));
    assert.equal(legalDests(state).get('d4')?.includes('d6') ?? false, !delayed);
    assert.equal(legalDests(state).get('d4')?.includes('d7') ?? false, !delayed);
  });
}

test('preflight: existing effect cards resolve and physical captures are real', () => {
  for (const cardId of ['pacifism', 'truce', 'crab'] as const) {
    const state = protectedFixture(cardId);
    assert.ok(state.history.some(event => event.type === 'cardPlayed' && event.cardId === cardId));
    assert.equal(state.pieces.find(piece => piece.id === target.pieceId)?.zone, 'captured');
  }
  for (const state of [capturedCrab(), capturedCursedPawn()]) {
    assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, 1);
    assert.equal(state.turn.phase, 'beforeMove');
    assert.equal(isKingInCheck(state, 'white'), false);
    assert.ok(!state.effects.some(effect => (effect as { type?: string }).type === 'curse'));
  }
});

test('immediately returned own captured Crab does not restore its expired effect', () => {
  const state = betray(capturedCrab());
  assert.ok(!legalDests(state).get('d4')?.includes('c5'));
  assert.ok(legalDests(state).get('d4')?.includes('d5'));
});

test('a late return restores the own captured Crab to normal Pawn movement', () => {
  let state = capturedCrab();
  state = act(state, { type: 'move', from: 'a1', to: 'b1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = betray(state);
  assert.ok(legalDests(state).get('d4')?.includes('d5'));
  assert.ok(!legalDests(state).get('d4')?.includes('c5'));
});

test('Winged Victory cannot return the enemy physical Pawn made dead by Betrayal', () => {
  let state = betray(fixture(['betrayal'], ['winged-victory']));
  state = act(state, { type: 'move', from: 'd4', to: 'd5' });
  state = act(state, { type: 'endTurn' });
  const result = applyAction(state, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'black-pawn-d4', to: 'd4' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
  assert.ok(!cardPlayTargets(state, 'winged-victory').some(value => (value as { pieceId?: string }).pieceId === 'black-pawn-d4'));
});

test('Haunting Memories copies Betrayal and leaves the copier its Regular Move', () => {
  let state = fixture(['betrayal'], ['haunting-memories']);
  state.pieces.push({ id: 'black-reserve-pawn', owner: 'black', originalRole: 'pawn', role: 'pawn', square: null, zone: 'captured', promoted: false, royal: false, neutral: false, capturedAtPly: 0 });
  state = betray(state);
  state = act(state, { type: 'move', from: 'd4', to: 'd5' });
  state = act(state, { type: 'endTurn' });
  state = played(state, 'haunting-memories', { pieceId: 'black-reserve-pawn', to: 'd5' });
  assert.equal(state.history.at(-1)?.copiedCardId, 'betrayal');
  assert.equal(state.pieces.find(piece => piece.id === target.pieceId)?.zone, 'dead');
  assert.equal(state.pieces.find(piece => piece.id === 'black-reserve-pawn')?.square, 'd5');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
});

test('a neutral enemy on the board remains an eligible victim', () => {
  const state = fixture();
  state.pieces.find(piece => piece.id === 'black-pawn-d4')!.neutral = true;
  betray(state);
});

test('neutrality also makes an own-colored on-board Pawn eligible as the victim', () => {
  const state = fixture();
  const victim = state.pieces.find(piece => piece.id === 'black-pawn-d4')!;
  victim.owner = 'white';
  victim.neutral = true;
  const next = betray(state);
  assert.equal(next.pieces.find(piece => piece.id === target.pieceId)?.owner, 'white');
});

test('a captured neutral Pawn retains its original owner for replacement eligibility', () => {
  const state = fixture();
  const reserve = state.pieces.find(piece => piece.id === target.pieceId)!;
  reserve.neutral = true;
  reserve.owner = 'black';
  const result = applyAction(state, { type: 'playCard', cardId: 'betrayal', target });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Betrayal spends the card allowance but preserves FEN move counters', () => {
  const before = fixture(['betrayal', 'pacifism']);
  const state = betray(before);
  assert.deepEqual(state.fen.split(' ').slice(4), before.fen.split(' ').slice(4));
  const result = applyAction(state, { type: 'playCard', cardId: 'pacifism', target: 'd4' });
  assert.equal(result.ok, false);
  assert.equal(state.turn.cardPlays.white, 1);
});

for (const direction of ['clockwise', 'counterclockwise'] as const) {
  test(`Betrayal observes the frontier after a real ${direction} Earthquake`, () => {
    let state = createGameState({ fen: '7k/8/8/8/3pP2r/8/8/K7 b - - 0 1', hands: { white: ['betrayal'], black: ['earthquake'] } });
    state = act(state, { type: 'move', from: 'h4', to: 'e4' });
    state = played(state, 'earthquake', { direction, promotions: [] });
    state = act(state, { type: 'endTurn' });
    assert.notEqual(state.orientation, 0);
    const victim = state.pieces.find(piece => piece.id === 'black-pawn-d4')!;
    assert.ok(victim.square);
    assert.equal(victim.square, 'd4', 'Earthquake retains table coordinates');
    assert.equal(state.orientation, direction === 'clockwise' ? 90 : 270);
    if (direction === 'counterclockwise') {
      const result = applyAction(state, { type: 'playCard', cardId: 'betrayal', target: { pieceId: target.pieceId, to: victim.square } });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, state);
      return;
    }
    state = played(state, 'betrayal', { pieceId: target.pieceId, to: victim.square });
    assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.zone, 'dead');
    assert.equal(state.pieces.find(piece => piece.id === target.pieceId)?.square, victim.square);
  });
}

function cardIds(state: GameState): string[] {
  return Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]).map(card => card.id).sort();
}

function invariants(state: GameState, ids: string[], cards: string[]): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.ok(board.every(piece => piece.square !== null));
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.zone, 'dead');
  for (const owner of ['white', 'black']) assert.equal(board.filter(piece => piece.royal && piece.owner === owner).length, 1);
  assert.deepEqual(cardIds(state), cards, 'cards remain in exactly one physical zone');
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  for (const ep of state.enPassant) assert.ok(board.some(piece => piece.id === ep.pawnId && !piece.promoted && piece.originalRole === 'pawn'));
}

for (let seed = 1; seed <= 20; seed++) {
  test(`seed ${seed}: eight actual random plies after Betrayal preserve physical and board invariants`, context => {
    let state = fixture();
    const cards = cardIds(state);
    state = betray(state);
    const ids = state.pieces.map(piece => piece.id).sort();
    let random = seed;
    let plies = 0;
    while (plies < 8 && !state.outcome) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const moves = [...legalDests(state)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(moves.length > 0, `seed ${seed}, ply ${plies}`);
      const { from, to } = moves[random % moves.length]!;
      const pawn = state.pieces.find(piece => piece.square === from);
      const promotion = pawn?.role === 'pawn' && to[1] === (pawn.owner === 'white' ? '8' : '1') ? 'queen' : undefined;
      const color = state.turn.color;
      state = act(state, { type: 'move', from: from as SquareName, to, ...(promotion ? { promotion } : {}) });
      assert.equal(isKingInCheck(state, color), false);
      invariants(state, ids, cards);
      state = act(state, { type: 'endTurn' });
      invariants(state, ids, cards);
      plies++;
    }
    assert.ok(plies >= 4, `seed ${seed} executed only ${plies} actual post-card plies`);
    context.diagnostic(`seed=${seed}, actual post-Betrayal plies=${plies}`);
  });
}
