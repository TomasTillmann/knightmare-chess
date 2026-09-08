import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

// Numbered, independently read in order against rules §§8–11, 13, 16–21 and
// cards.md, with printed timing/continuing metadata from CARD_CATALOG.
const rationales = [
  '1. Nb1-c3 jumps to an empty square; e1 remains screened; quiet clock 1.',
  '2. White ends the completed move; Black starts with fresh allowances.',
  '3. Nb8-a6 is a clear knight landing; e8 remains safe; Black advances fullmove.',
  '4. Black ends; board, clocks and cards remain fixed.',
  '5. Fanatic h2-h5 crosses empty h3/h4/h5; replaces move, resets clock, creates no en passant; draw Crusade.',
  '6. Fanatic already consumed the move; Black starts without another White move.',
  '7. f7-f6 is one empty forward step; no capture or check; reset clock.',
  '8. Black ends f6 turn without card expenditure.',
  '9. d2-d3 is an empty forward step, freeing d2 and retaining King safety.',
  '10. White ends; Black starts, with d3 Pawn unchanged.',
  '11. f6-f5 is a further single Pawn step; e8 stays safe.',
  '12. Black ends f5 turn; no draw without card play.',
  '13. Ra1-b1 lands on the knight-vacated square; revoke White queenside rights.',
  '14. White ends Rb1 turn; remaining castling rights stay Kkq.',
  '15. b7-b6 lands empty; a6 Knight does not obstruct the b-file.',
  '16. Black ends; no board or deck changes.',
  '17. Bc1-d2 is adjacent diagonal into the vacated Pawn square.',
  '18. White ends Bd2 turn with neither King attacked.',
  '19. e7-e5 crosses empty e6, creates physical e6 en-passant opportunity; no White adjacent captor.',
  '20. Black ends and preserves the e6 opportunity for White.',
  '21. f2-f4 crosses empty f3; replaces stale e6 opportunity with f3; neither King exposed.',
  '22. White ends and preserves f3 en-passant opportunity.',
  '23. Bombard Rh8-h6 jumps the one h7 Pawn, leaving it intact; consumes move, clears en passant, revokes k; draw Treason.',
  '24. Black ends Bombard turn; White starts with Kq rights.',
  '25. Rh1-h2 enters Fanatic-vacated square; last White castling right is lost.',
  '26. White ends Rh2 turn with only black queenside rights.',
  '27. Rh6xh5 captures physical white-pawn-h2; rook survives on h5; reset clock.',
  '28. Black ends capture; h2 Pawn stays captured, not dead.',
  '29. Nc3-e4 jumps to empty e4; e1 remains shielded.',
  '30. White ends Ne4 turn without spending a card.',
  '31. Lost Castle exchanges black Rh5 and white Rh2 identities, no capture; replacement clock +1/fullmove +1; draw Think Again.',
  '32. Black ends swap turn; the white h5 Rook and black h2 Rook retain ownership.',
  '33. Bd2-c3 is an empty adjacent diagonal; no check remains on White.',
  '34. Vendetta is legal after White move; board unchanged, continuing card stays active, draw Knightmare.',
  '35. Black starts under Vendetta with legal captures including g2.',
  '36. Rh2xg2 captures the White Pawn as Vendetta requires; black King remains safe.',
  '37. White starts under Vendetta with f4xe5 available.',
  '38. f4xe5 captures physical black-pawn-e7 diagonally and meets Vendetta.',
  '39. Rebirth after move places enemy f5 Pawn on empty starting-rank b7, preserving physical identity; clock unchanged; draw Abduction.',
  '40. Black starts with Vendetta and Rg2xg1 available.',
  '41. Rg2xg1 captures White Knight; Bf1 still screens King e1 from rook.',
  '42. White starts under Vendetta; Rh5xh7 is available.',
  '43. Rh5xh7 crosses empty h6 and captures black h7 Pawn, satisfying Vendetta.',
  '44. Black starts under Vendetta with Rg1xf1 available.',
  '45. Rg1xf1 captures Bf1 and checks White King e1; permitted ordinary checking capture.',
  '46. White gets its escape turn; Kxf1 can remove the unprotected checking rook.',
  '47. Ke1xf1 captures that rook on an unattacked square and satisfies Vendetta.',
  '48. Black has no legal capture: its blocked sliders, a6/g8 Knights and Pawns cannot take White; Vendetta expires to discard.',
  '49. Ng8-h6 is a quiet knight jump now that Vendetta ended.',
  '50. Black ends Nh6 turn; no continuing effect remains.',
  '51. Evangelists swaps white Bc3 with black Bc8 without capture; neither King checked, consumes move; draw Madman.',
  '52. White ends replacement turn; bishops retain their owners on new squares.',
  '53. Qd8xc8 captures the swapped White Bishop one square horizontally.',
  '54. Black ends queen capture; Bishop stays captured.',
  '55. Rh7xh6 captures the black g8 Knight one square downward; no King exposed.',
  '56. White ends rook capture; two black Knights now have distinct zones.',
  '57. Qc8-b8 slides one empty square horizontally; no capture.',
  '58. Black ends Qb8 turn; replacement card not played.',
  '59. Madman d3-f5 jumps diagonally over own Ne4 onto empty f5; Knight is not captured; Pawn retains role; draw Man of Straw.',
  '60. White ends the Madman replacement move.',
  '61. Bf8-e7 enters the Pawn-vacated diagonal square; Black King stays safe.',
  '62. Black ends Be7 turn, preserving all identities.',
  '63. Rh6-h7 is a quiet one-square rook move; no castling rights restored.',
  '64. White ends Rh7 turn.',
  '65. Ke8-f8 is a safe adjacent step; remove remaining black castling right.',
  '66. Black ends Kf8 turn; rights remain absent.',
  '67. Rh7-h3 passes clear h6/h5/h4 and lands empty h3.',
  '68. White ends Rh3 turn; no card or effect changes.',
  '69. Be7-h4 passes empty f6/g5; no capture; White King f1 is not on its diagonal.',
  '70. Black ends Bh4 turn.',
  '71. a2-a4 crosses empty a3, resetting Pawn clock and creating a3 opportunity.',
  '72. White ends and preserves a3 opportunity for Black.',
  '73. Qb8-c8 is a clear one-square slide; old a3 opportunity expires.',
  '74. Black ends Qc8 turn.',
  '75. e5-e6 is a quiet forward Pawn step; Black King f8 is not attacked yet.',
  '76. White ends e6 turn.',
  '77. Bc3-a5 crosses empty b4 and lands empty a5.',
  '78. Black ends Ba5 turn.',
  '79. Qd1-d6 crosses empty d2/d3/d4/d5; no self-check or capture.',
  '80. Black Think Again immediately cancels Qd6, restoring Qd1, before-move phase and clocks; Black draws Breakthrough and spends reaction allowance.',
  '81. White instead plays Rh3-h1 through empty h2; different physical move satisfies cancellation restriction.',
  '82. White Truce after its replacement move leaves board and clocks fixed, activates capture prohibition; draw Assassin.',
  '83. White ends; both spent current-turn allowances reset for Black.',
  '84. Qc8-d8 is quiet and creates no King attack, so Truce continues.',
  '85. Black Man-Trap secretly marks its occupied Ba5 square after move; Truce allows creation, not captures; draw Vulture.',
  '86. Black ends with Truce and untouched a5 trap active.',
  '87. c2-c4 crosses empty c3, creates c3 opportunity; quiet move permitted during Truce.',
  '88. White ends; c3 opportunity remains available for next move.',
  '89. Qd8-c8 is quiet, expires c3 opportunity, and does not check a King.',
  '90. Black ends; Truce and a5 trap remain.',
  '91. Ne4-g3 is a quiet jump; neither King attacked, Truce remains.',
  '92. White ends Ng3 turn.',
  '93. Na6-c5 jumps to empty c5 without capture; Truce remains.',
  '94. Black ends Nc5 turn.',
  '95. e6-e7 creates a Pawn attack on Kf8; Truce immediately expires and goes to White discard; trap unchanged.',
  '96. White ends; Black receives check escape turn.',
  '97. Kf8xe7 captures checking Pawn on an unattacked square; clock resets.',
  '98. Treason after move swaps White Rh1 and Ng3 simultaneously, preserving ownership; no capture/check; draw Dark Mirror.',
  '99. Black ends Treason turn; no arrival on a5 so trap stays.',
  '100. Assassin Qd1xa4 passes empty c2/b3 and captures own a4 Pawn; consumes move and resets clock; a4 is not a5 trap; draw Tournament.',
  '101. White ends Assassin turn with own Pawn captured, not dead.',
  '102. c7-c6 is a quiet forward Pawn step; King e7 remains safe.',
  '103. Black ends c6 turn.',
  '104. Kf1-g2 is safe: Bh4 reaches f2 via g3, not g2; Ba5 line ends toward e1; knight c5 cannot reach g2.',
  '105. White ends Kg2 turn with a5 trap untriggered.',
  '106. g7-g5 crosses empty g6; white f5 Pawn can capture en passant at g6; reset clock.',
  '107. Black ends and preserves the genuine g6 opportunity.',
  '108. Tournament swaps White Nh1 with Black Nc5 without capture; clears g6 en passant, consumes move; neither King checked; draw Legacy.',
  '109. White ends Knight swap; a5 trap remains square-bound.',
  '110. Qc8-h8 crosses clear d8/e8/f8/g8; no check on White g2.',
  '111. Black ends Qh8 turn.',
  '112. Qa4-b4 is a quiet horizontal step; does not enter trapped a5.',
  '113. Abduction after move removes opposing d7 Pawn to away, preserving clock and concealing target in history; draw Blessing.',
  '114. Reveal moves concealment to recall only; no board, clock, allowance or card movement.',
  '115. Recall timeout captures d7 Pawn from away and resets clock; no self-check or direct mate, no second draw.',
  '116. White ends resolved challenge; no pending Abduction remains.',
  '117. Black Blessing moves g5 Pawn diagonally via empty f4/e3 to empty d2; no capture/promotion, consumes move; draw Knightmare.',
  '118. Black ends replacement move; Pawn retains identity at d2.',
  '119. White Blessing moves Rg3-d6 via empty f4/e5, landing empty; Rook keeps ordinary future movement, consumes move; draw Siege.',
  '120. White ends Blessing turn; Kg2 remains safe after rook departure.',
  '121. Ra8-e8 crosses clear b8/c8/d8; quiet rook move and no King exposed.',
  '122. Black ends Re8 turn; cards and trap unchanged.',
  '123. Rd6xc6 captures physical black-pawn-c7 one square horizontally; resets clock.',
  '124. White ends c6 capture; trap a5 is untouched.',
  '125. Ke7-d8 is a safe adjacent diagonal; Rc6 does not attack d8 and Nc5 attacks d7/e6, not d8.',
  '126. Black ends regular move 50; White starts, all pending choices closed, only the a5 trap remains.',
];

