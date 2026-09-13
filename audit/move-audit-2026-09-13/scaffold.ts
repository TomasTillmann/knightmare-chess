import assert from 'node:assert/strict';
import { makeSquare } from 'chessops/util';
import { applyAction, legalDests, isKingInCheck } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction, GameState, SquareName } from '../../src/game/types.js';

export const counts = { directed: 0, randomized: 0, multiCard: 0, adversarial: 0 };
export const findings: Array<{ label: string; error: string }> = [];
export const started = performance.now();
export function probe(group: keyof typeof counts, label: string, run: () => void): void {
  counts[group]++;
  try { run(); } catch (error) { findings.push({ label, error: String(error) }); }
}
export function act(state: GameState, action: GameAction): GameState {
  const before = JSON.stringify(state);
  const result = applyAction(state, action);
  assert.equal(JSON.stringify(state), before, 'action mutated input');
  assert.ok(result.ok, JSON.stringify(action) + (result.ok ? '' : ': ' + result.error.message));
  return result.state;
}
export function consistent(state: GameState): void {
  for (const owner of ['white', 'black']) {
    assert.equal(state.pieces.filter(piece => piece.royal && piece.owner === owner).length, 1, 'fixture royal count');
  }
  const snapshot = JSON.stringify(state);
  const moves = legalDests(state);
  assert.equal(JSON.stringify(state), snapshot, 'generator mutated input');
  for (const [from, targets] of moves) for (const to of targets) {
    const attempts = [undefined, 'queen', 'rook', 'bishop', 'knight'].map(promotion =>
      applyAction(state, { type: 'move', from, to, ...(promotion ? { promotion } : {}) }));
    assert.ok(attempts.some(result => result.ok), `${from}-${to} generated but rejected`);
    assert.equal(JSON.stringify(state), snapshot, 'candidate application mutated input');
  }
}
export function runBase(): void {
  for (const fen of [undefined, '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', '4k3/P7/8/8/8/8/8/4K3 w - - 0 1']) {
    probe('directed', fen ?? 'initial', () => consistent(createGameState({ fen })));
  }
  let seed = 913001;
  let state = createGameState();
  for (let ply = 0; ply < 12; ply++) {
    probe('randomized', `ordinary-${ply}`, () => {
      const candidates = [...legalDests(state)].flatMap(([from, targets]) => targets.map(to => ({ from, to })));
      assert.ok(candidates.length);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const move = candidates[seed % candidates.length]!;
      const color = state.turn.color;
      state = act(state, { type: 'move', ...move });
      assert.equal(isKingInCheck(state, color), false);
      state = act(state, { type: 'endTurn' });
    });
  }
  probe('multiCard', 'pacifism + truce', () => {
    let current = createGameState({ hands: { white: ['pacifism'], black: ['truce'] } });
    current = act(current, { type: 'playCard', cardId: 'pacifism', target: 'a2' });
    current = act(current, { type: 'move', from: 'e2', to: 'e4' });
    current = act(current, { type: 'endTurn' });
    current = act(current, { type: 'move', from: 'e7', to: 'e5' });
    current = act(current, { type: 'playCard', cardId: 'truce' });
    current = act(current, { type: 'endTurn' });
    consistent(current);
  });
  console.log('BASE_EXECUTED', JSON.stringify({ counts, findings, wallMs: performance.now() - started }));
}
export function complete(state: GameState): void {
  consistent(state);
  const snapshot = JSON.stringify(state);
  const generated = legalDests(state);
  for (const piece of state.pieces) {
    if (piece.zone !== 'board' || !piece.square || (piece.owner !== state.turn.color && !piece.neutral)) continue;
    for (let square = 0; square < 64; square++) {
      const to = makeSquare(square);
      const options = [undefined, 'queen', 'rook', 'bishop', 'knight'];
      const accepted = options.some(promotion => applyAction(state,
        {type:'move',from:piece.square,to,...(promotion ? {promotion} : {})}).ok)
        || applyAction(state,{type:'move',from:piece.square,to,enPassant:false}).ok;
      assert.equal(generated.get(piece.square)?.includes(to) ?? false, accepted, `${piece.square}-${to} generator/application mismatch`);
    }
  }
  assert.equal(JSON.stringify(state), snapshot, 'exhaustive candidate input mutation');
}
export function report(): void {
  console.log('AUDIT_DONE', JSON.stringify({ counts, findings, wallMs: performance.now() - started }));
}
