import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';

// Independently reviewed against rules §§8–13, 16, 22.4 and cards.md.
const rationales = [
  '1. b2-b3 advances one empty square; e1 remains shielded; pawn clock resets.',
  '2. White ends its completed move; Black receives a fresh turn, board unchanged.',
  '3. c7-c5 crosses empty c6, creates c6 en passant and advances Black fullmove.',
  '4. Challenge names movable enemy knight b1, excludes no royal; after-move card draws Tournament.',
  '5. Challenge survives into White turn; c6 en passant remains until White moves.',
  '6. b1-a3 is a knight jump satisfying Challenge; effect and c6 opportunity expire.',
  '7. White hands over with its King safe behind d2 and e2.',
  '8. Queen d8-a5 traverses c7,b6; no capture and Black King stays safe.',
  '9. Black ends; queen a5 is blocked from e1 by d2.',
  '10. f2-f3 enters empty f3, retains e1 safety and resets clock.',
  '11. White ends without spending or drawing a card.',
  '12. d7-d6 advances into empty d6 without exposing e8.',
  '13. Black ends; no effect, hand, or board change.',
  '14. g2-g3 advances one empty square; no check on e1.',
  '15. White ends its pawn move, preserving all identities.',
  '16. Queen a5-b6 is one diagonal step with no capture.',
  '17. Black hands over safely; queen diagonal still blocked.',
  '18. Rook a1-b1 uses the vacated knight square and loses queenside rights.',
  '19. White ends, leaving only its kingside right.',
  '20. Bishop c8-d7 enters the square vacated by d-pawn.',
  '21. Black ends with no draw or discard.',
  '22. Bishop c1-b2 enters the square vacated by b-pawn.',
  '23. White ends its quiet bishop move.',
  '24. h7-h5 crosses empty h6; h6 en passant opens; Black clock resets.',
  '25. Black ends, preserving the immediate h6 opportunity.',
  '26. Bishop b2-c1 reverses its diagonal move; h6 opportunity expires.',
  '27. White ends, no remaining temporary effects.',
  '28. a7-a6 advances into empty a6 without exposing e8.',
  '29. Rebirth returns opposing g-pawn from g3 to empty f2, a valid white pawn start; draw Resurrection.',
  '30. Black ends after Rebirth; g-pawn identity remains distinct from pawn f3.',
  '31. Onslaught selects only pawn c2; c3 initially empty; replaces move and draws Dubbing.',
  '32. White ends after replacement move; no extra regular move is granted.',
  '33. Queen b6-b4 crosses empty b5; b3 pawn stops further attack.',
  '34. Black ends its safe queen move.',
  '35. Queen d1-c2 enters the newly vacated diagonal square.',
  '36. White ends with e1 protected by its pawns.',
  '37. Queen b4-a5 moves one diagonal square without capturing.',
  '38. Black ends, all hands and effects unchanged.',
  '39. Original f-pawn f3-f4 advances into empty f4.',
  '40. White ends; the reborn g-pawn remains f2.',
  '41. Queen a5xa3 passes empty a4 and captures original b1 knight, not the a2 pawn.',
  '42. Black ends, captured knight remains recoverable.',
  '43. Reborn g-pawn f2-f3 moves normally in its current file; e1 remains safe.',
  '44. White ends, preserving both distinct f-file pawns.',
  '45. f7-f6 advances one square, no checking line exposed yet.',
  '46. Black ends without a card.',
  '47. Queen c2-g6 crosses d3,e4,f5; f7 was vacated at step45, so g6-f7-e8 gives check.',
  '48. White ends giving Black its escape turn from the queen diagonal.',
  '49. f6-f5 does not answer g6-f7-e8 check alone; §11.6 allows provisional move with Dungeon rescue pending.',
  '50. Dungeon relocates checking enemy queen g6 to empty corner a1, restores e8 safety and freezes queen next White turn; draw Heresy.',
  '51. Black ends only after the pending rescue is cured; Dungeon survives.',
  '52. h2-h3 moves a pawn while imprisoned queen a1 remains still.',
  '53. Cowardice sends Black f5-f7 backward through empty f6; no clocks or rights change; draw Under Elf Hill.',
  '54. White ends its following turn and Dungeon expires.',
  '55. d6-d5 enters empty d5; no capture and no check on e8.',
  '56. Heresy moves White bishops c1-c2,f1-f2 before Black d7-c7; all orthogonal empty squares change color; f8 bishop has no empty orthogonal neighbor.',
  '57. Black ends after Heresy; bishops retain physical identity and bishop powers.',
  '58. Bishop f2xc5 crosses e3,d4 and captures Black c-pawn; e1 stays safe.',
  '59. White ends; c-pawn is captured, not dead.',
  '60. Queen a3xa2 captures White a-pawn one vertical square.',
  '61. Black ends; a2 capture leaves White King protected.',
  '62. Bishop c5-b6 moves one diagonal square, no capture.',
  '63. White ends its bishop move.',
  '64. Queen a2xb1 captures the a1 rook and checks e1 along c1,d1.',
  '65. Treason swaps opposing rook h1 and knight g1 without capture or extra move; check already exists and White can escape f2; draw Lost Castle.',
  '66. Black ends, White receives the check escape turn.',
  '67. King e1-f2 leaves queen b1 rank; f2 is empty and unattacked; both White rights removed.',
  '68. White ends after its safe King move.',
  '69. Tournament swaps Black b8 knight with White h1 knight as replacement; h1 knight checks f2 but White has escapes, so no direct mate; draw Long Jump.',
  '70. Black ends replacement move, no ordinary move follows.',
  '71. Under Elf Hill removes White royal f2 to away and escapes knight check; consumes move, draws Disintegration.',
  '72. White ends; its King remains away through Black turn.',
  '73. Queen b1-d1 crosses empty c1; absent White King is not threatened.',
  '74. Black ends and mandatory White King return becomes due.',
  '75. Same King returns to empty edge a4, safe because c2 bishop blocks queen d1 diagonal and a6 pawn blocks rook; no clock, draw, or move consumed.',
  '76. Bishop c2-f5 crosses d3,e4; b3 pawn now blocks queen d1-c2-b3-a4; returned King stays still.',
  '77. White ends; return immobility expires and King remains a4.',
  '78. e7-e5 crosses empty e6, establishes e6 en passant and clears bishop f8 diagonal.',
  '79. Black ends with e6 opportunity intact.',
  '80. Rook g1xg7 crosses empty g2–g6, captures Black g-pawn and expires e6 en passant.',
  '81. Disintegration on b3 would expose queen d1-c2-b3-a4 to White King; §11.6 fizzles board but spends and draws Knightmare.',
  '82. White ends with b3 pawn alive on board and no pending check.',
  '83. Bishop f8-c5 crosses e7,d6; Black King e8 stays protected.',
  '84. Black ends its quiet bishop move.',
  '85. Bishop f5-d3 crosses empty e4; White King a4 remains safe.',
  '86. White ends without card spending.',
  '87. Tournament knight h1-g3 makes legal L jump to empty square.',
  '88. Black ends; knight g3 does not attack King a4.',
  '89. Bishop d3-f5 crosses e4; no King line uncovered.',
  '90. White ends, preserving hand and deck.',
  '91. Knight g8-f6 makes legal L jump; no capture.',
  '92. Black ends its knight move.',
  '93. Bishop b6xc5 captures Black f8 bishop one diagonal step.',
  '94. White ends; captured bishop retains original identity.',
  '95. Rook h8-f8 crosses vacated g8 and removes Black kingside right.',
  '96. Black ends, retaining queenside right only.',
  '97. Bishop f5-d3 crosses e4, no capture.',
  '98. White ends its bishop move.',
  '99. b7-b5 crosses vacated b6; Black pawn now checks White King a4; b6 en passant opens.',
  '100. Black ends, handing White the pawn-check escape turn.',
  '101. King a4-b4 escapes b5 pawn attack; b4 is safe, c5 bishop blocks d6 diagonal later; en passant expires.',
  '102. White ends with King safely b4.',
  '103. Bishop c7-d6 moves one diagonal step; White c5 bishop blocks attack on b4.',
  '104. Black ends; no check through occupied c5.',
  '105. White original g1 knight b8xa6 captures Black a-pawn by L jump; King b4 remains safe.',
  '106. White ends; a-pawn is recoverably captured.',
  '107. Bishop d6-c7 returns diagonally without capture.',
  '108. Black ends its bishop move.',
  '109. Queen a1-a2 moves vertically to empty square; Dungeon expired long ago.',
  '110. White ends without drawing.',
  '111. Queen d1-c2 moves diagonally; White King b4 is not on its line.',
  '112. Black ends, saving queen movement as Doppelganger reference.',
  '113. Doppelganger lets White bishop d3-d4 copy last opposing Queen geometry without capture; keeps bishop identity, consumes move and draws Split Knight.',
  '114. White ends its replacement move; no second move.',
  '115. Resurrection returns captured Black original g-pawn to empty b7, a valid pawn start; consumes move, resets pawn clock, draws Truce.',
  '116. Black ends; restored pawn and existing b5 pawn are separate identities.',
  '117. Rook g7-g8 moves one vertical square; Black rook f8 blocks line to e8; White King b4 safe.',
  '118. White ends the fiftieth regular move, Black to act; no unresolved effects or rescue.',
];

