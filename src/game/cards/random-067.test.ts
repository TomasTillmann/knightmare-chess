import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Manually reviewed in order against rules §§8–11, 15.5, 18, 20, 21.1 and cards.md.
const rationale = [
  '1. c2-c4 crosses empty c3; double Pawn move resets clock and creates c3 en passant.',
  '2. White finishes c4; Black receives the turn and the c3 opportunity.',
  '3. Bombard h8-h3 jumps only h7, crosses empty h6/h5/h4, replaces Black move, revokes kingside castling.',
  '4. Black ends the completed Bombard turn; White receives its move.',
  '5. Nb1-c3 is an empty L jump with White King protected.',
  '6. Siege swaps White Nc3/Ra1 without capture or extra clock; physical identities and prior movement survive.',
  '7. White closes Siege after-move window; Black allowance resets.',
  '8. Ng8-f6 is an empty L jump; no King line opens.',
  '9. Black completes Nf6 and White becomes active.',
  '10. f2-f3 advances into an empty square; Pawn clock resets.',
  '11. White finishes f3; no optional discard is requested.',
  '12. Rh3xh2 captures White h-Pawn one square down; Black King stays shielded.',
  '13. Black finishes Rh2; captured h-Pawn remains returnable.',
  '14. Rc3-e3 crosses empty d3; physical a-Rook regular movement removes its remaining castling eligibility.',
  '15. White finishes Re3 without changing board or clocks.',
  '16. h7-h6 is one empty forward Black Pawn step.',
  '17. Black finishes h6 and hands the move to White.',
  '18. g2-g3 is an empty forward Pawn step; King e1 remains safe.',
  '19. White finishes g3; hands and pieces persist.',
  '20. Rh2-h5 crosses empty h3/h4 without capture.',
  '21. Black finishes Rh5; clocks do not advance again.',
  '22. Re3-d3 is one empty horizontal step.',
  '23. Challenge names Black Nb8, which can legally jump to a6/c6; after-move card leaves board and clocks.',
  '24. Black turn begins with the b8 Knight obligation intact.',
  '25. Nb8-c6 is a legal L jump satisfying and removing Challenge.',
  '26. Black ends Nc6 with Challenge already discharged.',
  '27. Rd3xd7 crosses empty d4/d5/d6 and captures the d-Pawn.',
  '28. White finishes Rxd7; Black King is not checked through its e7 Pawn.',
  '29. Nc6-b4 is an empty L jump; it does not uncover Black King.',
  '30. Black finishes Nb4; no card effect remains.',
  '31. Qd1-b3 crosses empty c2 on a diagonal.',
  '32. White ends Qb3 with both Kings safe.',
  '33. Qd8xd7 captures the White a-Rook directly below it.',
  '34. Black ends Qxd7 and preserves the captured Rook identity.',
  '35. Qb3xb4 captures Black original b8 Knight one square forward.',
  '36. Panic is an after-move card imposing 15000 ms on Black next move; no board or clock change.',
  '37. White ends its turn with Panic waiting for Black.',
  '38. Black Panic timeout forfeits the turn, expires the effect, increments clocks once without moving.',
  '39. a2-a3 is an empty Pawn step on White consecutive turn.',
  '40. White ends a3; Black resumes ordinary play.',
  '41. e7-e6 is an empty forward Black Pawn step.',
  '42. Black ends e6 without extra clock increment.',
  '43. Qb4xb7 crosses empty b5/b6 and captures Black b-Pawn.',
  '44. White ends Qxb7; Black King e8 has no Queen attack.',
  '45. Rh5-c5 crosses empty g5/f5/e5/d5.',
  '46. Fatal Attraction marks owned Ra8 and retains its card; neighboring a7 Pawn and White Qb7 are frozen.',
  '47. Black ends with the magnet and its immobilization active.',
  '48. Rh1-h5 crosses empty h2/h3/h4 outside magnet range and revokes White remaining castling right.',
  '49. White finishes Rh5 while Qb7 stays frozen.',
  '50. e6-e5 is an empty Pawn step outside magnet range.',
  '51. Black ends e5; the a8 magnet has not moved.',
  '52. Rh5-h2 crosses empty h4/h3 without capture.',
  '53. White ends Rh2 with Fatal Attraction retained.',
  '54. Tournament f6/g1 would put White Knight on f6 attacking Black Ke8; it fizzles, spends card and safe-start replacement move.',
  '55. Black ends the fizzled Tournament turn; both Knights remain in place.',
  '56. e2-e3 is an empty Pawn step; Qb7 remains immobilized.',
  '57. White ends e3 without effect expiry.',
  '58. Bf8-d6 crosses vacant e7 diagonally.',
  '59. Black ends Bd6; no King is checked.',
  '60. e3-e4 advances White Pawn onto an empty square.',
  '61. White ends e4, preserving all physical markers.',
  '62. Qd7-b5 crosses empty c6 diagonally; White d2 Pawn blocks its e2/f1 line.',
  '63. Black ends Qb5 and White receives its move.',
  '64. f3-f4 advances one empty square; King e1 is safe.',
  '65. White ends f4 with Qb7 still unable to move.',
  '66. g7-g6 advances Black Pawn into an empty square.',
  '67. Black ends g6 and retains the stationary magnet.',
  '68. a3-a4 advances outside the magnet neighborhood.',
  '69. White ends a4 without moving its frozen Queen.',
  '70. Ra8-b8 moves the magnet itself, discards Fatal Attraction and releases Qb7; Black queenside castling expires.',
  '71. Black ends Rb8 with no continuing effects.',
  '72. a4-a5 is an empty Pawn step; no capture is required.',
  '73. White ends a5 and passes to Black.',
  '74. Bc8-d7 is a clear single diagonal step.',
  '75. Black finishes Bd7, leaving b8 Rook exposed.',
  '76. Released Qb7xb8 captures the Rook and checks Ke8 along empty c8/d8.',
  '77. White ends Qxb8; checked Black receives its escape turn.',
  '78. Nf6xe4 has L geometry and captures the Pawn but leaves Qb8 check; only a pending same-turn card rescue permits staging.',
  '79. Cowardice a5-a3 cannot cure the b8-e8 check; card fizzles and the illegal Knight move/capture/clocks rewind.',
  '80. Qb5xb8 crosses empty b6/b7 and captures the checking Queen, legally curing check.',
  '81. Black ends the replacement Qxb8 with Cowardice spent.',
  '82. Rh2-h1 returns to empty h1; castling rights do not return.',
  '83. White ends Rh1 and Black receives the turn.',
  '84. Qb8-a8 is an empty horizontal step.',
  '85. Black ends Qa8 with both Kings safe.',
  '86. b2-b4 crosses empty b3; records b3 en passant and resets clock.',
  '87. White ends b4 preserving the immediate en-passant opportunity.',
  '88. Rc5xa5 crosses empty b5 and captures White a-Pawn; old en passant expires.',
  '89. Black ends Rxa5; no marker or capture restriction applies.',
  '90. Ng1-h3 is an empty L jump.',
  '91. White finishes Nh3 without a card.',
  '92. Resurrection returns captured Black b8 Knight to empty alternate start g8; retains identity, consumes move and increments clocks.',
  '93. Black finishes Resurrection and White receives its move.',
  '94. Bc1-a3 crosses empty b2 diagonally; White b4 Pawn blocks the longer diagonal.',
  '95. White ends Ba3 with both Kings safe.',
  '96. Guardian a7-a6 advances the Pawn one empty step; optional Qa8 follower is declined, Pawn clock resets.',
  '97. Black finishes Guardian and no extra Regular Move follows.',
  '98. d2-d4 crosses empty d3; records d3 en passant.',
  '99. Vendetta is played after d4, retains its card and requires captures while one exists; en passant and clocks stay unchanged.',
  '100. Black begins under Vendetta with captures available.',
  '101. Bd7xh3 crosses e6/f5/g4 and captures White Knight, satisfying Vendetta.',
  '102. White begins under Vendetta with d4xe5 available.',
  '103. d4xe5 captures Black e-Pawn diagonally and satisfies Vendetta.',
  '104. No Quarter follows the unassisted capture; only that captured e-Pawn becomes irreversibly dead.',
  '105. White ends No Quarter; Black still has a legal capture under Vendetta.',
  '106. Qa8xe4 crosses empty b7/c6/d5, captures White e-Pawn and checks Ke1 down the e-file.',
  '107. White has no legal capturing answer to Qe4 check, so Vendetta expires and its card is discarded.',
  '108. Bf1-g2 is a clear diagonal step but leaves Qe4 check; it is staged solely in pending card-rescue state.',
  '109. Curse on Ra5 cannot suppress Qe4 check; it fizzles, spends its card and rewinds Bf1-g2/clocks.',
  '110. Ke1-d1 escapes the e-file; d1 is not attacked by Qe4, Ra5, bishops or Knights.',
  '111. White ends Kd1 after its legal replacement move.',
  '112. Ke8-f8 reaches an unattacked adjacent square.',
  '113. Black ends Kf8 and White receives its move.',
  '114. b4-b5 is an empty Pawn step, with White King safe on d1.',
  '115. White ends b5; the fiftieth Regular Move command is complete and no pending choices remain.',
];

