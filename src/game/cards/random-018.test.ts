import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { legalDests } from '../reducer.js';

// Sequential review of every .txt row against rules.md, cards.md and catalog timing.
// Each quiet move increments the halfmove clock, each Pawn move/capture resets it;
// Black increments fullmove once per completed move. EndTurn preserves these clocks,
// resets both allowances and draws nothing. The individual exceptions are below.
const rationale = [
  '1. Nb1-c3 is an unobstructed Knight jump; both Kings remain screened.',
  '2. White closes the completed Knight move; Black receives its first turn.',
  '3. d7-d5 crosses empty d6; Pawn identity survives and d6 en passant is recorded.',
  '4. Black closes; d6 en passant survives into White’s reply.',
  '5. Nc3-e4 is an L jump to empty e4; it expires d6 en passant.',
  '6. White closes with its King still behind its Pawn line.',
  '7. g7-g5 crosses empty g6 and records that Pawn’s g6 en passant target.',
  '8. Black closes without using a card; the new en passant right remains.',
  '9. h2-h4 crosses empty h3; it replaces the expired g6 right with h3.',
  '10. White plays Plots after its move: no board/clock/EP change, one discard and pacifism draw; two immediate eligible plays open.',
  '11. Black immediately Fogs Plots: both cards stay spent, Plots allowance is removed, h2-h4 stays complete, Black draws riposte once.',
  '12. White closes; Fog restrictions reset and h3 remains available for Black.',
  '13. Black g5xh4 is a forward diagonal ordinary capture of white-pawn-h2, not en passant; EP expires.',
  '14. Black’s after-move Neutrality legally marks opposing nonroyal Ra1; retains card, draws heresy, preserves owner and clocks.',
  '15. Black closes with the neutral Rook screened from both Kings.',
  '16. White moves neutral Ra1-b1 one empty file; c1 Bishop shields Ke1, marker follows and Q castling right is lost.',
  '17. White closes; neutrality remains attached to the physical a1 Rook.',
  '18. Black Ke8-d7 enters an empty unattacked square; Ne4 attacks d6/f6 rather than d7; black castling rights disappear.',
  '19. Black closes its safe King move and passes to White.',
  '20. g2-g4 crosses empty g3; black h4 Pawn makes the g3 en passant right relevant in FEN.',
  '21. White closes; Black retains the immediate g3 en passant opportunity.',
  '22. Black controls neutral Rb1xc1 and captures its original owner’s Bishop; Qd1 shields Ke1, clocks reset and EP expires.',
  '23. Black closes after the neutral capture; captured Bishop remains captured.',
  '24. e2-e3 is a clear single Pawn advance; Qd1 still blocks the neutral Rook from Ke1.',
  '25. White closes the safe Pawn move without drawing or spending.',
  '26. Black controls neutral Rc1-a1 over empty b1; Qd1 still shields Ke1 and no castling right returns.',
  '27. Black closes; the neutral Rook stays a1 and the marker persists.',
  '28. Ng1-h3 jumps to the vacant square, preserving physical Knight identity.',
  '29. White closes; h4 Pawn attacks g3, not the White King.',
  '30. e7-e6 is a clear Black Pawn step with no promotion or en passant.',
  '31. Black closes with Kd7 safe behind its pieces.',
  '32. c2-c4 crosses empty c3; c3 en passant records the moved Pawn.',
  '33. White closes and preserves the immediate c3 en passant target.',
  '34. Black neutral Ra1-b1 moves one vacant file and expires c3 en passant.',
  '35. Black closes; Qd1 remains the line blocker shielding Ke1.',
  '36. Ne4-c5 is a clear L jump and checks Kd7; White’s King remains safe.',
  '37. Figure Dance after the move rotates h1-h8, h8-a8, a8-a1 simultaneously; empty a1 contributes nothing. Rb1 stays neutral, no capture/promotion, last White castling right is lost, draw winged-victory once.',
  '38. White may close its checking turn; Black can escape to d6, so Figure Dance did not newly mate.',
  '39. Kd7-d6 escapes Nc5’s attack onto a square attacked by no White piece; e3/f2/Pawns block Bishop lines.',
  '40. Heresy moves White Bf1-g1 first, then Black Bf8-e8, both one orthogonal color-changing step. Bc8 has b8/d8/c7 occupied, so cannot move. Spend and draw fatal-attraction once; clocks stay 3/10.',
  '41. Black closes after both required movable Bishops relocate; King remains d6 and safe.',
  '42. Nc5xb7 jumps onto and captures black-pawn-b7; White’s move is ordinary and card-free.',
  '43. Black Riposte immediately restores Pb7 and captures the attacking Knight, preserves White’s consumed move, clears EP and draws holy-war; Black owes one lost move.',
  '44. Closing White’s turn starts Black’s forfeiture automatically: afterMove, no actual moved piece, halfmove 1/fullmove 11.',
  '45. Black closes the forfeiture without a card; its single Riposte penalty is exhausted.',
  '46. e3-e4 advances to the empty square vacated by the captured Knight; no EP or promotion.',
  '47. White closes the safe Pawn turn.',
  '48. f7-f5 crosses empty f6; records f6 en passant, Pawn clock zero and Black fullmove 12.',
  '49. Black closes; f6 en passant remains for White’s immediate reply.',
  '50. Ke1-f1 enters the square cleared by Heresy; neither h4 Pawn nor blocked neutral Rb1 attacks it; EP expires.',
  '51. White closes its safe King relocation.',
  '52. Black Bishop e8-d7 moves one diagonal to the vacated d7 square; its Heresy position changes no identity.',
  '53. Black closes with Bishop d7 and King d6 distinct.',
  '54. White Rh8xg8 captures black-knight-g8 on the adjacent file; no King line is exposed.',
  '55. White Challenge marks opposing Pe6 after its move; e6-e5 is legal, so target is movable. Discard and draw treason once.',
  '56. White closes; Black begins with the physical e7 Pawn obligation.',
  '57. Blessing moves the challenged Pawn e6-f7 diagonally to empty f7 as the replacement move; satisfies Challenge, retains Pawn identity, clears obligation and draws resurrection.',
  '58. Black closes the completed Blessing replacement with no extra ordinary move.',
  '59. White Qd1-c1 steps to an empty square and continues blocking Rb1’s line to Kf1.',
  '60. White closes; no hidden or pending card choice remains.',
  '61. Black neutral Rb1xb2 captures white-pawn-b2; Qc1 still blocks black Ra1 from Kf1.',
  '62. Black closes its legal neutral capture.',
  '63. White controls neutral Rb2-b1; Qc1 shields Kf1 from both first-rank Rooks.',
  '64. White closes the quiet neutral move.',
  '65. Black Kd6-e7 is an adjacent empty safe square; Rg8 attacks rank8/fileg rather than e7.',
  '66. Black closes its King move.',
  '67. Qc1-c2 exposes neutral Rb1 along c1/d1/e1 to Kf1; this is a provisional rescue window under §11.6, not a legal completed turn.',
  '68. Treason swaps black Ra1/Nb8 but cannot remove neutral Rb1’s check: it fizzles, remains spent/draws dark-mirror, restores Qc1 and pre-move 2/16 clocks, and reopens the ordinary move.',
  '69. White c4xd5 legally captures black-pawn-d7 instead; Qc1 stays to shield Kf1 and the spent Treason allowance remains used.',
  '70. White now closes a safe completed replacement choice after the failed rescue.',
  '71. Black neutral Rb1-b5 traverses empty b2/b3/b4; Qc1 shields White from Ra1 and d5 Pawn blocks the rank toward Black.',
  '72. Black plays after-move Doomsayer, retains it, draws challenge, opens White’s immediate naming choice without altering board/clocks.',
  '73. White intentionally names Knight and loses its surviving Nh3; capture is permitted, Doomsayer expires/discards, halfmove resets and no second draw occurs.',
  '74. Black closes after the mandatory naming response resolves.',
  '75. White d2-d3 advances one empty square; Qc1 continues the first-rank screen.',
  '76. White closes the Pawn move with no additional card.',
  '77. Black h4-h3 is a forward single step into the square freed by Doomsayer.',
  '78. Black closes; h3 Pawn attacks g2 and does not check Kf1.',
  '79. White Rg8xd8 traverses empty f8/e8 and captures Black’s Queen; King e7 is not on that Rook line.',
  '80. White closes after the Queen capture with both Kings intact.',
  '81. Black neutral Rb5-c5 moves one empty file; d5 Pawn blocks its rank and Kf1 is not aligned.',
  '82. Black closes the quiet neutral Rook move.',
  '83. Dark Mirror replaces White’s move with Pg4xh3 backward diagonal capture of black-pawn-g7; identity stays Pawn, draw curse once, no EP.',
  '84. White closes the capture replacement; there is no extra ordinary move.',
  '85. Black Ke7xd8 captures the unprotected white-rook-h1; neutral Rc5 and White’s Pawns do not attack d8.',
  '86. Black closes the King capture on its safe destination.',
  '87. White Qc1xc5 traverses empty c2/c3/c4 and captures its neutral Rook, expiring Neutrality, but exposes Ra1-Kf1; only provisional rescue is allowed.',
  '88. Curse on Bd7 cannot block Ra1-Kf1: failed rescue spends/draws truce, rewinds Q to c1, restores neutral Rc5 and its retained card, and keeps White beforeMove.',
  '89. White e4xf5 makes a different legal capture of black-pawn-f7; Qc1 keeps the Rook screen while Curse stays spent.',
  '90. White closes the safe Pawn capture after its failed rescue.',
  '91. Ghostwalk replaces Black’s move with ordinary quiet c7-c6; zero obstructions is allowed, c6 is empty, Pawn remains itself, draw evangelists once.',
  '92. Black closes the Ghostwalk replacement without an extra move.',
  '93. White before-move Pacifism marks its nonroyal Pd5; card retained/draw sanctuary, no movement or clocks, Pawn can neither capture nor be captured.',
  '94. White f5-f6 advances an unmarked Pawn into empty f6; Pacifism remains attached to different physical Pc2 at d5.',
  '95. White closes; neither King is in check.',
  '96. Black neutral Rc5-c3 traverses empty c4 and lands vacant c3; marker follows, no capture, Qc1 still screens Kf1.',
  '97. Black closes the quiet two-square Rook move.',
  '98. White f2-f4 crosses empty f3, records f3 en passant and resets the Pawn clock.',
  '99. After-move Truce retains its card/draws fog-of-war, prohibits capture, preserves f3 EP and clocks; no existing check ends it.',
  '100. White closes with Truce, Pacifism and Neutrality retained; f3 EP remains geometrically recorded.',
  '101. Black Resurrection places captured original Pg7 on vacant starting-rank e7; no capture or arrival, consumes move, clears EP, draws fireball, fullmove 23.',
  '102. Black closes the resurrection replacement; original identity Pg7 is now on e7.',
  '103. White Kf1-e2 steps to empty e2; no effective check, quiet clock increments while Truce remains.',
  '104. White closes its safe King move.',
  '105. Black Evangelists atomically swaps Bc8 and White Bg1; no capture, identities/owners preserved, move consumed, clocks 2/24 and draw vulture.',
  '106. White immediately Fogs Evangelists: Bishops and 1/23 clocks restore, Black gets an ordinary move, both physical cards stay spent and White draws breakthrough once.',
  '107. Black c6-c5 is a quiet one-step replacement into the square vacated by neutral Rook; both spent allowances stay consumed.',
  '108. Black closes its ordinary replacement and resets both Fog allowances.',
  '109. White Ke2-f3 enters an empty adjacent square; d3 Pawn blocks neutral Rc3’s rank and Truce remains.',
  '110. White closes with Kf3 and existing effect identities unchanged.',
  '111. Black Bd7-c6 moves diagonally one empty square; Pd5 blocks its diagonal and is also Pacifist.',
  '112. Black after-move Fatal Attraction marks its Bc6, retains card/draws masquerade. Neighboring b7/c5/d5 are immobilized; clocks stay 2/25.',
  '113. Black closes; magnet continues to freeze its neighbors without moving anything.',
  '114. White Bg1-d4 traverses empty f2/e3; d4 is outside c6’s neighborhood, no capture, Truce continues.',
  '115. White closes the safe diagonal move.',
  '116. Black Kd8-c7 enters empty c7 adjacent to its magnet; royal exemption permits it and no White attack reaches c7.',
  '117. Black closes; King c7 remains exempt from immobilization.',
  '118. White neutral Rc3-b3 moves one empty file, outside magnet range; d3 Pawn still separates the Rook from Kf3.',
  '119. White closes the quiet neutral move.',
  '120. Black Nb8-d7 makes a Knight jump to empty d7; landing beside Bc6 is permitted and the Knight becomes immobilized afterward.',
  '121. Black closes; the arriving Knight stays d7 with its original identity and active magnet restriction.',
  '122. White h3-h4 is a quiet forward Pawn step outside magnet range; clock resets, no EP or promotion.',
  '123. White closes the fiftieth move command; Black begins beforeMove with all four effects retained and no unresolved reaction.',
];

