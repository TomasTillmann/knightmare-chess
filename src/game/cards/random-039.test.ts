import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { checkState, digest, type RandomTrace } from './random-campaign.js';

// Rules §§8–11, 13, 15.1 and the printed catalog timing govern this review.
// The first suspect transition is 97. Generated actions 98–117 are retained,
// but are not counted as reviewed or passed.
const rationales = [
  '1. h2-h4 crosses empty h3; initial pawn double move grants h3 en passant.',
  '2. White closes its completed move; Black receives the turn and h3 opportunity.',
  '3. d7-d6 advances one empty square and expires the old en-passant opportunity.',
  '4. Black closes its completed pawn move; White receives the turn.',
  '5. Nb1-a3 is a noncapturing L jump; neither King is exposed.',
  '6. White ends its Knight turn without changing pieces or cards.',
  '7. f7-f6 is one forward empty square; Black King remains screened.',
  '8. Black ends its completed pawn turn.',
  '9. Na3-c4 is a legal L jump to an empty square.',
  '10. White ends the Knight turn.',
  '11. Bc8-h3 crosses empty d7,e6,f5,g4; it does not capture or expose e8.',
  '12. Black plays after-move Neutrality on opposing nonroyal b2 pawn; retain marker and draw Betrayal.',
  '13. EndTurn preserves the neutral physical pawn and resets both card allowances.',
  '14. c2-c3 is a one-square advance, leaving both Kings safe.',
  '15. White ends its completed pawn move with Neutrality unchanged.',
  '16. g7-g6 is a one-square advance to an empty square.',
  '17. Black ends its completed pawn move.',
  '18. Rh1xh3 crosses empty h2 and captures the c8 Bishop; White loses kingside castling.',
  '19. White ends the capture; captured Bishop remains off board.',
  '20. Black controls neutral b2-b4; white ownership means northward direction, empty b3 and b4.',
  '21. EndTurn keeps the neutral pawn on b4 and passes control to White.',
  '22. Rh3-h2 retreats one empty square; no capture occurs.',
  '23. White ends its Rook move and expires the prior pawn opportunity.',
  '24. Black again controls neutral b4-b5; its original white forward direction persists.',
  '25. Black ends the neutral pawn move.',
  '26. Ng1-f3 jumps to an empty square without exposing e1.',
  '27. After-move Holy Quest swaps opposing Bishop f8 and Knight g8 without capture or clock change.',
  '28. White ends the turn; Holy Quest remains discarded and Holy War replaces it.',
  '29. Guardian replaces Black move: a7-a5 crosses a6; trailing a8 Rook follows to a6; no en passant.',
  '30. Black ends the consumed replacement move; queenside castling remains revoked.',
  '31. Nc4-e5 is an empty L jump with safe White King.',
  '32. White ends its Knight move.',
  '33. Blessing replaces Black move: g6-c2 crosses empty f5,e4,d3 diagonally; no capture or promotion.',
  '34. Black ends its replacement move, retaining the Pawn identity on c2.',
  '35. Nf3-g1 jumps back to the empty original square.',
  '36. White ends the Knight turn.',
  '37. Ra6-c6 crosses empty b6; neutral b5 does not attack e8.',
  '38. Black ends its Rook move.',
  '39. Ra1-b1 moves to the square vacated by its Knight; White loses remaining castling rights.',
  '40. White ends its Rook move.',
  '41. Rc6xc3 crosses vacated c5,c4 and captures White c2 physical pawn.',
  '42. No Quarter immediately follows an ordinary capture and makes exactly that captured pawn dead.',
  '43. Black ends the capture turn; No Quarter is discarded and Anathema replaces it.',
  '44. d2-d3 advances into empty d3; c3 Rook is blocked from the King by remaining pieces.',
  '45. White ends the Pawn move.',
  '46. a5-a4 advances south into an empty square.',
  '47. Black ends its Pawn move.',
  '48. Hidden Passage replaces White move, relocating e1 King to vacant safe h5; f6 pawn attacks g5, not h5.',
  '49. White ends the King relocation; no castling rights are restored.',
  '50. Bg8-e6 crosses empty f7 diagonally; e6 Bishop does not attack h5.',
  '51. Black after-move Anathema swaps White Bishop f1 and Rook b1; no capture or check is created.',
  '52. Black ends the turn with the swapped physical identities retained.',
  '53. Bb1xc2 captures the g7 physical pawn previously moved by Blessing.',
  '54. White ends its Bishop capture.',
  '55. Nf8-d7 is a noncapturing L jump.',
  '56. Black ends the Knight move.',
  '57. a2-a3 advances one empty square; no promotion or capture.',
  '58. White ends the Pawn move.',
  '59. f6-f5 advances south; its attacks on e4,g4 do not hit White King h5.',
  '60. Black ends the Pawn move.',
  '61. White controls neutral b5-b6; it threatens a7,c7 without threatening either King.',
  '62. White ends the neutral pawn move.',
  '63. Nd7xe5 captures White original b1 Knight by an L jump.',
  '64. White immediately uses Hostage: h4 pawn is captured instead, same Knight returns to h4, captor stays e5.',
  '65. Black ends the move; White reaction allowance resets for its own turn.',
  '66. Kh5-h6 enters an empty safe square; h7 pawn attacks g6, h8 Rook remains screened by h7.',
  '67. White ends its King move.',
  '68. c7xb6 captures the neutral white pawn; its Neutrality duration ends and physical card is discarded.',
  '69. Black ends the capture with no remaining Neutrality effect.',
  '70. Qd1-d2 slides one empty square.',
  '71. White ends its Queen move.',
  '72. Be6-g8 crosses empty f7; h6 King remains safe.',
  '73. Black ends the Bishop move.',
  '74. Qd2-f4 crosses empty e3 diagonally; no capture occurs.',
  '75. White after-move Crab marks its f2 Pawn; physical Pawn identity stays and replacement Betrayal is drawn.',
  '76. White ends the turn with Crab retained beside the board.',
  '77. Rc3xa3 crosses empty b3 and captures White original a2 Pawn.',
  '78. Black ends the Rook capture.',
  '79. Bc1-d2 moves one empty diagonal square.',
  '80. After-move Holy War swaps White Knight h4 and Bishop d2, preserving both identities and clocks.',
  '81. White ends its Bishop turn after the swap.',
  '82. Ra3xd3 crosses empty b3,c3 and captures White original d2 Pawn.',
  '83. Black ends its Rook capture.',
  '84. Rf1-e1 slides to empty e1; e2 Pawn blocks its line toward Black King.',
  '85. White ends its Rook move.',
  '86. Rd3-h3 crosses empty e3,f3,g3; White Bishop h4 screens King h6.',
  '87. Black ends its Rook move.',
  '88. Rh2xh3 captures Black original a8 Rook on the adjacent square.',
  '89. White ends its Rook capture.',
  '90. Ke8-f7 enters a safe adjacent square: White Queen f4 is blocked by Black f5 Pawn.',
  '91. Black ends the King move and loses its last castling right.',
  '92. Rh3-e3 crosses empty g3,f3; no capture occurs.',
  '93. White ends its Rook move.',
  '94. b6-b5 advances the original Black c7 Pawn south one square.',
  '95. Black ends its Pawn turn.',
  '96. Kh6xh7 is provisional because Rh8 attacks h7; unused White Challenge(b8) can suppress that attack (§11.7).',
  '97. SUSPECT: Black Revenge(f2) is an unrelated after-opponent-move capture, not a cancellation; it must not rewind White Kxh7 or erase its available Challenge rescue (§§8.3,11.6).',
];

