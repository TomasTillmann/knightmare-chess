import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkState, digest, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';

// Reviewed against rules §§2, 8-13, 15.1, 17.1, 20 and the printed catalog
// metadata. All quiet moves below leave the e1/e8 Kings screened and safe;
// neutral a7 retains Black ownership and southward Pawn movement throughout.
// The first invalid state is action 55. Actions 56-119 are NOT approved.
const rationale = [
  '1. White a2-a4 crosses empty a3 to empty a4; Pawn clock resets and a3 en passant is available.',
  '2. End White turn: preserve a3 opportunity and board; Black receives a fresh move and both allowances reset.',
  '3. Black Ng8-f6 is a legal empty-square jump; expire a3, increment quiet clock and Black fullmove.',
  '4. End Black turn with no card or unresolved check; White receives its move without another clock increment.',
  '5. White Nb1-a3 is an empty-square Knight jump; quiet clock becomes 2.',
  '6. Holy War after move swaps friendly Ng1 and Bc1 without capturing; identities and clocks remain; discard once, draw Anathema.',
  '7. End White turn after the move and Holy War; reset both allowances, preserve the swapped pieces.',
  '8. Black b7-b6 is one empty forward square; reset Pawn clock and advance to fullmove 3.',
  '9. White Chaos immediately cancels b7-b6, restores b7 and clocks 2/2, gives Black a different move; spend Chaos and draw Evangelists.',
  '10. Black Nf6-g4 is a distinct legal replacement jump; clocks become 3/3 and White reaction remains spent.',
  '11. End Black turn and clear its canceled-move restriction; both card allowances refresh.',
  '12. White Knight originally g1 jumps c1-a2, vacated by the opening Pawn; clock becomes 4.',
  '13. Neutrality after move targets opposing nonroyal nonqueen a7 Pawn; retain marker, draw Merciless, preserve board and clocks.',
  '14. End White turn; neutral a7 remains the same Black-owned physical Pawn with no capture.',
  '15. Black moves its neutral a7 Pawn south to empty a6; clock resets and fullmove becomes 4.',
  '16. End Black turn with neutral marker unchanged and no extra draw.',
  '17. White h2-h4 crosses empty h3; reset clock and create h3 en passant for this physical Pawn.',
  '18. Anathema after move exchanges opposing Bf8/Rh8 without a move or capture; preserve rights and h3 opportunity, discard and draw Cathedral.',
  '19. End White turn preserves h3 en passant and swapped physical Black identities.',
  '20. Black Masquerade replaces move: Ng4-g3 uses one empty Queen-style orthogonal square, no capture; expire h3, clocks 1/5; draw Guardian.',
  '21. End Black replacement turn; White receives a move, no extra card draw.',
  '22. White f2-f4 crosses empty f3; Pawn clock resets and f3 opportunity names white-pawn-f2.',
  '23. End White turn preserves f3 opportunity and all physical identities.',
  '24. Black f7-f6 advances one empty square; expire f3 and reset clock, fullmove 6.',
  '25. End Black turn with no unresolved effects; White starts beforeMove.',
  '26. Evangelists replaces White move: friendly Bf1 and opposing Bh8 exchange, no capture or exposed King; clocks 1/6, draw Crusade.',
  '27. End White replacement turn; both swapped Bishops keep original colors and identities.',
  '28. Black e7-e6 advances into an empty square; e8 stays safe and fullmove reaches 7 with Pawn clock zero.',
  '29. End Black turn, retaining the neutral a6 Pawn and swapped Bishops.',
  '30. White Bishop originally c1 moves g1-h2 one empty diagonal; clock 1, no capture.',
  '31. End White turn; unused card allowances reset without mandatory discard.',
  '32. Black Nb8-c6 is an empty-square Knight jump; clock 2 and fullmove 8.',
  '33. End Black turn; White starts with one Regular Move available.',
  '34. White Na2-b4 is an empty-square jump; clock 3, identities unchanged.',
  '35. End White turn with both Kings safe; Black card allowance remains available.',
  '36. Black g7-g5 crosses empty g6 and lands empty; reset clock, fullmove 9, g6 en passant belongs to g7 Pawn.',
  '37. End Black turn retains the g6 opportunity for White.',
  '38. White b2-b3 advances to empty b3, expires g6 opportunity and resets clock.',
  '39. End White turn; no effects or hands change.',
  '40. Black Ng3-e4 jumps into empty e4; it attacks d2/f2 but does not check e1, clocks 1/10.',
  '41. End Black turn; White may use either color of the neutral Pawn.',
  '42. White controls neutral Black a6 Pawn and moves it south to empty a5; original owner/direction and marker persist, Pawn clock zero.',
  '43. Black Chaos cancels that White move even though the physical Pawn is Black-owned; restore a6 and clock 1/10; draw Knightmare once.',
  '44. White f4-f5 is a different legal replacement into empty f5; clock resets, Black reaction allowance stays consumed.',
  '45. End White turn clears Chaos restriction and refreshes both card allowances.',
  '46. Black physical h8 Rook moves f8-g8 one empty horizontal square; revoke its kingside right, clocks 1/11.',
  '47. End Black turn preserves only White rights plus Black queenside right.',
  '48. White a4-a5 advances to empty a5; neutral a6 Pawn does not attack e1; Pawn clock zero.',
  '49. Black Knightmare cancels a4-a5, restores a4 and clock 1/11, spends its distinct card and draws Dubbing; White must choose another move.',
  '50. White Nb4-a2 is a distinct legal replacement jump into empty a2; clock 2, no capture.',
  '51. End White turn clears Knightmare replacement prohibition and resets allowances.',
  '52. Black Dubbing replaces move: Bf1-e3 is a noncapturing Knight jump into empty e3; Bishop identity retained, clocks 3/12, draw Toll.',
  '53. End Black replacement turn; temporary Knight movement ends, e3 piece remains a Bishop.',
  '54. White Na3-b5 is an empty-square Knight jump crossing ranks 4/5 toward Black; clock 4 and a valid Toll trigger.',
  '55. Black Toll takes the selected White a4 Pawn as captured, preserves Nb5 and White completed turn, spends once and draws Forced March. Capture must reset the halfmove clock to 0 under ordinary capture/draw semantics (§2); actual FEN incorrectly retains 4.',
] as const;

