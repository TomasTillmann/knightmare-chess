import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, PieceState, SquareName } from '../types.js';

// Independently reviewed in order against rules §§8–14, 19, 22 and printed catalog timing.
const rationale = [
  '1. a2-a4 crosses empty a3, creates a3 en passant, resets clock; e1 remains screened.',
  '2. White ends; a3 opportunity persists for Black, no draw or board change.',
  '3. d7-d6 is an empty forward step, expires a3 opportunity; Black King remains screened.',
  '4. Black ends at fullmove 2; no board or hand change.',
  '5. e2-e4 crosses empty e3; creates e3 opportunity and opens f1 diagonal.',
  '6. White ends with e3 opportunity intact.',
  '7. d6-d5 advances one into empty d5; expires e3, no check on e8.',
  '8. Black ends at fullmove 3.',
  '9. Original g1 Knight jumps to empty h3, no blocked path requirement.',
  '10. White ends; Knight displacement and clock retained.',
  '11. a7-a5 crosses empty a6, creates a6 en passant; a4 Pawn is not captured.',
  '12. Black ends; a6 right remains until White moves.',
  '13. f1 Bishop enters empty e2 diagonally, clears en passant; e1 safe.',
  '14. After-move Earthquake turns forward west/east; h7 Pawn promotes first to Knight, a4 Pawn to Bishop. Fixed squares persist. Bishop a4-b5-c6-d7-e8 checks Black, permitted for continuing effect. Spend to effect and draw Vulture.',
  '15. White ends with rotated orientation and check on e8.',
  '16. Original b8 Knight jumps to c6, interposing on a4-e8 diagonal and curing check.',
  '17. Black ends safely with c6 interposition.',
  '18. Blessing replaces move: g1 Knight h3-g4 is a vacant diagonal step, not an ordinary Knight move; spend and draw Lost Castle.',
  '19. White ends; Blessing grants no additional move.',
  '20. Original a8 Rook enters vacant a7; removes its castling right.',
  '21. Black ends; neither King is exposed.',
  '22. Original h1 Rook moves to vacant g1; its castling right expires.',
  '23. White ends; Queen-side right remains.',
  '24. d8 Queen traverses empty d7 to d6; d5 Pawn is beyond destination.',
  '25. Black ends; e8 remains screened.',
  '26. h1 Rook g1-f1 uses empty adjacent square.',
  '27. Cathedral swaps original a1 Rook with promoted a2 Bishop on a4, preserving physical roles and identities, no capture. Draw Under Elf Hill; retain previous move clocks.',
  '28. White ends after swap, no additional move.',
  '29. Queen d6-e6 takes an empty horizontal step; e7 Pawn screens e8.',
  '30. Black ends; the e6 Queen is blocked from e1 by e4 Pawn.',
  '31. Original a1 Rook a4-a3 enters vacancy and loses remaining White castling right.',
  '32. White ends with e1 safe behind e4 and e2.',
  '33. Queen e6-f6 is a vacant horizontal step.',
  '34. Black ends; e8 remains safe.',
  '35. Lost Castle exchanges White a3 Rook and original Black h8 Rook, irrespective of path; consumes move and last Black castling right, draws Sanctuary. g8 Knight blocks White h8 Rook from e8.',
  '36. White ends after replacement move.',
  '37. Evil Eye: f6 Queen legally threatens f2 through vacant f5,f4,f3. Capture only original f2 Pawn, leave Queen f6. e8 remains safe behind f8 Bishop and g8 Knight. Draw Cathedral, reset clock.',
  '38. Black ends; f2 capture remains and Queen is stationary.',
  '39. Original h1 Rook f1-h1 traverses vacant g1.',
  '40. White ends; e1 remains protected by e2 Bishop.',
  '41. Queen f6-e6 enters vacant square; e4 Pawn blocks e1 ray.',
  '42. Black ends, e8 safe.',
  '43. White original a1 Rook h8xg8 captures original g8 Knight; f8 Bishop still blocks e8.',
  '44. White ends; captured g8 Knight cannot act again.',
  '45. Fanatic sends original d7 Pawn d5-g5 east through empty e5,f5,g5 under rotation, no capture or en passant. Move consumed, draw Squaring the Circle.',
  '46. Black ends; g5 Pawn has not yet reached last file h.',
  '47. White original g2 Pawn moves west g2-f2 into vacancy created by Evil Eye.',
  '48. White ends with clock reset by Pawn.',
  '49. Queen e6xe4 crosses empty e5, captures original e2 Pawn; e2 Bishop still blocks e1.',
  '50. Black ends; Queen on e4 does not see through e2 Bishop.',
  '51. Original a1 Rook g8-h8 enters vacancy, no new rights.',
  '52. White ends; e1 remains safe.',
  '53. Original d7 Pawn g5-h5 advances east to last file, promotes to Knight and resets clock.',
  '54. Black ends; h5 promoted Knight is distinct from h7 promoted Knight.',
  '55. Original h1 Rook h1-f1 crosses vacant g1.',
  '56. White ends; e1 safe behind e2 Bishop.',
  '57. Queen e4-f5 takes empty diagonal, releasing e-file pressure.',
  '58. Black ends; no check.',
  '59. Original f1 Bishop e2-a6 follows clear d3,c4,b5; Queen f5 is not aligned with e1.',
  '60. White ends after Bishop displacement; e1 safe.',
  '61. Queen f5-b5 traverses vacant e5,d5,c5; e8 remains safe.',
  '62. Black ends; b5 Queen is not aligned with e1.',
  '63. b2 Pawn captures west-diagonally a3 original Black h8 Rook, promotes to Knight on last file a.',
  '64. White ends; a3 Knight retains original b2 identity.',
  '65. Queen b5-b4 is a vacant vertical step; d2 Pawn blocks b4-e1 diagonal.',
  '66. Black ends; White King remains screened by d2.',
  '67. Original a1 Rook h8xf8 crosses empty g8 and captures original f8 Bishop, checking adjacent e8 along rank 8.',
  '68. White ends with check, Black may answer.',
  '69. Promoted original h7 Pawn Knight h7xf8 captures checking White a1 Rook; original g8 Knight remains captured.',
  '70. Black ends after curing check; capture resets clock.',
  '71. Promoted original a2 Bishop a1-c3 crosses now-empty b2; d2 still screens King from b4 Queen.',
  '72. White ends; a3 Knight and c3 Bishop are separate promoted Pawns.',
  '73. Promoted original d7 Knight h5-f4 jumps into vacancy; e1 is not a Knight target.',
  '74. Black ends; e1 safe.',
  '75. Under Elf Hill removes physical White e1 King to away zone, consumes move, draws Mystic Shield and advances clock without capture.',
  '76. White ends while King remains away; no return yet.',
  '77. Original b8 Knight c6-b8 jumps home; absent White King has no attacks.',
  '78. Black ends; White return obligation becomes due.',
  '79. White King returns to vacant edge h1 safely: b4 Queen is not aligned, f4 Knight does not attack h1. No clocks, draws, or move allowance consumed; King frozen this turn.',
  '80. Promoted a2 Bishop c3-e5 traverses empty d4; returned King h1 stays fixed.',
  '81. White ends and return movement restriction expires.',
  '82. Promoted d7 Knight f4-d3 jumps to vacancy; h1 is not attacked.',
  '83. Black ends; no effects expire beyond unchanged Earthquake.',
  '84. Original g1 Knight g4-e3 jumps clear; h1 remains safe.',
  '85. White ends; d3 and e3 Knights belong to different players.',
  '86. Queen b4-f4 crosses clear c4,d4,e4; h1 is not aligned with f4.',
  '87. Black ends; neither King is checked.',
  '88. Queen d1-g4 follows clear e2,f3; h1 remains safe.',
  '89. White ends; Black King still at e8.',
  '90. Haunting Memories copies last card Under Elf Hill with inherited before-move timing: removes Black e8 King, spends its own instance, draws Dark Mirror, consumes move.',
  '91. Black ends with own King away, waiting through White turn.',
  '92. Queen g4-g6 crosses empty g5; absent Black King cannot be checked.',
  '93. White ends; Black return becomes due.',
  '94. Black King returns vacant edge a2: Queen g6 is unaligned; Bishops a6/e5 do not attack a2; Knights a3,b1,e3 do not attack a2; c2 Pawn attacks b1/b3. No clocks/draws, returned King frozen.',
  '95. Original b8 Knight b8xa6 captures original White f1 Bishop; returned Black King stays a2.',
  '96. Black ends; return restriction expires, a2 King remains safe.',
  '97. White King h1-g2 is one diagonal step; Queen f4 is not aligned with g2 and d3 Knight does not attack g2.',
  '98. White ends; both Kings safely placed.',
  '99. Black f7 Pawn captures east-diagonally g6 White Queen; g6 is not last file, so no promotion.',
  '100. Black ends; captured Queen remains unavailable.',
  '101. Original g1 Knight e3-d5 jumps to vacancy; f4 Queen is unaligned with g2.',
  '102. White ends; g2 King safe.',
  '103. Promoted h7 Knight f8-d7 jumps clear; original d7 Pawn Knight remains d3.',
  '104. Black ends; a2 King safe.',
  '105. Promoted b2 Knight a3-c4 jumps clear; does not attack a2 King.',
  '106. White ends; no check or draw.',
  '107. Queen f4-g5 is an empty diagonal and checks White g2 King along vacant g4,g3; g7/g6 Pawns are beyond the Queen.',
  '108. Cathedral exchanges original Black a8 Rook on a7 and c8 Bishop, preserving identity, clocks and existing g5-g2 check. White can escape to f3, so no direct mate; draw Knightmare.',
  '109. Black ends with White checked along g5-g2, Earthquake persists.',
  '110. White King g2-f3 cures check: Queen g5 is unaligned; d3 Knight cannot attack f3; a7 Bishop is not diagonally aligned with f3.',
  '111. White ends; f3 King safe.',
  '112. Queen g5xe5 crosses empty f5 and captures promoted a2 Bishop; Queen e5 is unaligned with f3.',
  '113. Black ends with Bishop captured; White King safe.',
  '114. Original g1 Knight d5xe7 captures Black e7 Pawn; other White Knights stay b1/c4.',
  '115. White ends; Knight e7 does not check distant a2 King.',
  '116. Original b8 Knight a6-b8 returns with legal jump, distinct from promoted Knights d7/d3.',
  '117. Black ends at fullmove 29; 50 regular moves reviewed, Earthquake still active, no pending return.',
];

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const projection = (pieces: PieceState[]) => pieces.map(({ capturedAtPly: _captured, capturedBy: _actor, ...piece }) => piece);

