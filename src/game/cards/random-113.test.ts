import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

// Independent sequential review: rules §§8–11, 13.1, 14.4 and the named cards.
const rationale = [
  '1. White g-pawn advances g2-g3 without capture.',
  '2. White finishes; Black receives a fresh turn.',
  '3. Black c7-c5 crosses empty c6; c6 en-passant opportunity is created.',
  '4. Black finishes; c6 opportunity survives into White turn.',
  '5. White e2-e4 crosses empty e3; replaces c6 opportunity with e3.',
  '6. White finishes and retains e3 opportunity.',
  '7. Black d7-d6 is a single push; e3 opportunity expires.',
  '8. Black finishes without spending a card.',
  '9. White a2-a3 is a single push.',
  '10. White finishes; no card zones change.',
  '11. Black bishop c8-f5 follows empty d7,e6.',
  '12. Black finishes; bishop remains f5.',
  '13. White bishop f1-d3 crosses empty e2.',
  '14. White finishes; bishop remains d3.',
  '15. Black f7-f6 is a single pawn push.',
  '16. Black finishes; no replacement draw is due.',
  '17. White knight g1-e2 makes a legal jump.',
  '18. White finishes with both castling rights still available.',
  '19. Black bishop f5-g4 moves one diagonal square.',
  '20. Black finishes; no physical changes.',
  '21. White b2-b4 crosses empty b3; b3 en-passant is created.',
  '22. White finishes and preserves b3 opportunity.',
  '23. Black knight b8-d7 jumps; b3 opportunity expires.',
  '24. Black finishes; no card zones change.',
  '25. White castles: e1-g1 and h1-f1 over clear, safe f1/g1; White rights expire.',
  '26. White finishes after castling.',
  '27. Black King e8-f7 enters a safe adjacent square; Black rights expire.',
  '28. Black finishes with no castling rights remaining.',
  '29. White e4-e5 advances a single square.',
  '30. White finishes; pawn remains e5.',
  '31. Black bishop g4-e6 crosses empty f5.',
  '32. Black finishes; no card expenditure.',
  '33. White e5xf6 captures the original black f-pawn; capturedBy White.',
  '34. White finishes after the capture.',
  '35. Black bishop e6-a2 crosses d5,c4,b3, all empty.',
  '36. Black finishes; bishop is a2.',
  '37. Assassin replaces White move: knight e2xg3 captures own g-pawn; draw Fog of War.',
  '38. White finishes; own capture remains attributed to White.',
  '39. Black queen d8-b6 crosses empty c7.',
  '40. Black finishes; no physical changes.',
  '41. White h2-h4 crosses empty h3; create h3 opportunity.',
  '42. White finishes and retains h3 opportunity.',
  '43. Black g7xf6 captures original white e-pawn; expire h3 opportunity.',
  '44. Black finishes after capture attributed to Black.',
  '45. White a3-a4 is an unobstructed single push.',
  '46. White finishes; no draw without a card.',
  '47. Onslaught replaces Black move: d6-d5,e7-e6,f6-f5,h7-h6 are empty noncaptures; draw Chaos.',
  '48. Black finishes after the four simultaneous pawn advances.',
  '49. White queen d1-h5 crosses e2,f3,g4; it checks f7 along g6.',
  '50. White finishes; Black must answer queen check.',
  '51. Black King f7-g6 remains attacked by h5 Queen; temporary rescue window under §11.6.',
  '52. Fortification b7/c8 cannot block h5-g6; spend and draw Lost Castle, rewind unsafe King move and clocks.',
  '53. Black King f7-e7 safely answers check using restored move; card allowance remains spent.',
  '54. Black finishes safely and resets allowances.',
  '55. White bishop d3-b5 crosses empty c4.',
  '56. White finishes; Black turn begins.',
  '57. Black queen b6-d8 crosses empty c7.',
  '58. Black finishes; White turn begins.',
  '59. White queen h5-f3 crosses empty g4.',
  '60. Black Chaos reacts: restore queen h5 and pre-move clocks, forbid h5-f3, draw Forced March.',
  '61. White instead pushes d2-d3, a different move from the canceled queen move.',
  '62. White finishes; Black reaction allowance resets for its turn.',
  '63. Black queen d8-b8 crosses empty c8.',
  '64. Black finishes; no physical changes.',
  '65. White bishop c1-e3 crosses the vacated d2 square.',
  '66. Holy War swaps own knight b1 and bishop e3 without capture or clock advance; draw Holy Quest.',
  '67. White finishes with bishop b1 and knight e3.',
  '68. Black e6-e5 is a single pawn push.',
  '69. Black finishes; no physical changes.',
  '70. White King g1-h1 is an unattacked adjacent move.',
  '71. White finishes safely on h1.',
  '72. Black bishop a2-c4 crosses empty b3.',
  '73. Black finishes; bishop remains c4.',
  '74. White rook f1-c1 crosses empty e1,d1.',
  '75. White finishes; rook remains c1.',
  '76. Black bishop c4-a2 crosses empty b3.',
  '77. Black finishes; no physical changes.',
  '78. White knight e3-d1 jumps legally.',
  '79. White finishes; knight on d1 blocks the later rook line.',
  '80. Lost Castle replaces Black move: swap black h8 rook and white c1 rook; no capture; draw Disintegration.',
  '81. Black finishes; White King h1 remains shielded by own knight d1 from rook c1.',
  '82. White queen h5xh6 captures black h-pawn; capturedBy White.',
  '83. White finishes after capture.',
  '84. Forced March replaces Black move: original g-pawn f5-g5 sideways into empty square; draw Fireball.',
  '85. Black finishes; shifted pawn remains g5.',
  '86. White f2-f4 crosses empty f3; create f3 opportunity.',
  '87. White finishes and retains f3 opportunity.',
  '88. Black bishop a2-c4 crosses empty b3; f3 opportunity expires.',
  '89. Black finishes; no physical changes.',
  '90. White queen h6-h5 moves one vertical square.',
  '91. White finishes; no card changes.',
  '92. Black rook c1xd1 captures original white b1 knight and checks h1 across e1,f1,g1.',
  '93. Disintegration kills own original g-pawn on g5 permanently, without capturedBy; draw Sanctuary.',
  '94. Black finishes; White remains in check from rook d1.',
  '95. White queen h5-h7 crosses empty h6 but does not answer rook check; temporary rescue only.',
  '96. Holy Quest c4/g8 swap cannot cure d1-h1 check; card fizzles, draw Hidden Passage and restore queen/clocks.',
  '97. White knight g3-f1 jumps into the rook d1-h1 ray and answers check.',
  '98. White finishes safely with knight f1.',
  '99. Black rook d1-c1 moves one horizontal square.',
  '100. Black finishes; no physical changes.',
  '101. White queen h5-f3 crosses empty g4.',
  '102. White finishes; no card changes.',
  '103. Black bishop f8-g7 moves one diagonal square.',
  '104. Black finishes; no physical changes.',
  '105. White bishop b5-a6 moves one diagonal square.',
  '106. White finishes; no physical changes.',
  '107. Black bishop g7-f6 moves one diagonal square.',
  '108. Black finishes; no physical changes.',
  '109. White queen f3-d1 crosses empty e2.',
  '110. White finishes the fiftieth move command; Black begins with fresh allowances.',
];

