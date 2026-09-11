import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { attacks } from 'chessops/attacks';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare, makeSquare } from 'chessops/util';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameState, SquareName } from '../types.js';

// Each numbered row was reviewed from the physical board, rules.md and cards.md.
const rationales = `
1. a2-a4 crosses empty a3; pawn clock resets and a3 en passant opens; e1/e8 safe.
2. White ends; Black receives a3 opportunity; board and clocks unchanged.
3. e7-e5 crosses empty e6; replaces a3 opportunity with e6; e8 remains safe.
4. Black ends; White receives the turn and e6 opportunity.
5. Ra1-a3 crosses vacated a2; revokes Q castling, expires en passant, e1 safe.
6. White ends with rook a3; no card or further clock change.
7. Qd8-g5 follows clear e7-f6 diagonal; neither King is attacked.
8. Black ends with queen g5, White still safe on e1.
9. Ra3-e3 crosses empty b3-c3-d3; e2 pawn remains between rook and own King.
10. White ends; e3 rook and all hands remain fixed.
11. Qg5-h5 moves one rank step, no capture and neither King checked.
12. Black ends; White gets move with queen h5.
13. d2-d4 crosses d3; creates d3 en passant, resets clock, e1 safe.
14. White ends preserving d3 opportunity for Black.
15. b7-b6 enters empty b6, expires d3 opportunity; Black King safe.
16. Black ends; no extra move, capture or draw.
17. Squaring the Circle: a8/h1/h8 occupied, a1 empty; Nb1 relocates to a1 without capture; replaces move, spends/draws once.
18. White ends the replacement turn; Black starts, no second move granted.
19. a7-a6 advances into empty a6; pawn clock resets, e8 safe.
20. Black ends; physical board and hands unchanged.
21. d4xe5 captures black e7-pawn diagonally; white pawn retains d2 identity, Kings safe.
22. Curse after move targets opposing Rh8; retain card on that identity, draw Forbidden City, clocks fixed.
23. White ends; Curse persists and allowances reset.
24. d7-d5 crosses d6; e5 pawn can en passant to d6; e8 safe, fullmove increments.
25. Black ends preserving d6 for White.
26. Guardian moves b2-b4 across b3; no follower selected, b1 empty; b3 en passant opens, replaces move and draws Treason.
27. White ends Guardian turn; Black receives normal move.
28. Ng8-e7 jumps to empty e7; Curse concerns only Rh8, no King check.
29. Black ends; Knight e7 and effects persist.
30. Qd1xd5 follows empty d2-d3-d4 and captures d7-pawn; no royal ray is exposed.
31. White ends with Queen d5; d7-pawn remains captured.
32. Bc8-e6 crosses vacated d7; e8 King safe and bishop threatens Queen d5.
33. Black ends; threatening a Queen is not check.
34. Bc1-b2 enters pawn-vacated b2; King e1 stays safe.
35. Forbidden City marks empty d1 after move; retained continuing card, draws Long Jump, no board/clock change.
36. White ends; d1 remains forbidden, Curse remains Rh8-bound.
37. Qh5xe2 passes empty g4-f3 and captures e2-pawn; adjacent file attack checks Ke1, Black safe.
38. Black ends with check on White; White has Bf1xe2 among legal answers.
39. Ng1-h3 is a valid Knight jump but leaves Qe2 checking Ke1; only provisional pending rescue is allowed by 11.6.
40. Fortification f7-g7 cannot stop adjacent Qe2-e1 attack; spend/discard/draw Earthquake, restore Ng1 and pre-move clocks, leave White move available.
41. Bf1xe2 captures checking Queen on adjacent diagonal; Ke1 safe, card allowance still spent.
42. White ends after legal replacement answer; no wall survives failed rescue.
43. Be6xd5 captures White Queen directly; neither King checked.
44. No Quarter binds just-captured white d1-Queen; captured becomes dead, no board/clock change; draws Under Elf Hill.
45. Black ends; dead Queen cannot return, continuing effects persist.
46. Re3-b3 crosses d3-c3; neither King attacked; quiet rook move could trigger Merciless.
47. Challenge selects opposing f7-pawn which can move f6/f5; after-move obligation, discard/draw Truce, no board change.
48. White ends preserving Black f7 obligation into next turn.
49. f7-f5 across f6 satisfies Challenge; removes obligation, opens f6 en passant, resets clock.
50. Black ends preserving f6 opportunity; Curse/City persist.
51. Ke1-d2 enters empty adjacent square; Bd5 is same file, not a diagonal attacker of d2; White castling revoked.
52. White ends with King d2 safe; en passant already expired.
53. Bd5-f3 crosses e4; f3 and d2 are not diagonally aligned, so White King remains safe.
54. Black ends; bishop f3 is capturable by Ng1.
55. Ng1xf3 captures c8-bishop by Knight jump; no royal ray exposed.
56. White ends; black c8-bishop stays captured.
57. Lost Castle swaps black Ra8 with white Rb3, identities preserved; Nb8 blocks exact a8-e8 rank ray, Kd2 not aligned with Rb3; consumes move.
58. Black ends replacement move; White rook a8, Black rook b3, q castling revoked.
59. c2xb3 captures swapped black a8-Rook; diagonal Pawn capture, White King d2 safe.
60. White ends; black a8-Rook remains captured, white a1-Rook still a8.
61. c7-c6 enters empty c6; pawn clock resets and Black King safe.
62. Black ends; no effects expire or cards draw.
63. Be2-d3 moves one empty diagonal; white King d2 stays safe.
64. White ends; bishop d3 preserved.
65. Ne7-c8 jumps onto empty c8; Nb8 still blocks white Ra8 toward Ke8.
66. Black Truce after move: neither King in check; retain card, draw Assassin, forbid captures.
67. Black ends with Truce active; no board or clock changes.
68. Kd2-c3 steps diagonally to empty c3; no geometric attacker even ignoring Truce.
69. White ends with safe c3 King; Truce persists.
70. Cursed Rh8-g8 moves one square, within two-square limit; revokes last black castling right.
71. Black ends; Curse follows rook g8, Truce remains.
72. Nf3-g5 jumps quietly; no geometric King check to end Truce.
73. White ends with g5 Knight; no capture permitted under Truce.
74. b6-b5 enters empty square, no capture, no check, resets halfmove.
75. Black ends; Truce persists with pawn b5.
76. Long Jump moves Na1 to empty h5 of opposite square color; no capture or check, consumes move and draws Revenge.
77. White ends Long Jump turn; physical b1-Knight now h5.
78. g7-g6 advances quietly; its diagonal geometry reaches f5/h5, neither containing a King, so Truce persists.
79. Black ends preserving Truce and physical pawn g6.
80. Rh1-e1 crosses empty g1-f1; does not enter forbidden d1; pawn e5 blocks e-file to Ke8.
81. White ends with rook e1; no raw King check, Truce persists.
82. a6-a5 advances quietly to a5; no King attack, pawn clock resets.
83. Black ends; neither Truce nor persistent markers expire.
84. Ra8-a7 descends one empty square; does not check Ke8, Truce remains.
85. White adds a second Truce after move, retains physical card and draws Breakthrough; neither King checked.
86. White ends; both separate Truce cards persist.
87. h7-h6 advances quietly; neither King checked, both Truces persist.
88. Black ends; no captures or extra draws.
89. Ng5-e4 jumps to empty e4; no King attacked, both Truces continue.
90. White ends with Knight e4; card state unchanged.
91. Winged Victory returns captured black d7-Pawn to empty center d5; placement is not capture, Truce permits it; replaces move, pawn clock zero, draws Resurrection.
92. Black ends with restored d7 identity at d5; no en passant generated.
93. Ra7-e7 crosses empty b7-c7-d7; adjacent e7-e8 royal file check ends and discards both Truces, leaving Curse and City.
94. White ends checking Black; capture is again legal and Ke8xe7 is available.
95. Ke8xe7 captures checking Rook; white Re1 ray is blocked first by Ne4, then Pe5; Nh5/Bd3/Bb2 do not attack e7.
96. Black ends safely on e7; white a1-Rook captured.
97. h2-h3 quiet Pawn advance, neither King attacked, halfmove resets.
98. White ends; no remaining Truce prevents later captures.
99. Ke7-d8 steps to empty diagonal square; no white piece attacks d8.
100. Black ends with King d8 safe and castling already absent.
101. Ne4-d2 jumps to empty d2; Pe5 still blocks white Re1 toward former e7 King, current Kd8 safe.
102. White ends; no captures/effect changes.
103. b5xa4 captures white a2-Pawn diagonally; black d8 King safe.
104. Black ends; pawn a4 attacks b3 Pawn, not Kc3.
105. Re1-e3 crosses empty e2, no forbidden square; neither King checked.
106. White ends; rook e3 fixed, card hands unchanged.
107. a4xb3 captures white c2-Pawn; black pawn b3 attacks a2/c2, not Kc3.
108. Black ends; White c3 King safe despite adjacent enemy Pawn b3.
109. g2-g4 crosses empty g3; opens g3 en passant, no adjacent black Pawn can take it; White King safe.
110. White ends preserving g3 opportunity; no card changes.
111. Bf8xb4 follows clear e7-d6-c5 and captures white b2-Pawn; Bb4 checks Kc3 diagonally.
112. Black ends with White checked; c3xb3 is a legal escape.
113. Kc3xb3 captures black b7-Pawn; Bb4 shares file, not diagonal with b3; no other black attacker reaches b3.
114. White ends safely on b3; captured Pawn identity retained.
115. Bb4-d6 crosses empty c5; d6 and b3 are not aligned; Black d8 King safe.
116. Black ends at fullmove 28, halfmove 1, White to move, both Kings safe; all 50 move commands reviewed.
`.trim().split('\n');

