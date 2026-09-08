import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { attacks } from 'chessops/attacks';
import { Board } from 'chessops/board';
import { makeBoardFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const rationale = [
  '1. g1-h3: Knight jumps to empty h3.',
  '2. White closes; Black receives a fresh move and both allowances reset.',
  '3. g7-g6: Black pawn advances one empty square.',
  '4. Black closes; White receives a fresh move.',
  '5. d2-d3: White pawn advances into empty d3.',
  '6. Disintegration after move makes own g2 pawn dead, never captured; discard and draw Treason.',
  '7. White closes; dead g-pawn remains irrecoverable.',
  '8. f7-f5: empty f6/f5; reset pawn clock, expose f6 en passant.',
  '9. Black closes retaining f6 opportunity.',
  '10. a2-a3: empty forward square; expire f6 opportunity.',
  '11. White closes without physical change.',
  '12. b8-c6: Knight jumps into empty c6.',
  '13. Black closes without physical change.',
  '14. Plots Within Plots before move: only Lost Castle currently qualifies; discard, draw Curse, allow two eligible cards.',
  '15. c1-g5: Bishop traverses empty d2/e3/f4; ordinary move closes unused Plots window.',
  '16. White closes without physical change.',
  '17. Blessing g8-d5: Knight uses diagonal through empty f7/e6; no capture, consume move, draw No Quarter.',
  '18. Black closes replacement move.',
  '19. Lost Castle swaps h1/h8 Rooks without capture; remove K/k rights, consume move, draw Fatal Attraction.',
  '20. White closes; identities and ownership survive swap.',
  '21. a7-a6: pawn advances into empty a6.',
  '22. Black closes without physical change.',
  '23. a1-a2: Rook steps into vacated a2; remove Q castling right.',
  '24. White closes without physical change.',
  '25. b7-b5: empty b6/b5; expose b6 en passant.',
  '26. Black closes retaining b6 opportunity.',
  '27. b2-b3: empty forward square; expire b6 opportunity.',
  '28. White closes without physical change.',
  '29. d5-f4: Knight jumps to empty f4.',
  '30. Black closes without physical change.',
  '31. d3-d4: pawn advances into empty d4.',
  '32. White closes without physical change.',
  '33. e7-e6: pawn advances into empty e6.',
  '34. Black closes without physical change.',
  '35. d4-d5: pawn advances into empty d5.',
  '36. White closes without physical change.',
  '37. d8-f6: Queen traverses empty e7 to empty f6.',
  '38. Mystic Shield selects just-moved Queen f6; protect during next White turn, discard and draw Man-Trap.',
  '39. Black closes; protection becomes relevant on White turn.',
  '40. d5-d6: pawn advances into empty d6; shield remains.',
  '41. Treason swaps opposing h1 Rook/c6 Knight; no captures or clock advance; draw Bog.',
  '42. White closes; Black Queen shield expires after protected turn.',
  '43. f8xd6: Bishop crosses e7, captures d-pawn for Black; vacating f8 exposes h8 Rook to e8 King, provisional rescue only.',
  '44. Man-Trap h1 cannot cure h8-e8 check: discard/draw Lost Castle, no trap, rewind Bishop/pawn and clocks; clear returned pawn captor.',
  '45. f6-b2: Queen crosses empty e5/d4/c3; replacement ordinary move is safe with f8 Bishop restored.',
  '46. Black closes with its card already spent.',
  '47. d1-d4: Queen traverses empty d2/d3 to empty d4.',
  '48. White closes without physical change.',
  '49. e8-f7: King enters unattacked f7; remove last q castling right.',
  '50. Dungeon places opposing c2 pawn in empty corner a1; no promotion, forbid its next move, draw Knightmare.',
  '51. Black closes; c-pawn remains immobilized for White turn.',
  '52. e1-d1: King steps to empty unattacked d1; Dungeon pawn stays a1.',
  '53. White closes; Dungeon expires.',
  '54. f4-h5: Knight jumps into empty h5.',
  '55. Black closes without physical change.',
  '56. f2-f4: empty f3/f4; expose f3 en passant.',
  '57. White closes retaining f3 opportunity.',
  '58. Long Jump h5-e1 changes square color, lands empty; consumes move, clears en passant, draws Forced March.',
  '59. Black closes replacement move.',
  '60. h8xf8: White Rook crosses empty g8 and captures Black Bishop for White; checks King f7.',
  '61. Curse after capture marks opposing Queen b2, retains card, draws Onslaught; existing check remains answerable by Kxf8.',
  '62. White closes; Black receives check response.',
  '63. f7xf8: Black King captures checking White Rook on unattacked f8; captor Black.',
  '64. Black closes safely.',
  '65. b1-c3: Knight jumps to empty c3.',
  '66. White closes without physical change.',
  '67. f8-f7: King steps to unattacked f7.',
  '68. Black closes without physical change.',
  '69. d4-c4: Queen steps to empty c4.',
  '70. White closes without physical change.',
  '71. Lost Castle swaps Black c6 Rook and White a2 Rook; no capture, consumes move, draws Legacy.',
  '72. Black closes replacement move.',
  '73. c3-e4: Knight jumps to empty e4.',
  '74. Fatal Attraction marks owned Knight e4; freezes adjacent non-Kings including f4/f5 pawns; retain card and draw Man-Trap.',
  '75. White closes; magnet remains stationary.',
  '76. f7-e8: King steps to unattacked e8.',
  '77. Black closes without physical change.',
  '78. c4-b4: Queen starts outside magnet adjacency and steps to empty b4.',
  '79. White closes without physical change.',
  '80. a2xa3: Black Rook captures White a-pawn for Black; neither is adjacent to e4.',
  '81. Black closes without physical change.',
  '82. b4-d2: Queen traverses empty c3 and lands empty d2 outside magnet.',
  '83. White closes without physical change.',
  '84. e8-f8: King steps to unattacked f8.',
  '85. Black closes without physical change.',
  '86. c6-c1: Rook crosses empty c5/c4/c3/c2; passing near magnet is permitted.',
  '87. White closes without physical change.',
  '88. b2-a2: cursed Queen moves one square, within two-square limit.',
  '89. Black closes without physical change.',
  '90. h3-g1: Knight jumps to empty g1, outside magnet.',
  '91. White closes without physical change.',
  '92. Forced March b5-a5 and g6-h6: two sideways empty destinations, neither pawn frozen; consume move, reset pawn clock, draw Doomsayer.',
  '93. Black closes replacement move.',
  '94. c1xc7: Rook crosses empty c2-c6 and captures c7 pawn for White; transit past magnet is legal.',
  '95. Man-Trap marks d2 occupied by own Queen; retain physical card and draw Confabulation.',
  '96. White closes; d2 trap persists.',
  '97. f8-g7: King steps to unattacked g7; c7 Rook ray is blocked by d7 pawn.',
  '98. Black closes without physical change.',
  '99. f1-h3: Bishop crosses dead pawn vacant g2 to empty h3.',
  '100. White closes without physical change.',
  '101. e1-f3: Knight jumps from outside magnet to empty adjacent f3 and becomes frozen.',
  '102. Black closes; frozen Knight gives no forbidden-capture check.',
  '103. c7-c1: Rook crosses empty c6-c2, passing magnet adjacency without stopping.',
  '104. White closes without physical change.',
  '105. Masquerade g7-f7: non-Pawn King moves as Queen into safe empty f7; consume move and draw Hostage.',
  '106. Black closes replacement move.',
  '107. d2-d5: Queen crosses empty d3/d4 and ends next to magnet, hence freezes; square-bound d2 trap stays.',
  '108. White closes; frozen Queen cannot give check.',
  '109. e6-e5: pawn starts outside magnet and advances into empty adjacent e5, becoming frozen.',
  '110. Black closes without physical change.',
  '111. h3-g4: Bishop moves diagonally into empty g4, two files from magnet and movable.',
  '112. White closes without physical change.',
  '113. f7-g6: King steps to unattacked g6; frozen d5 Queen cannot attack even within its geometry.',
  '114. Black closes without physical change.',
  '115. b3-b4: pawn advances into empty b4; remains outside magnet.',
  '116. White closes without physical change.',
  '117. a3-c3: Rook crosses empty b3 to empty c3, two files from magnet and movable.',
  '118. Black closes without physical change.',
  '119. g5-f6: Bishop starts two files from magnet and moves diagonally into empty f6.',
  '120. White closes with all three continuing markers intact.',
];

const relocations: Record<number, Record<string, SquareName>> = {
  17: { 'black-knight-g8': 'd5' },
  19: { 'white-rook-h1': 'h8', 'black-rook-h8': 'h1' },
  41: { 'black-rook-h8': 'c6', 'black-knight-b8': 'h1' },
  50: { 'white-pawn-c2': 'a1' },
  58: { 'black-knight-g8': 'e1' },
  71: { 'black-rook-h8': 'a2', 'white-rook-a1': 'c6' },
  92: { 'black-pawn-b7': 'a5', 'black-pawn-g7': 'h6' },
  105: { 'black-king-e8': 'f7' },
};
const at = (s: GameState, square: string) => s.pieces.find(p => p.zone === 'board' && p.square === square);
const distance = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));
const boardOf = (pieces: PieceState[]) => {
  const board = Board.empty();
  for (const p of pieces) if (p.square && p.zone === 'board') board.set(parseSquare(p.square)!, { role: p.role, color: p.owner });
  return board;
};

