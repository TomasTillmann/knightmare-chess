import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, isKingInCheck, legalDests } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';

const started = performance.now();
let positions = 0, destinations = 0, checks = 0;
for (const line of readFileSync(process.argv[2]!, 'utf8').trim().split('\n')) {
  const sample = JSON.parse(line), state = createGameState({ fen: sample.fen });
  const before = JSON.stringify(state);
  const normalize = (from: string, to: string): string => {
    const mover = state.pieces.find(p => p.square === from && p.zone === 'board');
    const target = state.pieces.find(p => p.square === to && p.zone === 'board');
    if (mover?.role === 'king' && target?.role === 'rook' && target.owner === mover.owner) {
      return `${from}${to[0] === 'a' ? 'c' : 'g'}${from[1]}`;
    }
    return from + to;
  };
  const actual = [...new Set([...legalDests(state)].flatMap(([from, tos]) => tos.map(to => normalize(from, to))))].sort();
  const context = `seed=${sample.seed} game=${sample.game} ply=${sample.ply} fen=${sample.fen}`;
  assert.deepEqual(actual, sample.destinations, `destinations ${context}`); checks++;
  assert.deepEqual(['white', 'black'].map(color => isKingInCheck(state, color as 'white' | 'black')), sample.checks, `royal attacks ${context}`); checks++;
  const roles = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' } as const;
  const promotion = roles[sample.move[4] as keyof typeof roles];
  const result = applyAction(state, { type: 'move', from: sample.move.slice(0, 2), to: sample.move.slice(2, 4), ...(promotion ? { promotion } : {}) });
  assert.ok(result.ok, `legal move rejected ${context} move=${sample.move}`); checks++;
  assert.equal(result.state.fen, sample.after, `transition ${context} move=${sample.move}`); checks++;
  assert.equal(JSON.stringify(state), before, `input mutation ${context}`); checks++;
  positions++; destinations += actual.length;
}
console.log(JSON.stringify({ sentinel: 'INDEPENDENT_ORACLE_DONE', positions, destinations, checks, findings: 0, ms: performance.now() - started }));