test('iteration 018: independently reviewed random campaign', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/018.json', import.meta.url), 'utf8'));
  assert.equal(rationale.length, 123);
  assert.equal(rationale.length, trace.steps.length);
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 19);
  assert.equal(trace.steps.filter(step => step.action.type === 'namePiece').length, 1);
  const state = replayTrace(trace);
  assert.equal(state.fen, 'r1b5/ppknpp1p/2b2P2/2pP4/3B1P1P/1R1P1K2/P7/r1Q5 b - - 0 27');
  assert.deepEqual(state.turn, { color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.equal(state.orientation, 0);
  assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer && !state.outcome);
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.pieces.filter(piece => piece.zone === 'board').length, 22);
  assert.deepEqual(state.pieces.filter(piece => piece.zone === 'captured').map(piece => piece.id).sort(), [
    'black-knight-g8', 'black-pawn-d7', 'black-pawn-f7', 'black-queen-d8',
    'white-bishop-c1', 'white-knight-b1', 'white-knight-g1', 'white-pawn-b2', 'white-pawn-h2', 'white-rook-h1',
  ]);
  const piece = (id: string) => state.pieces.find(item => item.id === id)!;
  assert.equal(piece('white-king-e1').square, 'f3');
  assert.equal(piece('black-king-e8').square, 'c7');
  assert.equal(piece('white-rook-a1').square, 'b3');
  assert.equal(piece('white-rook-a1').neutral, true);
  assert.equal(piece('black-pawn-g7').square, 'e7');
  assert.equal(piece('white-pawn-g2').square, 'h4');
  assert.equal(piece('white-bishop-f1').square, 'd4');
  assert.equal(piece('black-bishop-c8').square, 'c8');
  assert.deepEqual(state.effects.map(effect => (effect as { type: string }).type), ['neutrality', 'pacifism', 'truce', 'fatal-attraction']);
  assert.deepEqual([state.players.white.deck.length, state.players.black.deck.length], [66, 65]);
  assert.deepEqual([state.players.white.hand.length, state.players.black.hand.length], [5, 5]);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['plots-within-plots', 'figure-dance', 'challenge', 'treason', 'dark-mirror', 'curse', 'fog-of-war']);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), ['fog-of-war', 'heresy', 'riposte', 'blessing', 'doomsayer', 'ghostwalk', 'resurrection', 'evangelists']);
  const destinations = legalDests(state);
  assert.equal(destinations.get('d7')?.length ?? 0, 0, 'Knight entering the magnet neighborhood is now frozen');
  assert.equal(destinations.get('b7')?.length ?? 0, 0, 'magnet freezes its neighboring friendly Pawn');
  assert.equal(destinations.get('c5')?.length ?? 0, 0, 'magnet freezes the other neighboring Pawn');
});
