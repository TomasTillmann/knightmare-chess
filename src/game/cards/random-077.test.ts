import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { parseFen, makeBoardFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { SquareSet } from 'chessops/squareSet';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';

// Each numbered entry was reviewed against the actual preceding board, cards.md,
// rules.md and printed catalog timing. Neither King ever leaves e1/e8; there are
// no promotions, neutral pieces, walls, or capture restrictions except Shield.
const rationales = [
  '1. e2-e3 advances into empty e3; neither King exposed; Pawn clock resets.',
  '2. White completes its safe move; Black begins, no draw or board change.',
  '3. f7-f6 advances into empty f6; e8 remains shielded by e7; fullmove becomes 2.',
  '4. Black ends safely; White begins with unchanged board and clocks.',
  '5. Nb1-c3 is an empty-square L jump; d2 still blocks the e1 diagonal.',
  '6. White ends Nc3 safely; Black begins with unchanged material.',
  '7. Ng8-h6 is a legal empty-square jump; neither King is attacked.',
  '8. Black ends Nh6; White begins without drawing.',
  '9. a2-a4 has empty a3/a4; a3 en passant opportunity is recorded, Pawn clock zero.',
  '10. White ends a4; Black retains its one-reply a3 opportunity.',
  '11. b7-b6 enters empty b6 and expires a3; e8 remains safe.',
  '12. Black plays Plots after b6; only already-held Siege is eligible for two extra card allowances; no extra move; draw Chaos.',
  '13. Black declines optional extra cards and ends; no allowance survives into White turn.',
  '14. Ng1-f3 jumps to empty f3; e1 safe; no captures.',
  '15. White Shields just-moved Nf3 for the next Black turn; regular card discarded, Blessing drawn.',
  '16. White ends; Shield remains active for Black upcoming turn.',
  '17. Bc8-a6 crosses empty b7; no Shield capture; d3/c4/b5 route does not reach e1.',
  '18. Black ends Ba6; White Shield expires after this protected turn.',
  '19. g2-g3 enters empty g3; e1 safe behind d2/e3/f2.',
  '20. White ends g3; no board, clocks, or hand changes.',
  '21. c7-c5 crosses empty c6/c5; c6 en passant recorded; e8 safe.',
  '22. Black ends c5 retaining c6 en passant for White reply.',
  '23. b2-b3 enters empty b3 and expires c6; e1 remains safe.',
  '24. White ends b3; Black begins with no outstanding capture window.',
  '25. f6-f5 is one empty forward square; no White line reaches e8.',
  '26. Black ends f5 safely; White begins.',
  '27. Bf1-g2 enters vacated g2; does not uncover an attack on e1.',
  '28. White ends Bg2; Black begins without changing cards.',
  '29. c5-c4 is an empty forward square; its attacks b3/d3 miss e1.',
  '30. Black ends c4; both Kings safe.',
  '31. Nc3-d5 is an empty-square jump; e1 remains protected.',
  '32. Cathedral swaps own Ra1/Bc1 after Nd5; no path or capture, King safe; draw No Quarter.',
  '33. White ends Cathedral; no second move or additional draw.',
  '34. Nb8-c6 is an empty L jump; Nd5 does not attack e8.',
  '35. Black ends Nc6; White begins safely.',
  '36. Rh1-g1 moves one empty square and loses h1 castling entitlement; e1 safe.',
  '37. White ends Rg1; no clock increment at endTurn.',
  '38. Ra8-b8 enters vacated b8 and loses a8 castling entitlement; e8 safe.',
  '39. Black ends Rb8; no restoration of castling rights.',
  '40. Nd5xb6 legally captures the b7 Pawn by L jump; e1 safe and capture clock zero.',
  '41. White ends Nxb6; captured Pawn remains eligible for Resurrection.',
  '42. Rb8-a8 moves one empty square; lost castling rights stay lost; e8 safe.',
  '43. Black ends Ra8; White begins with capture history unchanged.',
  '44. d2-d3 enters empty d3; Ba6-e2-f1 diagonal misses e1; legal Pawn move.',
  '45. Black Chaos rewinds exactly d3 to d2 and clocks to 1/11; d2-d3 forbidden this reply; draw Think Again.',
  '46. Ba1xg7 crosses empty b2,c3,d4,e5,f6; captures g7 Pawn, differs from canceled move; no check on e8.',
  '47. No Quarter follows ordinary Bxg7 and makes only captured g7 Pawn dead; draw Chaos, no board shift.',
  '48. White ends; both players card counts reset for next turn, g7 Pawn stays dead.',
  '49. Nc6-d4 is an empty L jump; e8 safe behind d7/e7.',
  '50. White Chaos restores Nc6 and clocks 0/11; forbids c6-d4 this reply; draw Annexation.',
  '51. Nc6-e5 is a different empty-square L jump; no King exposure.',
  '52. Black ends Ne5; White response allowance resets.',
  '53. Annexation simultaneously advances b3-b5/g3-g5 through empty b4/g4; neither began on rank 2, no en passant.',
  '54. White ends replacement move; no ordinary move follows Annexation.',
  '55. Resurrection returns captured b7 Pawn to vacant b7, never dead g7 Pawn; consumes Black move and draws Vulture.',
  '56. Black ends Pawn placement; fullmove 13 and both Kings safe.',
  '57. c2-c3 enters empty c3; c4 Pawn attacks b3/d3, not e1.',
  '58. Curse marks opposing Qd8 after c3; Continuing card retained, limits distance to two; Siege drawn.',
  '59. White ends; Curse remains on physical black Queen.',
  '60. Ra8-c8 crosses empty b8; Curse affects Queen only; no e8 exposure.',
  '61. Black ends Rc8; persistent Curse and hands unchanged.',
  '62. h2-h3 advances one empty square; both Kings safe.',
  '63. White ends h3; Curse remains active.',
  '64. Qd8xb6 crosses empty c7 and travels exactly two under Curse; captures Nb6; e8 safe.',
  '65. Black ends Qxb6; Curse follows Queen to b6.',
  '66. Nf3xe5 captures Black b8 Knight by legal L jump; Shield already expired; e1 safe.',
  '67. White ends Nxe5; captured Knight remains captured.',
  '68. Evil Eye uses Ba6 legal capture on adjacent b5 Pawn; bishop stationary, Pawn captured, Black move consumed.',
  '69. Black ends Evil Eye; no second movement or draw; e8 safe.',
  '70. g5-g6 enters empty g6; no promotion or attack on e8.',
  '71. White ends g6; Curse persists, no new en passant.',
  '72. Rc8-c6 crosses empty c7; no capture or e8 exposure.',
  '73. Black ends Rc6; White begins with same board.',
  '74. g6xh7 captures the h7 Pawn diagonally; rank 7 does not promote; e1 safe.',
  '75. White ends gxh7; g2 Pawn identity now h7.',
  '76. Nh6-g4 is a legal empty L jump; e8 remains safe.',
  '77. Siege swaps own Ng4/Rc6 after the move; neither captures; e8 safe; draw Doomsayer.',
  '78. Black ends Siege; Nc6 and Rg4 retain their original identities.',
  '79. f2-f4 crosses empty f3/f4, records f3 en passant; Rg4 is not aligned with e1.',
  '80. White ends f4 retaining f3 reply opportunity.',
  '81. Qb6-d8 crosses empty c7, exactly two under Curse; f3 opportunity expires; e8 safe.',
  '82. Black ends Qd8; Curse follows Queen, no draw.',
  '83. Qd1-b3 crosses empty c2 to empty b3; e1 safe, no capture.',
  '84. White ends Qb3; Black begins safely.',
  '85. Rg4-g6 crosses vacated g5 to empty g6; no exposure of e8.',
  '86. Black ends Rg6; both Kings remain safe.',
  '87. Bg7xf8 captures adjacent Black Bishop; Bf8 does not attack horizontally adjacent Ke8.',
  '88. White ends Bxf8; ordinary capture clock remains zero.',
  '89. Rg6-g7 enters empty g7; e8 safe, no capture.',
  '90. Black plays Doomsayer after Rg7; Continuing card retained; White receives immediate option; Fireball drawn.',
  '91. White declines immediate naming; no capture, card use, or clock change; Doomsayer stays active.',
  '92. Black ends after the naming option closes; White begins with Doomsayer live.',
  '93. White names Knight and loses its own Ne5; capture resets halfmove, resolves and discards Doomsayer without drawing.',
  '94. Qb3-a3 enters adjacent empty a3; removed Ne5 did not expose e1.',
  '95. White ends Qa3; only Curse remains.',
  '96. Nc6-d4 is legal now: prior Chaos prohibition ended many turns earlier and concerned another Knight.',
  '97. Black ends Nd4; Nd4 attacks c2/e2, not e1.',
  '98. Qa3-b2 enters adjacent empty b2; no exposure of e1.',
  '99. White ends Qb2; no draw or clock advance.',
  '100. Qd8-c8 is one empty square under Curse; e8 safe because Bf8 attacks diagonally.',
  '101. Black ends Qc8; Curse remains on Queen.',
  '102. Qb2-a3 returns to empty a3; no forbidden-repeat obligation remains.',
  '103. White ends Qa3 with e1 safe.',
  '104. Qc8-c7 moves one empty square under Curse; e8 safe.',
  '105. Black ends Qc7; White begins safely.',
  '106. Qa3-d6 crosses empty b4,c5; Qd6 is NOT aligned with Ke8 (delta 1,2), so no claimed blocker.',
  '107. White ends Qd6; neither King checked.',
  '108. Rg7-g8 enters empty g8; Qd6 does not check Ke8, so Black may move this Rook.',
  '109. Black ends Rg8; White begins with no capture or extra move.',
  '110. e3xd4 captures Black g8 Knight diagonally; Ba6-e2-f1 line still misses e1; capture resets clock.',
  '111. White ends exd4; no King exposure.',
  '112. Rh8xh7 captures White g2 Pawn one square down, revokes final Black castling entitlement; fullmove 26.',
  '113. Black ends Rxh7; no promotion occurred before the Pawn was captured.',
  '114. d2-d3 is now legal despite old Chaos; empty square, e1 safe, Pawn clock zero.',
  '115. White ends d3; Black begins at fullmove 26 with Curse intact and no pending rescue.',
];

test('iteration 077 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/077.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860077);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 12);
  let state = createGameState(trace.initial);
  const states = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationales[index]!.startsWith(`${n}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    const expectedPieces = structuredClone(before.pieces);
    const piece = (id: string) => expectedPieces.find(p => p.id === id)!;
    const relocate = (id: string, square: string | null, zone: 'board' | 'captured' | 'dead' = 'board') => {
      Object.assign(piece(id), { square, zone });
      if (zone === 'captured') piece(id).capturedBy = n === 93 ? 'black' : before.turn.color;
      else delete piece(id).capturedBy;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      // Curse never legalizes a standard-illegal move. Verify all 50 moves with
      // independent chess geometry, captures and King safety, including effect turns.
      const setup = parseFen(before.fen).unwrap();
      setup.castlingRights = SquareSet.empty(); // No castling is sampled; swaps leave dormant rights.
      const chess = Chess.fromSetup(setup).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.ok(chess.isLegal(move), rationales[index]);
      if (mover.id === 'black-queen-d8' && n >= 58) {
        assert.ok(Math.max(Math.abs(move.from % 8 - move.to % 8), Math.abs(Math.floor(move.from / 8) - Math.floor(move.to / 8))) <= 2);
      }
      chess.play(move);
      assert.equal(state.fen.split(' ')[0], makeBoardFen(chess.board), rationales[index]);
      assert.deepEqual(state.fen.split(' ').slice(4), [String(chess.halfmoves), String(chess.fullmoves)]);
      relocate(mover.id, action.to);
      if (victim) relocate(victim.id, null, 'captured');
    }
    if (n === 32) { relocate('white-rook-a1', 'c1'); relocate('white-bishop-c1', 'a1'); }
    if (n === 45) relocate('white-pawn-d2', 'd2');
    if (n === 47) relocate('black-pawn-g7', null, 'dead');
    if (n === 50) relocate('black-knight-b8', 'c6');
    if (n === 53) { relocate('white-pawn-b2', 'b5'); relocate('white-pawn-g2', 'g5'); }
    if (n === 55) relocate('black-pawn-b7', 'b7');
    if (n === 68) relocate('white-pawn-b2', null, 'captured');
    if (n === 77) { relocate('black-rook-a8', 'g4'); relocate('black-knight-g8', 'c6'); }
    if (n === 93) relocate('white-knight-g1', null, 'captured');
    assert.deepEqual(state.pieces, expectedPieces, rationales[index]);
    assert.deepEqual(state.pieces.filter(p => p.royal).map(p => [p.owner, p.square, p.zone]),
      [['white', 'e1', 'board'], ['black', 'e8', 'board']]);
    assert.ok(!state.pendingRescue);
    const expectedEffects: unknown[] = [];
    if (n >= 15 && n < 18) expectedEffects.push({ type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-knight-g1' });
    if (n >= 58) expectedEffects.push({ type: 'curse', owner: 'white', card: { id: 'white-hand-2-curse', cardId: 'curse' }, pieceId: 'black-queen-d8' });
    if (n >= 90 && n < 93) expectedEffects.push({ type: 'doomsayer', owner: 'black', card: { id: 'black-deck-4-doomsayer', cardId: 'doomsayer' } });
    assert.deepEqual(state.effects, expectedEffects, rationales[index]);
    const expectedPlayers = structuredClone(before.players);
    if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const player = expectedPlayers[owner];
      const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0);
      const [card] = player.hand.splice(cardIndex, 1);
      if (n !== 58 && n !== 90) player.discard.push(card!);
      player.hand.push(player.deck.shift()!);
      assert.deepEqual(state.turn.cardPlays, { ...before.turn.cardPlays, [owner]: before.turn.cardPlays[owner] + 1 });
      assert.equal(state.turn.color, before.turn.color);
      assert.equal(state.turn.phase, n === 45 || n === 50 ? 'beforeMove' : 'afterMove');
      assert.equal(state.turn.moveMade, n !== 45 && n !== 50);
    }
    if (n === 93) expectedPlayers.black.discard.push({ id: 'black-deck-4-doomsayer', cardId: 'doomsayer' });
    assert.deepEqual(state.players, expectedPlayers, rationales[index]);
    if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.equal(state.turn.phase, 'beforeMove');
      assert.equal(state.turn.moveMade, false);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
    }
    if (action.type !== 'move' && action.type !== 'endTurn') {
      const clocks: Record<number, string[]> = { 45: ['1', '11'], 50: ['0', '11'], 53: ['0', '12'], 55: ['0', '13'], 68: ['0', '16'], 93: ['0', '21'] };
      assert.deepEqual(state.fen.split(' ').slice(4), clocks[n] ?? before.fen.split(' ').slice(4));
    }
    const ep: Record<number, { target: string; pawnId: string }[]> = {
      9: [{ target: 'a3', pawnId: 'white-pawn-a2' }], 10: [{ target: 'a3', pawnId: 'white-pawn-a2' }],
      21: [{ target: 'c6', pawnId: 'black-pawn-c7' }], 22: [{ target: 'c6', pawnId: 'black-pawn-c7' }],
      79: [{ target: 'f3', pawnId: 'white-pawn-f2' }], 80: [{ target: 'f3', pawnId: 'white-pawn-f2' }],
    };
    assert.deepEqual(state.enPassant, ep[n] ?? []);
    const lostRookSquare = n === 36 ? 'h1' : n === 38 ? 'a8' : n === 112 ? 'h8' : undefined;
    const rights = parseFen(before.fen).unwrap().castlingRights;
    assert.deepEqual(parseFen(state.fen).unwrap().castlingRights,
      lostRookSquare ? rights.without(parseSquare(lostRookSquare)!) : rights);
    if (n === 12) {
      assert.equal(state.plotsAllowances?.length, 1);
      assert.equal(state.plotsAllowances[0]!.remaining, 2);
      assert.deepEqual(state.plotsAllowances[0]!.eligibleCards, ['black-hand-1-siege']);
    }
    if (n === 13) assert.equal(state.plotsAllowances, undefined);
    if (n === 45) assert.equal(state.fen, states[43]!.fen);
    if (n === 50) assert.equal(state.fen, states[48]!.fen);
    states.push(state);
  }
  assert.equal(state.fen, '4kBr1/ppqpp2r/b2Q4/5p2/P1pP1P2/2PP3P/6B1/2R1K1R1 b A - 0 26');
  assert.deepEqual(replayTrace(trace), state);
});
