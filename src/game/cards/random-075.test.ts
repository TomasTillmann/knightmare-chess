import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameState } from '../types.js';

// Individually reviewed against rules §§8–14, §19.2 and the printed catalog timing.
const rationales = [
  '1. g2-g4 crosses empty g3; pawn clock resets and g3 is the EP opportunity; both Kings safe.',
  '2. End White turn preserves g4 and EP; Black gets fresh allowances.',
  '3. a7-a6 is a clear black pawn step; expires g3 EP, fullmove becomes 2.',
  '4. End Black turn preserves board, clocks and hands.',
  '5. Hidden Passage replaces the move: e1-c5 is empty and safe, c7 pawn attacks b6/d6; revoke white castling, draw Lost Castle.',
  '6. End White replacement turn; c5/e8 Kings remain safe.',
  '7. a6-a5 advances without capture; c5 King is outside its b4 attack.',
  '8. End Black turn with no card or board change.',
  '9. h2-h3 is an empty pawn step; neither King line opens.',
  '10. End White turn, keeping all five cards.',
  '11. e7-e5 crosses e6; opens the bishop but does not attack c5, records e6 EP.',
  '12. End Black turn retains e6 opportunity and resets allowances.',
  '13. Kc5-d4 enters e5 pawn attack provisionally under §11.6; after-move Earthquake could change that attack.',
  '14. Holy War b1/c1 cannot remove e5-d4 check; spend and draw Madman, restore Kc5 and pre-move clock/EP for a legal retry.',
  '15. Kc5-b5 is one empty adjacent square, outside a5/c7 pawn attacks; no second card allowance.',
  '16. End White legal retry clears its consumed card allowance.',
  '17. Nb8-c6 is an empty knight jump; c6 does not attack b5.',
  '18. End Black turn with Kings safe and no draw.',
  '19. c2-c4 crosses empty c3, no capture, records c3 EP; b5 King remains safe.',
  '20. End White turn retains c3 EP.',
  '21. f7-f6 is a clear black pawn step, clearing EP and resetting halfmove.',
  '22. End Black turn passes to White with no hidden state change.',
  '23. Bf1-g2 moves one empty diagonal; the g-pawn vacated g2 at step 1.',
  '24. End White turn leaves Bishop g2 and King b5 safe.',
  '25. g7-g5 crosses empty g6; white g4 blocks further progress but not this move, records g6 EP.',
  '26. End Black turn retains g6 EP.',
  '27. Irresistible Force pushes enemy g5 pawn into empty g6 and moves white g4-g5; no capture/King push, replaces move, draws Fireball.',
  '28. End White replacement turn; EP is cleared by the push.',
  '29. Nc6-a7 is an empty knight jump; b5 King remains outside its attacks.',
  '30. End Black turn; clocks and card zones unchanged.',
  '31. Kb5-a6 provisionally enters b7 pawn attack; an opposite Earthquake orientation could remove it.',
  '32. Clockwise Earthquake promotes a5/h3 as specified but b7 still attacks a6; failed rescue rewinds King and orientation, spends card and draws Legacy.',
  '33. Kb5-a4 is an empty adjacent square safe behind a5 pawn; card allowance remains consumed.',
  '34. End White legal retry; no Earthquake effect persists.',
  '35. Ra8-b8 is a one-square rook move to the vacated knight square; removes black queenside right.',
  '36. End Black turn retains only black kingside castling.',
  '37. Bg2-d5 traverses empty f3/e4, lands empty; no King line is exposed.',
  '38. End White turn leaves Bishop d5 without card effects.',
  '39. b7-b6 is an empty pawn step; no check on a4 and no EP.',
  '40. End Black turn retains the new b6 pawn.',
  '41. Rh1-h2 uses the pawn-vacated square; no capture or King exposure.',
  '42. End White turn preserves h2 rook and hand.',
  '43. Bf8-a3 traverses empty e7/d6/c5/b4; a4 is not on its diagonal.',
  '44. End Black turn; Bishop a3 attacks b2 but not the King.',
  '45. Lost Castle swaps white a1 and black h8 Rooks as replacement move; a2 blocks the relocated enemy rook, g8 shields e8; draw Man-Trap, remove last castling right.',
  '46. End White replacement turn with both original rook identities preserved.',
  '47. c7-c6 advances into empty c6, attacks Bishop d5 but not a4.',
  '48. End Black turn without capture or card.',
  '49. f2-f3 is a clear pawn step, legal noncapturing Fireball trigger.',
  '50. Fireball at f3 captures exactly f3/e2 white pawns; other neighboring squares are empty; neither King is adjacent or exposed, draw Bombard.',
  '51. End White turn after explosion; captured pawns stay returnable, no extra clock advance.',
  '52. Fanatic b6-b3 crosses empty b5/b4, ends empty without capture or EP; replaces Black move and draws Tournament.',
  '53. End Black replacement turn at fullmove 13.',
  '54. Ng1-e2 jumps into the Fireball-vacated square; no capture/check.',
  '55. End White turn preserves knight identity and card zones.',
  '56. Ba3-f8 returns along empty b4/c5/d6/e7; King e8 remains shielded.',
  '57. End Black turn without a new effect.',
  '58. Nb1-c3 is an empty knight jump; a2 still shields Ka4 from Ra1.',
  '59. End White turn preserves empty b1 and occupied c3.',
  '60. Bf8-a3 repeats the clear five-square diagonal; no capture or check.',
  '61. End Black turn does not draw or advance clocks.',
  '62. Ne2-g1 returns by an empty knight jump, safe for Ka4.',
  '63. End White turn resets allowances with Bishop still d5.',
  '64. Ke8-f7 provisionally enters Bd5-e6-f7 attack; after-move Abduction can remove that bishop.',
  '65. Abduction instead selects white c4 Pawn; conceal away without capture/clocks, spend once and draw Lost Castle; rescue remains pending.',
  '66. Reveal Abduction changes concealment to recall only, without revealing a capture or moving another piece.',
  '67. Timeout would capture c4 but leaves Bd5 checking f7; fizzle restores c4 and Ke8 with pre-move clocks, keeping Abduction spent.',
  '68. Ba3-f8 is the legal replacement retry through clear b4/c5/d6/e7; Black cannot play another card.',
  '69. End Black turn after valid retry with Abduction closed.',
  '70. Nc3-b1 returns to empty b1; Ka4 stays shielded by a2.',
  '71. End White turn with no change to captured zones.',
  '72. h7-h5 crosses empty h6; white g5 pawn can capture en passant on h6, clock resets.',
  '73. End Black turn retains the immediately available h6 EP.',
  '74. Bd5-e4 is one empty diagonal step; declines and clears h6 EP.',
  '75. End White turn with bishop on e4 and no draw.',
  '76. h5-h4 is an empty pawn step stopping ahead of white h3; no capture.',
  '77. End Black turn; h3/h4 pawns remain distinct and blocked.',
  '78. Be4-c2 traverses empty d3 and ends at pawn-vacated c2.',
  '79. End White turn leaves both Kings safe.',
  '80. Black Lost Castle swaps b8/h2 Rooks; c8 bishop shields e8 from Rb8, d2 pawn blocks enemy Rh2; replaces move and draws Betrayal.',
  '81. End Black replacement turn retains all four rook identities.',
  '82. Rh8-h7 is one clear vertical step into the vacated pawn square.',
  '83. End White turn, retaining h7 rook and hand.',
  '84. Tournament swaps black g8 and white g1 Knights without capture; neither resulting Knight attacks a King, draw Annexation.',
  '85. End Black replacement turn at fullmove 20.',
  '86. Bc2-e4 traverses empty d3 and returns to empty e4.',
  '87. End White turn keeps card allowance unused.',
  '88. f6xg5 is a forward black pawn capture of the pushed white pawn; reset clock, preserve black pawn identity.',
  '89. End Black turn retains white g-pawn in captured zone.',
  '90. Qd1xg1 crosses empty e1/f1 and captures the swapped black Knight; queen cannot be taken with Riposte.',
  '91. End White turn leaves captured Knight off board and both Kings safe.',
  '92. Rh2-e2 traverses empty g2/f2 and stops before own-target white d2 pawn.',
  '93. End Black turn with no capture or card.',
  '94. Be4-g2 crosses empty f3, restoring the bishop to g2.',
  '95. End White turn; e2 enemy rook does not attack a4.',
  '96. Bf8-b4 crosses empty e7/d6/c5; adjacent Ka4 is orthogonal, so not checked.',
  '97. End Black turn leaves Bishop b4 blocking the b-file.',
  '98. Ng8-f6 is an empty knight jump that checks Ke8; check by an ordinary move is legal.',
  '99. End White turn passes the check to Black; no mate since f8 is safe.',
  '100. Ke8-f8 escapes Nf6, whose attacks include e8/g8 but not f8; Rb8 is blocked by Bc8.',
  '101. End Black escape turn with both Kings safe.',
  '102. Qg1-d4 crosses empty f2/e3; empty destination does not expose Ka4.',
  '103. End White turn retains queen d4 and unused cards.',
  '104. Re2xd2 captures white starting pawn one square left; does not expose Kf8, clock resets.',
  '105. End Black capture turn retains white d-pawn as captured.',
  '106. Qd4-g4 crosses empty e4/f4 and ends empty, stopping before h4 pawn.',
  '107. End White turn leaves queen g4 and both Kings safe.',
  '108. Rd2-d1 is an empty rook step; Bc1 blocks its leftward ray and Ka4 is not attacked.',
  '109. End Black turn keeps rook d1 and capture zones stable.',
  '110. Rb8-b7 moves one empty square; d7 blocks its rank attack on the black side.',
  '111. End White turn without card spending or clock change.',
  '112. Qd8-b6 traverses empty c7; a5 pawn blocks diagonal toward the a-file, no check on a4.',
  '113. End Black turn retains queen b6 and safe Kf8.',
  '114. Qg4-d4 traverses empty f4/e4; Black e5 pawn blocks its diagonal toward f6.',
  '115. End White turn completes all 50 move commands, three rewound, with Black to act and no pending effects.',
];

