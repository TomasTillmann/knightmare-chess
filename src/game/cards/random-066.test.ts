import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in order against rules §§8–11, 13.4, 18.5, 20–21
// and the catalog's printed timing/classification. Every endTurn preserves
// board/clocks/card zones and resets both allowances; every quiet move increments
// halfmoves, every Pawn move/capture resets them, and Black advances fullmoves.
const rationale = [
  '1. h2-h3 advances the white Pawn into empty h3; e1 remains screened.',
  '2. White ends after h3; Black receives its first move with all cards retained.',
  '3. Ng8-h6 is a legal knight jump into empty h6, preserving e8 safety.',
  '4. Black ends after Nh6; White receives the move at fullmove 2.',
  '5. Nb1-a3 jumps into empty a3 without exposing e1.',
  '6. White ends after Na3; no optional discard was requested.',
  '7. g7-g6 advances one empty square and resets the Pawn clock.',
  '8. Black ends after g6; White receives the move at fullmove 3.',
  '9. e2-e3 advances into empty e3 while e1 remains safe.',
  '10. White ends after e3 with unchanged five-card hands.',
  '11. Guardian replaces Black move: e7-e5 through empty e6; adjacent follower Ke8-e6 remains behind. e6 is safe; no en passant; Black castling lost; Pawn clock 0/fullmove 4; draw Onslaught.',
  '12. Black ends Guardian; no extra Regular Move is granted.',
  '13. f2-f4 crosses empty f3; records physical f2 Pawn en passant at f3, though no Black Pawn can use it.',
  '14. White ends f4, retaining the immediate Black en-passant opportunity.',
  '15. d7-d6 enters empty d6; passing the f4 opportunity expires it.',
  '16. Black ends d6; White receives fullmove 5.',
  '17. Qd1-g4 travels through vacated e2/f3 and checks Ke6 through empty f5.',
  '18. White ends Qg4 with its own King safe; Black receives the turn in check and can interpose Nf5.',
  '19. Nh6-f5 jumps into empty f5, interposing on Qg4-f5-e6 and curing Black check.',
  '20. Black ends Nf5; White receives fullmove 6.',
  '21. Na3-b5 jumps into empty b5; it does not attack Ke6.',
  '22. White ends Nb5 without spending a card.',
  '23. Qd8-e8 moves horizontally into the King-vacated square.',
  '24. Black Panic is legal after Qe8; white next move gets 15000ms obligation, no board/clock change; discard and draw Curse.',
  '25. Black ends; Panic survives into White before-move window.',
  '26. Ra1-b1 is a quiet legal move into vacated b1; fulfills Panic and loses queenside castling.',
  '27. White ends Rb1 with Panic resolved.',
  '28. Doppelganger copies the prior Rook for Nf5-f6, but vacating f5 opens Qg4-f5-e6 check. Restore board, spend/draw Legacy, consume the safe-start replacement move and advance clocks.',
  '29. Black ends its consumed failed replacement move.',
  '30. Tournament exchanges white Ng1 and black Nb8 without capture; neither King is attacked. Consume White move and draw Onslaught.',
  '31. White ends Tournament; ownership remains attached to both swapped Knights.',
  '32. Onslaught advances a7/c7/d6/f7/g6/h7 Pawns one empty square simultaneously. b7-b6 and e5-e4 are also possible but selection is optional. No capture/check; draw Charge.',
  '33. Black ends the six-Pawn replacement move at fullmove 9.',
  '34. Fanatic c2-c5 traverses empty c3/c4/c5 exactly three forward squares. No capture/promotion/en-passant, King safe; draw Dark Mirror.',
  '35. White ends Fanatic, without an additional ordinary move.',
  '36. e5xf4 captures the physical white f2 Pawn on its forward diagonal; Ke6 remains screened.',
  '37. Black ends exf4; the captured Pawn remains recoverable.',
  '38. White Onslaught selects b2/d2/e3/g2/h3, each moving one square into an initially empty square. Other Pawns may be omitted; no check or capture; draw Knightmare.',
  '39. White ends Onslaught with all five identities preserved.',
  '40. Qe8-d8 is a one-square quiet horizontal move, safe for Ke6.',
  '41. Black ends Qd8; White receives fullmove 11.',
  '42. h4-h5 advances into empty h5; black h6 Pawn is directly ahead afterward.',
  '43. White ends h5 with no card use.',
  '44. Bf8-d6 travels through empty e7 to empty d6.',
  '45. Black ends Bd6; no check on Ke1.',
  '46. Qg4xg5 captures black physical g7 Pawn; f6 still blocks the diagonal toward Ke6.',
  '47. White ends Qxg5 with capture clock zero.',
  '48. Bd6-e7 is a quiet diagonal step into empty e7.',
  '49. Black ends Be7; White receives fullmove 13.',
  '50. Rh1-h3 crosses empty h2 to empty h3; last White castling right is revoked.',
  '51. White ends Rh3; neither side retains castling rights.',
  '52. Black Ng1-f3 legally jumps and checks Ke1 by its knight geometry.',
  '53. Black ends Nf3; checked White has the legal Kf2 escape.',
  '54. Ke1-f2 moves one diagonal square out of Nf3 check; f2 is unattacked.',
  '55. Siege swaps white Nb8 and Rb1 after Kf2; identity/ownership retained, Kf2 safe, no direct mate; clocks unchanged and draw Bombard.',
  '56. White ends Siege with its completed Kf2 move retained.',
  '57. Nf3-e5 is a legal empty-square jump; Black King remains safe.',
  '58. Black ends Ne5 at fullmove 15.',
  '59. Nb1-d2 jumps into the Pawn-vacated d2 square; Kf2 remains safe.',
  '60. White Panic after Nd2 targets Black next move, preserves clocks, spends/replaces with Crab.',
  '61. White ends; Black receives Panic obligation.',
  '62. Ne5xd3 captures physical white d2 Pawn and satisfies Panic; zero clock/fullmove 16.',
  '63. White immediately plays Knightmare: restores Ne5, Pawn d3, Panic, pre-capture 6/15 clocks and Black move. White spends/draws Treason; repeated Ne5xd3 forbidden.',
  '64. Qd8-e8 is a different Black move; resolves restored Panic and retains White reaction allowance spent.',
  '65. Black Curse after Qe8 marks opposing Rb8 identity, retains physical card as Continuing Effect, draws Evil Eye; clocks unchanged.',
  '66. Black ends; Curse survives and new turn resets both spent allowances.',
  '67. Rb8xc8 captures the black c8 Bishop over one square, permitted by Curse; marker follows Rook.',
  '68. White ends Rxc8 with Curse still active.',
  '69. Nf5-d6 jumps to empty d6; Qg5-f6 is still blocked by the Pawn.',
  '70. Black ends Nd6 at fullmove 17.',
  '71. c5xd6 captures black original g8 Knight on the forward diagonal; no promotion.',
  '72. White ends cxd6 with physical Pawn on d6.',
  '73. Ne5-f3 jumps to empty f3 without checking Kf2.',
  '74. Black ends Nf3; White is safe.',
  '75. Qg5-f5 moves one square and gives Ke6 diagonal check.',
  '76. Treason would swap black Rh8/Nf3, putting Rf3 adjacent to Kf2 with a legal rook capture. Fizzle under §11.6, retain board/clocks and completed Qf5, draw Madman.',
  '77. White ends; Black must answer the existing Qf5 check.',
  '78. Breakthrough h6xh5 is a forward Pawn capture but fails to cure Qf5-e6 check. Fizzle and draw Doomsayer; checked-start ruling retains Black ordinary move and clocks.',
  '79. Ke6-f7 legally escapes: own f6 Pawn blocks Qf5 file, d6 Pawn attacks e7 rather than f7.',
  '80. Black ends Kf7; White receives fullmove 19.',
  '81. Cursed Rc8xc6 crosses empty c7 exactly two squares and captures black c7 Pawn; restriction satisfied.',
  '82. White ends Rxc6 with capture clock zero and Curse retained.',
  '83. Be7xd6 captures the physical white c2 Pawn, moving one diagonal square.',
  '84. Black ends Bxd6 at fullmove 20.',
  '85. Nd2xf3 jumps and captures black original b8 Knight; Kf2 safe.',
  '86. White ends Nxf3; both captured Black Knights stay off-board.',
  '87. Bd6-c7 moves one diagonal square into empty c7.',
  '88. Black ends Bc7; no King attack.',
  '89. Nf3-h2 jumps into empty h2; no pins or restrictions affect it.',
  '90. White ends Nh2 retaining all cards.',
  '91. Qe8-b8 crosses empty d8/c8; Curse applies only to white Rook, so three-square Queen move is legal.',
  '92. Black ends Qb8 at fullmove 22.',
  '93. Qf5xf4 captures black original e7 Pawn straight down one square.',
  '94. White ends Qxf4; f6 Pawn continues screening Kf7.',
  '95. b7xc6 captures cursed white physical a1 Rook on the forward diagonal. Printed Curse expires on capture and its card enters Black discard.',
  '96. Black ends bxc6 with Curse gone and capture clock zero.',
  '97. Nb5xc7 captures the black original f8 Bishop by legal knight jump.',
  '98. White ends Nxc7; no check on Kf7.',
  '99. Rh8-f8 crosses empty g8 to empty f8; castling was already unavailable.',
  '100. Black ends Rf8; White receives fullmove 24.',
  '101. Nc7xd5 captures black original d7 Pawn by legal knight jump.',
  '102. White ends Nxd5; Kf2 remains safe.',
  '103. Qb8-d6 crosses empty c7 into empty d6; neither King newly checked.',
  '104. Black ends Qd6 at fullmove 25.',
  '105. Nd5-c3 jumps into empty c3; removing d5 blocker still leaves d3 Pawn on Queen diagonal toward e2.',
  '106. White ends Nc3 safely.',
  '107. Kf7-e8 steps diagonally into empty e8 outside every White attack.',
  '108. Black ends Ke8; its old castling rights do not return.',
  '109. Rh3-h4 advances one empty square; no interference with h5 Pawn.',
  '110. White ends Rh4 with quiet clock 4.',
  '111. Ra8-a7 moves one empty square; a6 Pawn remains in place.',
  '112. Black ends Ra7 at fullmove 27.',
  '113. Qf4-f5 moves into empty f5; f6 Pawn blocks the file.',
  '114. White ends Qf5; Ke8 is safe.',
  '115. Ra7-f7 crosses empty b7/c7/d7/e7 to empty f7.',
  '116. Black ends Rf7; White receives fullmove 28.',
  '117. Bombard replaces White move with Rh4-g4, an optional zero-jump straight move into empty g4. No check or capture; clocks 8/28, draw Vulture.',
  '118. White ends Bombard with no further Regular Move.',
  '119. Qd6-e6 is a quiet horizontal step; e4 Pawn screens White King lines.',
  '120. Black ends the fiftieth Regular Move command; White before-move at 9/29, no active effect or unresolved obligation.',
];

