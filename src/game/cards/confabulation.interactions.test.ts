import assert from 'node:assert/strict';
import { it } from 'node:test';
import { applyAction, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Confabulation = { type: 'confabulation'; owner: 'white' | 'black'; card: { id: string }; pieceIds: string[] };
const action = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra }) as Action;
const ok = (result: ReturnType<typeof applyAction>): State => {
  assert.equal(result.ok, true, result.ok ? '' : `${result.error.code}: ${result.error.message}`);
  return result.state;
};
const game = (fen: string, hand: string[]) => createGameState({ fen, hands: { white: hand as never[], black: [] }, decks: { white: [], black: [] } });
const gameWithHands = (fen: string, white: string[], black: string[]) => createGameState({ fen, hands: { white: white as never[], black: black as never[] }, decks: { white: [], black: [] } });
const play = (state: State, cardId: string, target: unknown) => ok(applyAction(state, action('playCard', { cardId, target })));
const move = (state: State, from: string, to: string) => ok(applyAction(state, action('move', { from, to })));
const end = (state: State) => ok(applyAction(state, action('endTurn')));
const cycle = (state: State) => end(ok(applyAction(end(state), action('move', { from: 'h7', to: 'h6' }))));
const blackCycle = (state: State, from: string, to: string) => end(ok(applyAction(end(state), action('move', { from, to }))));
const rejected = (state: State, next: Action) => {
  const result = applyAction(state, next);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
};
const at = (state: State, square: string) => state.pieces.filter(piece => piece.zone === 'board' && piece.square === square);
const piece = (state: State, id: string) => state.pieces.find(candidate => candidate.id === id)!;
const confabulation = (state: State) => state.effects.find((effect): effect is Confabulation => (effect as { type?: string }).type === 'confabulation');
const uniqueBoardSquares = (state: State) => {
  const squares = state.pieces.filter(piece => piece.zone === 'board' && piece.square).map(piece => piece.square);
  assert.equal(new Set(squares).size, squares.length);
};
const assertAway = (state: State, id: string, zone = 'away') => {
  assert.equal(piece(state, id).zone, zone);
  assert.equal(piece(state, id).square, null);
};

it('Disintegration makes both Confabulation components dead and discards its physical card', () => {
  let state = game('7k/7p/8/8/8/8/P7/R6K w - - 0 1', ['confabulation', 'disintegration']);
  const pawnId = at(state, 'a2')[0].id;
  const rookId = at(state, 'a1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'a1', to: 'a2' }]);
  assert.equal(at(state, 'a2').length, 1);
  assertAway(state, rookId);
  state = cycle(state);
  assert.equal(cardPlayTargets(state, 'disintegration').includes('a2'), true);
  state = play(state, 'disintegration', 'a2');

  assertAway(state, pawnId, 'dead');
  assertAway(state, rookId, 'dead');
  assert.equal(at(state, 'a2').length, 0);
  assert.equal(confabulation(state), undefined);
  assert.equal(state.players.white.discard.some(candidate => candidate.id === card.id), true);
  uniqueBoardSquares(state);
});

it('Dubbing moves the Confabulation carrier and retains its exact continuing effect', () => {
  let state = game('7k/7p/8/8/8/8/P7/R6K w - - 0 1', ['confabulation', 'dubbing']);
  const pawnId = at(state, 'a2')[0].id;
  const rookId = at(state, 'a1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'a1', to: 'a2' }]);
  state = cycle(state);
  state = play(state, 'dubbing', [{ from: 'a2', to: 'b4' }]);

  assert.deepEqual(at(state, 'b4').map(candidate => candidate.id), [pawnId]);
  assertAway(state, rookId);
  assert.equal(at(state, 'a2').length, 0);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'white', card, pieceIds: [pawnId, rookId] });
  uniqueBoardSquares(state);
});