test('iteration 067 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/067.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860067);
  assert.equal(rationale.length, trace.steps.length);
  assert.equal(trace.steps.length, 115);
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 12);
  const snapshots = [createGameState(trace.initial)];
  for (const [i, { action }] of trace.steps.entries()) {
    const n = i + 1;
    assert.ok(rationale[i]!.startsWith(`${n}. `));
    const before = snapshots.at(-1)!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationale[i]);
    const after = result.state;
    snapshots.push(after);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      const mover = before.pieces.find(p => p.square === from)!;
      const victim = before.pieces.find(p => p.square === to);
      assert.ok(mover && mover.owner === before.turn.color);
      assert.deepEqual(after.pieces, before.pieces.map(p => p.id === mover.id ? { ...p, square: to }
        : p.id === victim?.id ? { ...p, square: null, zone: 'captured' } : p), rationale[i]);
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const legal = position.isLegal({ from: parseSquare(from)!, to: parseSquare(to)! });
      assert.equal(legal, ![78, 108].includes(n), rationale[i]);
      assert.equal(!!after.pendingRescue, [78, 108].includes(n));
      const fields = before.fen.split(' '), nextFields = after.fen.split(' ');
      assert.equal(Number(nextFields[4]), mover.role === 'pawn' || victim ? 0 : Number(fields[4]) + 1);
      assert.equal(Number(nextFields[5]), Number(fields[5]) + (before.turn.color === 'black' ? 1 : 0));
      assert.deepEqual(after.enPassant, [1, 86, 98].includes(n)
        ? [{ target: `${from[0]}3`, pawnId: mover.id }] : []);
      assert.deepEqual(after.players, n === 70 ? {
        ...before.players, black: { ...before.players.black, discard: [...before.players.black.discard,
          { id: 'black-deck-0-fatal-attraction', cardId: 'fatal-attraction' }] },
      } : before.players, 'moves preserve card zones except the moving magnet discards its effect');
      if (n > 46 && n < 70) {
        assert.notEqual(from, 'b7', 'Fatal Attraction freezes Queen');
        assert.notEqual(from, 'a7', 'Fatal Attraction freezes Pawn');
      }
    } else if (action.type === 'endTurn') {
      assert.deepEqual(after.pieces, before.pieces);
      assert.equal(after.fen, before.fen);
      assert.equal(after.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.equal(after.turn.phase, 'beforeMove');
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 });
      assert.deepEqual(after.enPassant, before.enPassant);
    } else if (action.type === 'playCard') {
      const owner = before.turn.color;
      const played = before.players[owner].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(played && played.cardId === action.cardId);
      assert.ok(CARD_CATALOG[action.cardId].timing.includes(before.turn.phase));
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.equal(after.turn.cardPlays[owner], 1);
      assert.deepEqual(after.players[owner].hand, [
        ...before.players[owner].hand.filter(c => c.id !== played.id), before.players[owner].deck[0]!,
      ]);
      assert.deepEqual(after.players[owner].deck, before.players[owner].deck.slice(1));
      const retained = n === 46 || n === 99;
      assert.deepEqual(after.players[owner].discard, retained ? before.players[owner].discard : [...before.players[owner].discard, played]);
    }
  }
  const at = (n: number) => snapshots[n]!;
  const square = (n: number, id: string) => at(n).pieces.find(p => p.id === id)?.square;
  assert.equal(square(3, 'black-rook-h8'), 'h3');
  assert.equal(square(3, 'black-pawn-h7'), 'h7');
  assert.equal(square(6, 'white-rook-a1'), 'c3');
  assert.equal(square(6, 'white-knight-b1'), 'a1');
  assert.deepEqual(at(23).effects, [{ type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-knight-b8' }]);
  assert.deepEqual(at(25).effects, []);
  assert.deepEqual(at(36).effects, [{ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 }]);
  assert.deepEqual(at(38).pieces, at(37).pieces);
  assert.equal(at(38).fen, 'r1b1kb2/pppqppp1/5n1p/7r/1QP5/5PP1/PP1PP3/N1B1KBNR w Kq - 1 10');
  assert.deepEqual(at(38).effects, []);
  assert.deepEqual(at(46).effects, [{ type: 'fatal-attraction', owner: 'black', card: { id: 'black-deck-0-fatal-attraction', cardId: 'fatal-attraction' }, pieceId: 'black-rook-a8' }]);
  assert.deepEqual(at(54).pieces, at(53).pieces);
  assert.equal(at(54).fen, 'r1b1kb2/pQpq1pp1/5n1p/2r1p3/2P5/P4PP1/1P1PP2R/N1B1KBN1 w q - 2 14');
  assert.deepEqual(at(70).effects, []);
  assert.ok(at(70).players.black.discard.some(c => c.cardId === 'fatal-attraction'));
  for (const [rewound, prior] of [[79, 77], [109, 107]]) {
    assert.deepEqual(at(rewound!).pieces, at(prior!).pieces);
    assert.equal(at(rewound!).fen, at(prior!).fen);
    assert.equal(at(rewound!).pendingRescue, null);
    assert.equal(at(rewound!).turn.moveMade, false);
    assert.deepEqual(at(rewound!).effects, []);
  }
  assert.equal(square(92, 'black-knight-b8'), 'g8');
  assert.equal(square(96, 'black-pawn-a7'), 'a6');
  assert.equal(square(96, 'black-queen-d8'), 'a8');
  assert.deepEqual(at(99).effects, [{ type: 'vendetta', owner: 'white', card: { id: 'white-hand-0-vendetta', cardId: 'vendetta' } }]);
  assert.equal(at(104).pieces.find(p => p.id === 'black-pawn-e7')?.zone, 'dead');
  const checked = Chess.fromSetup(parseFen(at(107).fen).unwrap()).unwrap();
  assert.ok(checked.isCheck());
  for (const [from, dests] of checked.allDests()) for (const to of dests) {
    assert.notEqual(checked.board.get(to)?.color, 'black', `White has no legal capture from ${from}`);
  }
  assert.deepEqual(at(107).effects, []);
  assert.ok(at(107).players.white.discard.some(c => c.cardId === 'vendetta'));
  assert.equal(at(115).fen, '5kn1/2p2p2/p2b1npp/rP2P3/2P1qP2/B5Pb/8/N2K1B1R b - - 0 27');
  assert.deepEqual(replayTrace(trace), at(115));
});