test('iteration 039: unrelated opposing Revenge must preserve the provisional move', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/039.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860039);
  assert.equal(trace.steps.length, 117);
  assert.equal(rationales.length, 97);
  const prefix = trace.steps.slice(0, rationales.length);
  assert.equal(prefix.filter(({ action }) => action.type === 'move').length, 42);
  assert.equal(prefix.filter(({ action }) => action.type === 'playCard').length, 11);
  let state = createGameState(trace.initial);
  for (const [index, { action, expected }] of prefix.entries()) {
    const n = index + 1;
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    checkState(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const moving = before.pieces.find(piece => piece.square === action.from)!;
      const setup = parseFen(before.fen).unwrap();
      if (moving.neutral) setup.board.set(from, { color: before.turn.color, role: moving.role });
      const position = Chess.fromSetup(setup).unwrap();
      // Neutral pawn directions come from original owner (§15.1), not controller.
      if (moving.neutral && moving.owner !== before.turn.color) {
        assert.equal(action.from[0], action.to[0]);
        assert.ok(to - from === 8 || to - from === 16);
        assert.equal(setup.board.get(to), undefined);
        if (to - from === 16) assert.equal(setup.board.get(from + 8), undefined);
        position.board.take(from);
        position.board.set(to, { color: moving.owner, role: moving.role });
      } else {
        assert.equal(position.isLegal({ from, to }), n !== 96, rationales[index]);
        position.play({ from, to });
      }
      assert.equal(makeBoardFen(position.board), state.fen.split(' ')[0], rationales[index]);
      assert.equal(state.pieces.find(piece => piece.id === moving.id)!.square, action.to);
      assert.equal(state.turn.color, before.turn.color);
      assert.equal(state.turn.moveMade, true);
      for (const owner of ['white', 'black'] as const) {
        assert.deepEqual(state.players[owner].hand, before.players[owner].hand, 'regular moves do not spend hands');
        assert.deepEqual(state.players[owner].deck, before.players[owner].deck, 'regular moves do not draw');
        if (n !== 68) assert.deepEqual(state.players[owner].discard, before.players[owner].discard);
      }
      assert.equal(!!state.pendingRescue, n === 96);
    }
    if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces);
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.players, before.players);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.equal(state.turn.moveMade, false);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
    }
    if (action.type === 'playCard' && n !== 97) {
      const owner = before.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black';
      assert.equal(state.players[owner].deck.length, before.players[owner].deck.length - 1);
      assert.equal(state.players[owner].hand.length, 5);
      assert.ok(!state.players[owner].hand.some(card => card.id === action.cardInstanceId));
      assert.equal(state.turn.cardPlays[owner], 1);
    }
    if (n === 12) {
      assert.equal(state.pieces.find(p => p.id === 'white-pawn-b2')!.neutral, true);
      assert.deepEqual(state.effects, [{ type: 'neutrality', owner: 'black', card: { id: 'black-hand-1-neutrality', cardId: 'neutrality' }, pieceId: 'white-pawn-b2' }]);
      assert.equal(state.fen, before.fen);
    }
    if (n === 29) {
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-a7')!.square, 'a5');
      assert.equal(state.pieces.find(p => p.id === 'black-rook-a8')!.square, 'a6');
      assert.deepEqual(state.enPassant, []);
    }
    if (n === 42) assert.equal(state.pieces.find(p => p.id === 'white-pawn-c2')!.zone, 'dead');
    if (n === 48) assert.equal(state.pieces.find(p => p.royal && p.owner === 'white')!.square, 'h5');
    if (n === 64) {
      assert.equal(state.pieces.find(p => p.id === 'white-knight-b1')!.square, 'h4');
      assert.equal(state.pieces.find(p => p.id === 'white-pawn-h2')!.zone, 'captured');
      assert.equal(state.pieces.find(p => p.id === 'black-knight-g8')!.square, 'e5');
    }
    if (n === 68) {
      assert.deepEqual(state.effects, []);
      assert.equal(state.pieces.find(p => p.id === 'white-pawn-b2')!.neutral, false);
      assert.equal(state.players.black.discard.at(-1)!.cardId, 'neutrality');
    }
    if (n === 75) assert.deepEqual(state.effects, [{ type: 'crab', owner: 'white', card: { id: 'white-deck-1-crab', cardId: 'crab' }, pieceId: 'white-pawn-f2' }]);
    if (n === 96) {
      const rescue = applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'b8' });
      assert.ok(rescue.ok, 'b8 Knight is movable and Challenge suppresses Rh8 capture');
      assert.equal(!!rescue.state.pendingRescue, false);
      assert.equal(rescue.state.pieces.find(p => p.id === 'white-king-e1')!.square, 'h7');
      assert.ok(applyAction(rescue.state, { type: 'endTurn' }).ok);
    }
    if (n === 97) {
      // Revenge may capture the Crab, but it has no move-cancellation text.
      // At minimum, Black must not consume White's still-open rescue window.
      assert.equal(state.pieces.find(p => p.id === 'white-king-e1')!.square, 'h7', rationales[index]);
      assert.equal(state.pieces.find(p => p.id === 'black-pawn-h7')!.zone, 'captured');
      assert.equal(state.pieces.find(p => p.id === 'white-pawn-f2')!.zone, 'captured');
      assert.equal(state.turn.moveMade, true);
      assert.ok(state.pendingRescue);
      assert.equal(state.turn.cardPlays.white, 0);
    } else assert.equal(digest(state, 1), expected, rationales[index]);
  }
});