it('Long Jump moves a rook carrier selected through its away Knight component', () => {
  let state = game('7k/7p/8/8/8/R7/8/1N5K w - - 0 1', ['confabulation', 'long-jump']);
  const rookId = at(state, 'a3')[0].id;
  const knightId = at(state, 'b1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'b1', to: 'a3' }]);
  assert.deepEqual(at(state, 'a3').map(candidate => candidate.id), [rookId]);
  assertAway(state, knightId);
  state = cycle(state);
  assert.equal(cardPlayTargets(state, 'long-jump').some(target => JSON.stringify(target) === JSON.stringify([{ from: 'a3', to: 'b5' }])), true);
  state = play(state, 'long-jump', [{ from: 'a3', to: 'b5' }]);

  assert.deepEqual(at(state, 'b5').map(candidate => candidate.id), [rookId]);
  assertAway(state, knightId);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'white', card, pieceIds: [rookId, knightId] });
  uniqueBoardSquares(state);
});
it('Pacifism applied after merge protects the whole object', () => {
  let state = game('7k/7p/p7/2b5/8/N7/8/R6K w - - 0 1', ['confabulation', 'pacifism']);
  const knightId = at(state, 'a3')[0].id;
  const rookId = at(state, 'a1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'a1', to: 'a3' }]);
  state = blackCycle(state, 'h7', 'h6');
  state = play(state, 'pacifism', 'a3');
  const pacifism = state.effects.find(effect => (effect as { type?: string }).type === 'pacifism')!;
  const expected = { type: 'confabulation', owner: 'white' as const, card, pieceIds: [knightId, rookId] };

  assert.equal(legalDests(state).get('a3')?.includes('a6'), false);
  rejected(state, action('move', { from: 'a3', to: 'a6' }));
  state = move(state, 'h1', 'h2');
  state = end(state);
  rejected(state, action('move', { from: 'c5', to: 'a3' }));

  assert.deepEqual(at(state, 'a3').map(candidate => candidate.id), [knightId]);
  assertAway(state, rookId);
  assert.deepEqual(confabulation(state), expected);
  assert.deepEqual(state.effects.find(effect => (effect as { type?: string }).type === 'pacifism'), pacifism);
  uniqueBoardSquares(state);
});

it('Pacifism on an away component protects the merged object', () => {
  let state = game('7k/7p/p7/8/8/N7/8/R6K w - - 0 1', ['pacifism', 'confabulation']);
  const knightId = at(state, 'a3')[0].id;
  const rookId = at(state, 'a1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'pacifism', 'a1');
  const pacifism = state.effects.find(effect => (effect as { type?: string }).type === 'pacifism')!;
  state = move(state, 'h1', 'h2');
  state = blackCycle(state, 'h7', 'h6');
  state = play(state, 'confabulation', [{ from: 'a1', to: 'a3' }]);
  state = blackCycle(state, 'h6', 'h5');
  const expected = { type: 'confabulation', owner: 'white' as const, card, pieceIds: [knightId, rookId] };

  assert.deepEqual(state.effects.find(effect => (effect as { type?: string }).type === 'pacifism'), pacifism);
  assert.equal((pacifism as { pieceId: string }).pieceId, rookId);
  assert.equal(legalDests(state).get('a3')?.includes('a6'), false);
  rejected(state, action('move', { from: 'a3', to: 'a6' }));

  assert.deepEqual(at(state, 'a3').map(candidate => candidate.id), [knightId]);
  assertAway(state, rookId);
  assert.deepEqual(confabulation(state), expected);
  uniqueBoardSquares(state);
});

it('Forbidden City blocks only composite non-jumping geometry', () => {
  let state = game('7k/8/8/8/8/N7/8/R6K w - - 0 1', ['forbidden-city', 'confabulation']);
  const knightId = at(state, 'a3')[0].id;
  const rookId = at(state, 'a1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = ok(applyAction(state, action('move', { from: 'h1', to: 'g1' })));
  state = play(state, 'forbidden-city', 'a4');
  const forbiddenCity = state.effects.find(effect => (effect as { type?: string }).type === 'forbidden-city')!;
  state = blackCycle(state, 'h8', 'g8');
  state = play(state, 'confabulation', [{ from: 'a1', to: 'a3' }]);
  state = blackCycle(state, 'g8', 'f8');
  const expected = { type: 'confabulation', owner: 'white' as const, card, pieceIds: [knightId, rookId] };
  const dests = legalDests(state).get('a3') ?? [];

  assert.equal(dests.includes('a4'), false);
  assert.equal(dests.includes('a6'), false);
  assert.equal(dests.includes('b5'), true);
  rejected(state, action('move', { from: 'a3', to: 'a6' }));
  state = ok(applyAction(state, action('move', { from: 'a3', to: 'b5' })));

  assert.deepEqual(at(state, 'b5').map(candidate => candidate.id), [knightId]);
  assertAway(state, rookId);
  assert.deepEqual(confabulation(state), expected);
  assert.deepEqual(state.effects.find(effect => (effect as { type?: string }).type === 'forbidden-city'), forbiddenCity);
  uniqueBoardSquares(state);
});

it('Crab marker persists and adds geometry to the composite', () => {
  let state = game('7k/7p/8/8/8/P7/8/R6K w - - 0 1', ['crab', 'confabulation']);
  const pawnId = at(state, 'a3')[0].id;
  const rookId = at(state, 'a1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = ok(applyAction(state, action('move', { from: 'h1', to: 'h2' })));
  state = play(state, 'crab', 'a3');
  const crab = state.effects.find(effect => (effect as { type?: string }).type === 'crab')!;
  state = blackCycle(state, 'h7', 'h6');
  state = play(state, 'confabulation', [{ from: 'a1', to: 'a3' }]);
  state = blackCycle(state, 'h6', 'h5');
  const expected = { type: 'confabulation', owner: 'white' as const, card, pieceIds: [pawnId, rookId] };

  assert.equal(legalDests(state).get('a3')?.includes('b4'), true);
  state = ok(applyAction(state, action('move', { from: 'a3', to: 'b4' })));

  assert.deepEqual(at(state, 'b4').map(candidate => candidate.id), [pawnId]);
  assertAway(state, rookId);
  assert.deepEqual(confabulation(state), expected);
  assert.deepEqual(state.effects.find(effect => (effect as { type?: string }).type === 'crab'), crab);
  uniqueBoardSquares(state);
});
it('Fanatic recognizes a Confabulated away Pawn', () => {
  let state = game('7k/7p/8/8/8/R7/P7/7K w - - 0 1', ['confabulation', 'fanatic']);
  const pawnId = at(state, 'a2')[0].id;
  const rookId = at(state, 'a3')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'a2', to: 'a3' }]);
  state = cycle(state);
  assert.equal(cardPlayTargets(state, 'fanatic').includes('a3'), true);
  state = play(state, 'fanatic', 'a3');

  assert.deepEqual(at(state, 'a6').map(candidate => candidate.id), [rookId]);
  assertAway(state, pawnId);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'white', card, pieceIds: [rookId, pawnId] });
  uniqueBoardSquares(state);
});

