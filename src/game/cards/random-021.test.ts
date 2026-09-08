import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Sequential manual review of every action and state in 021.txt, rules §§8–15,
// §§17–18, §22.10, cards.md, and the eleven printed catalog timing records.
// Quiet moves below have empty destinations/paths, preserve identity, and leave
// the acting royal safe unless explicitly marked as a temporary rescue move.
// Pawn/capture moves reset the halfmove clock; other moves increment it; Black
// advances the fullmove number. End-turn rows do neither, reset allowances, and
// preserve hands/decks/discards/effects except for the expiry explicitly noted.
// Every card spends its owner's one allowance and draws the next ordered card;
// retained Continuing Effects are distinguished from regular discards below.
const review = [
  '1. White a2-a3 is a one-step Pawn move to empty a3; no en-passant opportunity.',
  '2. End White turn; Black starts beforeMove with the board and clocks unchanged.',
  '3. Black c7-c6 is one forward Pawn step; fullmove becomes 2.',
  '4. End Black turn; White starts with neither card allowance spent.',
  '5. White c2-c3 advances one square without capture or promotion.',
  '6. End White turn; no effects or card-zone changes.',
  '7. Black g7-g5 crosses empty g6 and leaves the physical g7 Pawn eligible at g6.',
  '8. After-move Fatal Attraction marks owned Ra8; a7/b7/b8 freeze, magnet stays mobile. Retain card, draw Fanatic, preserve g6 opportunity.',
  '9. End Black turn; the magnet and g6 opportunity persist into White turn.',
  '10. White b2-b3 is outside the magnet neighborhood; it clears the old g6 opportunity.',
  '11. End White turn; magnet remains on the unmoved black a8 Rook.',
  '12. Black e7-e5 crosses empty e6, outside the magnet; opportunity names the e7 Pawn at e6.',
  '13. End Black turn; e6 opportunity survives for White.',
  '14. White e2-e3 is a normal forward Pawn move and clears e6 availability.',
  '15. After-move Crab marks owned Pawn e3 without relocation; retain its physical card, draw Heresy, preserve clocks.',
  '16. End White turn; Crab and Fatal Attraction persist with their physical carriers.',
  '17. Black d7-d5 crosses empty d6; create d6 opportunity for the physical d7 Pawn.',
  '18. End Black turn; d6 opportunity remains available to White.',
  '19. White h2-h4 crosses empty h3, temporarily replaces d6 opportunity with h3.',
  '20. Black Knightmare reacts immediately: restore h2 Pawn, old d6 opportunity and pre-move clocks; discard Knightmare, draw Merciless, forbid repeating h2-h4 this turn.',
  '21. White Evangelists replaces the retried move: swap owned Bf1 with enemy Bc8, no capture or path requirement. Both Kings safe; discard it, draw Evil Eye, clear en passant.',
  '22. End White turn after the replacement move; both allowances reset.',
  '23. Black Qd8-a5 slides through empty c7,b6; c8 White Bishop does not attack e8.',
  '24. End Black turn; magnet and Crab still retained.',
  '25. White Ke1xf1 captures the swapped black c8 Bishop on an unattacked adjacent square; revoke both White castling rights.',
  '26. End White turn; captured Bishop stays off-board and no Hostage was played.',
  '27. Black Ke8-d7 is temporarily attacked by White Bc8; pending rescue prevents ending this turn as legal.',
  '28. Counterclockwise Earthquake cannot remove Bc8-d7 check. Spend and discard it, draw Plots, restore orientation, unpromoted edge Pawns, Ke8, black rights and clocks; failed rescue returns the Regular Move.',
  '29. Black Qa5-c5 crosses empty b5 as the legal replacement; card allowance remains spent after the failed rescue.',
  '30. End Black turn; no illegal d7 King position or Earthquake transformation survives.',
  '31. White Ng1-f3 is an ordinary L jump, outside the magnet.',
  '32. End White turn; no card drawn because none was played or discarded.',
  '33. Black Qc5-e7 uses empty d6; the destination was vacated by e7-e5.',
  '34. End Black turn; no pending check rescue.',
  '35. White Nf3xg5 legally captures the physical black g7 Pawn; it becomes captured, not dead.',
  '36. End White turn; the g7 Pawn remains captured.',
  '37. Black d5-d4 is one forward Pawn step to empty d4.',
  '38. End Black turn; no en-passant right arises from a one-square step.',
  '39. White Bc8-h3 traverses empty d7,e6,f5,g4; preserves the swapped f1 Bishop identity.',
  '40. End White turn; that Bishop no longer attacks d7.',
  '41. Black f7-f5 crosses empty f6, blocks the h3-d7 diagonal and creates f6 opportunity.',
  '42. End Black turn; f6 opportunity persists for White.',
  '43. White Ng5-f7 jumps to the newly empty square and clears f6 availability.',
  '44. End White turn; Nf7 attacks h8/d8/d6/e5/g5/h6, not e8.',
  '45. Black Ke8-d7 is now safe: f5 blocks Bh3 and Nf7 does not attack d7. Revoke black castling rights.',
  '46. End Black turn with the King legally on d7.',
  '47. White Nf7xe5 captures the black e7 Pawn and checks the black King on d7 by L geometry.',
  '48. End White turn; Black receives its checked turn and can use a card to escape.',
  '49. Black Qe7-g5 crosses empty f6 but does not cure Ne5-d7 check; keep the turn pending rescue.',
  '50. After-move Coup crowns the safe owned Pawn a7 and demotes Kd7 to Prince. Royal immunity exempts a7 from the a8 magnet; retain Coup, draw Betrayal, resolve pending rescue.',
  '51. End Black turn; royal identity stays with a7 Pawn, not the d7 Prince.',
  '52. White Ne5-f7 jumps quietly; neither it nor Bh3 attacks the new royal a7.',
  '53. End White turn; the old d7 King is now a capturable Prince.',
  '54. Black Bf8-c5 traverses empty e7,d6; no effect freezes those squares.',
  '55. End Black turn; Pawn a7 remains the safe royal.',
  '56. White f2-f3 is a quiet Pawn advance; c5 Bishop is blocked from f2 by White e3 Pawn.',
  '57. End White turn; Crab remains on the e3 physical Pawn.',
  '58. Black Bc5-f8 returns through empty d6,e7.',
  '59. End Black turn; no effect or card disposition changes.',
  '60. White Rh1-g1 moves to the Knight-vacated square; rights were already absent.',
  '61. End White turn; King f1 stays safe behind its Pawns.',
  '62. Black Qg5-h5 moves one horizontal square without capture.',
  '63. End Black turn; the magnet does not affect any h-file piece.',
  '64. White a3-a4 advances its original a2 Pawn; no promotion after the failed rotation.',
  '65. End White turn; orientation remains standard.',
  '66. Black Bf8-d6 crosses empty e7; destination d6 is free.',
  '67. End Black turn; Bishop identity remains the original f8 Bishop.',
  '68. White d2-d3 moves one forward square, stopping before enemy Pawn d4.',
  '69. After-move Heresy moves enemy Bd6-d5 first, then own Bc1-c2 and Bh3-g3; all destinations vacant and opposite-colored, all surviving Bishops included. Discard Heresy, draw Doppelganger.',
  '70. Black Plots may react in the after-opponent-card window; no extra card need be played. Discard Plots, draw Masquerade; board/clocks stay unchanged.',
  '71. End White turn; unused immediate Plots permission closes instead of granting Black an extra move.',
  '72. Black Ng8-h6 makes an ordinary Knight jump.',
  '73. End Black turn; no movement of the frozen b8 Knight.',
  '74. White Bg3-c7 traverses empty f4,e5,d6; neither origin nor destination neighbors magnet a8.',
  '75. End White turn; c7 Bishop threatens b8 Knight, not royal a7.',
  '76. Black Prince d7-e6 takes an adjacent empty square; it is no longer the royal piece.',
  '77. End Black turn; Coup continues to protect the a7 Pawn.',
  '78. White Crab e3-f4 moves diagonally forward without capture, allowed by Crab; same physical e2 Pawn and halfmove reset.',
  '79. After-move Rebirth relocates enemy d4 Pawn to vacant e7, a valid black Pawn starting square; no capture or clock increment. Discard Rebirth, draw Treason.',
  '80. End White turn; e7 occupant is the original d7 Pawn, not the captured original e7 Pawn.',
  '81. Black Qh5-g5 returns horizontally to empty g5.',
  '82. End Black turn; the g5 Queen remains capturable.',
  '83. White Nf7xg5 captures the black Queen by a legal L jump; no royal capture because Coup chose a7.',
  '84. End White turn; black Queen stays captured.',
  '85. Black Nh6-f7 jumps to the White Knight-vacated square.',
  '86. End Black turn; no resurrection or Hostage response occurred.',
  '87. White g2-g4 crosses empty g3 and creates g3 en-passant opportunity.',
  '88. End White turn; g3 availability persists for Black.',
  '89. Black Rh8-e8 traverses empty g8,f8; the a8 magnet is a distinct Rook and stays active. Clear g3 opportunity.',
  '90. End Black turn; no castling rights can be regained.',
  '91. White Nb1-a3 jumps to the square vacated by its a-Pawn.',
  '92. End White turn; a3 Knight is far from magnet a8.',
  '93. Black Bd5-e4 moves one diagonal to an empty square; White King f1 is not attacked.',
  '94. End Black turn; c7 Bishop still threatens the frozen but capturable b8 Knight.',
  '95. White Evil Eye replaces the move: Bc7 legally threatens Nb8 diagonally and captures it in place without moving Bc7 or ending the a8 magnet. Discard Evil Eye, draw Bombard; capture resets clock.',
  '96. End White turn; the stationary capture consumes exactly one Regular Move.',
  '97. Black Re8-c8 traverses empty d8 and avoids the magnet neighborhood b8.',
  '98. End Black turn; a8 Rook remains the stationary magnet.',
  '99. White Qd1-e1 moves one horizontal square to the original King-vacated square.',
  '100. End White turn; e1 Queen does not block the future d3-e2-f1 diagonal.',
  '101. Black Be4xd3 captures the original White d2 Pawn and checks Kf1 through empty e2.',
  '102. End Black turn; White may answer this check using its move/card combination.',
  '103. White Ra1-a2 is a temporary move that leaves Bd3-e2-f1 check; pending rescue remains required.',
  '104. After-move Dungeon relocates the checking Bd3 to vacant corner h8, safely removing the check. Discard it, draw Hostage, prohibit that physical Bishop on Black next turn; clocks unchanged.',
  '105. End White turn; Dungeon restriction persists into the required Black turn.',
  '106. Black Nf7-h6 moves a different piece; imprisoned Bh8 stays in place.',
  '107. End Black turn; Dungeon restriction expires after the full prohibited turn, other effects remain.',
  '108. White h2-h4 now legally repeats the old canceled move on a later turn, through empty h3; create h3 opportunity.',
  '109. End White turn; opportunity survives until Black acts.',
  '110. Black Rc8-g8 crosses empty d8,e8,f8; Bh8 is beyond the destination. Clear en passant and advance to fullmove 26.',
  '111. End final Black turn; White starts beforeMove, no pending rescue, expired Dungeon, three retained effects and safe royals f1/a7.',
];