test('iteration 066 independently reviewed deterministic campaign', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/066.json', import.meta.url), 'utf8'));
  assert.equal(trace.seed, 860066);
  assert.equal(rationale.length, 120);
  assert.equal(trace.steps.length, rationale.length);
  rationale.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  const cardMoves: Record<number, Array<[string, string]>> = {
    11: [['e7', 'e5'], ['e8', 'e6']], 24: [], 28: [],
    30: [['g1', 'b8'], ['b8', 'g1']],
    32: [['a7', 'a6'], ['c7', 'c6'], ['d6', 'd5'], ['f7', 'f6'], ['g6', 'g5'], ['h7', 'h6']],
    34: [['c2', 'c5']], 38: [['b2', 'b3'], ['d2', 'd3'], ['e3', 'e4'], ['g2', 'g3'], ['h3', 'h4']],
    55: [['b1', 'b8'], ['b8', 'b1']], 60: [], 65: [], 76: [], 78: [], 117: [['h4', 'g4']],
  };
  const cardClocks: Record<number, [number, number]> = {
    11: [0, 4], 24: [4, 7], 28: [6, 8], 30: [7, 8], 32: [0, 9], 34: [0, 9],
    38: [0, 10], 55: [4, 14], 60: [6, 15], 63: [6, 15], 65: [7, 16],
    76: [2, 18], 78: [2, 18], 117: [8, 28],
  };
  let state = createGameState(trace.initial);
  const snapshots = [state];
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1;
    const before = state;
    const result = applyAction(before, step.action);
    assert.ok(result.ok, rationale[index]);
    state = result.state;
    const setup = parseFen(before.fen).unwrap();
    const after = parseFen(state.fen).unwrap();
    const action = step.action;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const position = Chess.fromSetup(setup).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.ok(position.isLegal(move), rationale[index]);
      if (before.effects.some(effect => (effect as { type: string }).type === 'curse') && action.from === before.pieces.find(p => p.id === 'white-rook-a1')?.square) {
        assert.ok(Math.max(Math.abs(move.from % 8 - move.to % 8), Math.abs((move.from >> 3) - (move.to >> 3))) <= 2);
      }
      position.play(move);
      assert.equal(makeBoardFen(after.board), makeBoardFen(position.board), rationale[index]);
      assert.equal(after.halfmoves, position.halfmoves, rationale[index]);
      assert.equal(after.fullmoves, position.fullmoves, rationale[index]);
      assert.equal(after.turn, position.turn);
      assert.deepEqual(after.castlingRights, position.toSetup().castlingRights);
      const mover = before.pieces.find(p => p.zone === 'board' && p.square === action.from)!;
      const victim = before.pieces.find(p => p.zone === 'board' && p.square === action.to);
      assert.deepEqual(state.pieces, before.pieces.map(p => p.id === mover.id ? { ...p, square: action.to } : p.id === victim?.id ? { ...p, square: null, zone: 'captured', capturedBy: before.turn.color } : p));
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true });
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen, rationale[index]);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else if (action.type === 'playCard') {
      const owner = n === 63 ? 'white' : before.turn.color;
      const player = before.players[owner];
      const physical = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(physical);
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c.id !== physical.id), player.deck[0]]);
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1));
      assert.deepEqual(state.players[owner].discard, n === 65 ? player.discard : [...player.discard, physical]);
      assert.equal(state.turn.cardPlays[owner], 1);
      assert.deepEqual([after.halfmoves, after.fullmoves], cardClocks[n], rationale[index]);
      if (n === 63) {
        assert.equal(state.fen, snapshots[61]!.fen);
        assert.deepEqual(state.pieces, snapshots[61]!.pieces);
        assert.equal(state.turn.color, 'black');
        assert.equal(state.turn.moveMade, false);
        assert.equal(applyAction(state, trace.steps[61]!.action).ok, false, 'Knightmare requires a different move');
      } else {
        const moves = cardMoves[n]!;
        assert.deepEqual(state.pieces, before.pieces.map(piece => {
          const relocation = moves.find(([from]) => piece.zone === 'board' && piece.square === from);
          return relocation ? { ...piece, square: relocation[1] } : piece;
        }), rationale[index]);
        assert.equal(state.turn.moveMade, n !== 78);
        if ([28, 76, 78].includes(n)) assert.equal(state.history.at(-1)?.type, 'cardFizzled');
      }
    } else assert.fail('Unreviewed action');
    const curse = { type: 'curse', owner: 'black', card: { id: 'black-deck-1-curse', cardId: 'curse' }, pieceId: 'white-rook-a1' };
    const expectedEffects = n === 24 || n === 25 ? [{ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 }]
      : [60, 61, 63].includes(n) ? [{ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 }]
      : n >= 65 && n < 95 ? [curse] : [];
    assert.deepEqual(state.effects, expectedEffects, rationale[index]);
    assert.deepEqual(state.enPassant, n === 13 || n === 14 ? [{ target: 'f3', pawnId: 'white-pawn-f2' }] : []);
    assert.ok(!state.pendingRescue && !state.outcome, rationale[index]);
    if (n === 95) assert.equal(state.players.black.discard.at(-1)?.id, 'black-deck-1-curse');
    snapshots.push(state);
  }
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 14);
  assert.equal(state.fen, '4kr2/5r2/p1p1qp1p/5Q1P/4P1R1/1PNP2P1/P4K1N/2B2B2 w - - 9 29');
  assert.deepEqual(replayTrace(trace), state);
});