// Ordinary geometry with the sole active power: Earthquake changes Pawn direction.
function reaches(piece: PieceState, to: string, pieces: PieceState[], rotated: boolean, capture: boolean): boolean {
  const [x, y] = xy(piece.square!);
  const [tx, ty] = xy(to);
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    const forward = rotated ? -dx * direction : dy * direction;
    const sideways = rotated ? ay : ax;
    if (capture) return forward === 1 && sideways === 1;
    if (sideways || forward < 1 || forward > 2) return false;
    if (forward === 1) return true;
    const ownerRank = rotated ? (piece.owner === 'white' ? 8 - x : x + 1) : (piece.owner === 'white' ? y + 1 : 8 - y);
    if (ownerRank > 2) return false;
  } else if (piece.role === 'bishop' ? ax !== ay : piece.role === 'rook' ? !!ax && !!ay : ax !== ay && !!ax && !!ay) return false;
  for (let step = 1; step < Math.max(ax, ay); step++) {
    if (pieces.some(p => p.zone === 'board' && xy(p.square!)[0] === x + Math.sign(dx) * step && xy(p.square!)[1] === y + Math.sign(dy) * step)) return false;
  }
  return true;
}

function assertSafe(pieces: PieceState[], color: Color, rotated: boolean, frozen?: string) {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  if (king.zone === 'away') return;
  for (const enemy of pieces.filter(p => p.zone === 'board' && p.owner !== color && p.id !== frozen)) {
    assert.equal(reaches(enemy, king.square!, pieces, rotated, true), false, `${enemy.id} must not attack ${color} King on ${king.square}`);
  }
}