test('iteration 011: Toll capture resets the halfmove clock at first invalid action 55', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/011.json', import.meta.url), 'utf8')) as RandomTrace;
  const reviewed = trace.steps.slice(0, 55);
  assert.equal(rationale.length, reviewed.length);
  assert.equal(trace.seed, 860011);
  assert.equal(reviewed.filter(step => step.action.type === 'move').length, 23);
  assert.equal(reviewed.filter(step => step.action.type === 'playCard').length, 10);
  let state = createGameState(trace.initial);
  for (const [index, step] of reviewed.entries()) {
    const before = digest(state);
    const result = applyAction(state, step.action);
    assert.equal(digest(state), before, `action ${index + 1} must not mutate input`);
    assert.ok(result.ok, rationale[index]);
    state = result.state;
    checkState(state);
    if (index < 54) assert.equal(digest(state), step.expected, rationale[index]);
  }
  assert.deepEqual(state.pieces.find(piece => piece.id === 'white-pawn-a2'), {
    id: 'white-pawn-a2', owner: 'white', role: 'pawn', originalRole: 'pawn',
    square: null, zone: 'captured', capturedBy: 'black', promoted: false, royal: false, neutral: false,
  });
  assert.equal(state.pieces.find(piece => piece.id === 'white-knight-b1')?.square, 'b5');
  assert.deepEqual(state.turn, { color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 0, black: 1 } });
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.orientation, 0);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['toll', 'man-of-straw', 'merciless', 'cathedral', 'crusade']);
  assert.deepEqual(state.players.black.hand.map(card => card.cardId), ['forbidden-city', 'man-of-straw', 'pacifism', 'guardian', 'forced-march']);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), ['masquerade', 'chaos', 'knightmare', 'dubbing', 'toll']);
  assert.deepEqual([state.players.white.deck.length, state.players.black.deck.length], [70, 70]);
  assert.deepEqual(state.effects, [{ type: 'neutrality', owner: 'white',
    card: { id: 'white-hand-2-neutrality', cardId: 'neutrality' }, pieceId: 'black-pawn-a7' }]);
  assert.equal(state.fen, 'r1bqk1rB/1ppp3p/p1n1pp2/1N3Pp1/4n2P/1P2b3/N1PPP1PB/R2QK2R b KQq - 0 12', rationale[54]);
});
