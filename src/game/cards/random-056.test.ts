import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

// Reviewed against rules §§8–11, 13.8, 15.3 and the printed catalog timing.
// Each entry covers identity, unobstructed geometry, royalty, clock and card accounting.
const rationales = [
  '1. f2-f3 is one white Pawn step to empty f3; e1 remains shielded; Pawn clock resets.',
  '2. White finishes f3; Black starts, with the same board and no automatic draw.',
  '3. c7-c5 crosses empty c6 from the starting rank; record c6 en passant; Black advances fullmove.',
  '4. Black finishes c5; White receives the c6 en-passant window.',
  '5. b1-c3 is an empty Knight jump; no King exposure; c6 opportunity expires.',
  '6. White finishes Nc3; Black starts with unchanged material and cards.',
  '7. g8-f6 is an empty Knight jump; Black King remains behind Pawns.',
  '8. Black finishes Nf6; White starts; no extra draw.',
  '9. d2-d3 is one empty forward Pawn step, opening c1 Bishop; reset clock.',
  '10. White finishes d3; Black starts without board or hand changes.',
  '11. d8-c7 is one diagonal Queen step into the vacated Pawn square.',
  '12. Black finishes Qc7; White starts with no changed effects.',
  '13. c3-a4 is an empty Knight jump; e1 remains safe.',
  '14. White finishes Na4; Black starts without a draw.',
  '15. g7-g5 crosses empty g6; record g6 en passant and reset clock.',
  '16. Black finishes g5; White receives that en-passant opportunity.',
  '17. c1-d2 is one empty Bishop diagonal; moving expires unused g6 en passant.',
  '18. After-move Rebirth places enemy h7 Pawn on empty g7, a legal starting Pawn square; no capture or clock advance; draw Masquerade.',
  '19. White finishes Rebirth; Black starts with White allowance reset.',
  '20. f6-e4 is an empty Knight jump; Black King e8 is safe.',
  '21. After-move Coup selects owned g7 Pawn, neither Rook nor Queen; h7 identity becomes royal and e8 becomes capturable Prince; retain Coup and draw Heresy.',
  '22. Black finishes Coup; White starts; physical roles and castling records remain unchanged.',
  '23. d3-d4 is one empty Pawn step; no line reaches White King.',
  '24. White finishes d4; Black starts with royalty at g7.',
  '25. b7-b5 crosses empty b6; new b6 en-passant opportunity; g7 royal remains safe.',
  '26. Black finishes b5; White receives the b6 opportunity.',
  '27. a1-b1 is an empty Rook step; revoke White queenside castling; expire b6 opportunity.',
  '28. White finishes Rb1; Black starts; no castling restoration.',
  '29. e4-d6 is an empty Knight jump; it does not uncover an attack on royal g7.',
  '30. Black finishes Nd6; White starts with same cards and Coup.',
  '31. c2-c3 is one empty forward Pawn step; clock resets.',
  '32. White finishes c3; Black starts with unchanged physical identities.',
  '33. g5-g4 is one Black forward Pawn step into empty g4; this is the original g7 Pawn, not the royal h7 Pawn.',
  '34. Black finishes g4; White starts while royal Pawn remains g7.',
  '35. d4-d5 is an empty Pawn step, keeping White King safe.',
  '36. After-move Holy Quest exchanges enemy f8 Bishop and b8 Knight without capture; neither new square attacks e1 or mates g7; draw Truce.',
  '37. White finishes Holy Quest; Black starts; swapped identities persist.',
  '38. d6-f5 is an empty Knight jump; royal g7 remains safe.',
  '39. Black finishes Nf5; White starts with same board and cards.',
  '40. a4xc5 is a Knight jump capturing original black c7 Pawn; only that identity becomes captured; clock resets.',
  '41. White finishes Nxc5 without playing No Quarter; captured Pawn remains returnable.',
  '42. e7-e6 is an empty Black Pawn step; g7 royal remains screened.',
  '43. Black finishes e6; White starts; captured c7 Pawn stays captured.',
  '44. h2-h3 is an empty Pawn step; opens h2 for Rook.',
  '45. White finishes h3; Black starts with no draw.',
  '46. f5-h4 is an empty Knight jump; it does not check e1.',
  '47. Black finishes Nh4; White starts with no card changes.',
  '48. h1-h2 is an empty Rook step; revoke remaining White castling right.',
  '49. White plays Truce after Rh2 with neither royal checked; capture prohibition remains active, retain card and draw Heresy.',
  '50. White finishes Truce; Black starts with capture prohibition active.',
  '51. c7-d8 is an empty Queen diagonal, permitted under Truce; fullmove advances.',
  '52. Black finishes Qd8; White starts; Truce remains active.',
  '53. d2-h6 traverses empty e3,f4,g5; Bishop attacks royal g7, ending Truce and discarding it; g7-g6 is an escape so this is not mate.',
  '54. White finishes Bh6 check; Black starts checked at g7 with an available response.',
  '55. d8-a5 crosses empty c7,b6; leaves g7 checked provisionally under §11.6 because after-move Heresy can relocate the checking Bishop; pending rescue prevents ending turn.',
  '56. Siege swapping f8 Knight and a8 Rook cannot remove h6-g7 check; spend/draw Chaos, fizzle and roll back provisional Qa5 because no saving card allowance remains.',
  '57. Royal g7-g6 retains Pawn movement and physical h7 identity; empty g6 escapes h6 Bishop; royal movement revokes Black castling; Pawn clock resets.',
  '58. Black finishes royal g6 escape; White starts with Siege spent.',
  '59. d1-d3 crosses empty d2; Queen stops before own d5 Pawn; White King safe.',
  '60. White finishes Qd3; Black starts with royal Pawn g6.',
  '61. h4-f5 is an empty Knight jump; Knight screens d3-e4-f5-g6 Queen line.',
  '62. Black finishes Nf5; White starts with that screen intact.',
  '63. h6-c1 follows empty g5,f4,e3,d2; no capture and no exposure of e1.',
  '64. After-move Heresy moves Black Bishops c8-c7,b8-b7 first, then White c1-c2,f1-f2; all adjacent empty opposite-color squares; four identities preserved; draw Dungeon.',
  '65. White finishes Heresy; Black starts with bishops on their new square colors.',
  '66. a7-a6 is one empty Pawn step; g6 royal remains screened by f5 Knight.',
  '67. Black finishes a6; White starts; no capture or cards.',
  '68. h3xg4 is a forward diagonal Pawn capture of original g7 Pawn; royal h7 identity at g6 survives.',
  '69. White finishes hxg4; original g7 Pawn remains captured, never dead.',
  '70. f7-f6 is an empty Black Pawn step; does not remove f5 screen.',
  '71. Black finishes f6; White starts with g6 royal safe.',
  '72. f3-f4 is an empty White Pawn step; Queen d3 line still blocked by f5 Knight.',
  '73. White finishes f4; Black starts with no capture or draw.',
  '74. Long Jump f5-a3 targets empty opposite-color a3 but exposes Qd3-e4-f5-g6 against royal Pawn; fizzle preserves board, spends/draws Truce and consumes move because Black began safe.',
  '75. Black finishes consumed replacement move; White starts; f5 Knight stays put.',
  '76. a2-a3 is an empty Pawn step; failed Long Jump never occupied a3.',
  '77. White finishes a3; Black starts with same royalty and cards.',
  '78. b7-c8 is a Bishop diagonal to empty c8; preserves original f8 Bishop identity.',
  '79. Black finishes Bc8; White starts; g6 remains screened.',
  '80. c2-a4 traverses empty b3; Bishop diagonal does not expose e1.',
  '81. White finishes Ba4; Black starts without card changes.',
  '82. c7-d6 is one empty Bishop diagonal; original c8 Bishop identity preserved.',
  '83. Black plays Truce after Bd6 with neither royal checked; retain continuing card and draw Toll.',
  '84. Black finishes Truce; White starts under capture prohibition.',
  '85. h2-h4 traverses empty h3; noncapture Rook move allowed under Truce; no royal check.',
  '86. White finishes Rh4; Black starts; Truce remains.',
  '87. h8-h6 traverses empty h7; Rook faces opposing h4 Rook but cannot capture under Truce.',
  '88. Black finishes Rh6; White starts; no royal check ends Truce.',
  '89. e1-f1 is an empty royal King step; no enemy line reaches f1; already absent castling rights stay absent.',
  '90. White finishes Kf1; Black starts with royal Pawn at g6.',
  '91. e8-e7 is one Prince step into empty e7; original King is capturable and g6 alone remains royal.',
  '92. Black finishes Prince e7; White starts; no check or Truce expiry.',
  '93. g4-g5 is one empty White Pawn step; it does not attack g6 because Pawns capture diagonally.',
  '94. White finishes g5; Black starts with Truce and g6 royal intact.',
  '95. e7-e8 is one empty Prince step; no restoration of castling or royal identity.',
  '96. Black finishes Prince e8; White starts; cards and board preserved.',
  '97. f2-g3 is an empty Bishop diagonal; f1 royal stays safe; Truce remains.',
  '98. White finishes Bg3; Black starts with unchanged material.',
  '99. e8-e7 is one empty Prince step, permitted independently of Prince attack status.',
  '100. Black finishes Prince e7; White starts; no automatic draw.',
  '101. b1-c1 is an empty Rook step; c3 Pawn blocks its file beyond c2.',
  '102. After-move Challenge names opposing h6 Rook, neither royal nor Queen, with legal noncapture h7 available even under Truce; draw Forbidden City.',
  '103. White finishes Challenge; Black starts bound to the physical h8 Rook now on h6.',
  '104. h6-h7 is an empty Rook step satisfying Challenge, which expires; Truce and Coup persist.',
  '105. Black finishes the compelled Rh7; White starts unrestricted.',
  '106. c1-a1 traverses empty b1; Rook returns without restoring lost castling rights.',
  '107. White finishes Ra1; Black starts with unchanged effects.',
  '108. e7-f7 is an empty Prince step; g6 royal remains untouched; noncapture clock reaches 7 and fullmove 26.',
  '109. Black finishes Prince f7; White starts, no pending choices or rescue; Coup and Black Truce remain.',
];

