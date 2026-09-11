import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Review stops at the FIRST invalid state, 67. Rows 68–124 are unreviewed.
const rationale = [
  '1. f2-f3 is one unobstructed White pawn step; reset the pawn clock.',
  '2. End White turn; Black begins with both card allowances refreshed.',
  '3. d7-d6 is one unobstructed Black pawn step; advance fullmove to 2.',
  '4. End Black turn without changing the board or clocks.',
  '5. Ke1-f2 is one safe diagonal step; both White castling rights expire.',
  '6. End White turn; no check or outstanding choice.',
  '7. Bc8-h3 follows d7,e6,f5,g4, all empty; no capture.',
  '8. End Black turn; neither royal is attacked.',
  '9. Dubbing grants Bc1 a noncapturing Knight jump to empty d3; replacement move.',
  '10. End the Dubbing turn; its physical card was discarded and replaced once.',
  '11. Onslaught advances a7,c7,e7 to empty a6,c6,e6 simultaneously; all single pawn steps.',
  '12. End Black replacement turn; no en-passant opportunity was created.',
  '13. Ng1xh3 is a Knight jump; White physically captures black-bishop-c8.',
  '14. End White turn; captured Bishop remains captured by White.',
  '15. Qd8-f6 follows empty e7; White f3 blocks the f-file before Kf2.',
  '16. End Black turn with both royal positions safe.',
  '17. g2-g3 is a single noncapturing pawn step; resets halfmove.',
  '18. End White turn, preserving board and counters.',
  '19. Ke8-d8 is a safe adjacent move; Black loses both castling rights.',
  '20. End Black turn; all castling rights remain permanently absent.',
  '21. Under Elf Hill removes the physical White King at f2 to away, consumes the move, and draws once.',
  '22. End White turn; return remains dormant throughout the following Black turn.',
  '23. a6-a5 advances Black pawn one square; the absent White King has no attacks.',
  '24. Beginning White turn makes its edge return mandatory before any move.',
  '25. Return the same King to empty safe edge h5; placement costs no move or clock, and immobilizes it this turn.',
  '26. Nb1-c3 is a legal jump by another piece; returned King remains fixed at h5.',
  '27. Ending White turn expires the returned King restriction.',
  '28. Guardian b7-b6 advances an owned pawn; optional b8 Knight follower is omitted, no en-passant.',
  '29. End Black replacement move and refresh allowances.',
  '30. Bd3-a6 follows empty c4,b5; no capture or royal exposure.',
  '31. End White turn with the Bishop identity still white-bishop-c1.',
  '32. Qf6-f5 gives check across empty g5 to Kh5; Black King remains safe.',
  '33. End Black turn, giving the checked White player an escape turn.',
  '34. Rh1-g1 is geometrically valid but leaves Qf5 checking Kh5; §11.6 opens a rescue with the exact pre-move snapshot.',
  '35. Dungeon relocates checking enemy Qf5 to empty corner h1; it rescues Kh5 and bars that Queen for the following Black turn.',
  '36. End rescued White turn; Black Queen movement ban remains.',
  '37. Ng8-e7 jumps legally; the banned Queen is not moved and cannot give check.',
  '38. End Black turn; Dungeon restriction expires on its physical Queen.',
  '39. Hidden Passage relocates Kh5 to empty safe e1; Qh1 ray is blocked by Rg1 and Bf1, and the replacement move advances once.',
  '40. End White replacement turn with all castling rights still absent.',
  '41. h7-h6 is a single Black pawn advance.',
  '42. End Black turn; no new en-passant opportunity.',
  '43. Lost Castle exchanges owned Rg1 and enemy Ra8 without capture; Bf1 shields Ke1 and Nb8 shields Kd8.',
  '44. End White replacement turn; Rook ownership and physical identities are unchanged.',
  '45. c6-c5 is a single Black pawn advance before the rotation.',
  '46. Earthquake counterclockwise sets orientation 90; White h2 promotes to Knight first, Black a5 to Rook second, with coordinates and clocks unchanged.',
  '47. End Black turn; Earthquake stays in play and White pawn forward is east, Black west.',
  '48. Nh3xg1 jumps and captures the original black-rook-a8 for White; rotation does not change Knight geometry.',
  '49. End White turn with the captured Rook still attributed to White.',
  '50. Evil Eye selects promoted Ra5 and white Pa2: clear a4,a3 give a legal Rook capture; only Pa2 is captured by Black and Ra5 stays fixed.',
  '51. End Black stationary capture replacement; clocks reset and fullmove advances once.',
  '52. Ra1-b1 moves to an adjacent empty square without capture.',
  '53. End White turn, preserving both original and promoted Rook identities.',
  '54. Irresistible Force moves Pg7 west to f7, pushes Pf7 to e7 and Ne7 to empty d7; no King, capture, or promotion in the chain.',
  '55. End Black replacement turn; no en-passant follows a push.',
  '56. Nc3-e4 is an ordinary Knight jump to empty e4.',
  '57. End White turn; Earthquake remains the only continuing effect.',
  '58. Promoted Ra5-a1 traverses empty a4,a3,a2; promoted identity increments rather than resets halfmove.',
  '59. End Black turn, preserving its promoted physical pawn as a Rook.',
  '60. Ng1-h3 is a safe Knight jump; an opponent move reaction is now eligible.',
  '61. Chaos cancels that exact jump, restores its board and clocks, spends only Black card, and forbids white-knight-g1:g1:h3.',
  '62. Qd1-c1 is a genuinely different replacement; clears the prior movement ban.',
  '63. End White turn, resetting Black reaction allowance for its own turn.',
  '64. Rh8-h7 is a safe adjacent Rook move.',
  '65. Think Again cancels Rh8-h7, restores pre-move clocks and position, and forbids black-rook-h8:h8:h7.',
  '66. Kd8-c8 is geometrically adjacent but attacked by Ba6 through empty b7; provisional rescue retains the full pre-move cancellation checkpoint.',
  '67. Fortification f3-f4 cannot block Ba6-b7-c8; fizzle rolls back Kc8 and spends the wall card. The prior h8-h7 prohibition MUST survive the aborted replacement (§17.1).',
];

