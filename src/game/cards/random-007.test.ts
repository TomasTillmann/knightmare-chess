import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently checked against rules.md §§8–13, 15.5, 18.2, 20–21 and
// cards.md/catalog printed timing. End-turn entries include unchanged cards,
// board and clocks; ordinary moves spend no cards. No transformations occur.
const reasons = `
1. Nb1-c3 jumps to an empty square, preserves identity and leaves Ke1 safe; halfmove 1.
2. White ends the completed Nc3 turn; Black receives its move and no cards change.
3. Ng8-f6 is an empty-square L jump; safe Ke8, halfmove 2 and fullmove 2.
4. Black ends Nf6; White receives the move without another clock increment.
5. Pd2-d3 advances one into an empty square; no capture, halfmove resets.
6. White ends d3 with Ke1 safe and both hands unchanged.
7. Pa7-a6 advances Black one into empty a6; halfmove zero, fullmove 3.
8. Black ends a6; White receives its ordinary move.
9. Ra1-b1 uses the square vacated by Nb1; White loses queenside castling only.
10. White ends Rb1, preserving the surviving kingside and Black castling rights.
11. Squaring the Circle sees exactly a8/h8/h1 occupied; Bf8 relocates to sole empty a1 without path restrictions. Both Kings stay safe, Black consumes its move, discards the card and draws Resurrection, deck 74.
12. Black ends the replacement move, resets allowances and preserves the 2/4 clocks.
13. Nc3-b5 jumps to empty b5 without exposing Ke1; halfmove 3.
14. White ends Nb5; the displaced black Bishop remains a1.
15. Pg7-g6 advances one without capture or King exposure; Black advances fullmove 5.
16. Black ends g6 with no card spend or draw.
17. Pb2-b4 crosses empty b3; the initial double step creates a b3 en-passant opportunity and resets the clock.
18. White ends b4, retaining that opportunity for Black only.
19. Ke8-f8 enters the Bishop-vacated safe square, forfeits both Black castling rights and expires b3 en passant.
20. Black ends Kf8; only White kingside castling remains.
21. Pg2-g4 crosses empty g3, resets the clock and creates the g3 en-passant opportunity.
22. White ends g4, preserving that opportunity into Black turn.
23. Passing in the Night simultaneously swaps c7/b4 and f7/e2 Pawns with identity and ownership intact. Neither King is checked, no promotion/capture occurs, en passant clears; Black spends its replacement move and draws Challenge, deck 73.
24. Black ends the simultaneous swap with hands and clocks unchanged.
25. Pa2-a3 is a clear forward step; the black Pawn on e2 attacks d1/f1 rather than Ke1.
26. White ends a3 without an unresolved King threat.
27. Kf8-g7 enters a safe adjacent square; White Pf7 attacks e8/g8, not g7.
28. Black ends Kg7; move count advances only on the move action.
29. Rb1-b3 crosses vacant b2, stops before the black b4 Pawn, and leaves Ke1 safe.
30. White ends Rb3 without changing cards or captured pieces.
31. Nf6-h5 makes an empty-square L jump; Black King remains safe.
32. Black ends Nh5, opening White move normally.
33. Ng1xe2 captures the swapped physical black f7 Pawn by an L jump; victim becomes captured, halfmove zero.
34. White ends Nxe2; no reaction was played and hands remain five.
35. Ba1-f6 follows clear b2/c3/d4/e5; no capture or King exposure, fullmove 10.
36. Black ends Bf6 with only that Bishop relocated.
37. Pa3xb4 captures the swapped physical black c7 Pawn diagonally forward; halfmove zero.
38. White ends axb4; the victim stays captured and available for a suitable future return.
39. Pb7-b6 advances to empty b6, with Black King safe and fullmove 11.
40. Black ends b6 without drawing or spending a card.
41. Ne2-c3 jumps to empty c3 without uncovering a line to Ke1.
42. White ends Nc3 with both Kings safe.
43. Qd8-f8 slides through vacant e8 into vacant f8; halfmove 2, fullmove 12.
44. Black ends Qf8 without changing hands or castling rights.
45. Nb5-d4 is a clear L jump to empty d4; Ke1 stays screened.
46. White ends Nd4 and Black receives its pre-move window.
47. Resurrection returns captured black-pawn-f7 to empty owner-second-rank a7, preserving its physical identity. No path/capture/mate occurs; replacement move consumes Black turn, clock resets, Disintegration drawn and deck 72.
48. Black ends Resurrection with the returned Pawn on a7 and no extra draw.
49. Pg4xh5 captures physical black-knight-g8 diagonally; Ke1 remains safe and the clock resets.
50. White ends gxh5; Black Knight remains captured.
51. Bf6-h4 follows empty g5 to empty h4; Pf2 blocks its diagonal toward Ke1.
52. Black ends Bh4; White is not in check through its f2 blocker.
53. Nd4-c6 jumps to empty c6; moving that Knight does not expose Ke1.
54. White ends Nc6 with no card play.
55. Blessing lets Pb6-e3 slide diagonally through empty c5/d4 without capture. It remains a Pawn, both Kings stay safe, and Black consumes its move, draws Doppelganger and leaves deck 71.
56. Black ends the Blessing replacement move; no persistent Bishop power remains.
57. Ph5-h6 is a normal forward step and gives permitted check to Kg7; White Ke1 remains safe.
58. White ends h6 and Black receives the required escape turn.
59. Pe7-e5 crosses empty e6 and creates e6 en passant; Black temporarily remains checked by h6, so this staged move requires a same-turn rescue under §11.6.
60. Challenge selects movable nonroyal White Pd3. Requiring that Pawn suppresses other White captures, including h6xg7, resolving the staged check under §11.7. Card is discarded, Peace Talks drawn, deck 70; the completed move clocks and en passant stay unchanged.
61. Black may now end its safe rescued turn; Challenge and e6 en passant persist into White turn.
62. Pd3-d4 moves the exact challenged identity into empty d4, satisfies and removes Challenge, and expires en passant. White stays safe; h6 may again check Black on its next turn.
63. White ends the satisfied Challenge turn; no residual obligation or extra card draw remains.
64. Kg7-f6 answers h6 check by moving to safe f6, outside Nc6 and all White Pawn attacks.
65. Black ends Kf6 with its King safe.
66. Guardian advances Pf2-f3 and its directly following Bf1-f2 together. The Bishop screens h4-g3-f2-e1, so the final White King is safe despite the intermediate vacancy. No capture or en passant occurs; White consumes the replacement move, draws Bog and leaves deck 74.
67. White ends Guardian with Pawn f3 and Bishop f2, and both card allowances reset.
68. Pa6-a5 advances one into vacant a5; no capture, fullmove 18.
69. Black ends a5 without altering the resurrected Pawn on a7.
70. Qd1-d3 passes clear d2 to vacant d3, leaving Ke1 safe behind Bf2.
71. White ends Qd3 with unchanged cards and captured identities.
72. Qf8xb4 follows empty e7/d6/c5 and captures White original a2 Pawn; Black Kf6 remains safe, halfmove zero.
73. No Quarter immediately follows Black regular capture without a prior card. It changes exactly white-pawn-a2 from captured to dead, with no board/clock change; Black draws Vulture, deck 69.
74. Black ends No Quarter turn; the dead Pawn cannot be revived by Winged Victory.
75. White castles e1-g1 with Rh1-f1: f1/g1 are empty, Ke1/f1/g1 are not attacked, kingside rights survived, and both moving identities lose future castling rights.
76. White ends castling; Black receives its ordinary move with no remaining castling rights.
77. Rh8-f8 slides through empty g8, no capture; Black Kf6 remains safe and fullmove 20.
78. White Bog reacts to the two-square Rook move, truncating it to h8-g8. The Rook identity is preserved, clocks stay 2/20, no mate/self-check arises; Bog is discarded, Man-Trap drawn and White deck 73.
79. Black ends the Bog-adjusted turn with Rook g8; White own-turn allowance is fresh.
80. Nc3-e2 jumps into empty e2 and leaves Kg1 safe; halfmove 3.
81. White ends Ne2 without changing cards or effects.
82. Pe3xf2 captures the Guardian Bishop diagonally in Black forward direction; the Pawn gives allowed check to Kg1 and halfmove resets.
83. Black ends exf2; White receives an escape turn, with Riposte optional and unused.
84. Kg1-g2 escapes Pf2 check to safe g2; black Rg8 is blocked by Pg6 and the Bishop diagonal does not attack g2.
85. White ends Kg2 with no remaining King check.
86. Qb4-e1 follows empty c3/d2 to empty e1; Black King safe and fullmove 22.
87. Black ends Qe1; White Kg2 is not on the Queen diagonal or rank.
88. Rf1-g1 slides one square to empty g1, leaving Kg2 safe and the Queen blocked along rank one by this Rook.
89. White ends Rg1; its Rook is the opponent last-moved piece for Doppelganger.
90. Doppelganger lets non-Pawn Bc8 copy that Rook for c8-e8 through empty d8. No capture occurs, it stays a Bishop and both Kings remain safe; replacement move increments clocks, Tournament drawn, Black deck 68.
91. Black ends Doppelganger, with no lasting Rook movement power on Be8.
92. Breakthrough permits Ph6xh7 to capture the black h7 Pawn straight forward. White King remains safe, no promotion or direct mate occurs; replacement move resets clock and draws Siege, White deck 72.
93. White ends the Breakthrough capture with its Pawn on h7 and victim captured.
94. Bh4-g5 makes an ordinary one-step diagonal move into empty g5, leaving Kf6 safe.
95. Black ends Bg5; cards and identities are unchanged.
96. Qd3-a6 follows clear c4/b5 to empty a6; Nc6 blocks its sixth-rank line toward Kf6, and Kg2 is safe.
97. White ends Qa6; Black King has no outstanding check from that blocked line.
98. Kf6xf7 captures original White e2 Pawn at f7; f7 is not attacked by Qa6/Nc6/Ne2 or Ph7, so Black King is safe.
99. Black ends Kxf7; White captured Pawn becomes eligible for a later return, with no automatic draw.
100. Ne2-c3 jumps into empty c3, leaves Kg2 safe and increments the noncapture clock.
101. White ends Nc3 with no ongoing card effect.
102. Kf7-f8 moves into empty, unattacked f8; no castling right revives, fullmove 26.
103. Black ends Kf8 and White receives its next move.
104. Rb3xb8 follows empty b4/b5/b6/b7 and captures Black original b8 Knight. Be8 screens Kf8 from the Rook, and White King stays safe.
105. Black Knightmare immediately cancels that move, restoring Rb3, Nb8 and pre-move 2/26 clocks. White must choose a different move; Black spends one response, draws Truce and leaves deck 67.
106. Ph2-h4 is different from forbidden Rb3-b8, crosses empty h3 and legally supplies White replacement move; h3 en passant created, Black response allowance remains spent.
107. White ends h4, preserving en passant into Black turn and resetting turn allowances.
108. Qe1xc1 crosses empty d1 to capture the White c1 Bishop; King safety holds, halfmove resets and h3 en passant expires.
109. Black ends Qxc1 with that Bishop captured and White King safe.
110. Pd4xe5 captures Black original e7 Pawn diagonally forward; no self-check or promotion occurs.
111. White ends dxe5, leaving captured Pawn off-board and clocks unchanged.
112. Be8-f7 resumes ordinary Bishop geometry to empty f7, proving Doppelganger did not transform it; Black King f8 stays safe.
113. Black ends Bf7 and White receives the move without any new card effect.
114. Pe5-e6 advances one to empty e6, resetting the clock and attacking f7/d7 rather than Kf8.
115. White ends e6 with no capture, promotion, or unresolved rescue.
116. Bg5-e3 follows vacant f4 to empty e3; Kf8 remains safe and the noncapture clocks become 1/29.
117. Black ends the fiftieth regular-move command; White starts a fresh turn with no pending resolution, no active effect, and no extra draw.
`.trim().split('\n');

test('random iteration 007 independent semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/007.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(reasons.length, trace.steps.length);
  reasons.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 11);
  const state = replayTrace(trace);
  assert.equal(state.fen, 'rn3kr1/p1Pp1b1P/Q1N1P1p1/p7/7P/1RN1bP2/2P2pK1/2q3R1 w - - 1 29');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-a2')?.zone, 'dead');
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-e7')?.capturedBy, 'white');
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-f7')?.square, 'a7');
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-b8')?.square, 'b8');
  assert.deepEqual([state.players.white.deck.length, state.players.black.deck.length], [72, 67]);
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.moveMade, false);
  assert.equal(state.pendingRescue, null);
  assert.deepEqual(state.effects, []);
});
