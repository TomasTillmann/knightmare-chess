import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independent review: rules.md §§8–14, 17, 18.6, 20–22 and all thirteen
// played card artworks in final_cards. Coordinates remain fixed through Earthquake.
// Every quiet move increments the halfmove clock; Pawn moves/captures reset it.
// Black completed moves increment fullmove; endTurn alone never advances clocks.
// Unless called out below, hands/effects/identities persist and both Kings stay safe.
const reasons = [
  '1. Nb1-a3 is a clear knight jump; no capture or exposed King.',
  '2. White completes Na3; Black starts with fresh allowances and no draw.',
  '3. d7-d6 advances Black one empty square; no en-passant right.',
  '4. Black completes d6; White starts, board and hands unchanged.',
  '5. e2-e4 crosses empty e3; e3 is the temporary en-passant target.',
  '6. Holy Quest after e4 exchanges enemy Bf8 and Ng8 without capture; draw Earthquake and retain e3 opportunity.',
  '7. White completes the swap turn; Black starts with the e4 en-passant opportunity intact.',
  '8. c7-c6 is one forward Pawn step; the old e3 opportunity expires.',
  '9. Black completes c6 and passes to White without drawing.',
  '10. Bf1-a6 passes empty e2,d3,c4,b5; Black Pawn b7 is not captured.',
  '11. White completes Ba6; Black starts with both Kings safe.',
  '12. Before moving, Black marks its nonroyal b7 Pawn Pacifist; retain card and draw Under Elf Hill.',
  '13. Qd8-c7 moves diagonally to the vacated square; Pacifism remains on b7.',
  '14. Black completes Qc7; the continuing Pacifism marker persists.',
  '15. Qd1-g4 crosses empty e2 and f3; no capture or King exposure.',
  '16. White completes Qg4, resetting both turn allowances only.',
  '17. Bc8-f5 crosses d7,e6, both empty; Qg4 does not attack Black King through its own e4 Pawn.',
  '18. Black completes Bf5; White begins without a card obligation.',
  '19. e4-e5 is a clear forward step; both Kings remain screened.',
  '20. White completes e5; Black receives its ordinary move.',
  '21. Assassin replaces Black move: Rh8 captures own h7 Pawn; revoke k, reset clock, spend card and draw Knightmare.',
  '22. White Think Again immediately reverses Assassin: restore Rh8, h7 Pawn, k and clocks; return Assassin, undo Black draw/allowance; White draws Hostage.',
  '23. Pacifist b7-b5 crosses empty b6 without capture; this differs from canceled Rh8xh7 and creates b6 opportunity.',
  '24. Black ends the replacement turn; White reaction allowance resets, Pacifism follows b5.',
  '25. e5-e6 is a clear Pawn advance; b6 opportunity expires without an illegal capture of the Pacifist.',
  '26. White completes e6 and passes to Black.',
  '27. g7-g6 advances onto an empty square; it does not expose Black King.',
  '28. Black completes g6; neither player draws.',
  '29. Qg4-g3 moves one clear orthogonal square.',
  '30. White ends Qg3; continuing marker stays on Black b5.',
  '31. h7-h5 crosses empty h6 and creates h6 en-passant opportunity.',
  '32. After h5, Heresy moves White Bishops c1-d1,a6-a5 first, then Black f5-e5,g8-g7; all change square color to empty neighbors; spend/draw Knightmare.',
  '33. Black completes Heresy with h6 opportunity and all four Bishop identities preserved.',
  '34. Na3-c4 is a legal empty knight jump; h6 opportunity expires.',
  '35. Black Knightmare immediately restores Na3, h6 and clocks; White must replace its move, Black spends/draws Fatal Attraction.',
  '36. Qg3-h3 is a legal different replacement move; expire h6 again.',
  '37. White completes Qh3; Black reaction allowance resets for its own turn.',
  '38. h5-h4 is a clear one-square Black Pawn advance.',
  '39. Black ends h4 with no capture or card change.',
  '40. Qh3-f5 passes empty g4; h4 Pawn is not on that diagonal.',
  '41. White completes Qf5; Black King e8 remains safe behind its Pawns.',
  '42. Nf8-h7 is a clear knight jump by the Holy Quest relocated Knight.',
  '43. Black completes Nh7; no continuing effect expires.',
  '44. b2-b4 crosses empty b3, stops before Pacifist b5, and creates b3 opportunity.',
  '45. Earthquake after b4 rotates forward to White east/Black west; promote Black a7 then White h2 to Bishops, preserve identities, expire incompatible b3 and retain/draw Haunting Memories.',
  '46. White completes rotation; Black begins with both promotions resolved.',
  '47. f7xe6 is a legal westward Black Pawn diagonal capturing physical White e2 Pawn; reset clock.',
  '48. White Hostage immediately substitutes its capturable d2 Pawn and returns captured e2 Pawn to d2; captor stays e6, spend/draw Onslaught, Black turn remains active.',
  '49. Black ends the capture/reaction turn; White receives a fresh allowance.',
  '50. Promoted h2 Bishop moves to f4 through empty g3; promotion identity persists.',
  '51. White completes Bf4; no promotion reversal or extra draw.',
  '52. Be5-d4 is a clear adjacent diagonal; no capture.',
  '53. Black completes Bd4, handing the turn to White.',
  '54. Ng1-h3 jumps to an empty square, leaving e1 King safe.',
  '55. White ends Nh3 with castling rights intact.',
  '56. Qc7-d8 is a clear diagonal retreat; no capture.',
  '57. Black completes Qd8; no new obligation exists.',
  '58. Nh3-g5 is a legal empty knight jump; Black King remains safe.',
  '59. White completes Ng5 without changing cards.',
  '60. Promoted Ba7-c5 crosses empty b6; promoted Pawn identity remains a Bishop.',
  '61. Black completes Bc5 and passes to White.',
  '62. Ng5-h3 is a legal knight retreat; this is unrelated to the expired cancellation restriction.',
  '63. White completes Nh3; both Kings remain safe.',
  '64. Bd4xa1 crosses empty c3,b2 and captures White original a1 Rook; revoke Q and reset clock.',
  '65. Black completes Bxa1; White retains only kingside castling.',
  '66. e1-h1 encodes kingside castling: King to g1, Rook to f1; f1/g1 empty and e1/f1/g1 unattacked, so remove White K.',
  '67. White completes castling; Black starts with kq still available.',
  '68. Assassin replaces Black move: Bg7xh8 captures own Rook on adjacent diagonal; revoke k, draw Merciless and keep King safe.',
  '69. Black completes Assassin replacement and grants no extra ordinary move.',
  '70. Promoted Bf4-g5 is a clear diagonal move; no capture.',
  '71. White completes Bg5; Earthquake and Pacifism remain active.',
  '72. Promoted Bc5xb4 captures unprotected White b2 Pawn; Pacifist Black b5 is untouched.',
  '73. Black ends Bxb4 with a reset capture clock.',
  '74. Qf5-e5 is a clear horizontal step; e6 Pawn screens Black King.',
  '75. White completes Qe5 and passes to Black.',
  '76. Rotated Black h4xg5 captures westward/upward, removing promoted White h2 Bishop while preserving captured identity.',
  '77. Black completes the Pawn capture; no en-passant right is created.',
  '78. Ba5xb4 captures promoted Black a7 Bishop one diagonal step; Black b5 Pacifist survives.',
  '79. White completes Bxb4; the captured promotion remains in the captured zone.',
  '80. Bh8-g7 returns one empty diagonal square using its original Bishop identity.',
  '81. Black completes Bg7 without further card effects.',
  '82. Qe5-d4 is one empty diagonal step and does not expose White h1/g1 flank.',
  '83. White completes Qd4 and passes to Black.',
  '84. Ra8-a6 crosses vacated a7; original Rook movement revokes final q right.',
  '85. Black completes Ra6; castling rights remain absent for both sides.',
  '86. Kg1-h1 moves to a safe adjacent square, outside every Black attack.',
  '87. White completes Kh1; Black starts with unchanged hands.',
  '88. Earthquake makes Black e7-d7 a forward empty Pawn move; reset halfmove clock.',
  '89. Black completes westward d7; White starts with orientation unchanged.',
  '90. Nh3-f4 is a legal empty knight jump.',
  '91. Figure Dance would move Kh1-h8 and Ba1-h1; Bg7 attacks h8, so restore board for self-check, spend/discard and draw Doppelganger.',
  '92. White ends the fizzled Figure Dance turn; Nh3-f4 remains completed.',
  '93. Nh7-f6 jumps onto an empty square and leaves Black e8 King safe.',
  '94. Black completes Nf6; the fizzle grants no extra White move.',
  '95. Nf4-h3 is a clear knight retreat.',
  '96. White completes Nh3, preserving both ongoing effects.',
  '97. Nf6-h5 is a clear knight jump; Black g5 Pawn remains distinct.',
  '98. Black completes Nh5, making Knight the latest moved kind.',
  '99. Doppelganger replaces White move: non-Pawn Nh3-g1 copies the latest Black Knight, lands empty without capture; spend/draw Peace Talks.',
  '100. White ends its Doppelganger replacement; no second move is granted.',
  '101. Ba1xd4 crosses empty b2,c3 and captures White Queen; White h1 King remains safe.',
  '102. Black completes Bxd4; the Queen is captured, never dead.',
  '103. Na3-c4 jumps to empty c4; the earlier Knightmare prohibition ended many turns ago.',
  '104. Peace Talks after Nc4 cancels retained Earthquake; restore normal Pawn directions, discard both cards and draw Fog of War; no new last-rank Pawn needs promotion.',
  '105. White completes cancellation of Earthquake; Pacifism alone persists.',
  '106. Bg7-e5 crosses empty f6 with no capture and no exposed Black King.',
  '107. Fatal Attraction after Be5 marks owned Ra6 and draws Toll; adjacent b5 Pacifist freezes, King exemptions and board stay unchanged.',
  '108. Black ends its magnet turn; White starts with a6 magnet active.',
  '109. Normal-orientation g2-g4 crosses empty g3, outside magnet range; create g3 opportunity.',
  '110. Fireball after quiet g4 captures center g4, Black g5 Pawn and h5 Knight simultaneously; other neighbors empty, Kings safe, remove g3 opportunity and draw Legacy.',
  '111. White completes Fireball without a second clock advance or move.',
  '112. Bd4-e3 moves one clear diagonal outside the a6 magnet neighborhood.',
  '113. Black completes Be3; neither continuing marker changes.',
  '114. Bd1-h5 crosses empty e2,f3,g4; no capture, no magnet restriction or King exposure.',
  '115. White completes the fiftieth regular move command; Black starts, all reactions resolved and no pending rescue.',
];

test('fresh iteration 010 independently reviewed campaign', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/010.json', import.meta.url), 'utf8'));
  assert.equal(trace.seed, 860010);
  assert.equal(reasons.length, trace.steps.length);
  reasons.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 14);
  const result = replayTrace(trace);
  assert.equal(result.fen, '1n1qk3/3p4/r1ppp1p1/1p2b2B/1BN5/4b3/P1PP1P2/5RNK b - - 2 26');
  assert.equal(result.orientation, 0);
  assert.equal(result.turn.color, 'black');
  assert.equal(result.turn.phase, 'beforeMove');
  assert.ok(!result.pendingRescue);
  assert.deepEqual(result.effects.map(effect => (effect as { type: string }).type), ['pacifism', 'fatal-attraction']);
  assert.equal(result.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'd2');
  assert.equal(result.pieces.find(piece => piece.id === 'white-pawn-d2')?.zone, 'captured');
  assert.deepEqual([result.players.white.deck.length, result.players.black.deck.length], [67, 70]);
});