test('iteration 075 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/075.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860075);
  assert.equal(rationales.length, 115);
  assert.equal(trace.steps.length, rationales.length);
  const states: GameState[] = [createGameState(trace.initial)];
  const rewinds = new Map([[14, 12], [32, 30], [67, 63]]);
  const cardIds = new Map([[5, 'hidden-passage'], [14, 'holy-war'], [27, 'irresistible-force'],
    [32, 'earthquake'], [45, 'lost-castle'], [50, 'fireball'], [52, 'fanatic'],
    [65, 'abduction'], [80, 'lost-castle'], [84, 'tournament']]);
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationales[index]!.startsWith(`${n}. `));
    const before = states[index]!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    const after = result.state;
    states.push(after);
    assert.deepEqual(after.effects, [], `${n}: no surviving continuing effect`);
    assert.equal(after.orientation, 0);
    const setup = parseFen(before.fen).unwrap();
    const board = setup.board.clone();
    let half = setup.halfmoves;
    let full = setup.fullmoves;
    let fenTurn = setup.turn;
    const relocate = (from: string, to: string) => {
      const a = parseSquare(from)!; const b = parseSquare(to)!;
      const piece = board.get(a); assert.ok(piece);
      board.take(a); board.set(b, piece);
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = parseSquare(action.from)!; const to = parseSquare(action.to)!;
      const piece = board.get(from); assert.ok(piece);
      assert.equal(piece.color, before.turn.color);
      assert.equal(before.turn.moveMade, false);
      if ([13, 31, 64].includes(n)) {
        assert.equal(piece.role, 'king');
        assert.equal(board.get(to), undefined);
        assert.equal(Math.max(Math.abs((from & 7) - (to & 7)), Math.abs((from >> 3) - (to >> 3))), 1);
        assert.ok(after.pendingRescue, 'provisional King move must await a saving card');
      } else {
        assert.ok(Chess.fromSetup(setup).unwrap().isLegal({ from, to }), `${n}: independent ordinary legality`);
        assert.ok(!after.pendingRescue);
      }
      half = piece.role === 'pawn' || board.has(to) ? 0 : half + 1;
      full += before.turn.color === 'black' ? 1 : 0;
      fenTurn = before.turn.color === 'white' ? 'black' : 'white';
      relocate(action.from, action.to);
      assert.equal(after.pieces.find(p => p.id === before.pieces.find(p => p.square === action.from)!.id)!.square, action.to);
      const ep = piece.role === 'pawn' && Math.abs(from - to) === 16
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: before.pieces.find(p => p.square === action.from)!.id }] : [];
      assert.deepEqual(after.enPassant, ep);
    } else if (action.type === 'endTurn') {
      assert.ok(before.turn.moveMade);
      assert.ok(!before.pendingRescue && !before.pendingAbduction);
      assert.equal(after.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.equal(after.turn.phase, 'beforeMove');
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 });
      assert.deepEqual(after.pieces, before.pieces);
      assert.deepEqual(after.enPassant, before.enPassant);
    } else if (action.type === 'playCard') {
      assert.equal(action.cardId, cardIds.get(n));
      const owner = before.turn.color;
      const other = owner === 'white' ? 'black' : 'white';
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(before.turn.phase));
      const card = before.players[owner].hand.find(c => c.id === action.cardInstanceId); assert.ok(card);
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.equal(after.turn.cardPlays[owner], 1);
      assert.deepEqual(after.players[owner].hand, [...before.players[owner].hand.filter(c => c.id !== card.id), before.players[owner].deck[0]]);
      assert.deepEqual(after.players[owner].deck, before.players[owner].deck.slice(1));
      assert.deepEqual(after.players[owner].discard, [...before.players[owner].discard, card]);
      assert.deepEqual(after.players[other], before.players[other]);
      if ([5, 27, 45, 52, 80, 84].includes(n)) {
        assert.equal(after.turn.moveMade, true);
        assert.deepEqual(after.enPassant, []);
        half = [27, 52].includes(n) ? 0 : half + 1;
        full += owner === 'black' ? 1 : 0;
        fenTurn = other;
      }
      if (n === 5) relocate('e1', 'c5');
      if (n === 27) { relocate('g5', 'g6'); relocate('g4', 'g5'); }
      const swaps = new Map([[45, ['a1', 'h8']], [80, ['b8', 'h2']], [84, ['g8', 'g1']]]);
      const swap = swaps.get(n);
      if (swap) {
        const a = parseSquare(swap[0]!)!; const b = parseSquare(swap[1]!)!;
        const first = board.get(a)!; const second = board.get(b)!;
        board.set(a, second); board.set(b, first);
        for (const prior of before.pieces.filter(p => p.square === swap[0] || p.square === swap[1])) {
          assert.equal(after.pieces.find(p => p.id === prior.id)!.square, prior.square === swap[0] ? swap[1] : swap[0]);
        }
      }
      if (n === 50) {
        board.take(parseSquare('f3')!); board.take(parseSquare('e2')!); half = 0;
        assert.deepEqual(after.pieces.filter(p => p.zone === 'captured').map(p => p.id).sort(), ['white-pawn-e2', 'white-pawn-f2']);
      }
      if (n === 52) { for (const square of ['b5', 'b4', 'b3']) assert.equal(board.get(parseSquare(square)!), undefined); relocate('b6', 'b3'); }
      if (n === 65) {
        board.take(parseSquare('c4')!);
        assert.equal(after.pieces.find(p => p.id === 'white-pawn-c2')!.zone, 'away');
        assert.equal(after.pendingAbduction?.phase, 'concealment');
        assert.ok(after.pendingRescue);
      }
    } else if (action.type === 'revealAbduction') {
      assert.equal(n, 66);
      assert.equal(after.pendingAbduction?.phase, 'recall');
      assert.deepEqual(after.pieces, before.pieces);
    } else {
      assert.equal(n, 67);
      assert.equal(action.type, 'abductionTimeout');
      assert.ok(!after.pendingAbduction);
    }
    if (action.type !== 'playCard') assert.deepEqual(after.players, before.players, `${n}: no extra card spending/draw`);
    const rewind = rewinds.get(n);
    if (rewind !== undefined) {
      assert.equal(after.fen, states[rewind]!.fen, `${n}: restore complete pre-move FEN`);
      assert.deepEqual(after.pieces, states[rewind]!.pieces);
      assert.deepEqual(after.enPassant, states[rewind]!.enPassant);
      assert.equal(after.turn.moveMade, false);
      assert.ok(!after.pendingRescue);
    } else {
      const encoded = parseFen(after.fen).unwrap();
      assert.equal(makeBoardFen(encoded.board), makeBoardFen(board), `${n}: independent board transformation`);
      assert.equal(encoded.halfmoves, half, `${n}: halfmove clock`);
      assert.equal(encoded.fullmoves, full, `${n}: fullmove clock`);
      assert.equal(encoded.turn, fenTurn);
    }
  }
  const final = replayTrace(trace);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10);
  assert.equal(final.fen, '2b2k2/nR1p3R/1qp2Np1/p3p1p1/KbPQ3p/1p5P/PP4B1/rNBr4 b - - 5 27');
  assert.equal(final.pieces.filter(p => p.zone === 'captured').length, 5);
  assert.ok(!final.pendingRescue && !final.pendingAbduction);
});