it('Forced March recognizes a Confabulated away Pawn', () => {
  let state = game('7k/7p/8/8/8/R7/P7/7K w - - 0 1', ['confabulation', 'forced-march']);
  const pawnId = at(state, 'a2')[0].id;
  const rookId = at(state, 'a3')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'a2', to: 'a3' }]);
  state = cycle(state);
  assert.equal(cardPlayTargets(state, 'forced-march').some(target => JSON.stringify(target) === JSON.stringify([{ from: 'a3', to: 'b3' }])), true);
  state = play(state, 'forced-march', [{ from: 'a3', to: 'b3' }]);

  assert.deepEqual(at(state, 'b3').map(candidate => candidate.id), [rookId]);
  assertAway(state, pawnId);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'white', card, pieceIds: [rookId, pawnId] });
  uniqueBoardSquares(state);
});

it('Figure Dance relocates a Confabulated composite intact', () => {
  let state = game('4k3/7p/8/8/8/1N6/8/R3K3 w - - 0 1', ['confabulation', 'figure-dance']);
  const knightId = at(state, 'b3')[0].id;
  const rookId = at(state, 'a1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'b3', to: 'a1' }]);
  state = cycle(state);
  state = move(state, 'e1', 'e2');
  assert.equal(cardPlayTargets(state, 'figure-dance').some(target => JSON.stringify(target) === JSON.stringify([])), true);
  state = play(state, 'figure-dance', []);

  assert.deepEqual(at(state, 'h1').map(candidate => candidate.id), [rookId]);
  assertAway(state, knightId);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'white', card, pieceIds: [rookId, knightId] });
  uniqueBoardSquares(state);
});

it('Earthquake does not promote a Confabulated Pawn', () => {
  let state = game('k7/8/8/8/7P/8/8/K6R w - - 0 1', ['confabulation', 'earthquake']);
  const rookId = at(state, 'h1')[0].id;
  const pawnId = at(state, 'h4')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'h1', to: 'h4' }]);
  state = blackCycle(state, 'a8', 'b8');
  state = move(state, 'a1', 'b1');
  assert.equal(cardPlayTargets(state, 'earthquake').some(target => JSON.stringify(target) === JSON.stringify({ direction: 'clockwise', promotions: [] })), true);
  state = play(state, 'earthquake', { direction: 'clockwise', promotions: [] });

  assert.equal(state.orientation, 90);
  assert.deepEqual(at(state, 'h4').map(candidate => candidate.id), [pawnId]);
  assert.equal(piece(state, pawnId).role, 'pawn');
  assert.equal(piece(state, pawnId).promoted, false);
  assertAway(state, rookId);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'white', card, pieceIds: [pawnId, rookId] });
  uniqueBoardSquares(state);
});
it('Heresy targets the Rook carrier when Confabulation leaves its Bishop away', () => {
  let state = game('4k3/p7/7R/8/8/8/8/2B1K3 w - - 0 1', ['confabulation', 'heresy']);
  const rookId = at(state, 'h6')[0].id;
  const bishopId = at(state, 'c1')[0].id;
  const card = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'c1', to: 'h6' }]);
  state = end(state);
  state = move(state, 'a7', 'a6');
  state = end(state);
  state = move(state, 'e1', 'e2');
  const plan = cardPlayTargets(state, 'heresy').find(target =>
    Array.isArray(target) && target.some(move => (move as { from?: string }).from === 'h6'),
  ) as Array<{ from: string; to: string }> | undefined;
  assert.ok(plan);
  const moveFromCarrier = plan.find(move => move.from === 'h6')!;
  state = play(state, 'heresy', plan);

  assert.deepEqual(at(state, moveFromCarrier.to).map(candidate => candidate.id), [rookId]);
  assertAway(state, bishopId);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'white', card, pieceIds: [rookId, bishopId] });
  uniqueBoardSquares(state);
});