test('iteration 021: all 111 actions independently reviewed, including 50 move commands', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/021.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860021);
  assert.equal(trace.failure, undefined);
  assert.equal(review.length, 111);
  assert.equal(review.length, trace.steps.length);
  review.forEach((rationale, index) => assert.ok(rationale.startsWith(`${index + 1}. `)));
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(({ action }) => action.type === 'endTurn').length, 50);
  assert.deepEqual(trace.steps.flatMap(({ action }) => action.type === 'playCard' ? [action.cardId] : []), [
    'fatal-attraction', 'crab', 'knightmare', 'evangelists', 'earthquake', 'coup',
    'heresy', 'plots-within-plots', 'rebirth', 'evil-eye', 'dungeon',
  ]);
  const final = replayTrace(trace);
  assert.equal(final.fen, 'r5rb/ppB1p2p/2p1k2n/5pN1/P4PPP/NPP2P2/R1B5/4QKR1 w - - 1 26');
  assert.equal(final.orientation, 0);
  assert.equal(final.outcome, null);
  assert.ok(!final.pendingRescue);
  assert.deepEqual(final.enPassant, []);
  assert.deepEqual(final.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.deepEqual(final.pieces.filter(piece => piece.royal).map(piece => [piece.id, piece.square]).sort(), [
    ['black-pawn-a7', 'a7'], ['white-king-e1', 'f1'],
  ]);
  assert.deepEqual(final.pieces.filter(piece => piece.zone !== 'board').map(piece => [piece.id, piece.zone]).sort(), [
    ['black-bishop-c8', 'captured'], ['black-knight-b8', 'captured'], ['black-pawn-e7', 'captured'],
    ['black-pawn-g7', 'captured'], ['black-queen-d8', 'captured'], ['white-pawn-d2', 'captured'],
  ]);
  assert.equal(final.pieces.filter(piece => piece.zone === 'board').length, 26);
  assert.ok(final.pieces.every(piece => !piece.promoted && !piece.neutral));
  for (const [id, square] of [
    ['white-pawn-e2', 'f4'], ['black-pawn-d7', 'e7'], ['black-bishop-f8', 'h8'],
    ['white-bishop-f1', 'c7'], ['white-bishop-c1', 'c2'], ['black-king-e8', 'e6'],
    ['black-rook-h8', 'g8'], ['black-rook-a8', 'a8'], ['white-rook-a1', 'a2'],
  ]) assert.equal(final.pieces.find(piece => piece.id === id)?.square, square);
  assert.deepEqual(final.effects, [
    { type: 'fatal-attraction', owner: 'black', card: { id: 'black-hand-0-fatal-attraction', cardId: 'fatal-attraction' }, pieceId: 'black-rook-a8' },
    { type: 'crab', owner: 'white', card: { id: 'white-hand-0-crab', cardId: 'crab' }, pieceId: 'white-pawn-e2' },
    { type: 'coup', owner: 'black', card: { id: 'black-hand-3-coup', cardId: 'coup' }, princeId: 'black-king-e8', kingId: 'black-pawn-a7', princeRole: 'king' },
  ]);
  assert.deepEqual(final.players.white.hand.map(card => card.cardId), ['vulture', 'doppelganger', 'treason', 'bombard', 'hostage']);
  assert.deepEqual(final.players.black.hand.map(card => card.cardId), ['hostage', 'fanatic', 'merciless', 'betrayal', 'masquerade']);
  assert.deepEqual(final.players.white.discard.map(card => card.cardId), ['evangelists', 'heresy', 'rebirth', 'evil-eye', 'dungeon']);
  assert.deepEqual(final.players.black.discard.map(card => card.cardId), ['knightmare', 'earthquake', 'plots-within-plots']);
  assert.deepEqual([final.players.white.deck.length, final.players.black.deck.length], [69, 70]);

  // Explicit semantic checkpoints for reversible moves, royal transfer and rescue;
  // final-state hashing alone cannot validate these transient obligations.
  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const result = applyAction(state, action);
    assert.ok(result.ok, review[index]);
    state = result.state;
    const step = index + 1;
    if ([27, 49, 103].includes(step)) assert.ok(state.pendingRescue, review[index]);
    if (step === 20) {
      assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-h2')?.square, 'h2');
      assert.deepEqual(state.enPassant, [{ target: 'd6', pawnId: 'black-pawn-d7' }]);
      assert.equal(state.turn.moveMade, false);
    }
    if (step === 28) {
      assert.equal(state.orientation, 0);
      assert.equal(state.pieces.find(piece => piece.id === 'black-king-e8')?.square, 'e8');
      assert.ok(state.pieces.every(piece => !piece.promoted));
      assert.equal(state.fen, 'rnB1kbnr/pp3p1p/2p5/q2pp1p1/8/PPP1P3/3P1PPP/RNBQ1KNR b kq - 0 6');
      assert.equal(state.turn.moveMade, false);
      assert.equal(state.turn.cardPlays.black, 1);
      assert.ok(!state.pendingRescue);
    }
    if (step === 50) {
      assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-a7')?.royal, true);
      assert.equal(state.pieces.find(piece => piece.id === 'black-king-e8')?.royal, false);
      assert.ok(!state.pendingRescue);
    }
    if (step === 95) {
      assert.equal(state.pieces.find(piece => piece.id === 'white-bishop-f1')?.square, 'c7');
      assert.equal(state.pieces.find(piece => piece.id === 'black-knight-b8')?.zone, 'captured');
      assert.equal(state.effects.length, 3);
    }
    if (step === 104 || step === 106) {
      assert.equal(state.pieces.find(piece => piece.id === 'black-bishop-f8')?.square, 'h8');
      assert.deepEqual(state.effects.at(-1), { type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-bishop-f8' });
      assert.ok(!state.pendingRescue);
    }
    if (step === 107) assert.deepEqual(state.effects, final.effects);
  }
});
