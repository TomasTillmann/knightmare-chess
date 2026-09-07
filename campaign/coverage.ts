import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { CARD_CATALOG } from '../src/game/cards/catalog.js';
import type { RandomTrace } from '../src/game/cards/random-campaign.js';

const directory = new URL('./iterations/', import.meta.url);
const catalog = Object.keys(CARD_CATALOG).sort();
const cards = Object.fromEntries(catalog.map(id => [id, { dealt: 0, sampled: 0, played: 0, applied: 0, fizzled: 0 }]));
const runs = readdirSync(directory).filter(name => /^\d{3}\.json$/.test(name)).sort();
const ledger = JSON.parse(readFileSync(new URL('./progress.json', import.meta.url), 'utf8'));
let moves = 0;
let actions = 0;
let reviewedMoves = 0;
let reviewedActions = 0;
let validActions = 0;
let validMoves = 0;
const actionTypes: Record<string, number> = {};
const cardTargetShapes: Record<string, number> = {};
const cardTimings: Record<string, number> = {};
const failures: string[] = [];
const seeds = new Set<number>();
for (const name of runs) {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL(name, directory), 'utf8'));
  assert.ok(!seeds.has(trace.seed), 'each iteration has a distinct seed');
  seeds.add(trace.seed);
  for (const color of ['white', 'black'] as const) {
    const hand = trace.initial.hands?.[color] ?? [];
    assert.equal(hand.length, 5);
    assert.deepEqual([...hand, ...(trace.initial.decks?.[color] ?? [])].sort(), catalog,
      `${name}: ${color} receives every catalog card exactly once`);
    for (const id of hand) cards[id]!.dealt++;
  }
  for (const [id, count] of Object.entries(trace.sampledCards)) cards[id]!.sampled += count;
  const entry = ledger.iterations.find((item: { id: number; status: string }) =>
    item.id === Number(name.slice(0, 3)) && ['passed', 'fixed'].includes(item.status));
  const reviewed = entry?.reviewedActions ?? 0;
  // The offending action has a corrected regression, but its generated state is invalid.
  const accepted = entry?.status === 'fixed' ? reviewed - 1 : reviewed;
  assert.ok(accepted >= 0 && accepted <= trace.steps.length);
  validActions += accepted;
  validMoves += trace.steps.slice(0, accepted).filter(step => step.action.type === 'move').length;
  for (const step of trace.steps.slice(0, accepted)) if (step.action.type === 'playCard') cards[step.action.cardId]!.played++;
  const rows = readFileSync(new URL(name.replace('.json', '.txt'), directory), 'utf8').split('\n').filter(line => line.startsWith('{'));
  assert.equal(rows.length, trace.steps.length);
  for (const line of rows.slice(0, accepted)) {
    const row = JSON.parse(line);
    actionTypes[row.action.type] = (actionTypes[row.action.type] ?? 0) + 1;
    if (row.action.type !== 'playCard') continue;
    const shape = row.action.target === undefined ? 'none' : Array.isArray(row.action.target) ? 'array'
      : row.action.target && typeof row.action.target === 'object' ? Object.keys(row.action.target).sort().join(',') : typeof row.action.target;
    const key = `${row.action.cardId}:${shape}`;
    cardTargetShapes[key] = (cardTargetShapes[key] ?? 0) + 1;
    const timing = `${row.action.cardId}:${row.turn[0].phase}`;
    cardTimings[timing] = (cardTimings[timing] ?? 0) + 1;
    const kind = row.events.at(-1)?.type;
    if (kind === 'cardPlayed') cards[row.action.cardId]!.applied++;
    if (kind === 'cardFizzled') cards[row.action.cardId]!.fizzled++;
  }
  moves += trace.moves;
  actions += trace.steps.length;
  reviewedActions += reviewed;
  reviewedMoves += trace.steps.slice(0, reviewed).filter(step => step.action.type === 'move').length;
  if (trace.failure || trace.moves !== 50) failures.push(`${name}: ${trace.failure ?? 'short trace'}`);
}
console.log(JSON.stringify({ generatedIterations: runs.length, moves, actions, reviewedMoves, reviewedActions,
  validMoves, validActions, actionTypes, cardTargetShapes, cardTimings, failures,
  sampledCardTypes: catalog.filter(id => cards[id]!.sampled > 0).length,
  playedCardTypes: catalog.filter(id => cards[id]!.played > 0).length,
  appliedCardTypes: catalog.filter(id => cards[id]!.applied > 0).length,
  neverPlayed: catalog.filter(id => !cards[id]!.played), cards,
  limitations: ['Legal availability is state dependent.', 'Terminal candidates are conditioned out.',
    'Mandatory self-check rescue searches legal cards in random order.',
    'Dealt and sampled counts cover generated traces; played/applied/fizzled cover only reviewed valid prefixes.',
    'An offending action and its unreviewed suffix do not count as validated card coverage.'] }, null, 2));
