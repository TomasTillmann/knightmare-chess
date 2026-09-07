import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/004.json', import.meta.url), 'utf8')) as RandomTrace

// Reviewed in order against rules §§8–11, 13.1, 15.1, 18.3, 18.6, 20, 22.6
// and the corresponding cards.md text and catalog timing. Every quiet move
// preserves cards/identities, increments the halfmove clock, and expires EP;
// every pawn move/capture resets that clock. Black moves increment fullmove.
// End-turn rows preserve the position/clocks and reset both card allowances;
// no optional discard is requested. Exceptions are explicitly recorded below.
const rationales = [
  '1. f2-f4 crosses empty f3 to empty f4; King e1 safe; f3 EP is available for one reply.',
  '2. White ends after f4, keeping f3 EP and both unchanged five-card hands.',
  '3. f7-f6 is one unobstructed forward pawn step; old f3 EP expires; King e8 safe.',
  '4. Black ends after f6; White receives its regular move with clocks 0/2.',
  '5. a2-a4 crosses empty a3; no king line opens; a3 EP replaces the expired right.',
  '6. After-move Neutrality legally marks opposing nonroyal Bf8, retains its card, draws Ghostwalk (75→74), and preserves a3 EP.',
  '7. White ends with Bf8 neutral and new card allowances; no extra draw or EP expiration.',
  '8. Neutral Bf8 may capture its original-owner pawn on adjacent diagonal g7; pawn becomes captured, marker follows bishop, a3 EP expires.',
  '9. Black ends after neutral Bxg7; physical Black ownership remains unchanged.',
  '10. White controls neutral Bg7 and captures Black Rh8 diagonally; h8 rook is captured and Black kingside castling is revoked.',
  '11. White ends after neutral Bxh8; Black receives turn with queenside-only Black castling.',
  '12. e7-e5 crosses empty e6; e6 EP is recorded and neither King is exposed.',
  '13. Black ends, preserving e6 EP for the White reply.',
  '14. b2-b3 is a clear single pawn step; e6 EP expires and the neutral Bh8 diagonal is blocked by Black Pf6.',
  '15. White ends after b3 with the sole Neutrality marker still on Bh8.',
  '16. Ke8-f7 is one diagonal step to an unattacked square; Bh8 diagonal is blocked by Black f6, and all Black castling rights end.',
  '17. Black ends after Kf7; White retains KQ rights and unchanged hands.',
  '18. d2-d3 advances into an empty square, opening Bc1 without exposing Ke1.',
  '19. White ends after d3; no effect or card accounting changes.',
  '20. b7-b5 crosses empty b6; b6 EP is available, White Pa4 cannot capture it from rank four.',
  '21. Black ends after b5, preserving b6 EP for the next move.',
  '22. Nb1-a3 is a legal jump to empty a3; b6 EP expires; no royal attack is exposed.',
  '23. After-move Fatal Attraction targets own Pe2, retains its card and draws Holy War (74→73); Qd1, Bf1 and Pd3 freeze, Ke1 is exempt.',
  '24. White ends; both Neutrality and Fatal Attraction persist; Black pieces are outside the magnet neighborhood.',
  '25. Nb8-a6 is a legal jump to an empty square outside the e2 magnet; both Kings remain safe.',
  '26. Black ends after Na6 with both Continuing Effects unchanged.',
  '27. Magnet Pe2 may itself move e2-e4 through empty e3; its actual move discards Fatal Attraction, releases neighbors, and creates e3 EP.',
  '28. White ends with only Neutrality remaining and e3 EP still pending.',
  '29. Kf7-e8 is a safe adjacent return; lost castling rights stay lost and e3 EP expires.',
  '30. Black ends after Ke8; the discarded magnet card is neither redrawn nor reactivated.',
  '31. Na3-c4 is a legal jump to empty c4; its attacks d6/e5/e3/d2/b2/a3/a5/b6 miss Ke8.',
  '32. White ends after Nc4 with the neutral bishop still on h8.',
  '33. Neutral Bh8-g7 moves one diagonal square to empty g7; f6 blocks its line toward White.',
  '34. Black ends after Bg7 with Neutrality following the same physical bishop.',
  '35. Ng1-h3 jumps to empty h3; the former e2 magnet no longer imposes restrictions.',
  '36. White ends after Nh3 with no draw or discard.',
  '37. Ra8-b8 slides one clear square; Black rights were already absent and its King stays safe.',
  '38. Black ends after Rb8; White retains both castling rights.',
  '39. Ra1-a3 crosses empty a2 to vacant a3; White queenside castling ends, kingside remains.',
  '40. After-move Peace Talks cancels own retained Neutrality; Bg7 reverts to nonneutral Black, both cards are discarded, Forbidden City replaces Peace Talks (73→72).',
  '41. White ends after cancellation with no remaining effects, clocks still 6/10.',
  '42. Bc8-b7 is one clear diagonal step; c6/d5/e4 line stops at White Pe4, not Ke1.',
  '43. Black ends after Bb7; White receives its regular move.',
  '44. Rh1-g1 moves to the square vacated by Ng1; White kingside rights end, leaving no castling rights.',
  '45. White ends after Rg1 with all rights absent and cards unchanged.',
  '46. Qd8-c8 is a clear horizontal step into the bishop-vacated square; Ke8 remains shielded.',
  '47. Black ends after Qc8; no delayed obligations exist.',
  '48. g2-g3 advances into empty g3, resets the pawn clock, and exposes no line to Ke1.',
  '49. White ends after g3 with no EP opportunity.',
  '50. Ke8-e7 moves one square to an unattacked square; Nc4 does not attack e7 and bishops are blocked.',
  '51. Black ends after Ke7; fullmove 13 has already advanced.',
  '52. Bc1-d2 moves diagonally to the pawn-vacated square; King e1 remains safe.',
  '53. White ends after Bd2 without playing Crusade or another card.',
  '54. Ng8-h6 is a legal jump to empty h6; White King e1 is outside its attacks.',
  '55. Black ends after Nh6, no card follows the move.',
  '56. Ke1-e2 enters empty e2; Bb7 is stopped by Pe4, Bg7 by Pf6, and neither knight attacks e2.',
  '57. White ends after Ke2; previously lost castling rights remain absent.',
  '58. Bb7-a8 moves diagonally to the vacant rook start square; no capture or transformation.',
  '59. Black ends after Ba8; card zones remain unchanged.',
  '60. Qd1-e1 slides to the King-vacated square, leaving Ke2 safe behind its pawn screen.',
  '61. White ends after Qe1; no counters advance a second time.',
  '62. Bg7-f8 retreats diagonally to its original vacant square and is no longer neutral.',
  '63. Black ends after Bf8; no effect resumes merely because the bishop returned.',
  '64. Qe1-b1 crosses empty d1/c1; no capture, and Ke2 remains shielded.',
  '65. White ends after Qb1 with clock 8/16 and unchanged cards.',
  '66. Rb8-b6 crosses empty b7 and stops on empty b6 above own Pb5; no King line opens.',
  '67. Black ends after Rb6; no Merciless card is played.',
  '68. Qb1-a1 is a clear horizontal step into the old rook square; no castling rights return.',
  '69. White ends after Qa1; Black starts with both card allowances clear.',
  '70. Bf8-g7 is a clear diagonal step; its f6 pawn continues blocking attacks down the diagonal.',
  '71. Black ends after Bg7 without changing card zones.',
  '72. Ke2-d1 retreats diagonally to empty d1, outside all Black bishop/knight/rook attacks.',
  '73. White ends after Kd1; no pending obligation survives.',
  '74. Na6-b8 jumps back to its vacant start square; the Rb6 does not obstruct a jump.',
  '75. Black ends after Nb8 with unchanged cards and no effects.',
  '76. Ra3-a2 moves one square to empty a2; own Qa1 lies beyond the destination.',
  '77. White ends after Ra2; no extra rook move is granted.',
  '78. Bg7-h8 moves one diagonal square to empty h8, keeping original bishop identity.',
  '79. Black ends after Bh8; the captured h8 rook remains captured.',
  '80. Rg1-h1 returns horizontally to its empty original square without restoring castling.',
  '81. White ends after Rh1; clocks remain 16/20.',
  '82. a7-a6 is a clear single pawn step into the knight-vacated square; clock resets, no EP.',
  '83. Black ends after a6; fullmove 21 is preserved.',
  '84. g3-g4 advances one square into empty g4; no capture/promotion or new EP.',
  '85. White ends after g4; both Kings remain safe.',
  '86. Ke7-f7 is a safe adjacent step; Nc4 and blocked White bishops do not attack f7.',
  '87. Black ends after Kf7 with unchanged card zones.',
  '88. Nh3-g1 jumps to vacant g1 beside Rh1; no path obstruction applies.',
  '89. White ends after Ng1; Black receives its regular move.',
  '90. f6-f5 is an unobstructed pawn advance; White Pf4 prevents a further forward step, not this one.',
  '91. Black ends after f5; no EP was created by the single step.',
  '92. Qa1xe5 crosses empty b2/c3/d4 and captures Black Pe5, resetting the clock; Kd1 remains safe.',
  '93. After-move Holy War swaps own Nc4/Bf1 without capture; Bc4 checks Kf7 but Kg8 is an escape, so no direct mate; discard card and draw Revenge (72→71).',
  '94. White ends with Black in nonmate check from Bc4 along d5/e6/f7; Black gets an escape turn.',
  '95. Ba8-b7 is geometrically clear but leaves Kf7 checked; §11.6 permits staging with after-move Dungeon available, so pendingRescue must remain true.',
  '96. After-move Dungeon relocates checking White Bc4 to vacant a8, curing the check without capture; mark that identity for next-White-turn restriction, discard Dungeon and draw Riposte (75→74).',
  '97. Black can end after its rescue; White Ba8 restriction now applies and clocks remain 1/24.',
  '98. d3-d4 is an unobstructed pawn move by a different identity; the Dungeon-bound Ba8 stays put.',
  '99. White ends its restricted turn; Dungeon restriction expires without an extra card draw.',
  '100. Kf7-f8 moves to an unattacked adjacent square; Queen e5 attacks e8/f6/g7/h8 but not f8.',
  '101. Black ends after Kf8; no remaining Dungeon restriction or retained card.',
  '102. Bd2-b4 crosses empty c3; its b4/c5/d6/e7/f8 diagonal gives nonmate check, with Black Kg8 available.',
  '103. White ends after Bb4; Black must answer its check on the following turn.',
  '104. Bh8xe5 crosses empty g7/f6, captures the Queen, but leaves the Bb4-f8 check; this is only staged pending a same-turn Haunting Memories copy of Dungeon.',
  '105. After-move Haunting Memories copies last-played nonunique Dungeon, moving White Bb4 to vacant h8 without capture; this removes its f8 check, restricts that bishop next White turn, discards the copy and draws Treason (74→73).',
  '106. Black ends after the completed rescue; White begins with Bh8 restricted, both card allowances reset, no pending rescue, and clocks preserved at 0/26.',
]

test('iteration 004 independently reviewed random game', () => {
  assert.equal(rationales.length, trace.steps.length)
  rationales.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)))
  const state = replayTrace(trace)
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 6)
  assert.ok(!state.pendingRescue, 'the 50th move must resolve its mandatory rescue')
  assert.equal(state.fen, 'Bnq2k1B/1bpp3p/pr5n/1p2bp2/P2PPPP1/1P6/R1P4P/3K1NNR w - - 0 26')
  assert.equal(state.players.black.deck.length, 73)
  assert.equal(state.players.black.discard.at(-1)?.cardId, 'haunting-memories')
  assert.equal(state.turn.color, 'white')
  assert.equal(state.turn.phase, 'beforeMove')
  assert.equal(state.pieces.find(piece => piece.id === 'white-bishop-c1')?.square, 'h8')
  assert.deepEqual(state.effects, [{ type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-bishop-c1' }])
})