test('iteration 083 deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/083.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860083);
  assert.equal(rationale.length, 117);
  assert.equal(trace.steps.length, rationale.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 9);
  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    assert.ok(rationale[index]!.startsWith(`${step}. `));
    const expected = structuredClone(state.pieces);
    const at = (square: string) => expected.find(p => p.zone === 'board' && p.square === square)!;
    const actor = state.turn.color;
    let reset = false, consumes = false;
    let ep: typeof state.enPassant = [];
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.to, /^[a-h][1-8]$/);
      const mover = at(action.from), victim = at(action.to);
      assert.equal(mover.owner, actor);
      assert.ok(reaches(mover, action.to, expected, step > 14, !!victim), rationale[index]);
      reset = mover.role === 'pawn' || !!victim;
      if (victim) {
        assert.equal(victim.owner, opposite(actor));
        assert.equal(victim.royal, false);
        victim.zone = 'captured'; victim.square = null;
      }
      if ([1, 5, 11].includes(step)) ep = [{ target: ({ 1: 'a3', 5: 'e3', 11: 'a6' } as const)[step as 1 | 5 | 11], pawnId: mover.id }];
      mover.square = action.to as SquareName;
      if (action.promotion) {
        assert.equal(mover.role, 'pawn');
        assert.equal(action.to[0], actor === 'white' ? 'a' : 'h');
        assert.equal(action.promotion, 'knight');
        mover.role = 'knight'; mover.promoted = true;
      }
      consumes = true;
    } else if (action.type === 'playCard') {
      assert.equal(state.turn.cardPlays[actor], 0);
      assert.equal(state.turn.phase, [14, 27, 108].includes(step) ? 'afterMove' : 'beforeMove');
      consumes = ![14, 27, 108].includes(step);
      if (step === 14) {
        at('h7').role = 'knight'; at('h7').promoted = true;
        at('a4').role = 'bishop'; at('a4').promoted = true;
      } else if (step === 18) {
        assert.equal(at('h3').id, 'white-knight-g1'); assert.equal(at('g4'), undefined); at('h3').square = 'g4';
      } else if ([27, 35, 108].includes(step)) {
        const [from, to] = step === 27 ? ['a1', 'a4'] : step === 35 ? ['a3', 'h8'] : ['a7', 'c8'];
        const first = at(from!), second = at(to!);
        assert.equal(first.role, 'rook'); assert.equal(second.role, step === 35 ? 'rook' : 'bishop');
        first.square = to as SquareName; second.square = from as SquareName;
      } else if (step === 37) {
        assert.ok(reaches(at('f6'), 'f2', expected, true, true));
        const victim = at('f2'); assert.equal(victim.id, 'white-pawn-f2');
        const captureTrial = structuredClone(expected);
        captureTrial.find(p => p.id === victim.id)!.zone = 'captured';
        captureTrial.find(p => p.id === at('f6').id)!.square = 'f2';
        assertSafe(captureTrial, 'black', true);
        victim.zone = 'captured'; victim.square = null; reset = true;
      } else if (step === 45) {
        for (const square of ['e5', 'f5', 'g5']) assert.equal(at(square), undefined);
        assert.equal(at('d5').id, 'black-pawn-d7'); at('d5').square = 'g5'; reset = true;
      } else if ([75, 90].includes(step)) {
        const king = expected.find(p => p.royal && p.owner === actor)!;
        king.zone = 'away'; king.square = null;
      } else assert.fail(`Unreviewed card at ${step}`);
    } else if (action.type === 'returnKing') {
      const square = step === 79 ? 'h1' : 'a2';
      assert.equal(action.to, square); assert.equal(at(square), undefined);
      const king = expected.find(p => p.royal && p.owner === actor)!;
      assert.equal(king.zone, 'away'); king.zone = 'board'; king.square = square;
      ep = state.enPassant;
    } else { assert.equal(action.type, 'endTurn'); ep = state.enPassant; }
    const result = applyAction(state, action);
    assert.ok(result.ok, rationale[index]);
    const after = result.state;
    assert.deepEqual(projection(after.pieces), projection(expected), rationale[index]);
    assert.deepEqual(after.enPassant, ep, `step ${step}: opportunity lifetime`);
    assertSafe(expected, actor, step >= 14);
    if (action.type === 'playCard' && step !== 14 && step !== 108) assertSafe(expected, opposite(actor), true);
    if (step === 108) {
      const escape = structuredClone(expected);
      escape.find(p => p.id === 'white-king-e1')!.square = 'f3';
      assertSafe(escape, 'white', true);
    }
    assert.equal(after.orientation, step >= 14 ? 270 : 0);
    const oldFen = state.fen.split(' '), newFen = after.fen.split(' ');
    assert.equal(Number(newFen[4]), consumes ? reset ? 0 : Number(oldFen[4]) + 1 : Number(oldFen[4]), rationale[index]);
    assert.equal(Number(newFen[5]), Number(oldFen[5]) + (consumes && actor === 'black' ? 1 : 0));
    assert.equal(after.turn.color, action.type === 'endTurn' ? opposite(actor) : actor);
    assert.equal(after.turn.moveMade, action.type === 'endTurn' ? false : consumes || state.turn.moveMade);
    if (action.type === 'playCard') {
      const card = state.players[actor].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card);
      assert.deepEqual(after.players[actor].hand, [...state.players[actor].hand.filter(c => c.id !== card.id), state.players[actor].deck[0]]);
      assert.deepEqual(after.players[actor].deck, state.players[actor].deck.slice(1));
      assert.deepEqual(after.players[actor].discard, [...state.players[actor].discard, ...(step === 14 ? [] : [card])]);
      assert.deepEqual(after.players[opposite(actor)], state.players[opposite(actor)]);
      assert.equal(after.turn.cardPlays[actor], 1);
      if (step === 14) assert.deepEqual(after.effects, [{ type: 'earthquake', owner: 'white', card, direction: 'clockwise', target: action.target }]);
    } else assert.deepEqual(after.players, state.players);
    if (step !== 14) assert.deepEqual(after.effects, state.effects);
    if ([75, 90].includes(step)) assert.deepEqual(after.underElfHill, [{ pieceId: actor === 'white' ? 'white-king-e1' : 'black-king-e8', player: actor, returning: false }]);
    if ([79, 94].includes(step)) assert.deepEqual(after.underElfHill, [{ pieceId: actor === 'white' ? 'white-king-e1' : 'black-king-e8', player: actor, returning: true, returned: true }]);
    if ([81, 96, 117].includes(step)) assert.deepEqual(after.underElfHill, []);
    assert.equal(!!after.pendingRescue, false);
    state = after;
  }
  assert.equal(state.fen, '1nr5/bppnN1p1/6p1/p3q3/2N5/3n1K2/k1PP1P1P/1NB2R2 w - - 1 29');
  assert.deepEqual(replayTrace(trace), state);
});
