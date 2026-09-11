import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independent sequential review against rules.md §§8–14, 15.4, 16.2,
// 17.3, 18.1, 18.3 and 22.5; cards.md and printed catalog timing.
// Quiet moves increment halfmove; Pawn moves/captures reset it. Black moves
// advance fullmove. EndTurn preserves FEN and cards while resetting allowances.
// All listed paths were checked against the preceding board, including royal
// safety. Unmentioned physical identities, hands and effects remain unchanged.
const reasons = [
  '1. a2-a3 is an empty one-step Pawn move; White King remains screened; clock resets.',
  '2. White completed its move; Black starts with no card play or redraw.',
  '3. Black Plots is legal before moving; discard/draw once, no displacement or clock change.',
  '4. g8-h6 is a Knight jump to empty h6; ordinary move closes unused Plots allowance.',
  '5. Black ends; White allowance resets and fullmove remains 2.',
  '6. g1-f3 is a Knight jump to an empty square, with no exposed King.',
  '7. White ends with board and five-card hands preserved.',
  '8. b7-b6 is an empty forward Pawn step in original orientation.',
  '9. Earthquake is after-move and continuing: counterclockwise makes White forward east and Black west; h2 and a7 promote to Queens, opponent first; retain card and draw Confabulation.',
  '10. Black ends with orientation and both new Queen identities retained.',
  '11. Promoted h2 Queen reaches e5 via empty g3/f4; no capture or royal exposure.',
  '12. White ends; no card or extra move was used.',
  '13. Promoted a7 Queen moves to empty a6, preserving its promoted Pawn identity.',
  '14. Black Truce is legal after moving; retain its continuing card and draw Cowardice; no King currently checked.',
  '15. End Black turn; Truce and Earthquake remain active.',
  '16. e5-c5 Queen traverses empty d5 without capturing under Truce.',
  '17. White ends; neither King checked and Truce persists.',
  '18. a6-d3 Queen traverses empty b5/c4; no capture and White King screened.',
  '19. Black ends; no hand or effect change.',
  '20. c5-c3 Queen traverses empty c4; adjacent enemy d3 is not captured under Truce.',
  '21. White ends; Truce continues with legal quiet moves available.',
  '22. Black b6-a6 is westward forward motion to its rotated last rank; Bishop promotion is legal.',
  '23. After moving Black uses Cowardice b2-a2: one empty westward backward step for White; clocks preserved, card discarded and Revenge drawn.',
  '24. Black ends with relocated Pawn and promotion preserved.',
  '25. h1-h5 Rook has empty h2/h3/h4 path; White kingside castling right is lost.',
  '26. White Vendetta is legal after moving; retained temporarily and replaced with Cowardice.',
  '27. Black has no legal capture under Truce, so Vendetta expires into White discard at turn start.',
  '28. d3-d5 Queen has empty d4 path; expired Vendetta permits a quiet move.',
  '29. Black ends with Truce continuing and no capture.',
  '30. c3-c4 is a clear one-square Queen move under Truce.',
  '31. White ends; board and card zones unchanged.',
  '32. d5-b5 Queen crosses empty c5; no capture or check.',
  '33. Black ends with both five-card hands unchanged.',
  '34. f3-g5 Knight jump lands empty without capturing.',
  '35. White ends; all active restrictions remain.',
  '36. Black Masquerade replaces the move: a8 Rook follows clear Queen diagonal b7/c6/d5/e4/f3; no capture, queenside right lost, discard/draw once.',
  '37. Black replacement move completes the turn; no second regular move follows.',
  '38. a3-b3 is White forward east after Earthquake; Pawn move resets halfmove.',
  '39. White ends, preserving Truce and the rotated board.',
  '40. b5-c5 is an empty one-square Queen move.',
  '41. Black ends without drawing or changing effects.',
  '42. h5-h3 Rook crosses empty h4 and does not capture.',
  '43. White ends; move counter is not advanced again.',
  '44. f3-f4 Rook moves one square to empty f4.',
  '45. After Black move Dungeon relocates opposing f2 Pawn to vacant a8, with no promotion; draw Figure Dance and forbid that physical Pawn during next White turn.',
  '46. Black ends; Dungeon restriction remains for White forthcoming turn.',
  '47. a2-b2 moves the other White Pawn east; Dungeon target a8 does not move.',
  '48. White turn ends, expiring Dungeon restriction while its already-discarded card stays discarded.',
  '49. b8-c6 is a clear Knight jump; a8 Pawn is not captured.',
  '50. Black ends; no pending restriction or card action.',
  '51. h3-h4 is a quiet Rook step with no royal exposure.',
  '52. White ends, keeping both continuing cards.',
  '53. Black Confabulation replaces move: e7 Pawn steps west onto own d7 Pawn, merging without capture; one board representative, both identities retained; Pawn clock resets and card remains active.',
  '54. Black ends after Confabulation, without a second move.',
  '55. g5-e4 is an empty Knight destination and no capture under Truce.',
  '56. White ends; merged black Pawns remain together.',
  '57. f4-g4 is an empty Rook step; h4 White Rook is not captured.',
  '58. Black ends; Truce still has neither check nor stalemate.',
  '59. a1-a4 Rook crosses vacant a2/a3; last White castling right is revoked.',
  '60. White Cowardice targets merged Pawn d7-e7, backward east for Black; both components stay merged, clock preserved, Fanatic drawn.',
  '61. White ends; merged Pawn remains at e7 and card allowance resets.',
  '62. c8-b7 Bishop moves diagonally to vacant b7.',
  '63. Black ends with all capture protection preserved.',
  '64. h4-h3 is an empty quiet Rook step.',
  '65. White ends with hands and FEN unchanged.',
  '66. d8-d7 Queen enters the square vacated by the merged Pawns.',
  '67. Black ends without a card or capture.',
  '68. Annexation replaces White move: b3-d3 via c3 and a8-c8 via b8 are simultaneously clear eastward two-steps; rotated second-rank b3 and first-rank a8 grant independent c3 and b8 en-passant rights under FAQ7; no promotion.',
  '69. White ends; both c3 and b8 en-passant rights remain for Black immediately following move.',
  '70. b7-a8 Bishop moves to now-empty a8; both unused en-passant rights expire, while the pre-move Chaos checkpoint retains both.',
  '71. Black ends; no en-passant or pending choice remains.',
  '72. e4-g3 Knight jumps to empty g3 without capturing.',
  '73. White ends under continuing Truce.',
  '74. d7-d8 Queen returns to empty d8.',
  '75. Black ends; fullmove stays 18 after the completed move.',
  '76. c4-f4 Queen traverses empty d4/e4 to vacant f4.',
  '77. White ends without moving or altering card zones.',
  '78. c7-b7 is Black forward west; b7 is empty, not last rank, so no promotion.',
  '79. Black ends; Pawn clock stays reset.',
  '80. White Hidden Passage replaces move, relocating royal e1-h2 to empty safe h2; discard/draw Plots, preserve all other pieces.',
  '81. White replacement move ends; no ordinary move is granted.',
  '82. c5-g1 Queen diagonal passes empty d4/e3/f2; g1 attacks h2 King, ending Truce and putting its card in Black discard.',
  '83. Black ends with White checked by g1 Queen but a legal capture escape available.',
  '84. h2xg1 King captures checking promoted Queen; g3 Knight/g2 Pawn block g4 Rook and no other Black piece attacks g1; capture clock resets.',
  '85. White ends safely; captured Queen identity remains among captured pieces.',
  '86. g4-h4 Rook reaches empty h4; neither Black King nor White g1 King is exposed.',
  '87. Black ends; Truce stays discarded.',
  '88. f4-f2 Queen passes empty f3; White g1 King remains safe.',
  '89. White ends; no capture, promotion or effect change.',
  '90. c6-d4 Knight jumps to an empty square, with Black King still screened.',
  '91. Black ends with no pending card or rescue.',
  '92. h3-h1 Rook passes empty h2; returning home does not restore castling rights.',
  '93. White ends safely and leaves both continuing effects.',
  '94. d4-f5 Knight jumps to empty f5, without capturing.',
  '95. Black Figure Dance after move cycles h1-h8, h8-a8, a8-a1 simultaneously; a1 was vacant, no capture/promotion, remaining Black castling right revoked; f8 Bishop shields e8 King.',
  '96. Black ends after the corner relocation; card discarded, Vendetta replacement retained.',
  '97. f2-f3 Queen moves to vacant f3; White King remains safe.',
  '98. White ends without additional effects.',
  '99. Promoted a6 Bishop crosses empty b5 to c4; its attack toward g1 is blocked by d3 Pawn.',
  '100. Black ends; neither King is in check.',
  '101. f3-f4 Queen steps onto empty f4 with no exposed King.',
  '102. White ends; captured promoted Queen and merged Pawns remain in their correct zones.',
  '103. a8-a7 Rook moves to empty a7, retaining identity after Figure Dance.',
  '104. Black ends; no card or extra clock advancement.',
  '105. f4-e5 Queen steps diagonally to empty e5; e7 merged Pawns block the line to Black King.',
  '106. White ends safely; no direct-card mate involved.',
  '107. f5-d6 Knight jumps to empty d6 without exposing Black King.',
  '108. Black ends; normal White move and card allowances available.',
  '109. White Plots before moving is spent and replaced by Challenge; no board or clock change, newly drawn Challenge is not a nested eligible card.',
  '110. g2-h2 Pawn moves east to rotated last rank and promotes to Knight; ordinary move closes unused Plots allowance; halfmove resets.',
  '111. White ends after promotion; both White Knights retain distinct physical identities.',
  '112. d6-f5 Knight jumps to empty f5; no King safety issue.',
  '113. Black ends without altering any card or piece.',
  '114. g3-h1 Knight jumps to empty h1; vacating g3 does not expose g1 King to h4 Rook.',
  '115. White ends safely with both effects unchanged.',
  '116. f5-d6 Knight completes regular move 50; no capture, clock 3 and fullmove 28.',
  '117. Final Black endTurn leaves White beforeMove, no unresolved choice/rescue, correct cards and final board.',
];

test('random campaign iteration 009 independently reviewed trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/009.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860009);
  assert.equal(reasons.length, trace.steps.length);
  reasons.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 13);
  const state = replayTrace(trace);
  assert.equal(state.fen, '2Pqkb1R/rp2pppp/3n3n/4Q3/R1b4r/3P4/1PPPP2N/bNBQ1BKN w - - 3 28');
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.moveMade, false);
  assert.equal(state.pendingRescue, null);
  assert.deepEqual(state.effects.map(effect => (effect as { type: string }).type), ['earthquake', 'confabulation']);
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-a7')?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-e7')?.zone, 'away');
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d7')?.square, 'e7');
});
