import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { parseFen, makeBoardFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';

// Reviewed sequentially against rules §§8–13, 15.3/15.5, 18.1, 21.2,
// 22.6–22.8, cards.md, and CARD_CATALOG printed timing/classification metadata.
const rationale = [
  '1. f2-f4 crosses empty f3; e1/e8 safe; pawn clock resets and f3 EP is recorded.',
  '2. White ends; Black starts with unchanged board/clocks and f3 EP.',
  '3. Black Ghostwalk Qd8-h4 crosses its own e7 Pawn and empty f6/g5; empty h4 gives check along g3-f2-e1, escapable by g3; spend/draw, consume move, clear EP, 1/2 clocks.',
  '4. Black ends with e8 safe; White receives the Qh4 check response turn.',
  '5. Dubbing Pe2-d4 has Knight geometry but cannot answer Qh4-g3-f2-e1; fizzle spends/draws, restores e2, preserves checked White move and clocks.',
  '6. g2-g3 advances to empty g3 and blocks Qh4-e1; pawn reset.',
  '7. White ends after blocking check; allowance resets for Black.',
  '8. Nb8-a6 jumps to empty a6; Black e8 remains safe; 1/3 clocks.',
  '9. Black ends; White begins with unchanged position.',
  '10. a2-a4 crosses empty a3; g3 still blocks Qh4-e1; reset clock and record a3 EP.',
  '11. White ends; a3 EP lasts into Black turn.',
  '12. Qh4xh2 crosses empty h3 and captures physical h2 Pawn; e8 safe; EP clears and clock resets.',
  '13. Black ends; Qh2 does not check e1 and e2 blocks its second-rank ray.',
  '14. Ra1-a3 passes empty a2; e1 safe; White queenside castling right removed, halfmove 1.',
  '15. White ends; board and lost queenside right persist.',
  '16. Qh2xe2 crosses empty g2/f2, captures e2 Pawn and checks adjacent e1; Black e8 safe, clocks 0/5.',
  '17. Black ends; White has Qd1xe2 to answer check.',
  '18. Onslaught d2-d3/f4-f5/g3-g4 uses empty forward squares but leaves Qe2 checking e1; fizzle restores all Pawns, spends/draws, retains White move.',
  '19. Qd1xe2 captures the checking Queen by one diagonal step; e1 safe, reset clock.',
  '20. White ends; both royals safe and card allowances reset.',
  '21. Haunting Memories copies last declared nonunique Onslaught despite its fizzle; c7-c6/g7-g6 are empty one-step advances; e8 safe, reset clock/fullmove 6, spend/draw.',
  '22. Black ends after replacement move; no extra Regular Move or EP.',
  '23. Bf1-h3 crosses vacated g2 to empty h3; e1 safe, halfmove 1.',
  '24. White ends; both royals remain safe.',
  '25. e7-e6 is empty forward step; Qe2-e8 ray remains blocked at e6; pawn reset/fullmove 7.',
  '26. Black ends with e8 protected from Qe2 by e6 Pawn.',
  '27. Bh3-f1 crosses empty g2 back to empty f1; e1 safe, halfmove 1.',
  '28. White ends, no effect or card changes.',
  '29. d7-d5 crosses empty d6; e6 still blocks Qe2-e8; reset clock and record d6 EP.',
  '30. Black ends; d6 EP remains available for the immediate White turn.',
  '31. Qe2-g4 crosses empty f3; White e1 safe; Qg4 does not align with e8; EP clears, halfmove 1.',
  '32. White ends with unchanged hand and board.',
  '33. Na6-b8 jumps to vacant original square; Black e8 safe; clocks 2/9.',
  '34. Black ends; no card or effect changes.',
  '35. b2-b3 is empty forward step; e1 safe, pawn clock resets.',
  '36. White ends; Black receives its normal move.',
  '37. Ng8-e7 jumps to empty e7; e8 safe, clocks 1/10.',
  '38. Black plays continuing Vendetta after its move; no displacement/clocks; physical card stays active and replacement draws Winged Victory.',
  '39. Black ends; White has legal Rh1xh7 and Qg4xe6 captures, so Vendetta persists.',
  '40. Rh1xh7 crosses vacant h2-h6 and takes h7 Pawn, satisfying Vendetta; White last castling right revoked; e1 safe, reset clock.',
  '41. White ends; Black has Rh8xh7, keeping Vendetta active.',
  '42. Rh8xh7 captures invading White Rook, satisfying Vendetta; e8 safe, Black kingside right lost, clocks 0/11.',
  '43. Black ends; White Qg4xe6 is available and Vendetta persists.',
  '44. Qg4xe6 passes vacant f5 to capture e6 Pawn; e1 safe, e7 Knight blocks Queen file to e8; reset clock.',
  '45. White ends; Black f7xe6 can legally capture the Queen.',
  '46. f7xe6 takes White Queen diagonally; Black e8 safe with e7 Knight still present, reset/fullmove 12.',
  '47. Black ends; White has no captures: Ra3 hemmed by a4/b3, Bc1 by d2/a3, Bf1 rays and both Knight destinations have no enemy; Vendetta discards.',
  '48. Bf1-e2 is an empty diagonal step, now permitted without capture; e1 safe; halfmove 1.',
  '49. White ends with Vendetta absent.',
  '50. Rh7-g7 is an empty horizontal step; e8 safe; clocks 2/13.',
  '51. Black ends; no card/effect changes.',
  '52. Ke1-f2 steps to empty f2, outside enemy Knight/Pawn attacks; black Bishops do not align with f2; halfmove 3.',
  '53. White ends with Kf2 safe.',
  '54. Ne7-f5 jumps to empty f5; e8 safe, clocks 4/14.',
  '55. Black ends; Nf5 does not attack f2.',
  '56. Be2-g4 crosses empty f3; Kf2 safe, halfmove 5.',
  '57. White ends; Bg4 ray toward e6 is blocked by Nf5.',
  '58. Resurrection returns captured black original e7 Pawn to vacant second-rank d7; no capture or promotion, e8 safe; spend/draw, consume move, reset/fullmove 15.',
  '59. Black ends; returned physical Pawn and lost castling rights persist.',
  '60. Nb1-c3 jumps to empty c3; Kf2 safe; halfmove 1.',
  '61. Immediate Black Knightmare cancels Nb1-c3, restores b1 and 0/15 clocks, requires different move; only Black card is spent/replaced.',
  '62. c2-c3 is a different physical Pawn move to vacant c3 after rollback; Kf2 safe, reset clock.',
  '63. White ends after replacement, resetting Black reaction allowance for its own turn.',
  '64. Rg7-h7 takes one empty horizontal step; e8 safe; clocks 1/16.',
  '65. Black ends; hands and effects unchanged.',
  '66. Bc1-b2 is empty diagonal step; Kf2 safe; halfmove 2.',
  '67. White ends; b2 Bishop is blocked northeast by own c3 Pawn.',
  '68. Nf5-h6 jumps to vacant h6; e8 safe because g4 Bishop ray meets e6 Pawn; clocks 3/17.',
  '69. Black ends; Nh6 does not attack f2.',
  '70. Kf2-g2 moves to empty safe g2; black Bishops do not align with g2 and Nh6 is too far; halfmove 4.',
  '71. White ends; g2 safe and allowances reset.',
  '72. Ke8-e7 steps onto vacant safe e7; Bg4 is not aligned with e7, Bb2 is blocked by c3; Black last castling right lost, clocks 5/18.',
  '73. Black ends with e7 safe.',
  '74. Kg2-f3 steps to empty safe f3; Nh6 cannot reach it and black Bishops have no f3 diagonal; halfmove 6.',
  '75. White ends with f3 safe.',
  '76. a7-a5 crosses empty a6; e7 safe; reset/fullmove 19 and record a6 EP.',
  '77. Black ends; a6 EP retained for White.',
  '78. Bg4-h3 is an empty diagonal retreat; Kf3 safe; EP clears and halfmove 1.',
  '79. White ends; no card/effect changes.',
  '80. c6-c5 advances to empty c5; e7 safe; reset/fullmove 20.',
  '81. After-move Coup marks returned Pawn d7 as royal and makes original King e7 a Prince; neither moves, d7 is unattacked; card active, spend/draw, clocks unchanged.',
  '82. Black ends; royal d7 and Prince e7 identities persist.',
  '83. Bh3-f1 passes empty g2; White Kf3 safe; black royal d7 remains safe; halfmove 1.',
  '84. White ends; Coup stays active.',
  '85. Nh6-f5 jumps to empty f5; d7 royal Pawn remains safe and its Pawn powers unchanged; clocks 2/21.',
  '86. Black ends; Nf5 does not check White Kf3.',
  '87. d2-d4 crosses empty d3; White Kf3 safe; reset and record d3 EP.',
  '88. Peace Talks cancels physical Coup while Prince e7 survives safely; restore e7 royal and d7 nonroyal, discard Coup and Peace Talks, draw Curse; board/clocks/EP unchanged.',
  '89. White ends; ordinary Black King e7 restored safely; d3 EP retained.',
  '90. Ke7-d8 steps to empty safe d8; Bf1 does not align with d8 and Bb2 is blocked by own c3 Pawn; clocks 1/22, EP clears.',
  '91. Black ends; d8 safe.',
  '92. Bf1-d3 crosses vacant e2; Kf3 safe; halfmove 2.',
  '93. White ends; both Kings safe.',
  '94. Rh7-h5 crosses empty h6; Kd8 safe; clocks 3/23.',
  '95. Black ends; Rh5 does not attack Kf3.',
  '96. White Ghostwalk Bb2-f6 crosses own c3/d4 and empty e5; vacant f6 checks Kd8 through e7, but Be7 is an escape; Kf3 safe; spend/draw, replacement move, halfmove 4.',
  '97. Black immediately plays Vulture: takes physical White Ghostwalk from discard, discards top undrawn Bombard, spends Vulture, draws Peace Talks; six cards, deck -2, board/clocks unchanged.',
  '98. White ends; Black gets checked turn and a fresh own-turn card allowance.',
  '99. Bf8-d6 passes empty e7 but leaves Bf6-e7-d8 check; §11.6 permits pending rescue because held Crusade can return same Bishop to e7; no capture, clocks 5/24.',
  '100. Immediate Crusade moves same quiet-move Bishop d6-e7, blocking Bf6-d8; Black safe, White Kf3 not aligned with Be7; spend/draw, no second clock increment or extra Regular Move.',
  '101. Black ends only after Crusade clears pending rescue.',
  '102. Bd3-e4 advances one empty diagonal square; Kf3 safe, halfmove 6.',
  '103. White ends; e7 Bishop still blocks Bf6-d8.',
  '104. Winged Victory returns captured black h7 Pawn to empty central e5; Kd8 safe and White Kf3 not checked; spend/draw, replacement move, reset/fullmove 25.',
  '105. Black ends; returned Pawn keeps physical h7 identity.',
  '106. f4xe5 captures that returned h7 Pawn by forward diagonal; Kf3 safe, reset clock.',
  '107. White ends; no card/effect changes.',
  '108. Black uses stolen physical White Ghostwalk for Rh5-h3 through empty h4 to empty h3; g3 Pawn blocks rook toward Kf3; Kd8 safe, spend/draw, clocks 1/26.',
  '109. Black ends with no check on White because g3 remains occupied.',
  '110. Kf3-f4 steps to vacant f4; Nf5 attacks d4/d6/e3/e7/g3/g7/h4/h6, not f4; Pawn e6 attacks f5, not f4; halfmove 2.',
  '111. White ends with f4 safe.',
  '112. Rh3-h8 crosses empty h4-h7; Kd8 safe; original Rook identity preserved and no castling right restored, clocks 3/27.',
  '113. Black ends; h8 Rook does not check f4.',
  '114. Ng1-h3 jumps to vacant h3; Kf4 safe, halfmove 4.',
  '115. White ends; Knight h3 identity preserved.',
  '116. Nf5-h6 jumps to empty h6; Kd8 safe with Be7 interposed against Bf6; clocks 5/28.',
  '117. Black ends; Nh6 does not attack Kf4.',
  '118. Kf4-g5 steps to empty g5; Nh6 attacks f5/f7/g4/g8, g6 Pawn attacks f5/h5; Be7-g5 ray is blocked by White Bf6; halfmove 6.',
  '119. White ends with Kg5 safe; Black begins move 28, no pending obligations, all 50 move commands reviewed.',
];

test('iteration 080 deterministic semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/080.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860080);
  assert.equal(rationale.length, 119);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((line, i) => assert.ok(line.startsWith(`${i + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 14);
  const states: GameState[] = [createGameState(trace.initial)];
  const cardMoves: Record<number, Array<[string, string]>> = {
    3: [['d8', 'h4']], 21: [['c7', 'c6'], ['g7', 'g6']],
    61: [['c3', 'b1']], 96: [['b2', 'f6']], 100: [['d6', 'e7']], 108: [['h5', 'h3']],
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const before = states.at(-1)!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationale[index]);
    const after = result.state;
    states.push(after);
    const expectedPieces = structuredClone(before.pieces);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      // Coup changes royalty for steps 83/85/87, but neither the old nor new
      // royal is threatened in these reviewed positions. Ordinary geometry applies.
      assert.equal(position.isLegal(move), step !== 99, rationale[index]);
      position.play(move);
      assert.equal(makeBoardFen(position.board), after.fen.split(' ')[0], rationale[index]);
      const mover = expectedPieces.find(piece => piece.square === action.from)!;
      const victim = expectedPieces.find(piece => piece.square === action.to);
      if (victim) { victim.square = null; victim.zone = 'captured'; victim.capturedBy = before.turn.color; }
      assert.match(action.to, /^[a-h][1-8]$/);
      mover.square = action.to as SquareName;
      const oldFen = before.fen.split(' ');
      const newFen = after.fen.split(' ');
      assert.equal(Number(newFen[4]), mover.role === 'pawn' || victim ? 0 : Number(oldFen[4]) + 1);
      assert.equal(Number(newFen[5]), Number(oldFen[5]) + Number(before.turn.color === 'black'));
      const doublePawn = mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2;
      assert.deepEqual(after.enPassant, doublePawn ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : []);
      assert.deepEqual(after.players, before.players);
      assert.deepEqual(after.turn, { ...before.turn, phase: 'afterMove', moveMade: true });
      if ([40, 42, 44, 46].includes(step)) assert.ok(victim, 'Vendetta requires these legal captures');
    } else if (action.type === 'endTurn') {
      assert.equal(after.fen, before.fen);
      assert.deepEqual(after.enPassant, before.enPassant);
      assert.deepEqual(after.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
      if (step !== 47) assert.deepEqual(after.players, before.players);
    } else if (action.type === 'playCard') {
      for (const [from, to] of cardMoves[step] ?? []) {
        const piece = expectedPieces.find(item => item.square === from)!;
        assert.ok(piece, rationale[index]);
        assert.ok(!expectedPieces.some(item => item.square === to));
        assert.match(to, /^[a-h][1-8]$/);
        piece.square = to as SquareName;
      }
      if (step === 58 || step === 104) {
        const piece = expectedPieces.find(item => item.id === (step === 58 ? 'black-pawn-e7' : 'black-pawn-h7'))!;
        assert.equal(piece.zone, 'captured');
        piece.square = step === 58 ? 'd7' : 'e5';
        piece.zone = 'board';
        delete piece.capturedBy;
      }
      if (step === 81 || step === 88) {
        expectedPieces.find(piece => piece.id === 'black-king-e8')!.royal = step === 88;
        expectedPieces.find(piece => piece.id === 'black-pawn-e7')!.royal = step === 81;
      }
      const owner = before.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black';
      const player = before.players[owner];
      const card = player.hand.find(item => item.id === action.cardInstanceId)!;
      assert.ok(card, rationale[index]);
      assert.equal(before.turn.cardPlays[owner], 0);
      const expectedPlayers = structuredClone(before.players);
      const expectedPlayer = expectedPlayers[owner];
      expectedPlayer.hand = expectedPlayer.hand.filter(item => item.id !== card.id);
      if (step === 97) expectedPlayer.discard.push(expectedPlayer.deck.shift()!);
      if (step !== 38 && step !== 81) expectedPlayer.discard.push(card);
      expectedPlayer.hand.push(expectedPlayer.deck.shift()!);
      if (step === 97) expectedPlayer.hand.push(expectedPlayers.white.discard.pop()!);
      if (step === 88) expectedPlayers.black.discard.push({ id: 'black-deck-0-coup', cardId: 'coup' });
      assert.deepEqual(after.players, expectedPlayers, rationale[index]);
      assert.equal(after.turn.cardPlays[owner], 1);
      assert.equal(after.turn.color, before.turn.color);
      const clock: Record<number, string> = { 3: '1 2', 21: '0 6', 58: '0 15', 61: '0 15', 96: '4 23', 104: '0 25', 108: '1 26' };
      assert.equal(after.fen.split(' ').slice(4).join(' '), clock[step] ?? before.fen.split(' ').slice(4).join(' '));
      assert.equal(after.turn.moveMade, ![5, 18, 61].includes(step));
      if ([5, 18].includes(step)) assert.equal(after.fen, before.fen, 'failed card restores board and clocks');
      assert.deepEqual(after.enPassant, step === 88 ? before.enPassant : []);
    } else assert.fail(`Unreviewed action at ${step}`);
    assert.deepEqual(after.pieces, expectedPieces, rationale[index]);
    assert.equal(after.orientation, 0);
    assert.equal(after.fen.split(' ')[2], step < 14 ? 'KQkq' : step < 40 ? 'Kkq' : step < 42 ? 'kq' : step < 72 ? 'q' : '-');
    assert.equal(Boolean(after.pendingRescue), step === 99, rationale[index]);
    const vendetta = { type: 'vendetta', owner: 'black', card: { id: 'black-deck-1-vendetta', cardId: 'vendetta' } };
    const coup = { type: 'coup', owner: 'black', card: { id: 'black-deck-0-coup', cardId: 'coup' }, princeId: 'black-king-e8', kingId: 'black-pawn-e7', princeRole: 'king' };
    assert.deepEqual(after.effects, step >= 38 && step < 47 ? [vendetta] : step >= 81 && step < 88 ? [coup] : []);
  }
  assert.deepEqual(states[61]!.pieces, states[59]!.pieces, 'Knightmare physical rollback');
  const noCapture = Chess.fromSetup(parseFen(states[47]!.fen).unwrap()).unwrap();
  for (const from of noCapture.board.white) {
    assert.ok(noCapture.dests(from).intersect(noCapture.board.black).isEmpty(), 'White has no ordinary capture when Vendetta expires');
  }
  assert.deepEqual(states[47]!.players.black.discard, [...states[46]!.players.black.discard, { id: 'black-deck-1-vendetta', cardId: 'vendetta' }]);
  assert.equal(states[61]!.fen, states[59]!.fen, 'Knightmare complete FEN rollback');
  assert.ok(Chess.fromSetup(parseFen(states[99]!.fen).unwrap()).isErr, 'checked Black cannot finalize Bf8-d6 without rescue');
  const rescued = Chess.fromSetup(parseFen(states[100]!.fen).unwrap()).unwrap();
  assert.equal(rescued.isCheck(), false);
  assert.equal(states[119]!.fen, 'rnbk3r/1p1pb3/4pBpn/p1ppP1K1/P2PB3/RPP3PN/8/1N6 b - - 6 28');
  assert.equal(replayTrace(trace).fen, states[119]!.fen);
});