const cardTargets: Record<number, { id: string; target?: unknown }> = {
  9: { id: 'dubbing', target: [{ from: 'c1', to: 'd3' }] },
  11: { id: 'onslaught', target: [{ from: 'a7', to: 'a6' }, { from: 'c7', to: 'c6' }, { from: 'e7', to: 'e6' }] },
  21: { id: 'under-elf-hill' },
  28: { id: 'guardian', target: [{ from: 'b7', to: 'b6' }] },
  35: { id: 'dungeon', target: [{ from: 'f5', to: 'h1' }] },
  39: { id: 'hidden-passage', target: [{ from: 'h5', to: 'e1' }] },
  43: { id: 'lost-castle', target: { own: 'g1', opponent: 'a8' } },
  46: { id: 'earthquake', target: { direction: 'counterclockwise', promotions: [{ square: 'h2', role: 'knight' }, { square: 'a5', role: 'rook' }] } },
  50: { id: 'evil-eye', target: { attacker: 'a5', victim: 'a2' } },
  54: { id: 'irresistible-force', target: [{ from: 'g7', to: 'f7' }] },
  61: { id: 'chaos' }, 65: { id: 'think-again' },
  67: { id: 'fortification', target: { from: 'f3', to: 'f4' } },
};

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const boardFen = (pieces: PieceState[]) => Array.from({ length: 8 }, (_, row) => {
  let rank = '', empty = 0;
  for (let file = 0; file < 8; file++) {
    const p = pieces.find(p => p.square === `${String.fromCharCode(97 + file)}${8 - row}`);
    if (!p) { empty++; continue; }
    if (empty) rank += empty;
    empty = 0;
    const char = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[p.role];
    rank += p.owner === 'white' ? char.toUpperCase() : char;
  }
  return rank + (empty || '');
}).join('/');

function reaches(pieces: PieceState[], piece: PieceState, to: string, orientation: number, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    return orientation === 0 ? dy === forward && (capture ? Math.abs(dx) === 1 : dx === 0)
      : dx === forward && (capture ? Math.abs(dy) === 1 : dy === 0);
  }
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = !dx || !dy;
  if (!(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let k = 1; k < Math.max(Math.abs(dx), Math.abs(dy)); k++) {
    const s = `${String.fromCharCode(97 + x + k * Math.sign(dx))}${y + 1 + k * Math.sign(dy)}`;
    if (pieces.some(p => p.square === s)) return false;
  }
  return true;
}

