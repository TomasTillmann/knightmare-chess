import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { CARD_CATALOG } from '../src/game/cards/catalog.js';
import type { RandomTrace } from '../src/game/cards/random-campaign.js';

const directory = new URL('./iterations/', import.meta.url);
const catalog = Object.keys(CARD_CATALOG).sort();
const cards = Object.fromEntries(catalog.map(id => [id, { dealt: 0, sampled: 0, played: 0, applied: 0, fizzled: 0 }]));
const runs = readdirSync(directory).filter(name => /^\d{3}\.json$/.test(name)).sort();
let moves = 0;
let actions = 0;
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
  for (const step of trace.steps) if (step.action.type === 'playCard') cards[step.action.cardId]!.played++;
  const rows = readFileSync(new URL(name.replace('.json', '.txt'), directory), 'utf8').split('\n').filter(line => line.startsWith('{'));
  assert.equal(rows.length, trace.steps.length);
  for (const line of rows) {
    const row = JSON.parse(line);
    if (row.action.type !== 'playCard') continue;
    const kind = row.events.at(-1)?.type;
    if (kind === 'cardPlayed') cards[row.action.cardId]!.applied++;
    if (kind === 'cardFizzled') cards[row.action.cardId]!.fizzled++;
  }
  moves += trace.moves;
  actions += trace.steps.length;
  if (trace.failure || trace.moves !== 50) failures.push(`${name}: ${trace.failure ?? 'short trace'}`);
}
console.log(JSON.stringify({ generatedIterations: runs.length, moves, actions, failures,
  sampledCardTypes: catalog.filter(id => cards[id]!.sampled > 0).length,
  playedCardTypes: catalog.filter(id => cards[id]!.played > 0).length,
  appliedCardTypes: catalog.filter(id => cards[id]!.applied > 0).length,
  neverPlayed: catalog.filter(id => !cards[id]!.played), cards,
  limitations: ['Legal availability is state dependent.', 'Terminal candidates are conditioned out.',
    'Mandatory self-check rescue searches legal cards in random order.',
    'Generated traces require a separate fresh-agent semantic review before acceptance.'] }, null, 2));
