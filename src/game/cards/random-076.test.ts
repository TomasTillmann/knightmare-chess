import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Reviewed in order against rules §§8–13, 15.4, 20–21 and the card catalog/artwork.
// Every move below also receives a separate chessops geometry/capture/King-safety oracle.
const rationale = `
1. Confabulation merges Rh1 one square left with friendly Ng1; neither royal, no intervening square, Ke1 safe. Replacement move revokes K right, active card draws Holy Quest.
2. Black Chaos immediately undoes the replacement move: Rh1, K right, clocks, white hand/deck and allowance restored; Chaos alone discarded/drawn and different-move obligation opens.
3. White d2-d3 is a different move, empty forward square, no capture/check; Pawn resets clock and satisfies Chaos.
4. White ends after d3; Black starts with fresh allowances, board/clocks/cards unchanged.
5. Black Fanatic d7-d4 crosses empty d6/d5 to empty d4; d3 is outside the path. No capture or en-passant, Pawn clock zero, fullmove 2, card discarded/drawn.
6. Black ends the Fanatic replacement; White starts and neither King is checked.
7. White f2-f3 advances into empty f3; Black Queen remains d8 behind pieces, Ke1 safe, clock zero.
8. White ends f3 with no card expenditure; Black starts normally.
9. Black b7-b5 crosses empty b6; record b6 en-passant opportunity, Pawn clock zero/fullmove 3.
10. Black ends b5 retaining its one-reply en-passant opportunity and passing to White.
11. White Nb1-c3 is an unobstructed jump to empty c3, no discovered attack on Ke1; b6 opportunity expires, halfmove 1.
12. White ends Nc3 with unchanged board/cards and fresh Black allowances.
13. Black c7-c5 crosses empty c6; new c6 opportunity replaces old, no self-check, fullmove 4.
14. Black Curse is legal after its move, targets opposing Qd1, changes no placement/clocks/EP; active physical card draws Riposte.
15. Black ends with Qd1 limited to two squares; c6 opportunity persists into White turn.
16. White a2-a4 crosses empty a3, no King line opened, new a3 opportunity/zero clock.
17. White ends a4, retaining a3 opportunity and Curse while Black starts.
18. Black Nb8-c6 jumps to empty c6, Ke8 safe; a3 opportunity expires, halfmove 1/fullmove 5.
19. Black ends Nc6, White starts with its card allowance restored.
20. White again merges Rh1 with Ng1, now on a later turn after Chaos was satisfied; K right lost, Q right retained, active composite draws Holy Quest.
21. White ends replacement merge; both components retain identity and Black starts.
22. Black Qd8-a5 traverses empty c7/b6. Qa5-e1 diagonal is blocked by White Nc3, so Ke1 is safe; halfmove 3/fullmove 6.
23. Black ends Qa5 with Nc3 still shielding Ke1 on the actual diagonal.
24. White a4xb5 captures black original b7 Pawn, not the nearby Queen; Nc3 still blocks Qa5-e1, clock zero.
25. White ends axb5; only captured b7 Pawn leaves board, Black starts.
26. Black Qa5-a2 crosses empty a4/a3 to empty a2; White Ra1 is adjacent but uncaptured. Qa2 and Ke1 are not aligned; halfmove 1/fullmove 7.
27. Black ends Qa2 with neither royal in check; White starts.
28. White Nc3-d5 jumps clear; vacating c3 does not expose check because Qa2 is not aligned with Ke1; halfmove 2.
29. White ends Nd5, permitting Black's next ordinary move.
30. Black Qa2-a5 crosses empty a3/a4 and checks Ke1 on a5-b4-c3-d2-e1, now clear; Black Ke8 remains safe, fullmove 8.
31. Black ends its legal checking move; White receives an escape turn.
32. White Ra1-a3 is geometrically clear through a2 but leaves Qa5-e1 check; provisional pending rescue is required. Fatal Attraction on own b5 could freeze Qa5.
33. Holy Quest selects enemy Bc8/Ng8 after the provisional move, but their swap cannot cure Qa5-e1. Spend/draw card, undo swap and failed Ra3, restore Ra1/Q right/clocks and White move.
34. White Bc1-d2 moves one diagonal square to block Qa5-e1, curing check with the card allowance already spent; halfmove 4.
35. White ends Bd2 with King protected; Black starts, board and card zones retained.
36. Black Masquerade Bc8-g4 follows Queen diagonal d7/e6/f5 to empty g4, no capture. Bf1/Ke1 unchanged; Bg4's line stops at White f3, card consumes move/fullmove 9.
37. Black ends Masquerade; White starts safely, persistent Curse/composite unchanged.
38. White Nd5-f4 makes an empty Knight jump, Bd2 still blocks Qa5-e1; halfmove 6.
39. White ends Nf4 with no additional card or draw.
40. Black Qa5-b6 makes one empty diagonal step; no check of Ke1, halfmove 7/fullmove 10.
41. Black Forbidden City marks newly empty a5 after its move, changing no piece or clock; active card draws Neutrality.
42. White Fog of War immediately cancels Forbidden City; both physical cards discarded, only White draws now, both allowances consumed; Qb6 move and clocks preserved.
43. Black ends its completed move; White's next own allowance resets despite its prior reaction, a5 is available again.
44. White Bd2-b4 crosses empty c3 to empty b4; Qb6 does not align with Ke1, safe departure from d2, halfmove 8.
45. White ends Bb4, preserving two surviving effects and all cards.
46. Black Ra8-d8 crosses empty b8/c8; loses q right, retains k; Ke8 safe, halfmove 9/fullmove 11.
47. Black ends Rd8 and passes to White without changing clocks again.
48. White e2-e4 crosses empty e3; Bg4-e2 diagonal stops first at f3, so Ke1 remains safe. Black d4 Pawn can take en-passant on e3; zero clock.
49. White ends e4 preserving actual e3 en-passant availability for Black.
50. Black e7-e5 crosses empty e6 instead of taking en-passant; replaces e3 with e6 opportunity, Pawn clock zero/fullmove 12.
51. Black Man-Trap marks occupied own King square e8 after moving; selection need not be nonroyal, no arrival yet, active card draws Truce and retains e6 EP.
52. Black ends with trap still on e8 and White receives the next move.
53. White Bf1-e2 makes one empty diagonal step; Ke1 is not aligned with Bg4 or Qb6, old e6 opportunity expires, halfmove 1.
54. White ends Be2, trap remains untriggered at e8.
55. Black Ke8-d7 makes one empty diagonal step. Bb4's route to d6 stops at c5, Nf4 does not attack d7, so destination safe. All Black castling rights gone/fullmove 13.
56. Black ends Kd7; vacating e8 does not erase its square-bound Man-Trap.
57. White Ra1-b1 moves one empty horizontal square, relinquishes final White Q right; no King exposure, halfmove 3.
58. White ends Rb1; all castling rights remain absent.
59. Black a7-a5 crosses empty a6; Fog removed the former city. White b5 can take a6 en-passant; zero clock/fullmove 14.
60. Black ends a5 preserving a6 availability into White's reply.
61. White Bb4-c3 makes one empty diagonal step, leaves Ke1 safe; declines/clears a6 en-passant, halfmove 1.
62. White ends Bc3; Black starts with no pending obligation.
63. Black Nc6-b8 jumps to empty b8. Qb6 and Black c5 still interrupt bishop lines toward Kd7, halfmove 2/fullmove 15.
64. Black ends Nb8 without altering effects or card inventory.
65. White Nf4-e6 jumps to empty e6; attacks d8/f8/c7/g7/c5/g5/d4/f4, not Kd7; halfmove 3.
66. White ends Ne6; Black's King remains safe.
67. Black Qb6-c7 steps diagonally into Ne6's attack, which is legal for a nonroyal Queen; Kd7 is not exposed, halfmove 4/fullmove 16.
68. Black ends Qc7; attacked Queen is neither captured nor a terminal condition.
69. White Ke1-f2 moves diagonally to empty f2. Bg4 is not aligned with f2 (one file, two ranks); its southwest ray g4-f3-e2-d1 stops at White f3. Qc7 also does not align with f2, safe destination, halfmove 5.
70. White ends Kf2; castling remains absent and Black starts.
71. Black h7-h5 crosses empty h6; no attack on Kd7 exposed, h6 opportunity/zero clock/fullmove 17.
72. Black ends h5 and preserves h6 opportunity into White turn.
73. White Irresistible Force c2-c3 pushes own Bc3 to empty c4, without capture or King push. Neither Bg4 nor Qc7 aligns with Kf2; Pawn replacement clears EP, zero clock, card discarded/drawn.
74. White ends the push replacement with Bc4/c3 Pawn identities intact.
75. Black Ng8-h6 jumps to empty h6, no trap or check; halfmove 1/fullmove 18.
76. Black ends Nh6 with no extra spending/drawing.
77. White original a2 Pawn b5-b6 advances into empty b6 without promotion, attacks c7 Queen without capturing it; zero clock.
78. White ends b6; Black may leave its Queen en prise.
79. Black g7-g5 crosses empty g6 to empty g5; Kd7 safe, g6 EP opportunity/zero clock/fullmove 19.
80. Black ends g5 and retains the g6 opportunity.
81. White h2-h3 advances to empty h3, Kf2 remains outside Bg4/Qc7 rays and Nh6 attacks; g6 EP expires, zero clock.
82. White ends h3 without changing physical card zones.
83. Black Irresistible Force g5-g4 pushes own Bg4 to empty g3, no capture/King push; Bg3 checks adjacent Kf2 but Kxg3 is available, so regular card does not mate. Zero clock/fullmove 20.
84. Black ends the checking push, granting White an escape turn; Black Kd7 safe.
85. White Bc4-b3 is clear but fails to answer Bg3-f2 check, requiring provisional rescue; Fatal Attraction on own h3 could freeze Bg3.
86. Fatal Attraction chooses Ne6, too far from Bg3; King d7 is exempt and freezing nearby e5/f7 cannot stop Bg3-f2. Fizzle discards/draws card, restores Bc4/clocks and White move.
87. White Kf2xg3 captures the checking original c8 Bishop. Black g4 Pawn attacks f3/h3, Nh6 attacks f5/f7/g4/g8, neither attacks g3; capture safe, clock zero.
88. White ends Kxg3 with the Bishop captured and no pending rescue.
89. Black Nh6-f5 jumps to empty f5 and checks Kg3 by Knight geometry; Black Kd7 remains safe, halfmove 1/fullmove 21.
90. Black ends Nf5 check; White gets an escape turn.
91. White Kg3-f4 escapes Nf5 but enters e5 Pawn's attack; provisional rescue required, a wall on e5-f4 could cure that attack.
92. White Fortification selects e4-e5, an adjacent boundary that does not block e5-f4. Fizzle spends/draws wall card, restores Kg3/clocks and move; no wall survives.
93. White Kg3-h2 retreats one diagonal step beyond Nf5 attacks; Black h5 blocks Rh8 along h-file and h3 also screens h2, safe, halfmove 2.
94. White ends Kh2 having answered the Knight check; Black starts.
95. Black Nf5-h4 jumps to empty h4; attacks f3/f5/g2/g6 rather than Kh2, halfmove 3/fullmove 22.
96. Black ends Nh4 with White King safe.
97. White Ne6xc7 captures original black Queen; Nc7 attacks e8/e6/d5/b5/a6/a8, not adjacent Kd7, clock zero.
98. White ends Nxc7 with only the Queen newly captured.
99. Black Rh8-h6 crosses empty h7; h5 Pawn blocks the ray to Kh2, halfmove 1/fullmove 23.
100. Black ends Rh6 preserving the untriggered e8 trap.
101. White c3xd4 captures original black d7 Pawn diagonally forward; no royal exposure, clock zero.
102. White ends cxd4; its c2-origin Pawn is now d4 and black d7-origin Pawn captured.
103. Black Kd7-e7 moves one empty horizontal square. Nc7 does not attack e7, Bc4's diagonal targets d5/e6/f7 rather than e7; destination safe, halfmove 1/fullmove 24.
104. Black ends Ke7 without restoring castling or moving the e8 trap.
105. White f3xg4 captures original black g7 Pawn diagonally forward; Rh6 still blocked by h5/h3, Kh2 safe, clock zero.
106. White ends fxg4 with the captured g7 identity off board.
107. Black e5xd4 captures the white c2-origin Pawn on d4, not the already captured black d7 Pawn; Ke7 safe, clock zero/fullmove 25.
108. Black ends exd4 with both captured identities preserved separately.
109. White cursed Qd1-f1 traverses empty e1 exactly two squares, within Curse limit; no capture/King exposure, halfmove 1.
110. White ends Qf1, carrying Curse on the same physical Queen.
111. Black a5-a4 advances one empty square; no remaining Forbidden City, Pawn clock zero/fullmove 26.
112. Black ends a4; White starts with all three surviving effects unchanged.
113. White Bc4-a2 crosses empty b3 into empty a2; neither K is exposed, halfmove 1.
114. White ends Ba2; Black gets the final sampled regular move.
115. Black Nh4-f3 jumps to empty f3, attacks g1 composite but not Kh2. No capture or trap arrival, halfmove 2/fullmove 27.
116. Black ends Nf3; White starts, 50 regular move commands reviewed, no unresolved rescue or terminal outcome.
`.trim().split('\n');