const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
function checked(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  const [kx, ky] = xy(king.square!);
  return pieces.some(p => {
    if (p.zone !== 'board' || p.owner === color) return false;
    const [x, y] = xy(p.square!); const dx = kx! - x!, dy = ky! - y!;
    if (p.role === 'pawn') return Math.abs(dx) === 1 && dy === (p.owner === 'white' ? 1 : -1);
    if (p.role === 'knight') return Math.abs(dx * dy) === 2;
    if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
    if (!(p.role === 'queen' ? diagonal || straight : p.role === 'rook' ? straight : diagonal)) return false;
    for (let i = 1; i < Math.max(Math.abs(dx), Math.abs(dy)); i++) {
      const square = `${String.fromCharCode(97 + x! + Math.sign(dx) * i)}${y! + Math.sign(dy) * i + 1}`;
      if (pieces.some(q => q.zone === 'board' && q.square === square)) return false;
    }
    return true;
  });
}

function boardFen(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = pieces.find(p => p.zone === 'board' && p.square === `${'abcdefgh'[file]}${8 - rank}`);
      if (!p) { empty++; continue; }
      if (empty) row += empty; empty = 0;
      row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 113 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/113.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((text, i) => assert.ok(text.startsWith(`${i + 1}. `)));
  let state = createGameState(trace.initial);
  let expected = structuredClone(state);
  const snapshots = new Map<number, GameState>();
  const relocate = (from: string, to: string, captor?: Color) => {
    assert.match(to, /^[a-h][1-8]$/);
    const piece = expected.pieces.find(p => p.square === from && p.zone === 'board')!;
    assert.ok(piece, from);
    const victim = expected.pieces.find(p => p.square === to && p.zone === 'board');
    if (victim) {
      assert.ok(captor); victim.zone = 'captured'; victim.square = null; victim.capturedBy = captor;
    }
    piece.square = to as SquareName;
  };
  for (const [i, step] of trace.steps.entries()) {
    const n = i + 1, action = step.action, actor = expected.turn.color;
    const original = structuredClone(state);
    snapshots.set(n, structuredClone(expected));
    let [, side, rights, , half, full] = expected.fen.split(' ');
    let halfmove = Number(half), fullmove = Number(full);
    const advance = (reset: boolean) => {
      halfmove = reset ? 0 : halfmove + 1;
      if (actor === 'black') fullmove++;
      side = actor === 'white' ? 'b' : 'w';
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true; expected.enPassant = [];
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const position = Chess.fromSetup(parseFen(expected.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.equal(position.isLegal(move), ![51, 95].includes(n), rationale[i]);
      const piece = expected.pieces.find(p => p.square === action.from && p.zone === 'board')!;
      const pawn = piece.role === 'pawn', capture = expected.pieces.some(p => p.square === action.to && p.owner !== actor);
      advance(pawn || capture);
      if (n === 25) { relocate('e1', 'g1'); relocate('h1', 'f1'); rights = 'kq'; }
      else { relocate(action.from, action.to, actor); if (n === 27) rights = '-'; }
      if (pawn && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2) {
        expected.enPassant = [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: piece.id }];
      }
    } else if (action.type === 'endTurn') {
      assert.ok(expected.turn.moveMade); assert.equal(checked(expected.pieces, actor), false);
      expected.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unexpected action');
      const owner: Color = n === 60 ? 'black' : actor;
      assert.equal(expected.turn.cardPlays[owner], 0);
      const player = expected.players[owner], index = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(index >= 0); assert.equal(player.hand[index]!.cardId, action.cardId);
      player.discard.push(player.hand.splice(index, 1)[0]!); player.hand.push(player.deck.shift()!);
      if (n === 37) { relocate('e2', 'g3', 'white'); advance(true); }
      else if (n === 47) { for (const [f, t] of [['d6', 'd5'], ['e7', 'e6'], ['f6', 'f5'], ['h7', 'h6']]) relocate(f!, t!); advance(true); }
      else if ([52, 60, 96].includes(n)) {
        const before = snapshots.get(n === 52 ? 51 : n === 60 ? 59 : 95)!;
        expected.pieces = structuredClone(before.pieces); expected.enPassant = structuredClone(before.enPassant);
        expected.turn = structuredClone(before.turn);
        [, side, rights, , half, full] = before.fen.split(' '); halfmove = Number(half); fullmove = Number(full);
      } else if (n === 66 || n === 80) {
        const from = n === 66 ? 'b1' : 'h8', to = n === 66 ? 'e3' : 'c1';
        const first = expected.pieces.find(p => p.square === from)!, second = expected.pieces.find(p => p.square === to)!;
        first.square = to as SquareName; second.square = from as SquareName;
        if (n === 80) advance(false);
      } else if (n === 84) { relocate('f5', 'g5'); advance(true); }
      else if (n === 93) {
        const pawn = expected.pieces.find(p => p.square === 'g5')!; pawn.square = null; pawn.zone = 'dead'; delete pawn.capturedBy;
      } else throw new Error(`unreviewed card ${n}`);
      expected.turn.cardPlays[owner]++;
    }
    expected.fen = `${boardFen(expected.pieces)} ${side} ${rights} - ${halfmove} ${fullmove}`;
    const result = applyAction(state, action);
    assert.deepEqual(state, original, `step ${n}: complete input immutability`);
    assert.ok(result.ok, rationale[i]); state = result.state;
    assert.deepEqual(state.pieces, expected.pieces, `step ${n}: all physical identities and capturedBy`);
    assert.deepEqual(state.players, expected.players, `step ${n}: complete hand/deck/discard order and identities`);
    assert.deepEqual(state.effects, [], `step ${n}: no retained effect, including failed Fortification`);
    assert.deepEqual(state.turn, expected.turn, `step ${n}: turn and allowances`);
    assert.equal(state.fen, expected.fen, `step ${n}: complete board, side, rights and clocks`);
    assert.deepEqual(state.enPassant, expected.enPassant, `step ${n}: en passant`);
    assert.equal(Boolean(state.pendingRescue), [51, 95].includes(n));
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    if (expected.turn.phase === 'afterMove') assert.equal(checked(expected.pieces, actor), [51, 95].includes(n), `step ${n}: independent royal safety`);
  }
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 9);
  assert.equal(state.fen, 'rq4nR/pp1nk3/B4b2/2ppp3/PPb2P1P/3P4/2P5/RBrQ1N1K b - - 7 26');
  assert.deepEqual(replayTrace(trace), state);
});