test('iteration 053 independently reviewed deterministic campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/053.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860053);
  assert.equal(trace.failure, undefined);
  assert.equal(rationales.length, 126);
  assert.equal(trace.steps.length, rationales.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 16);
  const relocations: Record<number, Array<[string, string | null, 'board' | 'captured' | 'away']>> = {
    5: [['white-pawn-h2', 'h5', 'board']],
    23: [['black-rook-h8', 'h6', 'board']],
    31: [['black-rook-h8', 'h2', 'board'], ['white-rook-h1', 'h5', 'board']],
    39: [['black-pawn-f7', 'b7', 'board']],
    51: [['white-bishop-c1', 'c8', 'board'], ['black-bishop-c8', 'c3', 'board']],
    59: [['white-pawn-d2', 'f5', 'board']],
    80: [['white-queen-d1', 'd1', 'board']],
    98: [['white-rook-h1', 'g3', 'board'], ['white-knight-b1', 'h1', 'board']],
    100: [['white-queen-d1', 'a4', 'board'], ['white-pawn-a2', null, 'captured']],
    108: [['white-knight-b1', 'c5', 'board'], ['black-knight-b8', 'h1', 'board']],
    113: [['black-pawn-d7', null, 'away']],
    115: [['black-pawn-d7', null, 'captured']],
    117: [['black-pawn-g7', 'd2', 'board']],
    119: [['white-rook-h1', 'd6', 'board']],
  };
  const replacements = new Set([5, 23, 31, 51, 59, 100, 108, 117, 119]);
  let state = createGameState(trace.initial);
  let ep = state.enPassant;
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    const why = rationales[index]!;
    assert.ok(why.startsWith(`${n}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    state = result.state;
    const priorFen = parseFen(before.fen).unwrap();
    const nextFen = parseFen(state.fen).unwrap();
    const expectedPieces = structuredClone(before.pieces);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const position = Chess.fromSetup(priorFen).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.ok(position.isLegal(move), why);
      const victim = expectedPieces.find(p => p.zone === 'board' && p.square === action.to);
      const mover = expectedPieces.find(p => p.zone === 'board' && p.square === action.from)!;
      if (n >= 36 && n <= 47) assert.ok(victim, 'Vendetta requires capture');
      if (n >= 84 && n <= 95) assert.equal(victim, undefined, 'Truce forbids captures');
      if (victim) { victim.square = null; victim.zone = 'captured'; }
      mover.square = action.to as typeof mover.square;
      position.play(move);
      assert.equal(makeBoardFen(position.board), nextFen.board && makeBoardFen(nextFen.board), why);
      assert.equal(nextFen.halfmoves, position.halfmoves, why);
      assert.equal(nextFen.fullmoves, position.fullmoves, why);
      assert.equal(nextFen.turn, position.turn, why);
      assert.deepEqual(nextFen.castlingRights, position.castles.castlingRights, why);
      assert.equal(state.turn.color, before.turn.color, why);
      assert.equal(state.turn.phase, 'afterMove', why);
      assert.equal(state.turn.moveMade, true, why);
      ep = mover.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2
        ? [{ target: `${action.from[0]}${(Number(action.to[1]) + Number(action.from[1])) / 2}` as 'a3', pawnId: mover.id }]
        : [];
    } else {
      for (const [id, square, zone] of relocations[n] ?? []) {
        const piece = expectedPieces.find(p => p.id === id)!;
        piece.square = square as typeof piece.square;
        piece.zone = zone;
      }
      if (replacements.has(n)) {
        assert.equal(state.turn.phase, 'afterMove', why);
        assert.equal(state.turn.moveMade, true, why);
        assert.equal(nextFen.turn, before.turn.color === 'white' ? 'black' : 'white', why);
        assert.equal(nextFen.fullmoves, priorFen.fullmoves + Number(before.turn.color === 'black'), why);
        assert.equal(nextFen.halfmoves, [5, 59, 100, 117].includes(n) ? 0 : priorFen.halfmoves + 1, why);
        ep = [];
      } else if (n === 80) {
        assert.equal(state.fen, 'r1q2k2/pppp2p1/np2P3/b4P2/P3N2b/7R/1PP1P3/1R1Q1K2 w - - 1 20', why);
        assert.equal(state.turn.phase, 'beforeMove', why);
        assert.equal(state.turn.moveMade, false, why);
      } else {
        assert.equal(nextFen.turn, priorFen.turn, why);
        assert.equal(nextFen.fullmoves, priorFen.fullmoves, why);
        assert.equal(nextFen.halfmoves, n === 115 ? 0 : priorFen.halfmoves, why);
      }
    }
    assert.deepEqual(state.pieces, expectedPieces, why);
    assert.deepEqual(state.enPassant, ep, why);
    assert.equal(state.orientation, 0, why);
    assert.ok(!state.pendingRescue, why);
    // No special movement/check restrictions affect these reviewed positions;
    // standard setup validity independently rejects an attacked previous mover.
    const position = Chess.fromSetup(nextFen).unwrap();
    if (action.type === 'playCard' && ![34, 82, 85].includes(n)) assert.equal(position.isCheckmate(), false, why);
    const effects: unknown[] = [];
    if (n >= 34 && n < 48) effects.push({ type: 'vendetta', owner: 'white', card: { id: 'white-hand-1-vendetta', cardId: 'vendetta' } });
    if (n >= 82 && n < 95) effects.push({ type: 'truce', owner: 'white', card: { id: 'white-hand-0-truce', cardId: 'truce' } });
    if (n >= 85) effects.push({ type: 'man-trap', owner: 'black', card: { id: 'black-hand-0-man-trap', cardId: 'man-trap' }, square: 'a5' });
    assert.deepEqual(state.effects, effects, why);
    for (const color of ['white', 'black'] as const) {
      const prior = before.players[color];
      const card = action.type === 'playCard' ? prior.hand.find(c => c.id === action.cardInstanceId) : undefined;
      assert.deepEqual(state.players[color].hand, card ? [...prior.hand.filter(c => c.id !== card.id), prior.deck[0]!] : prior.hand, why);
      assert.deepEqual(state.players[color].deck, card ? prior.deck.slice(1) : prior.deck, why);
      const expired = color === 'white' && [48, 95].includes(n)
        ? [{ id: n === 48 ? 'white-hand-1-vendetta' : 'white-hand-0-truce', cardId: n === 48 ? 'vendetta' : 'truce' }] : [];
      assert.deepEqual(state.players[color].discard, [...prior.discard, ...(card && ![34, 82, 85].includes(n) ? [card] : []), ...expired], why);
      assert.equal(state.turn.cardPlays[color], action.type === 'endTurn' ? 0 : before.turn.cardPlays[color] + Number(!!card), why);
    }
    if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen, why);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', why);
      assert.equal(state.turn.phase, 'beforeMove', why);
      assert.equal(state.turn.moveMade, false, why);
    }
    if (n === 113 || n === 114) {
      assert.equal(state.pendingAbduction?.pieceId, 'black-pawn-d7', why);
      assert.equal(state.pendingAbduction?.phase, n === 113 ? 'concealment' : 'recall', why);
      assert.equal(state.history.at(-1)?.target, undefined, 'Abduction concealment must not leak target');
    } else assert.ok(!state.pendingAbduction, why);
  }
  assert.equal(state.fen, '3kr2q/pp6/1pR5/b1N2P2/1QP4b/8/1P1pP1K1/1R5n w - - 1 30');
  assert.equal(trace.moves, 50);
  assert.deepEqual(replayTrace(trace), state);
});