test('iteration 096: 120 independently reasoned actions and complete physical transitions', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/096.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationale.length, 120);
  assert.equal(trace.steps.length, rationale.length);
  let state = createGameState(trace.initial);
  let rescueBefore: GameState | undefined;
  let effects: unknown[] = [];
  let moveCount = 0, cardCount = 0;
  for (const [i, { action }] of trace.steps.entries()) {
    const n = i + 1, why = rationale[i]!;
    assert.ok(why.startsWith(`${n}. `));
    const before = state, color = before.turn.color;
    const opposite = color === 'white' ? 'black' : 'white';
    let expectedPieces = structuredClone(before.pieces);
    let expectedEp = structuredClone(before.enPassant);
    let expectedTurn = structuredClone(before.turn);
    let expectedPlayers = structuredClone(before.players);
    let clock = before.fen.split(' ').slice(1);
    const replacement = [17, 19, 58, 71, 92, 105].includes(n);
    if (action.type === 'move') {
      moveCount++;
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/);
      const moving = at(before, action.from)!;
      const victim = at(before, action.to);
      assert.equal(moving.owner, color, why);
      assert.equal(before.turn.phase, 'beforeMove', why);
      if (n >= 75 && !moving.royal && moving.id !== 'white-knight-b1') assert.ok(distance(action.from, 'e4') > 1, why);
      if (n >= 61 && moving.id === 'black-queen-d8') assert.ok(distance(action.from, action.to) <= 2, why);
      const from = parseSquare(action.from)!, to = parseSquare(action.to)!;
      if (moving.role === 'pawn') {
        assert.equal(action.from[0], action.to[0], why);
        assert.equal(victim, undefined, why);
        const direction = color === 'white' ? 1 : -1;
        const ranks = (Number(action.to[1]) - Number(action.from[1])) * direction;
        assert.ok(ranks === 1 || ranks === 2, why);
        if (ranks === 2) {
          assert.equal(Number(action.from[1]), color === 'white' ? 2 : 7, why);
          assert.equal(at(before, `${action.from[0]}${Number(action.from[1]) + direction}`), undefined, why);
        }
      } else assert.ok(attacks({ color, role: moving.role }, from, boardOf(before.pieces).occupied).has(to), why);
      if (victim) { assert.equal(victim.owner, opposite, why); assert.equal(victim.royal, false, why); }
      expectedPieces = expectedPieces.map(p => p.id === moving.id ? { ...p, square: action.to as SquareName }
        : p.id === victim?.id ? { ...p, square: null, zone: 'captured', capturedBy: color } : p);
      expectedEp = moving.role === 'pawn' && Math.abs(to - from) === 16
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: moving.id }] : [];
      expectedTurn = { ...expectedTurn, phase: 'afterMove', moveMade: true };
      clock[0] = opposite[0]!;
      clock[3] = String(moving.role === 'pawn' || victim ? 0 : Number(clock[3]) + 1);
      clock[4] = String(Number(clock[4]) + (color === 'black' ? 1 : 0));
      if (n === 23) clock[1] = 'q';
      if (n === 49) clock[1] = '-';
      if (n === 43) rescueBefore = before;
    }
    if (action.type === 'playCard') {
      cardCount++;
      const player = expectedPlayers[color];
      const card = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.equal(card.cardId, action.cardId, why);
      assert.equal(before.turn.cardPlays[color], 0, why);
      player.hand = [...player.hand.filter(c => c.id !== card.id), player.deck[0]!];
      player.deck = player.deck.slice(1);
      if (![61, 74, 95].includes(n)) player.discard.push(card);
      expectedTurn.cardPlays[color] = 1;
      if (n === 6) expectedPieces = expectedPieces.map(p => p.id === 'white-pawn-g2' ? { ...p, square: null, zone: 'dead' } : p);
      if (relocations[n]) expectedPieces = expectedPieces.map(p => ({ ...p, ...(relocations[n]![p.id] ? { square: relocations[n]![p.id]! } : {}) }));
      if (replacement) {
        assert.equal(before.turn.phase, 'beforeMove', why);
        expectedTurn = { ...expectedTurn, phase: 'afterMove', moveMade: true };
        expectedEp = [];
        clock[0] = opposite[0]!;
        clock[3] = String(n === 92 ? 0 : Number(clock[3]) + 1);
        clock[4] = String(Number(clock[4]) + (color === 'black' ? 1 : 0));
      } else assert.equal(before.turn.phase, n === 14 ? 'beforeMove' : 'afterMove', why);
      if (n === 19) clock[1] = 'Qq';
      if (n === 44) {
        expectedPieces = structuredClone(rescueBefore!.pieces);
        expectedEp = structuredClone(rescueBefore!.enPassant);
        clock = rescueBefore!.fen.split(' ').slice(1);
        expectedTurn = { ...expectedTurn, phase: 'beforeMove', moveMade: false };
      }
      if (n === 38) effects.push({ type: 'mystic-shield', owner: 'black', player: 'black', pieceId: 'black-queen-d8' });
      if (n === 50) effects.push({ type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-pawn-c2' });
      if (n === 61) effects.push({ type: 'curse', owner: 'white', card, pieceId: 'black-queen-d8' });
      if (n === 74) effects.push({ type: 'fatal-attraction', owner: 'white', card, pieceId: 'white-knight-b1' });
      if (n === 95) effects.push({ type: 'man-trap', owner: 'white', card, square: 'd2' });
    }
    if (action.type === 'endTurn') {
      expectedTurn = { color: opposite, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      if (n === 42 || n === 53) effects = [];
    }
    const inputSnapshot = structuredClone(before);
    const result = applyAction(before, action);
    assert.deepEqual(before, inputSnapshot, `${why} Complete input remains immutable, including capturedBy`);
    assert.ok(result.ok, why);
    state = result.state;
    assert.deepEqual(state.pieces, expectedPieces, `${why} All affected and unaffected identities`);
    assert.deepEqual(state.players, expectedPlayers, why);
    assert.deepEqual(state.turn, expectedTurn, why);
    assert.deepEqual(state.enPassant, expectedEp, why);
    assert.deepEqual(state.effects, effects, why);
    assert.equal(state.orientation, 0, why);
    // No reviewed double pawn move has an adjacent en-passant captor, so canonical FEN uses '-'.
    clock[2] = '-';
    assert.equal(state.fen, `${makeBoardFen(boardOf(expectedPieces))} ${clock.join(' ')}`, why);
    assert.equal(!!state.pendingRescue, n === 43, why);
    if (n === 43) {
      assert.deepEqual(state.pendingRescue!.pieces, before.pieces, why);
      assert.equal(state.pendingRescue!.fen, before.fen, why);
    }
    if (n === 14) assert.deepEqual(state.plotsAllowances, [{ player: 'white', remaining: 2,
      eligibleCards: ['white-hand-0-lost-castle'], window: { phase: 'beforeMove', moveMade: false,
        capture: undefined, cardResponse: undefined, fogCheckpoint: undefined,
        legacyCapture: undefined, shieldMove: undefined,
        reaction: { type: 'move', from: 'b8', to: 'c6' } } }], why);
    else assert.equal(state.plotsAllowances, undefined, why);
    const king = state.pieces.find(p => p.owner === color && p.royal)!;
    const board = boardOf(state.pieces);
    const threats = state.pieces.filter(p => {
      if (p.zone !== 'board' || p.owner === color) return false;
      if (n >= 74 && !p.royal && p.id !== 'white-knight-b1' && distance(p.square!, 'e4') <= 1) return false;
      if (n >= 61 && p.id === 'black-queen-d8' && distance(p.square!, king.square!) > 2) return false;
      return attacks({ role: p.role, color: p.owner }, parseSquare(p.square!)!, board.occupied).has(parseSquare(king.square!)!);
    });
    assert.equal(threats.length > 0, n === 43, why);
    for (const p of state.pieces) if (p.zone !== 'captured') assert.equal(p.capturedBy, undefined, why);
  }
  assert.equal(moveCount, 50);
  assert.equal(cardCount, 15);
  assert.equal(state.fen, 'r1b5/3p3p/p2P1Bkp/p2Qpp2/1P2NPB1/2r2n2/q3P2P/P1RK2Nn b - - 2 28');
  assert.equal(replayTrace(trace).fen, state.fen);
});
