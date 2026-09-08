import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';

// Ordered review from rules §§8–16 and 18, cards.md, catalog timing, and the
// Truce/Confabulation/Earthquake/Fortification artwork. No generated pass labels.
const rationales = [
  '1. d2-d3 is one empty forward pawn step; both Kings remain screened.',
  '2. White ends after d3; Black receives its ordinary move, no forced discard.',
  '3. a7-a5 crosses empty a6; a6 en passant belongs to this physical pawn.',
  '4. Black ends; the a6 opportunity persists for White.',
  '5. Bc1-e3 crosses the vacated d2; quiet diagonal, pawn shield intact.',
  '6. Black Knightmare reacts: restore Bc1 and the a6 opportunity; forbid that move, spend/draw once.',
  '7. Qd1-d2 is a different quiet move to an empty adjacent square; a6 expires.',
  '8. White ends the replacement move; reset both per-turn card allowances.',
  '9. Ra8-a6 crosses empty a7, loses Black queenside castling only.',
  '10. Black ends the quiet rook move; board and clocks stay fixed.',
  '11. a2-a4 crosses empty a3, creates a3 opportunity; a5 is not traversed.',
  '12. White plays Truce after moving: retain its card beside board and refill once; no capture or check exists.',
  '13. End passes to Black; Truce and the a3 opportunity persist.',
  '14. g7-g5 crosses empty g6 without capture, satisfying Truce; replace a3 opportunity with g6.',
  '15. Black ends with Truce active; no optional discard selected.',
  '16. Qd2-d1 is quiet and leaves the King screened; g6 expires.',
  '17. End passes to Black without altering Truce.',
  '18. g5-g4 is an empty forward pawn step, not a capture.',
  '19. Black ends; White gets its move with Truce intact.',
  '20. Ra1-a3 crosses empty a2; quiet, loses White queenside castling.',
  '21. White ends; neither King is checked and Truce stays.',
  '22. b7-b6 is one empty forward step under Truce.',
  '23. Black plays Vendetta after its move; retain it and draw Dubbing.',
  '24. White cannot legally capture under Truce, so Vendetta expires into Black discard.',
  '25. g2-g3 is empty forward movement; g4 remains occupied by the opposing pawn.',
  '26. White ends its quiet move; Truce stays.',
  '27. b6-b5 is one empty forward step, with no capture.',
  '28. Black ends; no board or hand changes.',
  '29. Ra3-c3 crosses empty b3 and stops before the friendly pawn d3.',
  '30. White ends; Truce still suppresses captures.',
  '31. h7-h6 is empty forward pawn movement.',
  '32. Black ends with the same board and active Truce.',
  '33. h2-h4 crosses empty h3; record h3 opportunity even though Truce forbids capture.',
  '34. White ends; h3 remains available in bookkeeping for the next turn.',
  '35. b5-b4 is quiet; the unused h3 opportunity expires.',
  '36. Black ends; Truce remains active.',
  '37. Ke1-d2 is adjacent and safe; remove White remaining castling rights.',
  '38. White ends at d2; no opposing line attacks that King.',
  '39. Nb8-c6 is a quiet knight jump and does not check d2.',
  '40. Rebirth after Black move sends enemy c2 pawn to empty a2, a legal starting pawn square; same identity, no capture.',
  '41. Black ends; relocated pawn and Truce remain.',
  '42. Confabulation merges e2 pawn diagonally into friendly d3 pawn, no capture; retain both identities and consume the replacement move.',
  '43. White ends; composite at d3 remains one board occupant with two physical pawns.',
  '44. Hidden Passage replaces Black move: Ke8-d4 to empty safe square; pawns at d3 attack c4/e4, not d4.',
  '45. Black ends its replacement move; all castling rights are now lost.',
  '46. Bf1-e2 enters the vacated pawn square; d3 blocks its diagonal toward the Black King.',
  '47. White ends; composite and Truce persist.',
  '48. Bf8-g7 is a quiet adjacent diagonal to the vacated pawn square.',
  '49. Black ends; no capture, no King line yet.',
  '50. Rc3-c4 is quiet and now attacks adjacent Black King d4; this ends Truce and discards it.',
  '51. White ends with Black in check; Black gets its escape turn.',
  '52. Kd4-d5 escapes the c4 rook rank; d5 is not attacked by the d3 composite or White minors.',
  '53. Black ends safely on d5.',
  '54. Rc4xg4 crosses empty d4/e4/f4 and captures Black g-pawn; capture resets halfmove clock.',
  '55. White ends; composite remains active, Truce is gone.',
  '56. Evangelists swaps Black c8 and White c1 Bishops atomically, replacing Black move; Bishop c1 checks d2 but White can escape.',
  '57. Black ends the checking swap, giving White its escape turn.',
  '58. Be2-f3 leaves White in Bc1 check; only a provisional same-turn card-rescue state is allowed (§11.6).',
  '59. Earthquake cannot cure the adjacent Bc1-d2 attack; spend/draw it, restore failed Be2-f3 and all attempted promotions/orientation.',
  '60. Kd2-c2 is adjacent and escapes Bc1; c6 knight is too far, c-file Queen is not present yet.',
  '61. White ends the safe replacement move; Earthquake remains spent.',
  '62. Bg7-e5 crosses empty f6, quiet diagonal; White King c2 is not on its line.',
  '63. Black ends, preserving the ordinary quiet-move clock.',
  '64. Ng1-h3 jumps to an empty square; White King c2 remains safe.',
  '65. White ends; both card allowances reset.',
  '66. Be5-g7 crosses empty f6, a two-square quiet bishop move.',
  '67. White Bog reacts and shortens that bishop move to f6; same turn/clocks, spend and refill White only.',
  '68. Black ends the shortened move; White receives a fresh own-turn allowance.',
  '69. Rg4xg8 crosses empty g5/g6/g7 and captures Black g8 Knight; Black King d5 is safe.',
  '70. Anathema after White move swaps enemy Bishop f6 and Rook h8 without capture or changing clocks.',
  '71. White ends with both swapped physical identities preserved.',
  '72. Qd8xc8 captures the White Bishop moved there by Evangelists; White King c2 is screened by c7 pawn.',
  '73. Black ends the capture; White receives its move.',
  '74. Rh1-g1 is a quiet rook step to the vacated Knight square.',
  '75. White ends; no effect expires.',
  '76. Nc6-e5 jumps to an empty square; Black King d5 stays safe.',
  '77. Black ends its quiet knight move.',
  '78. Rg1-e1 crosses empty f1; no capture and no King exposure.',
  '79. Disintegration after White move makes own a4 pawn dead, not captured; no clock change or composite change.',
  '80. White ends; the dead pawn cannot later be used by Betrayal.',
  '81. c7-c6 is an empty forward step; it continues to block Queen c8 from White King c2.',
  '82. Black ends; board remains safe.',
  '83. f2-f3 advances into empty square while Bishop e2 continues shielding White lines.',
  '84. White ends the pawn move.',
  '85. Rf6-f4 crosses empty f5 and stops before White pawn f3; no capture.',
  '86. Black Panic after its move schedules White 15000ms; discard regular card and draw Fortification.',
  '87. Black ends; White begins with Panic active and still has a move.',
  '88. Re1-h1 crosses empty f1/g1; a timely legal move satisfies and clears Panic.',
  '89. White ends normally after satisfying Panic.',
  '90. Kd5-c5 is adjacent and safe: White d3 pawn only attacks c4/e4.',
  '91. Black ends with King c5 safe.',
  '92. g3xf4 is a forward diagonal pawn capture of Black Rook; reset clock and retain pawn identity.',
  '93. White ends the capture; composite remains at d3.',
  '94. Ne5xd3 captures the entire composite: both d2/e2 physical pawns captured, Confabulation discarded.',
  '95. Black ends; neither original pawn remains on board or away.',
  '96. Rg8-g6 crosses empty g7; c6 pawn blocks its rank toward Black King area.',
  '97. White ends the quiet rook move.',
  '98. Nd3-e1 is a quiet knight jump to the vacated rook square, checking White King c2.',
  '99. Black ends having checked White; White may use a before-move card and still must cure its check.',
  '100. Before-move Betrayal returns captured d2 pawn alone at b4 and makes opposing b-pawn dead; both Kings now checked, but White retains its curing Regular Move (§11.6).',
  '101. Rh1xe1 crosses empty g1/f1 and captures the checking Black Knight, curing White check; Black remains checked by b4 pawn.',
  '102. White ends with Black in pawn check; escape turn follows.',
  '103. d7-d5 crosses empty d6 but fails to answer b4-c5 check; stage only pending rescue with d6 opportunity.',
  '104. Fortification b6-c7 does not block pawn b4-c5; spend/draw and undo failed d7-d5, restoring d7, clock, turn, and no en passant.',
  '105. Kc5-b6 escapes the pawn attack; White Rg6 is screened by Black c6 pawn.',
  '106. Black ends safe on b6; failed Fortification remains discarded.',
  '107. Masquerade replaces White move, allowing Knight h3-g4 as a quiet Queen diagonal; identity stays Knight.',
  '108. White ends the Masquerade move; no continuing movement power remains.',
  '109. Bh8-e5 crosses empty g7/f6; its f4 ray stops at a White pawn, and its c3 ray does not attack King c2.',
  '110. Black ends its quiet Bishop move.',
  '111. b4xa5 captures Black a-pawn; returned White pawn is an ordinary pawn and checks King b6.',
  '112. White ends checking Black; a legal capture of the checker is available.',
  '113. Ra6xa5 captures that White pawn and cures the b6 check; no White line is opened to b6.',
  '114. Black ends the safe capture.',
  '115. Evil Eye replaces White move: Rg6 legally threatens adjacent h6 pawn; capture that pawn without moving the Rook, Black King screened by c6.',
  '116. White ends Evil Eye replacement move, no extra ordinary move.',
  '117. Kb6-b7 is adjacent and safe: Rg6 attacks rank six, Ng4 does not attack b7.',
  '118. Black ends the fiftieth move command; White begins turn 27 with no unresolved effects.',
];

