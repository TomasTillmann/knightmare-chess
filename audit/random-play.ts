import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import { applyAction, cardPlayTargets, isPromotionSquare, legalDests } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';
import type { CardInstance, Color, GameAction, GameState, Role } from '../src/game/types.js';
import { CARD_CATALOG } from '../src/game/cards/catalog.js';

const rawSeed = process.argv[2] ?? String(Date.now());
const rawCount = process.argv[3] ?? '20';
const seed = Number(rawSeed);
const requestedTransitions = Number(rawCount);
if (!Number.isSafeInteger(seed) || !Number.isInteger(requestedTransitions) || requestedTransitions < 1 || requestedTransitions > 200) {
  throw new Error('Usage: random-play.ts [integer-seed] [1..200 transitions] [.audit-scratch/output.json]');
}

let randomState = seed >>> 0 || 1;
const random = () => (randomState = Math.imul(randomState ^ randomState >>> 15, 1 | randomState),
  randomState ^= randomState + Math.imul(randomState ^ randomState >>> 7, 61 | randomState),
  (randomState ^ randomState >>> 14) >>> 0);
const choose = <T>(values: readonly T[]): T => values[random() % values.length]!;
const shuffle = <T>(values: readonly T[]): T[] => {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = random() % (index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled;
};

const cards = Object.keys(CARD_CATALOG);
const white = shuffle(cards);
const black = shuffle(cards);
let state = createGameState({
  hands: { white: white.slice(0, 5), black: black.slice(0, 5) },
  decks: { white: white.slice(5), black: black.slice(5) },
});
const initial = structuredClone(state);

const succeeds = (candidate: GameAction): boolean => applyAction(state, candidate).ok;
const moveActions = (): GameAction[] => [...legalDests(state)].flatMap(([from, destinations]) => {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from)!;
  return destinations.flatMap(to => (
    piece.role === 'pawn' && isPromotionSquare(state, piece.owner, to)
      ? ['queen', 'rook', 'bishop', 'knight'] as const
      : [undefined] as const
  ).map(promotion => ({ type: 'move', from, to, ...(promotion ? { promotion: promotion as Role } : {}) }) as GameAction)
    .filter(succeeds));
});
const playActions = (color: Color, hand: CardInstance[]): GameAction[] => hand.flatMap(card => {
  const timing = CARD_CATALOG[card.cardId]?.timing ?? [];
  const available = card.cardId === 'bog'
    ? color !== state.turn.color && state.turn.phase === 'afterMove' && timing.includes('afterOpponentMove')
    : color === state.turn.color && timing.includes(state.turn.phase);
  if (!available) return [];
  return cardPlayTargets(state, card.cardId).map(target => ({
    type: 'playCard', cardId: card.cardId, cardInstanceId: card.id,
    ...(target === undefined ? {} : { target }),
  }) as GameAction).filter(succeeds);
});

const invariant = (value: GameState): void => {
  const occupied = value.pieces.flatMap(piece => piece.zone === 'board' && piece.square ? [piece.square] : []);
  assert.equal(new Set(occupied).size, occupied.length, 'two pieces occupy one square');
  for (const color of ['white', 'black'] as const) {
    assert.equal(value.pieces.filter(piece => piece.owner === color && piece.royal).length, 1, `${color} royal identity changed`);
  }
};

const steps: Array<{ index: number; before: GameState; action: GameAction; after: GameState }> = [];
let stalled: string | undefined;
for (let index = 0; index < requestedTransitions && !state.outcome; index += 1) {
  invariant(state);
  const before = structuredClone(state);
  let actions: GameAction[];
  if (state.pendingDoomsayer) {
    actions = [{ type: 'declineDoomsayer', player: state.pendingDoomsayer.player }];
  } else {
    const cardActions = [
      ...playActions(state.turn.color, state.players[state.turn.color].hand),
      ...playActions(state.turn.color === 'white' ? 'black' : 'white', state.players[state.turn.color === 'white' ? 'black' : 'white'].hand),
    ];
    const moves = state.turn.phase === 'beforeMove' ? moveActions() : [];
    const end = state.turn.phase === 'afterMove' && succeeds({ type: 'endTurn' }) ? [{ type: 'endTurn' } as GameAction] : [];
    actions = cardActions.length && (random() & 1) ? cardActions : [...moves, ...end];
    if (!actions.length) actions = [...cardActions, ...moves, ...end];
  }
  assert.deepEqual(state, before, 'candidate enumeration mutated state');
  if (!actions.length) {
    stalled = `No successful action at transition ${index + 1}`;
    break;
  }
  const action = choose(actions);
  const result = applyAction(state, action);
  assert.equal(result.ok, true);
  state = result.state;
  invariant(state);
  steps.push({ index: index + 1, before, action, after: structuredClone(state) });
}

const trace = {
  seed,
  requestedTransitions,
  completedTransitions: steps.length,
  variant: 'independently shuffled implemented-card catalog; five-card starting hands',
  initial,
  steps,
  final: state,
  ...(stalled ? { stalled } : {}),
};
const json = `${JSON.stringify(trace, null, 2)}\n`;
const output = process.argv[4];
if (output) {
  const path = resolve(output);
  const scratch = resolve('.audit-scratch');
  if (relative(scratch, path).startsWith('..') || path === scratch) throw new Error('Output must be a file inside .audit-scratch');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, json, { flag: 'wx' });
  console.log(`RANDOM_PLAY_OK seed=${seed} transitions=${steps.length} output=${path}`);
} else {
  process.stdout.write(json);
}
