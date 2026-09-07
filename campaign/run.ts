import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { generateTrace, replayTrace, type RandomTrace } from '../src/game/cards/random-campaign.js';

const iteration = Number(process.argv[3]);
if (!Number.isInteger(iteration) || iteration < 1 || iteration > 300) throw new Error('Iteration must be 1..300');
const id = String(iteration).padStart(3, '0');
const base = new URL(`./iterations/${id}`, import.meta.url);
if (process.argv[2] === 'generate') {
  mkdirSync(new URL('./iterations/', import.meta.url), { recursive: true });
  const started = Date.now();
  const { trace, review } = generateTrace(860000 + iteration, (step, moves) => {
    if (step % 10 === 0) console.log(`PROGRESS iteration=${id} actions=${step} moves=${moves}`);
  });
  writeFileSync(`${base.pathname}.json`, JSON.stringify(trace, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(`${base.pathname}.txt`, review, { flag: 'wx' });
  console.log(JSON.stringify({ iteration, moves: trace.moves, actions: trace.steps.length,
    finalFen: trace.finalFen, failure: trace.failure, seconds: (Date.now() - started) / 1000 }));
} else if (process.argv[2] === 'replay') {
  const trace: RandomTrace = JSON.parse(readFileSync(`${base.pathname}.json`, 'utf8'));
  replayTrace(trace);
  console.log(`REPLAY_OK iteration=${id} moves=${trace.moves} actions=${trace.steps.length}`);
} else throw new Error('Use generate or replay');