test('iteration 047 independently reviewed deterministic game', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/047.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860047);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 118);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 16);
  const states: GameState[] = [createGameState(trace.initial)];
  const cardChanges: Record<number, Array<[string, string | null, string]>> = {
    6: [['white-bishop-c1', 'c1', 'board']],
    12: [], 23: [],
    40: [['white-pawn-c2', 'a2', 'board']],
    42: [['white-pawn-e2', null, 'away']],
    44: [['black-king-e8', 'd4', 'board']],
    56: [['black-bishop-c8', 'c1', 'board'], ['white-bishop-c1', 'c8', 'board']],
    59: [['white-bishop-f1', 'e2', 'board']],
    67: [['black-bishop-f8', 'f6', 'board']],
    70: [['black-bishop-f8', 'h8', 'board'], ['black-rook-h8', 'f6', 'board']],
    79: [['white-pawn-a2', null, 'dead']], 86: [],
    100: [['white-pawn-d2', 'b4', 'board'], ['black-pawn-b7', null, 'dead']],
    104: [['black-pawn-d7', 'd7', 'board']],
    107: [['white-knight-g1', 'g4', 'board']],
    115: [['black-pawn-h7', null, 'captured']],
  };
  const truce = { type: 'truce', owner: 'white', card: { id: 'white-hand-4-truce', cardId: 'truce' } };
  const vendetta = { type: 'vendetta', owner: 'black', card: { id: 'black-hand-4-vendetta', cardId: 'vendetta' } };
  const composite = { type: 'confabulation', owner: 'white', card: { id: 'white-hand-2-confabulation', cardId: 'confabulation' }, pieceIds: ['white-pawn-d2', 'white-pawn-e2'] };
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationales[index]!.startsWith(`${n}. `));
    const before = states[index]!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    const after = result.state;
    states.push(after);
    assert.equal(after.orientation, 0, 'failed Earthquake must not persist');
    assert.equal(!!after.pendingRescue, n === 58 || n === 103, rationales[index]);
    const ep = [3, 4, 6].includes(n) ? ['a6', 'black-pawn-a7']
      : [11, 12, 13].includes(n) ? ['a3', 'white-pawn-a2']
      : [14, 15].includes(n) ? ['g6', 'black-pawn-g7']
      : [33, 34].includes(n) ? ['h3', 'white-pawn-h2']
      : n === 103 ? ['d6', 'black-pawn-d7'] : undefined;
    assert.deepEqual(after.enPassant, ep ? [{ target: ep[0], pawnId: ep[1] }] : [], rationales[index]);
    const expectedEffects: unknown[] = [];
    if (n >= 12 && n < 50) expectedEffects.push(truce);
    if (n === 23) expectedEffects.push(vendetta);
    if (n >= 42 && n < 94) expectedEffects.push(composite);
    if (n === 86 || n === 87) expectedEffects.push({ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 });
    assert.deepEqual(after.effects, expectedEffects, rationales[index]);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const setup = parseFen(before.fen).unwrap();
      // At 101 both Kings are temporarily checked under §11.6. Validate the
      // ordinary setup without Betrayal's pawn, then restore it before the oracle.
      const validationBoard = setup.board.clone();
      if (n === 101) validationBoard.take(parseSquare('b4')!);
      const initialized = Chess.fromSetup({ ...setup, board: validationBoard });
      assert.ok(initialized.isOk, rationales[index]);
      const position = initialized.value;
      position.board = setup.board.clone();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.equal(position.isLegal(move), n !== 58 && n !== 103, rationales[index]);
      position.play(move);
      assert.equal(makeBoardFen(position.board), after.fen.split(' ')[0], rationales[index]);
      const mover = before.pieces.find(p => p.square === action.from)!;
      assert.deepEqual(after.pieces.find(p => p.id === mover.id), { ...mover, square: action.to });
      const victim = before.pieces.find(p => p.square === action.to);
      if (victim) assert.deepEqual(after.pieces.find(p => p.id === victim.id), { ...victim, square: null, zone: 'captured', capturedBy: before.turn.color });
      assert.equal(parseFen(after.fen).unwrap().halfmoves, position.halfmoves);
      assert.equal(parseFen(after.fen).unwrap().fullmoves, position.fullmoves);
      assert.equal(after.turn.moveMade, true);
      assert.deepEqual(after.turn.cardPlays, before.turn.cardPlays);
      assert.deepEqual(after.players.white.hand, before.players.white.hand);
      assert.deepEqual(after.players.black.hand, before.players.black.hand);
      if (n < 50) assert.equal(after.pieces.filter(p => p.zone === 'captured').length, 0, 'Truce forbids captures');
    } else if (action.type === 'endTurn') {
      assert.equal(after.fen, before.fen);
      assert.deepEqual(after.pieces, before.pieces);
      assert.equal(after.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.equal(after.turn.phase, 'beforeMove');
      assert.equal(after.turn.moveMade, false);
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 });
      assert.deepEqual(after.enPassant, before.enPassant);
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unreviewed action');
      const changes = cardChanges[n]!;
      assert.ok(changes);
      assert.deepEqual(after.pieces, before.pieces.map(piece => {
        const change = changes.find(([id]) => id === piece.id);
        if (!change) return piece;
        const { capturedBy: _actor, ...physicalPiece } = piece;
        return { ...physicalPiece, square: change[1], zone: change[2], ...(change[2] === 'captured' ? { capturedBy: before.turn.color } : {}) };
      }), rationales[index]);
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const previous = before.players[owner];
      const current = after.players[owner];
      const opponent = owner === 'white' ? 'black' : 'white';
      assert.deepEqual(after.players[opponent], before.players[opponent]);
      assert.deepEqual(current.hand, [...previous.hand.filter(c => c.id !== action.cardInstanceId), previous.deck[0]]);
      assert.deepEqual(current.deck, previous.deck.slice(1));
      assert.equal(after.turn.cardPlays[owner], before.turn.cardPlays[owner] + 1);
      assert.equal(current.discard.some(c => c.id === action.cardInstanceId), ![12, 23, 42].includes(n));
      assert.equal(after.turn.moveMade, ![6, 59, 100, 104].includes(n));
      if ([12, 23, 40, 70, 79, 86, 100].includes(n)) {
        assert.deepEqual(after.fen.split(' ').slice(1), before.fen.split(' ').slice(1), 'non-move card preserves clocks and actor');
      }
      const tails: Record<number, string> = { 6: 'w KQkq - 0 2', 42: 'b k - 0 10', 44: 'w - - 1 11',
        56: 'w - - 1 14', 59: 'w - - 1 14', 67: 'w - - 5 16', 104: 'b - - 0 23',
        107: 'b - - 2 24', 115: 'b - - 0 26' };
      if (tails[n]) assert.equal(after.fen.split(' ').slice(1).join(' '), tails[n], rationales[index]);
      const rewind = n === 6 ? 4 : n === 59 ? 57 : n === 104 ? 102 : undefined;
      if (rewind !== undefined) {
        assert.equal(after.fen, states[rewind]!.fen);
        assert.deepEqual(after.enPassant, states[rewind]!.enPassant);
      }
    }
  }
  assert.deepEqual(states[3]!.enPassant, [{ target: 'a6', pawnId: 'black-pawn-a7' }]);
  assert.deepEqual(states[11]!.enPassant, [{ target: 'a3', pawnId: 'white-pawn-a2' }]);
  assert.deepEqual(states[14]!.enPassant, [{ target: 'g6', pawnId: 'black-pawn-g7' }]);
  assert.deepEqual(states[33]!.enPassant, [{ target: 'h3', pawnId: 'white-pawn-h2' }]);
  assert.deepEqual(states[103]!.enPassant, [{ target: 'd6', pawnId: 'black-pawn-d7' }]);
  assert.deepEqual(states[94]!.pieces.filter(p => ['white-pawn-d2', 'white-pawn-e2'].includes(p.id)).map(p => p.zone), ['captured', 'captured']);
  assert.equal(states[100]!.pieces.find(p => p.id === 'white-pawn-e2')!.zone, 'captured');
  assert.equal(states[100]!.pieces.find(p => p.id === 'white-pawn-a2')!.zone, 'dead');
  assert.equal(states[115]!.pieces.find(p => p.id === 'white-rook-a1')!.square, 'g6');
  assert.equal(replayTrace(trace).fen, '2q5/1k1ppp2/2p3R1/r3b3/5PNP/5P2/PPK1B3/1NbQR3 w - - 1 27');
});