it('Rebirth targets the Rook carrier when an enemy Confabulation leaves its Knight away', () => {
  let state = gameWithHands('1n5k/8/r7/8/8/8/8/7K w - - 0 1', ['rebirth'], ['confabulation']);
  const rookId = at(state, 'a6')[0].id;
  const knightId = at(state, 'b8')[0].id;
  const card = state.players.black.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = move(state, 'h1', 'g1');
  state = end(state);
  state = play(state, 'confabulation', [{ from: 'b8', to: 'a6' }]);
  state = end(state);
  state = move(state, 'g1', 'f1');
  const target = [{ from: 'a6', to: 'b8' }];
  assert.equal(cardPlayTargets(state, 'rebirth').some(candidate => JSON.stringify(candidate) === JSON.stringify(target)), true);
  state = play(state, 'rebirth', target);

  assert.deepEqual(at(state, 'b8').map(candidate => candidate.id), [rookId]);
  assertAway(state, knightId);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'black', card, pieceIds: [rookId, knightId] });
  uniqueBoardSquares(state);
});

it('Anathema targets an opponent Confabulation whose Bishop is away', () => {
  let state = gameWithHands('r1b1k3/8/8/8/8/7r/P7/4K3 w - - 0 1', ['anathema'], ['confabulation']);
  const rookId = at(state, 'h3')[0].id;
  const bishopId = at(state, 'c8')[0].id;
  const otherRookId = at(state, 'a8')[0].id;
  const card = state.players.black.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = move(state, 'a2', 'a3');
  state = end(state);
  state = play(state, 'confabulation', [{ from: 'c8', to: 'h3' }]);
  state = end(state);
  state = move(state, 'a3', 'a4');
  const target = { bishop: 'h3', rook: 'a8' };
  assert.equal(cardPlayTargets(state, 'anathema').some(candidate => JSON.stringify(candidate) === JSON.stringify(target)), true);
  state = play(state, 'anathema', target);

  assert.deepEqual(at(state, 'a8').map(candidate => candidate.id), [rookId]);
  assert.deepEqual(at(state, 'h3').map(candidate => candidate.id), [otherRookId]);
  assertAway(state, bishopId);
  assert.deepEqual(confabulation(state), { type: 'confabulation', owner: 'black', card, pieceIds: [rookId, bishopId] });
  uniqueBoardSquares(state);
});

it('Doomsayer naming an away Knight captures the Confabulation carrier', () => {
  let state = gameWithHands('7k/7p/8/8/8/R7/8/1N5K w - - 0 1', ['confabulation'], ['doomsayer']);
  const rookId = at(state, 'a3')[0].id;
  const knightId = at(state, 'b1')[0].id;
  const confabCard = state.players.white.hand.find(candidate => candidate.cardId === 'confabulation')!;

  state = play(state, 'confabulation', [{ from: 'b1', to: 'a3' }]);
  state = end(state);
  state = move(state, 'h7', 'h6');
  state = play(state, 'doomsayer', undefined);
  const doomsayerCard = state.effects.find(effect => (effect as { type?: string }).type === 'doomsayer') as { card: { id: string } };
  state = ok(applyAction(state, action('namePiece', {
    speaker: 'white', name: 'knight', losses: [{ effectId: doomsayerCard.card.id, pieceId: rookId }],
  })));

  for (const id of [rookId, knightId]) {
    assert.equal(piece(state, id).zone, 'captured');
    assert.equal(piece(state, id).square, null);
  }
  assert.equal(at(state, 'a3').length, 0);
  assert.equal(confabulation(state), undefined);
  assert.equal(state.players.white.discard.some(candidate => candidate.id === confabCard.id), true);
  assert.equal(state.effects.some(effect => (effect as { type?: string }).type === 'doomsayer'), false);
  assert.equal(state.players.black.discard.some(candidate => candidate.id === doomsayerCard.card.id), true);
  uniqueBoardSquares(state);
});