test('iteration 056 deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/056.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860056);
  assert.equal(rationales.length, trace.steps.length);
  rationales.forEach((text, index) => assert.ok(text.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(({ action }) => action.type === 'playCard').length, 9);
  const final = replayTrace(trace);
  let state = createGameState(trace.initial);
  const snapshots = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const result = applyAction(state, action);
    assert.ok(result.ok, rationales[index]);
    const after = result.state;
    if (action.type === 'endTurn') {
      assert.equal(after.fen, state.fen);
      assert.deepEqual(after.pieces, state.pieces);
      assert.deepEqual(after.players, state.players);
      assert.deepEqual(after.turn, { color: state.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = state.pieces.find(piece => piece.square === action.from)!;
      const victim = state.pieces.find(piece => piece.square === action.to);
      assert.ok(mover && mover.owner === state.turn.color);
      const dx = action.to.charCodeAt(0) - action.from.charCodeAt(0);
      const dy = Number(action.to[1]) - Number(action.from[1]);
      if (mover.role === 'knight') assert.equal(Math.abs(dx * dy), 2);
      else if (mover.role === 'pawn') {
        const forward = mover.owner === 'white' ? 1 : -1;
        assert.ok(victim ? Math.abs(dx) === 1 && dy === forward : dx === 0 && (dy === forward || dy === 2 * forward && action.from[1] === (forward === 1 ? '2' : '7')));
      } else {
        assert.ok(mover.role === 'rook' ? dx === 0 || dy === 0 : mover.role === 'bishop' ? Math.abs(dx) === Math.abs(dy) : mover.role === 'king' ? Math.max(Math.abs(dx), Math.abs(dy)) === 1 : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy));
      }
      if (mover.role !== 'knight') {
        for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
          const square: string = String.fromCharCode(action.from.charCodeAt(0) + n * Math.sign(dx)) + (Number(action.from[1]) + n * Math.sign(dy));
          assert.ok(!state.pieces.some(piece => piece.square === square), `blocked path ${square}`);
        }
      }
      assert.deepEqual(after.pieces, state.pieces.map(piece => piece.id === mover.id ? { ...piece, square: action.to } : victim && piece.id === victim.id ? { ...piece, square: null, zone: 'captured', capturedBy: state.turn.color } : piece));
      assert.deepEqual(after.players, index === 52 ? { ...state.players, white: { ...state.players.white, discard: [...state.players.white.discard, { id: 'white-deck-1-truce', cardId: 'truce' }] } } : state.players);
      assert.equal(after.fen.split(' ')[4], String(mover.role === 'pawn' || victim ? 0 : Number(state.fen.split(' ')[4]) + 1));
      assert.equal(after.fen.split(' ')[5], String(Number(state.fen.split(' ')[5]) + (mover.owner === 'black' ? 1 : 0)));
      assert.deepEqual(after.enPassant, mover.role === 'pawn' && Math.abs(dy) === 2 ? [{ target: action.from[0] + (Number(action.from[1]) + dy / 2), pawnId: mover.id }] : []);
    } else if (action.type === 'playCard') {
      const player = state.turn.color;
      assert.equal(state.turn.cardPlays[player], 0);
      assert.equal(after.turn.cardPlays[player], 1);
      assert.deepEqual(after.players[player].deck, state.players[player].deck.slice(1));
      assert.deepEqual(after.players[player].hand, [...state.players[player].hand.filter(card => card.id !== action.cardInstanceId), state.players[player].deck[0]]);
    }
    snapshots.push(after);
    state = after;
  }
  const at = (step: number, id: string) => snapshots[step]!.pieces.find(piece => piece.id === id)!;
  assert.equal(at(18, 'black-pawn-h7').square, 'g7');
  assert.equal(at(21, 'black-pawn-h7').royal, true);
  assert.equal(at(21, 'black-king-e8').royal, false);
  assert.equal(at(36, 'black-bishop-f8').square, 'b8');
  assert.equal(at(36, 'black-knight-b8').square, 'f8');
  assert.equal(at(40, 'black-pawn-c7').zone, 'captured');
  assert.equal(snapshots[49]!.effects.length, 2);
  assert.equal(snapshots[53]!.effects.length, 1);
  assert.ok(snapshots[55]!.pendingRescue);
  assert.deepEqual(snapshots[56]!.pieces, snapshots[54]!.pieces);
  assert.equal(snapshots[56]!.fen, snapshots[54]!.fen);
  assert.equal(snapshots[56]!.turn.moveMade, false);
  assert.equal(at(57, 'black-pawn-h7').square, 'g6');
  assert.equal(snapshots[57]!.fen.split(' ')[2], '-');
  for (const [id, square] of [['black-bishop-c8', 'c7'], ['black-bishop-f8', 'b7'], ['white-bishop-c1', 'c2'], ['white-bishop-f1', 'f2']]) assert.equal(at(64, id!).square, square);
  assert.equal(at(68, 'black-pawn-g7').zone, 'captured');
  assert.deepEqual(snapshots[74]!.pieces, snapshots[73]!.pieces);
  assert.equal(snapshots[74]!.fen, 'r2qkn1r/1bbp4/p3ppp1/1pNP1n2/5PP1/2PQ4/PPB1PBPR/1R2K1N1 w - - 1 18');
  assert.deepEqual(snapshots[102]!.effects.at(-1), { type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-rook-h8' });
  assert.equal(snapshots[104]!.effects.length, 2);
  assert.deepEqual(final.effects, [
    { type: 'coup', owner: 'black', card: { id: 'black-hand-3-coup', cardId: 'coup' }, princeId: 'black-king-e8', kingId: 'black-pawn-h7', princeRole: 'king' },
    { type: 'truce', owner: 'black', card: { id: 'black-deck-2-truce', cardId: 'truce' } },
  ]);
  assert.equal(final.fen, 'r1bq1n2/3p1k1r/p2bppp1/1pNP1nP1/B4P1R/P1PQ2B1/1P2P1P1/R4KN1 w - - 7 26');
  assert.deepEqual(final.players.white.discard.map(card => card.cardId), ['rebirth', 'holy-quest', 'truce', 'heresy', 'challenge']);
  assert.deepEqual(final.players.black.discard.map(card => card.cardId), ['siege', 'long-jump']);
  assert.equal(final.pendingRescue, null);
});
