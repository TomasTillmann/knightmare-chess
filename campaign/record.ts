import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { RandomTrace } from '../src/game/cards/random-campaign.js';

const id = Number(process.argv[2]);
const status = process.argv[3];
assert.ok(Number.isInteger(id) && id >= 1 && id <= 300);
assert.ok(status === 'passed' || status === 'fixed');
const number = String(id).padStart(3, '0');
const trace: RandomTrace = JSON.parse(readFileSync(new URL(`./iterations/${number}.json`, import.meta.url), 'utf8'));
const reviewedActions = Number(process.argv[4] ?? trace.steps.length);
assert.ok(reviewedActions > 0 && reviewedActions <= trace.steps.length);
const reviewedMoves = trace.steps.slice(0, reviewedActions).filter(step => step.action.type === 'move').length;
if (status === 'passed') assert.equal(reviewedMoves, 50);
const rows = readFileSync(new URL(`./iterations/${number}.txt`, import.meta.url), 'utf8')
  .split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const path = new URL('./progress.json', import.meta.url);
const progress = JSON.parse(readFileSync(path, 'utf8'));
const previous = progress.iterations.find((item: { id: number }) => item.id === id) ?? {};
const entry = { ...previous, id, agent: `iteration_${number}`, seed: trace.seed, reviewedActions, reviewedMoves, status,
  finalFen: rows[reviewedActions - 1].fen[1],
  testCommit: execFileSync('git', ['log', '-1', '--format=%h', '--', `src/game/cards/random-${number}.test.ts`], { encoding: 'utf8' }).trim() };
progress.iterations = [...progress.iterations.filter((item: { id: number }) => item.id !== id), entry]
  .sort((left: { id: number }, right: { id: number }) => left.id - right.id);
const assigned = readdirSync(new URL('../src/game/cards/', import.meta.url)).flatMap(name => {
  const match = /^random-(\d{3})\.test\.ts$/.exec(name);
  return match ? [Number(match[1])] : [];
});
progress.nextIteration = Math.max(...assigned) + 1;
writeFileSync(path, JSON.stringify(progress, null, 2) + '\n');
console.log(JSON.stringify({ recorded: entry, complete: progress.iterations.filter((item: { status: string }) => ['passed', 'fixed'].includes(item.status)).length }));
