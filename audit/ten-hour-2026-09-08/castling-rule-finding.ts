import { applyAction, legalDests } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
const started = performance.now();
for (const [label, fen, from, to] of [
  ['White through check', 'k4r2/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1'],
  ['White out of check', 'k3r3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1'],
  ['Black through check', '4k2r/8/8/8/8/8/8/K4R2 b k - 0 1', 'e8', 'g8'],
] as const) {
  const state = createGameState({ fen }), action = { type: 'move' as const, from, to };
  const result = applyAction(state, action);
  console.log(JSON.stringify({ label, fen, action, offered: legalDests(state).get(from),
    result: result.ok ? 'accepted' : result.error, expected: 'allowed by official FAQ8: final King safe, no card required' }));
}
console.log(JSON.stringify({ sentinel: 'CASTLING_RULE_PROBES_DONE', groups: 3, ms: performance.now() - started }));