test('iteration 076: 116 reviewed actions, independent movement and card semantics', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/076.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860076);
  assert.equal(trace.steps.length, 116);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((line, index) => assert.ok(line.startsWith(`${index + 1}. `)));
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 14);
  const states: GameState[] = [createGameState(trace.initial)];
  const rollback = new Map([[2, 0], [33, 31], [86, 84], [92, 90]]);
  const cardMoves: Record<number, Array<[SquareName, SquareName | null]>> = {
    1: [['h1', null]], 5: [['d7', 'd4']], 20: [['h1', null]],
    36: [['c8', 'g4']], 73: [['c3', 'c4'], ['c2', 'c3']], 83: [['g4', 'g3'], ['g5', 'g4']],
  };
  const curse = { type: 'curse', owner: 'black', card: { id: 'black-deck-0-curse', cardId: 'curse' }, pieceId: 'white-queen-d1' };
  const merged = { type: 'confabulation', owner: 'white', card: { id: 'white-hand-3-confabulation', cardId: 'confabulation' }, pieceIds: ['white-knight-g1', 'white-rook-h1'] };
  const city = { type: 'forbidden-city', owner: 'black', card: { id: 'black-hand-3-forbidden-city', cardId: 'forbidden-city' }, square: 'a5' };
  const trap = { type: 'man-trap', owner: 'black', card: { id: 'black-deck-1-man-trap', cardId: 'man-trap' }, square: 'e8' };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const before = states.at(-1)!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationale[index]);
    const after = result.state;
    const expectedEffects = [...(step === 1 ? [merged] : []), ...(step >= 14 ? [curse] : []),
      ...(step >= 20 ? [merged] : []), ...(step === 41 ? [city] : []), ...(step >= 51 ? [trap] : [])];
    assert.deepEqual(after.effects, expectedEffects, `effects at ${step}`);
    assert.equal(!!after.pendingRescue, [32, 85, 91].includes(step), `rescue at ${step}`);
    assert.equal(after.orientation, 0);
    assert.ok(!after.outcome);
    const expectedPlayers = structuredClone(before.players);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const pos = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.equal(pos.isLegal(move), ![32, 85, 91].includes(step), `independent legality at ${step}`);
      pos.play(move);
      assert.equal(makeBoardFen(pos.board), after.fen.split(' ')[0], `board oracle at ${step}`);
      const setup = parseFen(after.fen).unwrap();
      assert.equal(setup.halfmoves, pos.halfmoves);
      assert.equal(setup.fullmoves, pos.fullmoves);
      assert.equal(setup.turn, pos.turn);
      const mover = before.pieces.find(piece => piece.square === action.from)!;
      const victim = before.pieces.find(piece => piece.square === action.to);
      for (const piece of before.pieces) {
        const actual = after.pieces.find(item => item.id === piece.id)!;
        if (piece === mover) assert.deepEqual(actual, { ...piece, square: action.to });
        else if (piece === victim) {
          const { capturedAtPly: _ply, capturedBy: _actor, ...identity } = actual;
          assert.deepEqual(identity, { ...piece, square: null, zone: 'captured' });
        } else assert.deepEqual(actual, piece);
      }
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const expectedEp = mover.role === 'pawn' && Math.abs(to - from) === 16
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : [];
      assert.deepEqual(after.enPassant, expectedEp, `EP at ${step}`);
      if (mover.id === 'white-queen-d1') assert.ok(Math.abs(to % 8 - from % 8) <= 2);
      assert.equal(after.turn.color, before.turn.color);
      assert.equal(after.turn.phase, 'afterMove');
      assert.equal(after.turn.moveMade, true);
      assert.deepEqual(after.turn.cardPlays, before.turn.cardPlays);
    } else if (action.type === 'endTurn') {
      assert.equal(after.fen, before.fen);
      assert.deepEqual(after.pieces, before.pieces);
      assert.deepEqual(after.enPassant, before.enPassant);
      assert.deepEqual(after.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unreviewed action');
      const owner = before.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black';
      const player = expectedPlayers[owner];
      const physical = player.hand.find(card => card.id === action.cardInstanceId)!;
      assert.ok(physical);
      assert.equal(before.turn.cardPlays[owner], 0);
      player.hand = player.hand.filter(card => card !== physical);
      if (![1, 14, 20, 41, 51].includes(step)) player.discard.push(physical);
      player.hand.push(player.deck.shift()!);
      if (step === 2) expectedPlayers.white = structuredClone(states[0].players.white);
      if (step === 42) expectedPlayers.black.discard.push(city.card);
      const base = rollback.has(step) ? states[rollback.get(step)!] : before;
      const expectedPieces = structuredClone(base.pieces);
      for (const [from, to] of cardMoves[step] ?? []) {
        const piece = expectedPieces.find(item => item.square === from)!;
        piece.square = to;
        piece.zone = to === null ? 'away' : 'board';
      }
      assert.deepEqual(after.pieces, expectedPieces, `card physical identity at ${step}`);
      if (rollback.has(step)) {
        assert.equal(after.fen, base.fen, `complete clock/castling/board rewind at ${step}`);
        assert.deepEqual(after.enPassant, base.enPassant);
        assert.equal(after.turn.moveMade, false);
        assert.equal(after.turn.phase, 'beforeMove');
      } else if (cardMoves[step]) {
        const fen = parseFen(after.fen).unwrap();
        const old = parseFen(before.fen).unwrap();
        assert.equal(fen.halfmoves, [5, 73, 83].includes(step) ? 0 : old.halfmoves + 1);
        assert.equal(fen.fullmoves, old.fullmoves + (owner === 'black' ? 1 : 0));
        assert.deepEqual(after.enPassant, []);
        assert.equal(after.turn.moveMade, true);
      } else {
        assert.equal(after.fen, before.fen);
        assert.deepEqual(after.enPassant, before.enPassant);
        assert.equal(after.turn.moveMade, before.turn.moveMade);
      }
      assert.equal(after.turn.color, before.turn.color);
      assert.equal(after.turn.cardPlays[owner], 1);
    }
    assert.deepEqual(after.players, expectedPlayers, `physical card spending/drawing at ${step}`);
    states.push(after);
  }
  assert.equal(states.at(-1)!.fen, '1n1r1b2/2N1kp2/1P5r/2p4p/p2pP1P1/3P1n1P/BP2B1PK/1R3QN1 w - - 2 27');
  assert.equal(replayTrace(trace).fen, states.at(-1)!.fen);
});