test('iteration 081 independently reviewed trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/081.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 116);
  rationales.forEach((line, index) => assert.ok(line.startsWith(`${index + 1}. `)));
  let state = createGameState(trace.initial);
  const states: GameState[] = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    states.push(state);
    const board = parseFen(state.fen).unwrap().board;
    // Geometric oracle independent of reducer legalDests/check calculation.
    const checks = (['white', 'black'] as const).filter(color => {
      const king = board.kingOf(color)!;
      return [...board].some(([square, piece]) => piece.color !== color
        && attacks(piece, square, board.occupied).has(king));
    });
    assert.deepEqual(checks, [37, 38, 39, 40, 111, 112].includes(step) ? ['white']
      : [93, 94].includes(step) ? ['black'] : [], `${step}: exact royal geometry`);
    const curse = { type: 'curse', owner: 'white', card: { id: 'white-hand-2-curse', cardId: 'curse' }, pieceId: 'black-rook-h8' };
    const city = { type: 'forbidden-city', owner: 'white', card: { id: 'white-deck-1-forbidden-city', cardId: 'forbidden-city' }, square: 'd1' };
    assert.deepEqual(state.effects, [
      ...(step >= 22 ? [curse] : []), ...(step >= 35 ? [city] : []),
      ...([47, 48].includes(step) ? [{ type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-pawn-f7' }] : []),
      ...(step >= 66 && step < 93 ? [{ type: 'truce', owner: 'black', card: { id: 'black-hand-0-truce', cardId: 'truce' } }] : []),
      ...(step >= 85 && step < 93 ? [{ type: 'truce', owner: 'white', card: { id: 'white-deck-5-truce', cardId: 'truce' } }] : []),
    ], `${step}: complete expected effects`);
    assert.equal(!!state.pendingRescue, step === 39);
    assert.equal(state.orientation, 0);
    assert.equal(state.outcome, null);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      assert.equal(position.isLegal({ from, to }), step !== 39, `${step}: ordinary movement and royal legality`);
      position.play({ from, to });
      assert.equal(makeBoardFen(position.board), state.fen.split(' ')[0], `${step}: independent board result`);
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      assert.deepEqual(state.pieces, before.pieces.map(p => p.id === mover.id ? { ...p, square: action.to }
        : p.id === victim?.id ? { ...p, square: null, zone: 'captured', capturedBy: before.turn.color } : p), `${step}: physical identities`);
      assert.notEqual(action.to, 'd1');
      if (mover.role !== 'knight') {
        const dx = Math.sign((to % 8) - (from % 8));
        const dy = Math.sign(Math.floor(to / 8) - Math.floor(from / 8));
        const distance = Math.max(Math.abs(to % 8 - from % 8), Math.abs(Math.floor(to / 8) - Math.floor(from / 8)));
        for (let n = 1; n <= distance; n++) {
          const crossed = makeSquare(from + n * dx + n * 8 * dy);
          if (step >= 35) assert.notEqual(crossed, 'd1', `${step}: City blocks traversals`);
        }
        if (mover.id === 'black-rook-h8') assert.ok(distance <= 2, 'Curse distance');
      }
      if (step > 66 && step < 93) assert.equal(victim, undefined, 'Truce forbids capture');
      const oldFen = parseFen(before.fen).unwrap();
      const newFen = parseFen(state.fen).unwrap();
      assert.equal(newFen.halfmoves, mover.role === 'pawn' || victim ? 0 : oldFen.halfmoves + 1);
      assert.equal(newFen.fullmoves, oldFen.fullmoves + (before.turn.color === 'black' ? 1 : 0));
      const doublePawn = mover.role === 'pawn' && Math.abs(to - from) === 16;
      assert.deepEqual(state.enPassant, doublePawn ? [{ target: makeSquare((to + from) / 2), pawnId: mover.id }] : []);
      assert.deepEqual(state.turn, { color: before.turn.color, phase: 'afterMove', moveMade: true, cardPlays: before.turn.cardPlays });
    } else if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces);
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.enPassant, before.enPassant);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else if (action.type === 'playCard') {
      const owner = before.turn.color;
      const card = before.players[owner].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(before.turn.phase));
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.equal(state.turn.cardPlays[owner], 1);
      assert.deepEqual(state.players[owner].hand, [...before.players[owner].hand.filter(c => c.id !== card.id), before.players[owner].deck[0]]);
      assert.deepEqual(state.players[owner].deck, before.players[owner].deck.slice(1));
      assert.deepEqual(state.players[owner].discard, [...before.players[owner].discard,
        ...(!CARD_CATALOG[card.cardId]!.continuing || step === 40 ? [card] : [])]);
      const other = owner === 'white' ? 'black' : 'white';
      assert.deepEqual(state.players[other], before.players[other]);
      let expected = before.pieces;
      const relocate = (id: string, square: SquareName) => {
        expected = expected.map(p => {
          if (p.id !== id) return p;
          const { capturedBy: _actor, ...returned } = p;
          return { ...returned, square, zone: 'board' };
        });
      };
      if (step === 17) {
        assert.deepEqual(['a1', 'a8', 'h1', 'h8'].filter(sq => before.pieces.some(p => p.square === sq)), ['a8', 'h1', 'h8']);
        relocate('white-knight-b1', 'a1');
      }
      if (step === 26) {
        assert.ok(['b3', 'b4'].every(sq => !before.pieces.some(p => p.square === sq)));
        relocate('white-pawn-b2', 'b4');
      }
      if (step === 40) expected = states[38]!.pieces;
      if (step === 44) expected = expected.map(p => {
        if (p.id !== 'white-queen-d1') return p;
        const { capturedBy: _actor, ...dead } = p;
        return { ...dead, zone: 'dead' };
      });
      if (step === 47) {
        const pos = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
        pos.turn = 'black';
        assert.ok(pos.isLegal({ from: parseSquare('f7')!, to: parseSquare('f5')! }));
      }
      if (step === 57) { relocate('white-rook-a1', 'a8'); relocate('black-rook-a8', 'b3'); }
      if (step === 76) { assert.equal((0 + 0) % 2 !== (7 + 4) % 2, true); relocate('white-knight-b1', 'h5'); }
      if (step === 91) {
        assert.equal(before.pieces.find(p => p.id === 'black-pawn-d7')!.zone, 'captured');
        assert.ok(!before.pieces.some(p => p.square === 'd5'));
        relocate('black-pawn-d7', 'd5');
      }
      assert.deepEqual(state.pieces, expected, `${step}: card physical delta`);
      const replacements = [17, 26, 57, 76, 91];
      if (replacements.includes(step)) {
        assert.equal(state.turn.moveMade, true);
        assert.deepEqual(state.enPassant, step === 26 ? [{ target: 'b3', pawnId: 'white-pawn-b2' }] : []);
        const oldFen = parseFen(before.fen).unwrap(), newFen = parseFen(state.fen).unwrap();
        assert.equal(newFen.halfmoves, [26, 91].includes(step) ? 0 : oldFen.halfmoves + 1);
        assert.equal(newFen.fullmoves, oldFen.fullmoves + (owner === 'black' ? 1 : 0));
      } else if (step === 40) {
        assert.equal(state.fen, states[38]!.fen);
        assert.equal(state.turn.moveMade, false);
        assert.equal(state.turn.phase, 'beforeMove');
      } else { assert.equal(state.fen, before.fen); assert.deepEqual(state.enPassant, before.enPassant); }
    }
    if (action.type !== 'playCard') {
      for (const color of ['white', 'black'] as const) {
        assert.deepEqual(state.players[color].hand, before.players[color].hand);
        assert.deepEqual(state.players[color].deck, before.players[color].deck);
        assert.deepEqual(state.players[color].discard, [...before.players[color].discard,
          ...(step === 93 ? [{ id: color === 'white' ? 'white-deck-5-truce' : 'black-hand-0-truce', cardId: 'truce' }] : [])]);
      }
    }
  }
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 12);
  assert.equal(state.fen, '1nnk2r1/8/2pb2pp/p2pPp1N/6P1/1K1BR2P/1B1N1P2/8 w - - 1 28');
  assert.deepEqual(replayTrace(trace), state);
});