test('iteration 152: first invalid state is a lost Think Again prohibition after failed rescue', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/152.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860152);
  assert.equal(rationale.length, 67);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces), players = structuredClone(state.players), turn = structuredClone(state.turn);
  let half = 0, full = 1, active = 'w', rights = 'KQkq', orientation = 0;
  const snapshots = new Map<number, GameState>([[0, structuredClone(state)]]);
  const at = (square: string) => { const piece = pieces.find(p => p.square === square); assert.ok(piece, square); return piece; };
  const relocate = (from: string, to: string) => { assert.match(to, /^[a-h][1-8]$/); at(from).square = to as SquareName; };
  const consumeMove = (pawnOrCapture: boolean) => {
    half = pawnOrCapture ? 0 : half + 1;
    if (turn.color === 'black') full++;
    active = turn.color === 'white' ? 'b' : 'w';
    turn.phase = 'afterMove'; turn.moveMade = true;
  };
  for (const [index, step] of trace.steps.slice(0, 67).entries()) {
    const n = index + 1, action = step.action, before = structuredClone(state);
    assert.ok(rationale[index]!.startsWith(`${n}. `));
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      const piece = at(from), victim = pieces.find(p => p.square === to);
      assert.equal(piece.owner, turn.color);
      assert.equal(turn.moveMade, false);
      assert.ok(reaches(pieces, piece, to, orientation, !!victim), rationale[index]);
      assert.ok(!victim || victim.owner !== piece.owner && !victim.royal);
      assert.ok(!(n >= 25 && n <= 26 && piece.id === 'white-king-e1'));
      assert.ok(!(n >= 35 && n <= 37 && piece.id === 'black-queen-d8'));
      if (victim) { victim.square = null; victim.zone = 'captured'; victim.capturedBy = turn.color; }
      relocate(from, to);
      if (piece.royal) rights = rights.replace(piece.owner === 'white' ? /[KQ]/g : /[kq]/g, '') || '-';
      consumeMove(piece.role === 'pawn' || !!victim);
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true);
      turn = { color: turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'returnKing') {
      assert.equal(n, 25); assert.equal(action.to, 'h5'); assert.ok(!pieces.some(p => p.square === 'h5'));
      const king = pieces.find(p => p.id === 'white-king-e1')!;
      assert.equal(king.zone, 'away'); king.zone = 'board'; king.square = 'h5';
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('Unexpected action');
      const expected = cardTargets[n]!;
      assert.equal(action.cardId, expected.id); assert.deepEqual(action.target, expected.target);
      const owner: Color = n === 61 ? 'black' : n === 65 ? 'white' : turn.color;
      const player = players[owner], cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0); assert.equal(turn.cardPlays[owner], 0);
      const card = player.hand[cardIndex]!; assert.equal(card.cardId, expected.id);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(owner === turn.color ? turn.phase : 'afterOpponentMove'));
      player.hand.splice(cardIndex, 1); player.hand.push(player.deck.shift()!);
      if (n !== 46) player.discard.push(card);
      turn.cardPlays[owner]++;
      if (n === 9) { relocate('c1', 'd3'); consumeMove(false); }
      if (n === 11) { relocate('a7', 'a6'); relocate('c7', 'c6'); relocate('e7', 'e6'); consumeMove(true); }
      if (n === 21) { const king = at('f2'); king.square = null; king.zone = 'away'; consumeMove(false); }
      if (n === 28) { relocate('b7', 'b6'); consumeMove(true); }
      if (n === 35) relocate('f5', 'h1');
      if (n === 39) { relocate('h5', 'e1'); consumeMove(false); }
      if (n === 43) { const own = at('g1'), opponent = at('a8'); own.square = 'a8'; opponent.square = 'g1'; consumeMove(false); }
      if (n === 46) { orientation = 90; for (const [s, role] of [['h2', 'knight'], ['a5', 'rook']] as const) { at(s).role = role; at(s).promoted = true; } }
      if (n === 50) { assert.ok(reaches(pieces, at('a5'), 'a2', orientation, true)); const p = at('a2'); p.square = null; p.zone = 'captured'; p.capturedBy = 'black'; consumeMove(true); }
      if (n === 54) { const p = at('g7'), pushed = at('f7'), knight = at('e7'); knight.square = 'd7'; pushed.square = 'e7'; p.square = 'f7'; consumeMove(true); }
      if (n === 61 || n === 65 || n === 67) {
        const restore = snapshots.get(n === 61 ? 59 : n === 65 ? 63 : 65)!;
        pieces = structuredClone(restore.pieces);
        const fields = restore.fen.split(' '); active = fields[1]!; half = Number(fields[4]); full = Number(fields[5]);
        turn.phase = 'beforeMove'; turn.moveMade = false;
      }
    }
    const input = JSON.stringify(state), result = applyAction(state, action);
    assert.equal(JSON.stringify(state), input, `${n}: full input immutability including captors/checkpoints`);
    assert.ok(result.ok, rationale[index]); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${n}: independently moved physical pieces and captors`);
    assert.deepEqual(state.players, players, `${n}: physical cards, draw order and exact discard`);
    assert.deepEqual(state.turn, turn, `${n}: turn/allowance oracle`);
    assert.equal(state.fen, `${boardFen(pieces)} ${active} ${rights} - ${half} ${full}`, `${n}: all six FEN fields`);
    assert.equal(state.orientation, orientation);
    assert.deepEqual(state.enPassant, [], `${n}: no double advance, including prospective capture window`);
    assert.equal(state.outcome, null);
    const earthquake = { type: 'earthquake', owner: 'black', card: { id: 'black-deck-0-earthquake', cardId: 'earthquake' }, direction: 'counterclockwise', target: cardTargets[46]!.target };
    assert.deepEqual(state.effects, n >= 46 ? [earthquake] : n >= 35 && n <= 37 ? [{ type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-queen-d8' }] : []);
    assert.deepEqual(state.underElfHill ?? [], n >= 21 && n <= 26 ? [{ pieceId: 'white-king-e1', player: 'white', returning: n >= 24, ...(n >= 25 ? { returned: true } : {}) }] : []);
    for (const color of ['white', 'black'] as const) {
      const king = pieces.find(p => p.owner === color && p.royal)!;
      const attacked = king.zone === 'board' && pieces.some(p => p.zone === 'board' && p.owner !== color
        && !(n >= 35 && n <= 37 && p.id === 'black-queen-d8')
        && !(n >= 25 && n <= 26 && p.id === 'white-king-e1')
        && reaches(pieces, p, king.square!, orientation, true));
      assert.equal(attacked, color === 'white' ? [32, 33, 34].includes(n) : n === 66, `${n}: independent ${color} royal attack geometry`);
      assert.equal(isKingInCheck(state, color), attacked, `${n}: reducer agrees with physical royal oracle`);
    }
    assert.equal(state.plotsExecution, undefined); assert.deepEqual(state.plotsAllowances ?? [], []);
    assert.deepEqual(state.fogLocked ?? [], []); assert.deepEqual(state.riposteLostMoves ?? [], []);
    assert.equal(state.riposteSkipped, undefined); assert.equal(state.riposteCheckDeferred, undefined);
    assert.equal(state.pendingAbduction ?? null, null); assert.equal(state.pendingDoomsayer ?? null, null);
    if (n === 34 || n === 66) {
      const rescue = structuredClone(state.pendingRescue);
      if (!before.plotsAllowances?.length) delete before.plotsAllowances;
      if (rescue?.before && !rescue.before.plotsAllowances?.length) delete rescue.before.plotsAllowances;
      assert.deepEqual(rescue, { before, fen: before.fen, pieces: before.pieces, enPassant: [], historyLength: before.history.length, movedPieceIds: [n === 34 ? 'white-rook-h1' : 'black-king-e8'] });
      assert.equal(before.history.length, n === 34 ? 16 : 33);
    } else assert.equal(state.pendingRescue ?? null, null);
    const forbidden = n === 61 ? { player: 'white', movement: 'white-knight-g1:g1:h3' }
      : n === 65 || n === 67 ? { player: 'black', movement: 'black-rook-h8:h8:h7' } : undefined;
    if (n === 67) {
      assert.equal(state.history.at(-1)?.type, 'cardFizzled');
      assert.equal(state.history.at(-1)?.reason, 'SELF_CHECK');
      const repeated = applyAction(state, { type: 'move', from: 'h8', to: 'h7' });
      assert.deepEqual({ forbidden: state.chaosForbidden, repeated: repeated.ok }, { forbidden, repeated: false }, rationale[index]);
    } else assert.deepEqual(state.chaosForbidden, forbidden, `${n}: complete cancellation movement token`);
    snapshots.set(n, structuredClone(state));
  }
});
