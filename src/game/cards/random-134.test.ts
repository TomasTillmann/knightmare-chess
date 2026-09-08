import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, PieceState, SquareName } from '../types.js';

// Reviewed against rules §§8–13, 16.2, 17.1, 18.2 and the nine printed cards:
// KC19_card1, KC10_card2, KC2_card2, KC3_card2/4, KC9_card2,
// KC1_card2/4 and KC8_card3. Every row also checks both royal threats below.
const rationale = [
  '1. c2-c4: initial Pawn double step through empty c3; no capture.',
  '2. End White turn; preserve c3 opportunity and clocks, reset allowances.',
  '3. b8-c6: Black Knight jumps one file and two ranks to empty c6.',
  '4. White Chaos immediately cancels that Knight move; restore b8, c3 opportunity and clocks; forbid its repeat; draw Madman.',
  '5. f7-f6: different Black replacement, one forward step; expires Chaos prohibition.',
  '6. End replacement turn; White regains its independent card allowance.',
  '7. g2-g3: White Pawn advances one to empty g3.',
  '8. End White turn, preserving board and clocks.',
  '9. c7-c5: Black Pawn double step through c6; no adjacent White Pawn on rank five.',
  '10. Challenge after Black move names movable enemy Knight g1; h3 is an available jump; draw Toll.',
  '11. End Black turn; retain Challenge obligation for White.',
  '12. g1-h3: mandated Knight moves by a legal jump; Challenge expires.',
  '13. End White turn; no obligation remains.',
  '14. d8-c7: Queen moves one diagonal to vacated c7.',
  '15. End Black turn with unchanged Queen position.',
  '16. a2-a3: White Pawn advances one into empty a3.',
  '17. End White turn; no draw without card play or optional discard.',
  '18. a7-a6: Black Pawn advances one into empty a6.',
  '19. End Black turn preserving both hands.',
  '20. h3-f4: Knight jumps two files and one rank into empty f4.',
  '21. End White turn preserving the Knight identity.',
  '22. Forced March replaces Black move: e7 Pawn steps sideways to empty f7; no capture or EP; draw Masquerade.',
  '23. End Black replacement turn; fullmove has advanced once.',
  '24. f4-e6: White Knight jumps into empty e6, threatening pieces but not the King e8.',
  '25. End White turn with Black King safe.',
  '26. c7-f4: Queen diagonal through empty d6 and e5 to empty f4.',
  '27. End Black turn, preserving Queen f4.',
  '28. a3-a4: White Pawn one forward step to empty a4.',
  '29. End White turn without further movement.',
  '30. f4-d6: Queen diagonal through empty e5 to empty d6.',
  '31. End Black turn; no captures or card changes.',
  '32. f1-h3: Bishop diagonal through vacated g2 to empty h3.',
  '33. End White turn, retaining castling rights until the Rook moves.',
  '34. b8-c6: Knight jump is legal again; Chaos prohibition ended at step 5.',
  '35. End Black turn without a card.',
  '36. Madman replaces White move: f2-h4 jumps diagonally over own Pawn g3; g3 survives; draw Winged Victory.',
  '37. End White replacement turn; f2 Pawn retains identity on h4.',
  '38. f6-f5: original f7 Pawn advances one square.',
  '39. End Black turn; original e7 Pawn remains f7.',
  '40. d2-d4: initial double step through empty d3; no capture.',
  '41. End White turn; d3 opportunity remains but no Black Pawn can use it.',
  '42. b7-b5: double step through empty b6; no White Pawn on rank five can capture EP.',
  '43. End Black turn retaining b6 opportunity.',
  '44. h1-f1: Rook travels through empty g1 to empty f1; revoke White kingside castling.',
  '45. End White turn; only White queenside rights remain.',
  '46. c6-d8: Knight jumps into the Queens former square.',
  '47. End Black turn preserving all cards.',
  '48. c1-f4: Bishop diagonal through empty d2 and e3 to empty f4.',
  '49. End White turn with Bishops on f4 and h3.',
  '50. d6-e7: Queen moves one diagonal to empty e7.',
  '51. End Black turn without drawing.',
  '52. b2-b3: White Pawn one forward step.',
  '53. End White turn; no additional obligations.',
  '54. g8-f6: Black Knight jumps to square vacated by original f7 Pawn.',
  '55. End Black turn; exactly a1, a8 and h8 corners are occupied.',
  '56. Squaring the Circle relocates White a4 Pawn to sole empty corner h1, no promotion or capture; draw Disintegration.',
  '57. End White replacement turn; Pawn h1 keeps original a2 identity.',
  '58. d7xe6: Black Pawn captures White g1 Knight diagonally forward; capturedBy black.',
  '59. End Black capture turn; captured Knight stays off board.',
  '60. a1-a2: Rook advances to empty a2; remove remaining White queenside castling.',
  '61. End White turn with no White castling rights.',
  '62. b5-b4: Black Pawn one forward step to empty b4.',
  '63. End Black turn; b4 Pawn cannot capture straight ahead.',
  '64. h3-g2: Bishop diagonal one square into empty g2.',
  '65. End White turn preserving both Rooks.',
  '66. a6-a5: Black Pawn one forward step to empty a5.',
  '67. Truce after Black move forbids all captures; physical card remains active, replacement Split Knight drawn.',
  '68. End Black turn retaining Truce and its physical card.',
  '69. f1-f2: Rook quiet one-square move allowed under Truce.',
  '70. End White turn; Truce still suppresses capture threats.',
  '71. f6-e4: Black Knight quiet jump allowed under Truce.',
  '72. End Black turn; Knight e4 does not attack either King.',
  '73. h2-h3: White Pawn advances into empty h3 under Truce.',
  '74. End White turn retaining Truce.',
  '75. g7-g5: Black Pawn double step through empty g6; Truce prevents any capture.',
  '76. End Black turn; g6 physical EP opportunity is not a legal capture.',
  '77. a2-d2: Rook travels through empty b2 and c2 to empty d2; EP expires.',
  '78. End White turn retaining Truce.',
  '79. c8-b7: Bishop moves one diagonal to empty b7.',
  '80. End Black turn; Truce remains in play.',
  '81. e2-e3: White Pawn quiet forward step; no capture.',
  '82. End White turn; e-file Pawn now on e3.',
  '83. e7-d7: Queen quiet horizontal step into empty d7.',
  '84. End Black turn with no capture or check.',
  '85. d1-c1: Queen quiet horizontal step into vacated c1.',
  '86. End White turn; no castling rights restored.',
  '87. h7-h6: Black Pawn one forward step into empty h6.',
  '88. End Black turn; Truce still active.',
  '89. Disintegration kills own Pawn e3 before the move; death bypasses Truce, no capturedBy; draw Fanatic, preserve clocks.',
  '90. e1-e2: King steps into empty safe e2; move remains available after Disintegration.',
  '91. End White turn; dead e2 Pawn cannot return.',
  '92. d7-c8: Queen one diagonal step to empty c8.',
  '93. End Black turn retaining Truce.',
  '94. f2-f3: Rook moves one square to empty f3.',
  '95. End White turn; Rook keeps original h1 identity.',
  '96. b7-c6: Bishop one diagonal step to empty c6.',
  '97. End Black turn with Truce active.',
  '98. Fanatic d4-d7 traverses empty d5,d6,d7; no EP/promotion; Pawn checks e8 ending Truce, e7 is a safe escape so no direct mate; draw Figure Dance.',
  '99. End White turn; Black remains in check from Pawn d7 with legal responses.',
  '100. Masquerade replaces Black move: King e8-e7 uses quiet Queen geometry to escape Pawn check; revoke kq; draw Man-Trap.',
  '101. End Black replacement turn with both Kings safe.',
  '102. e2-d1: White King diagonal step to empty safe d1.',
  '103. End White turn; no castling rights restored.',
  '104. f7-f6: original e7 Pawn, moved by Forced March, advances one square.',
  '105. End Black turn; distinct original f7 Pawn remains f5.',
  '106. g3-g4: White Pawn one forward step into empty g4.',
  '107. End White turn; Truce already expired so captures are available.',
  '108. c6xd7: Black Bishop captures original White d2 Pawn diagonally; capturedBy black.',
  '109. End Black capture turn; White Pawn remains captured, not dead.',
  '110. g2-f1: White Bishop quiet one-square diagonal move.',
  '111. End White turn preserving Bishop identity.',
  '112. d7-a4: Black Bishop travels through empty c6 and b5 to empty a4.',
  '113. End Black turn; White beforeMove, both Kings safe; 50 move commands reviewed.',
];

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1])] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(piece.square!); const [u, v] = xy(to);
  const dx = u - x; const dy = v - y; const ax = Math.abs(dx); const ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    if (dx || at(pieces, to)) return false;
    if (dy === forward) return true;
    return dy === 2 * forward && (piece.owner === 'white' ? y <= 2 : y >= 7)
      && !at(pieces, `${String.fromCharCode(97 + x)}${y + forward}`);
  }
  if (!(piece.role !== 'rook' && ax === ay || piece.role !== 'bishop' && (!dx || !dy))) return false;
  for (let d = 1; d < Math.max(ax, ay); d++) {
    if (at(pieces, `${String.fromCharCode(97 + x + Math.sign(dx) * d)}${y + Math.sign(dy) * d}`)) return false;
  }
  return true;
}
function threats(pieces: PieceState[], color: Color, truce: boolean, challenged = false): string[] {
  if (truce) return [];
  const royal = pieces.find(p => p.royal && p.owner === color)!;
  // No neutral, transformed, or composite pieces occur: assert that bound in the oracle.
  return pieces.filter(p => p.zone === 'board' && p.owner !== color
    && (!challenged || p.owner !== 'white' || p.id === 'white-knight-g1')
    && reaches(pieces, p, royal.square!, true)).map(p => p.id);
}
function boardFen(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let row = ''; let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = at(pieces, `${String.fromCharCode(97 + file)}${8 - rank}`);
      if (!piece) { empty++; continue; }
      if (empty) row += empty;
      empty = 0; const symbol = symbols[piece.role]; row += piece.owner === 'white' ? symbol.toUpperCase() : symbol;
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 134 independent physical, geometry, royal, card and clock oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/134.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationale.length, 113);
  assert.equal(trace.steps.length, rationale.length);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  let turn = structuredClone(state.turn);
  let ep = structuredClone(state.enPassant);
  let half = 0; let full = 1; let active: Color = 'white'; let rights = 'KQkq';
  let truce = false; let challenge = false; let cards = 0; let moves = 0;
  const relocate = (from: string, to: string, regular = false) => {
    assert.match(to, /^[a-h][1-8]$/);
    const piece = at(pieces, from)!; assert.ok(piece, from);
    const victim = at(pieces, to);
    assert.equal(piece.owner, turn.color);
    if (regular) assert.ok(reaches(pieces, piece, to, !!victim), `${from}-${to}: independent geometry`);
    if (victim) {
      assert.equal(truce, false); assert.equal(victim.owner, opposite(turn.color)); assert.equal(victim.royal, false);
      victim.square = null; victim.zone = 'captured'; victim.capturedBy = turn.color;
    }
    if (piece.id === 'white-rook-h1') rights = rights.replace('K', '');
    if (piece.id === 'white-rook-a1') rights = rights.replace('Q', '');
    if (piece.royal) rights = rights.replace(piece.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
    ep = [];
    if (regular && piece.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2)
      ep = [{ target: `${from[0]}${(Number(to[1]) + Number(from[1])) / 2}` as SquareName, pawnId: piece.id }];
    piece.square = to as SquareName;
    half = piece.role === 'pawn' || victim ? 0 : half + 1;
    if (turn.color === 'black') full++;
    active = opposite(turn.color); turn.phase = 'afterMove'; turn.moveMade = true;
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1; const action = step.action; const label = rationale[index]!;
    assert.ok(label.startsWith(`${n}. `));
    const original = JSON.stringify(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.equal(turn.phase, 'beforeMove', label); assert.equal(turn.moveMade, false);
      if (challenge) assert.equal(at(pieces, action.from)?.id, 'white-knight-g1');
      relocate(action.from, action.to, true); challenge = false; moves++;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label);
      assert.deepEqual(threats(pieces, turn.color, truce, challenge), [], label);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'playCard') {
      cards++;
      const owner: Color = action.cardId === 'chaos' ? 'white' : turn.color;
      const hand = players[owner].hand;
      const cardIndex = hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0, label); const [card] = hand.splice(cardIndex, 1); assert.ok(card);
      assert.equal(card.cardId, action.cardId); assert.equal(turn.cardPlays[owner], 0);
      turn.cardPlays[owner]++;
      const drawn = players[owner].deck.shift(); assert.ok(drawn); hand.push(drawn);
      if (action.cardId !== 'truce') players[owner].discard.push(card);
      switch (action.cardId) {
        case 'chaos':
          assert.equal(n, 4); assert.equal(turn.color, 'black'); assert.equal(turn.moveMade, true);
          assert.equal(at(pieces, 'c6')?.id, 'black-knight-b8');
          at(pieces, 'c6')!.square = 'b8'; half = 0; full = 1; active = 'black';
          ep = [{ target: 'c3', pawnId: 'white-pawn-c2' }]; turn.phase = 'beforeMove'; turn.moveMade = false;
          break;
        case 'challenge':
          assert.equal(n, 10); assert.equal(turn.phase, 'afterMove'); assert.equal(action.target, 'g1');
          assert.ok(reaches(pieces, at(pieces, 'g1')!, 'h3', false)); challenge = true; break;
        case 'forced-march':
          assert.equal(n, 22); assert.equal(turn.phase, 'beforeMove');
          assert.deepEqual(action.target, [{ from: 'e7', to: 'f7' }]); assert.equal(at(pieces, 'e7')?.role, 'pawn');
          assert.equal(at(pieces, 'f7'), undefined); relocate('e7', 'f7'); break;
        case 'madman':
          assert.equal(n, 36); assert.equal(turn.phase, 'beforeMove');
          assert.deepEqual(action.target, [{ from: 'f2', to: 'h4' }]); assert.equal(at(pieces, 'g3')?.id, 'white-pawn-g2');
          assert.equal(at(pieces, 'h4'), undefined); relocate('f2', 'h4'); break;
        case 'squaring-the-circle':
          assert.equal(n, 56); assert.equal(turn.phase, 'beforeMove');
          assert.deepEqual(action.target, [{ from: 'a4', to: 'h1' }]);
          assert.deepEqual(['a1', 'a8', 'h1', 'h8'].filter(s => at(pieces, s)), ['a1', 'a8', 'h8']);
          relocate('a4', 'h1'); break;
        case 'truce':
          assert.equal(n, 67); assert.equal(turn.phase, 'afterMove'); truce = true; break;
        case 'disintegration': {
          assert.equal(n, 89); assert.equal(turn.phase, 'beforeMove'); assert.equal(action.target, 'e3');
          const pawn = at(pieces, 'e3')!; assert.equal(pawn.id, 'white-pawn-e2');
          pawn.square = null; pawn.zone = 'dead'; delete pawn.capturedBy; break;
        }
        case 'fanatic': {
          assert.equal(n, 98); assert.equal(turn.phase, 'beforeMove'); assert.equal(action.target, 'd4');
          for (const s of ['d5', 'd6', 'd7']) assert.equal(at(pieces, s), undefined);
          relocate('d4', 'd7'); truce = false;
          players.black.discard.push({ id: 'black-hand-1-truce', cardId: 'truce' });
          // Construct the available ordinary King escape independently: no direct card mate.
          const escape = structuredClone(pieces); at(escape, 'e8')!.square = 'e7';
          assert.equal(at(pieces, 'e7'), undefined); assert.deepEqual(threats(escape, 'black', false), []); break;
        }
        case 'masquerade':
          assert.equal(n, 100); assert.equal(turn.phase, 'beforeMove');
          assert.deepEqual(action.target, [{ from: 'e8', to: 'e7' }]); assert.equal(at(pieces, 'e8')?.role, 'king');
          assert.equal(at(pieces, 'e7'), undefined); relocate('e8', 'e7'); break;
        default: assert.fail(`Unreviewed card ${action.cardId}`);
      }
    } else assert.fail(`Unreviewed action ${action.type}`);
    const result = applyAction(state, action);
    assert.equal(JSON.stringify(state), original, `${label}: complete input immutability`);
    assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: full physical identities and capturedBy`);
    assert.deepEqual(state.players, players, `${label}: all ordered physical card zones`);
    assert.deepEqual(state.turn, turn, `${label}: allowance, phase and turn owner`);
    assert.deepEqual(state.enPassant, ep, label);
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!;
      assert.equal(victim.zone, 'board'); assert.equal(victim.role, 'pawn');
      assert.equal(at(pieces, opportunity.target), undefined);
      const candidates = pieces.filter(p => p.zone === 'board' && p.role === 'pawn'
        && p.owner === opposite(victim.owner) && p.owner === active
        && p.square![1] === victim.square![1]
        && reaches(pieces, p, opportunity.target, true));
      const legalCaptors = candidates.filter(p => {
        if (truce || challenge && p.owner === 'white' && p.id !== 'white-knight-g1') return false;
        const captured = structuredClone(pieces);
        const removed = captured.find(q => q.id === victim.id)!;
        removed.square = null; removed.zone = 'captured'; removed.capturedBy = p.owner;
        captured.find(q => q.id === p.id)!.square = opportunity.target;
        return threats(captured, p.owner, false, challenge).length === 0;
      });
      assert.deepEqual(legalCaptors, [], `${label}: physical EP record has no legal capture`);
    }
    assert.equal(state.fen, `${boardFen(pieces)} ${active[0]} ${rights || '-'} - ${half} ${full}`, `${label}: six FEN fields`);
    const effects: unknown[] = challenge ? [{ type: 'challenge', owner: 'black', player: 'white', pieceId: 'white-knight-g1' }]
      : truce ? [{ type: 'truce', owner: 'black', card: { id: 'black-hand-1-truce', cardId: 'truce' } }] : [];
    assert.deepEqual(state.effects, effects, label);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer && !state.underElfHill?.length, label);
    assert.equal(state.plotsExecution, undefined, label);
    // Chaos normalizes the restored, empty extra-allowance list at its rollback.
    assert.deepEqual(state.plotsAllowances, n === 4 ? [] : undefined, label);
    assert.equal(state.fogLocked, undefined, label);
    assert.equal(state.riposteLostMoves, undefined, label);
    assert.equal(state.riposteSkipped, undefined, label);
    assert.equal(state.riposteCheckDeferred, undefined, label);
    assert.ok(pieces.every(p => !p.neutral && !p.promoted && p.role === p.originalRole));
    for (const color of ['white', 'black'] as const) {
      const expected = color === 'black' && (n === 98 || n === 99) ? ['white-pawn-d2'] : [];
      assert.deepEqual(threats(pieces, color, truce, challenge), expected, `${label}: ${color} royal threats`);
      if (truce) assert.deepEqual(threats(pieces, color, false), [], `${label}: no raw check to end Truce`);
    }
    assert.deepEqual(state.chaosForbidden, n === 4 ? { player: 'black', movement: 'black-knight-b8:b8:c6' } : undefined);
    if (n === 4) {
      const before = JSON.stringify(state); const repeated = applyAction(state, { type: 'move', from: 'b8', to: 'c6' });
      assert.equal(repeated.ok, false); assert.equal(JSON.stringify(state), before); assert.deepEqual(repeated.state, state);
    }
  }
  assert.equal(moves, 50); assert.equal(cards, 9);
  assert.equal(state.fen, 'r1qn1b1r/4k3/4pp1p/p1p2pp1/bpP1nBPP/1P3R1P/3R4/1NQK1B1P w - - 2 28');
});

test('iteration 134 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/134.json', import.meta.url), 'utf8')) as RandomTrace;
  replayTrace(trace);
});