test('iteration 048 deterministic trace', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/048.json', import.meta.url), 'utf8'));
  assert.equal(trace.seed, 860048);
  assert.equal(rationales.length, trace.steps.length);
  rationales.forEach((reason, i) => assert.ok(reason.startsWith(`${i + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 12);
  assert.equal(replayTrace(trace).fen, 'r3krR1/1pb2p2/N4n2/1pBpp2p/1K1B1P2/1PP2PnP/Q1qPP3/8 b q - 1 28');

  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    const piece = (id: string) => state.pieces.find(piece => piece.id === id)!;
    if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.players, before.players);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
    }
    if (action.type === 'playCard') {
      assert.ok(typeof action.cardId === 'string');
      const owner = before.turn.color;
      const card = before.players[owner].hand.find(card => card.id === action.cardInstanceId)!;
      assert.ok(card);
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(before.turn.phase));
      assert.equal(state.players[owner].deck.length, before.players[owner].deck.length - 1);
      assert.equal(state.players[owner].hand.length, 5);
      assert.deepEqual(state.players[owner].hand.at(-1), before.players[owner].deck[0]);
      assert.deepEqual(state.players[owner].discard.at(-1), card);
      assert.equal(state.turn.cardPlays[owner], 1);
      if (before.turn.phase === 'afterMove') {
        const suffix = before.fen.split(' ').slice(1).join(' ');
        assert.equal(state.fen.split(' ').slice(1).join(' '), action.cardId === 'treason' ? suffix.replace(' Kkq ', ' Hkq ') : suffix);
      }
    }
    switch (index + 1) {
      case 3: assert.deepEqual(state.enPassant, [{ target: 'c6', pawnId: 'black-pawn-c7' }]); break;
      case 4: assert.deepEqual(state.effects, [{ type: 'challenge', owner: 'black', player: 'white', pieceId: 'white-knight-b1' }]); break;
      case 6: assert.deepEqual(state.effects, []); assert.deepEqual(state.enPassant, []); break;
      case 29: assert.equal(piece('white-pawn-g2').square, 'f2'); assert.equal(piece('white-pawn-f2').square, 'f3'); break;
      case 31: assert.equal(piece('white-pawn-c2').square, 'c3'); assert.equal(state.turn.moveMade, true); break;
      case 49: assert.ok(state.pendingRescue); break;
      case 50:
        assert.equal(piece('white-queen-d1').square, 'a1'); assert.ok(!state.pendingRescue);
        assert.deepEqual(state.effects, [{ type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-queen-d1' }]); break;
      case 53: assert.equal(piece('black-pawn-f7').square, 'f7'); break;
      case 54: assert.deepEqual(state.effects, []); break;
      case 56:
        assert.deepEqual(['white-bishop-c1', 'white-bishop-f1', 'black-bishop-c8', 'black-bishop-f8'].map(id => piece(id).square), ['c2', 'f2', 'c7', 'f8']); break;
      case 65: assert.equal(piece('white-rook-h1').square, 'g1'); assert.equal(piece('white-knight-g1').square, 'h1'); break;
      case 69: assert.equal(piece('white-knight-g1').square, 'b8'); assert.equal(piece('black-knight-b8').square, 'h1'); break;
      case 71: assert.equal(piece('white-king-e1').zone, 'away'); assert.equal(piece('white-king-e1').square, null); break;
      case 74: assert.deepEqual(state.underElfHill, [{ pieceId: 'white-king-e1', player: 'white', returning: true }]); break;
      case 75:
        assert.equal(piece('white-king-e1').square, 'a4'); assert.equal(state.turn.moveMade, false);
        assert.deepEqual(state.players, before.players); assert.equal(state.fen.split(' ').slice(1).join(' '), before.fen.split(' ').slice(1).join(' ')); break;
      case 77: assert.deepEqual(state.underElfHill, []); break;
      case 81:
        assert.deepEqual(state.pieces, before.pieces); assert.equal(piece('white-pawn-b2').square, 'b3');
        assert.equal(state.fen, before.fen); break;
      case 99: assert.deepEqual(state.enPassant, [{ target: 'b6', pawnId: 'black-pawn-b7' }]); break;
      case 113: assert.equal(piece('white-bishop-c1').square, 'd4'); assert.equal(piece('white-bishop-c1').role, 'bishop'); break;
      case 115: assert.equal(piece('black-pawn-g7').square, 'b7'); assert.equal(piece('black-pawn-b7').square, 'b5'); break;
    }
  }
});
