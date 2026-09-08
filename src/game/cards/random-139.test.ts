import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/139.json', import.meta.url), 'utf8')) as RandomTrace;
// Independently reviewed against rules §§8–11,13.1,14.2,15.1,15.5,17.1,
// 18.1,18.3,21,22.1,22.10; cards.md and the twelve catalog-linked card images.
// Every row also receives the physical, royal, card-zone, clock and obligation oracle below.
const rationales = `
1. f2-f4: initial white Pawn double step through vacant f3; no black en-passant captor.
2. White completes its move; Black receives a fresh card allowance; f3 opportunity remains.
3. d7-d6: black Pawn advances one empty square; previous en-passant expires.
4. Black completes its move and advances play to White; no card draw is due.
5. b1-a3: white Knight jumps one file and two ranks to an empty square.
6. Vendetta follows White's move; retain its card and draw Dungeon; no board change.
7. Black has no available capture, ending Vendetta and discarding its retained card.
8. a7-a6: black Pawn advances one empty square after Vendetta expired.
9. Figure Dance simultaneously rotates a1-h1-h8-a8-a1, preserving all four Rook identities; all rights expire.
10. Black ends the turn after Figure Dance; the rotated corners persist.
11. g2-g3: white Pawn advances one empty square; clocks reset.
12. White ends the turn without a card; no optional discard was requested.
13. c8-h3: black Bishop follows empty d7,e6,f5,g4 to empty h3.
14. Black hands play to White; corner Rooks remain in their rotated positions.
15. a3-c4: white Knight jumps two files and one rank.
16. White completes its Knight move and hands play to Black.
17. h3-e6: black Bishop follows empty g4,f5 to empty e6.
18. Black ends the turn; no markers or card zones change.
19. a2-a3: white Pawn advances into the square vacated by its Knight.
20. White ends the turn; Black's before-move window opens.
21. f7-f6: black Pawn advances one empty square.
22. Neutrality targets opposing nonroyal Pawn c2 after Black's move; retain the card and original owner.
23. Black ends its turn; c2 remains neutral and usable by either player.
24. c2-c3: White controls the neutral Pawn; its original white forward direction remains unchanged.
25. White ends the turn; Neutrality persists on the physical Pawn.
26. c7-c5: black Pawn doubles through empty c6; no adjacent white Pawn can capture en passant.
27. Black ends the turn; c6 opportunity persists but remains uncapturable.
28. b2-b3: white Pawn advances one square and expires c6 en-passant.
29. White ends the turn, keeping the neutral Pawn on c3.
30. e6-g4: black Bishop follows empty f5 to empty g4.
31. Black completes the Bishop move; White receives its move.
32. f1-g2: white Bishop moves one diagonal square into the vacated Pawn square.
33. White ends the turn; card zones and Neutrality are unchanged.
34. g4-h3: black Bishop moves one diagonal square to empty h3.
35. Black ends the turn; no card is automatically played from either hand.
36. c4-e3: white Knight makes a two-file, one-rank jump.
37. White ends the turn with no capture or draw.
38. b7-b6: black Pawn advances one empty square.
39. Black ends the turn; the move clock remains zero.
40. e3-c2: white Knight jumps onto the neutral Pawn's vacated origin.
41. White ends the turn and clears both per-turn card allowances.
42. a1-b1: Black's original a8 Rook moves one file into empty b1.
43. Black ends the turn; White's Bishop c1 still stands between b1 and Queen d1.
44. g3-g4: white Pawn advances one square, resetting the halfmove clock.
45. White completes the Pawn move; Black receives the turn.
46. b1-b2: black Rook advances one rank into the vacated white Pawn square.
47. Black completes its Rook move; no capture occurred.
48. g2-d5: white Bishop slides through vacant f3,e4 to vacant d5.
49. Dungeon relocates opposing original h8 Rook a8-a1; empty corner, no capture; Black cannot move that identity next turn.
50. White ends the turn; the Dungeon prohibition remains for Black's following turn.
51. e8-f7: black King enters Bishop d5's clear e6-f7 diagonal; §11.6 requires a rescue before ending this turn.
52. Anathema rescues Black by swapping checking Bishop d5 with Rook h1; neither Rook d5 nor Bishop h1 is aligned to attack King f7.
53. Black ends its turn, so Dungeon expires while Neutrality persists.
54. h1-f3: White's relocated Bishop slides through vacant g2 to f3.
55. Holy War swaps controlled Knight g1 and Bishop c1 without a capture or an extra move.
56. White ends the turn with its swapped pieces and drawn Fireball.
57. b2-b1: Black's original a8 Rook returns one rank to empty b1.
58. Black ends the turn; White receives a fresh allowance.
59. f3-g2: white Bishop steps diagonally to empty g2.
60. White ends the turn with Neutrality unchanged.
61. b6-b5: black Pawn advances to empty b5.
62. Black ends its Pawn turn; no continuing obligation expires.
63. g1-c5: white Bishop travels f2,e3,d4 and captures black c7 Pawn at c5; capturedBy is White.
64. White ends the capture turn; the captured Pawn keeps its physical identity.
65. f7-e6: black King steps diagonally to e6, outside Bishop c5 and Rook d5 attack lines.
66. Black ends the King move; White receives the move.
67. e2-e4: white Pawn doubles through empty e3; no opposing Pawn can take en passant.
68. White ends the turn retaining the uncapturable e3 opportunity.
69. d8-d7: black Queen steps one rank into vacant d7; this actual move can be canceled.
70. Think Again cancels d8-d7: restore Queen d8, clocks and e3 opportunity; prohibit black-queen-d8:d8:d7 and draw Evil Eye for White.
71. h7-h6: Black chooses a genuinely different Pawn move; the canceled Queen movement prohibition ends.
72. Black ends the replacement turn; White's reaction allowance resets for its own turn.
73. c5-a7: white Bishop slides through vacant b6 to vacant a7.
74. White completes its Bishop move; no card zones change.
75. e6-f7: black King returns diagonally to safe empty f7.
76. Black ends the King turn; Neutrality remains active.
77. c2-b4: white Knight jumps one file and two ranks to empty b4.
78. White ends its Knight turn with the black c7 Pawn still captured.
79. Resurrection returns Black's own captured c7 Pawn to vacant legal starting square c7; clear capturedBy and consume Black's move.
80. Black ends the replacement move with no ordinary move available this turn.
81. g2-h3: white Bishop captures Black's c8 Bishop diagonally; capturedBy is White.
82. White ends the capture turn; the black Bishop remains captured.
83. d8-e8: black Queen moves one file to the King's vacated origin.
84. Black ends the Queen move; no Pawn opportunity exists.
85. c1-e2: white Knight jumps to the white e-Pawn's empty original square.
86. White completes the Knight turn without spending a card.
87. e7-e5: black Pawn doubles through empty e6; white e4 Pawn is not an en-passant captor.
88. Black ends the turn retaining its uncapturable e6 opportunity.
89. d5-d6: white Rook captures Black's d7 Pawn one rank forward; capturedBy is White.
90. White completes the capture turn; the e6 opportunity expired.
91. g7-g6: black Pawn advances one empty square.
92. Cowardice moves opposing white Pawn e4-e3 one square backward after Black's move, preserving clocks and identity.
93. Black ends its turn after Cowardice; White receives its replacement-move options.
94. Evil Eye: Knight e2 legally threatens neutral Pawn c3; remove only the Pawn, discard Neutrality, capture for White, consume White's move.
95. White ends the Evil Eye replacement turn; no ordinary move remains.
96. f7-g7: black King steps horizontally to a safe empty square.
97. Black ends the King turn with no active effects.
98. e3-e4: white Pawn advances back to empty e4.
99. White completes the Pawn move; Black receives the turn.
100. Breakthrough moves black Pawn e5-e4 straight forward capturing White's e-Pawn; this card replaces the move.
101. Black ends the replacement capture turn; no ordinary move is due.
102. b4-d3: white Knight jumps two files and one rank to vacant d3.
103. White ends its Knight turn; no effects or obligations remain.
104. b1-b2: black Rook moves one rank to empty b2.
105. Black ends its Rook turn; the other Rook remains on a1.
106. d6-d7: white Rook moves without capture and checks King g7 through vacant e7,f7; Fireball is enabled.
107. Fireball explodes moved checking Rook d7 and adjacent Pawn c7 and Queen e8; both Kings become safe, all three capturedBy White, clocks reset once.
108. White ends the Fireball turn; both Kings survive and no extra move is granted.
109. e4-e3: black Pawn advances into empty e3.
110. Black ends the Pawn turn; no promotion or en-passant choice exists.
111. e2-g3: white Knight jumps two files and one rank to vacant g3.
112. White ends the Knight turn with no pending choice.
113. a1-c1: Black's original h8 Rook travels through empty b1 to empty c1; Queen d1 blocks its line to King e1.
114. Black ends the fiftieth regular move command; White is next with all card allowances clear.
`.trim().split('\n');

const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);

function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(piece.square!); const [tx, ty] = xy(to);
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    if (dx || dy * forward < 1 || dy * forward > 2) return false;
    if (Math.abs(dy) === 1) return !at(pieces, to);
    return (piece.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, to) && !at(pieces, `${String.fromCharCode(97 + x)}${y + forward + 1}`);
  }
  if (piece.role === 'bishop' && ax !== ay) return false;
  if (piece.role === 'rook' && dx && dy) return false;
  if (piece.role === 'queen' && dx && dy && ax !== ay) return false;
  for (let k = 1; k < Math.max(ax, ay); k++) {
    if (at(pieces, `${String.fromCharCode(97 + x + k * Math.sign(dx))}${y + k * Math.sign(dy) + 1}`)) return false;
  }
  return true;
}

function threats(pieces: PieceState[], color: Color, step: number): string[] {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  const candidates = pieces.filter(p => p.zone === 'board' && p.id !== king.id && (p.neutral || p.owner !== color)
    && !(step >= 49 && step <= 52 && p.id === 'black-rook-h8')
    && geometry(pieces, p, king.square!, true));
  return candidates.filter(p => {
    if (!p.neutral) return true;
    // §15.1: a neutral hypothetical capture is controlled by the opposite King.
    const simulated = structuredClone(pieces).filter(q => q.id !== king.id);
    simulated.find(q => q.id === p.id)!.square = king.square;
    const controller = simulated.find(q => q.royal && q.owner === other(color))!;
    return !simulated.some(q => q.zone === 'board' && q.id !== p.id && q.owner === color
      && geometry(simulated, q, controller.square!, true));
  }).map(p => p.id);
}

function physicalFen(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, index) => {
    let row = '', empty = 0;
    for (const file of 'abcdefgh') {
      const p = at(pieces, `${file}${8 - index}`);
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 139: independent 114-row physical and rules oracle', () => {
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 114);
  let actual = createGameState(trace.initial);
  let pieces = structuredClone(actual.pieces), players = structuredClone(actual.players);
  let turn = structuredClone(actual.turn), ep: GameState['enPassant'] = [];
  let half = 0, full = 1, fenTurn: Color = 'white', rights = 'KQkq';
  let saved: { pieces: PieceState[]; half: number; full: number; ep: GameState['enPassant'] } | undefined;
  const neutralCard = { id: 'black-hand-3-neutrality', cardId: 'neutrality' };
  const vendettaCard = { id: 'white-hand-1-vendetta', cardId: 'vendetta' };
  const movePiece = (from: string, to: SquareName) => { const p = at(pieces, from); assert.ok(p); p.square = to; };
  const capture = (square: string, captor: Color) => {
    const p = at(pieces, square); assert.ok(p); assert.equal(p.royal, false);
    p.square = null; p.zone = 'captured'; p.capturedBy = captor;
    if (p.neutral) { p.neutral = false; delete p.neutralBeforeEffects; }
  };
  const consumeMove = (pawnOrCapture: boolean) => {
    half = pawnOrCapture ? 0 : half + 1;
    if (turn.color === 'black') full++;
    fenTurn = other(turn.color); turn.phase = 'afterMove'; turn.moveMade = true; ep = [];
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1, label = rationales[index]!;
    assert.ok(label.startsWith(`${step}.`));
    const immutable = structuredClone(actual);
    if (step === 69) saved = { pieces: structuredClone(pieces), half, full, ep: structuredClone(ep) };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/);
      assert.equal(action.promotion, undefined, label);
      assert.equal(turn.moveMade, false, label);
      const p = at(pieces, from), victim = at(pieces, to); assert.ok(p, label);
      assert.ok(p.neutral || p.owner === turn.color, label);
      assert.ok(!victim || victim.neutral || victim.owner !== turn.color, label);
      assert.ok(geometry(pieces, p, to, !!victim), label);
      if (step >= 50 && step <= 52) assert.notEqual(p.id, 'black-rook-h8', label);
      if (victim) capture(to, turn.color);
      consumeMove(p.role === 'pawn' || !!victim);
      if (p.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2) {
        ep = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }];
      }
      p.square = to as SquareName;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label);
      turn = { color: other(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      if (step === 7) {
        // No even geometric Black capture exists; therefore no legal capture exists either.
        assert.equal(pieces.some(p => p.owner === 'black' && pieces.some(q => q.owner === 'white'
          && geometry(pieces, p, q.square!, true))), false);
        players.white.discard.push(vendettaCard);
      }
    } else {
      assert.equal(action.type, 'playCard', label);
      if (action.type !== 'playCard') assert.fail(label);
      const owner = step === 70 ? 'white' : turn.color;
      assert.equal(turn.cardPlays[owner], 0, label);
      assert.equal(turn.phase, [79, 94, 100].includes(step) ? 'beforeMove' : 'afterMove', label);
      const hand = players[owner].hand, slot = hand.findIndex(card => card.id === action.cardInstanceId);
      assert.ok(slot >= 0, label); const card = hand.splice(slot, 1)[0]!;
      assert.equal(card.cardId, action.cardId, label);
      if (![6, 22].includes(step)) players[owner].discard.push(card);
      hand.push(players[owner].deck.shift()!); turn.cardPlays[owner]++;
      switch (step) {
        case 6: assert.equal(action.cardId, 'vendetta'); break;
        case 9: {
          assert.equal(action.cardId, 'figure-dance'); assert.deepEqual(action.target, []);
          const corners = ['a1', 'h1', 'h8', 'a8'] as const;
          const movers = corners.map(square => at(pieces, square)!);
          movers.forEach((p, i) => { assert.equal(p.role, 'rook'); p.square = corners[(i + 1) % 4]!; });
          rights = '-'; break;
        }
        case 22: {
          assert.equal(action.cardId, 'neutrality'); assert.equal(action.target, 'c2');
          const p = at(pieces, 'c2')!; assert.equal(p.owner, 'white'); assert.equal(p.role, 'pawn');
          p.neutral = true; p.neutralBeforeEffects = false; break;
        }
        case 49:
          assert.equal(action.cardId, 'dungeon'); assert.deepEqual(action.target, [{ from: 'a8', to: 'a1' }]);
          assert.equal(at(pieces, 'a1'), undefined); movePiece('a8', 'a1'); break;
        case 52: {
          assert.equal(action.cardId, 'anathema'); assert.deepEqual(action.target, { bishop: 'd5', rook: 'h1' });
          const bishop = at(pieces, 'd5')!, rook = at(pieces, 'h1')!;
          assert.equal(bishop.role, 'bishop'); assert.equal(rook.role, 'rook');
          assert.equal(bishop.owner, 'white'); assert.equal(rook.owner, 'white');
          bishop.square = 'h1'; rook.square = 'd5'; break;
        }
        case 55: {
          assert.equal(action.cardId, 'holy-war'); assert.deepEqual(action.target, { knight: 'g1', bishop: 'c1' });
          const knight = at(pieces, 'g1')!, bishop = at(pieces, 'c1')!;
          assert.equal(knight.role, 'knight'); assert.equal(bishop.role, 'bishop');
          knight.square = 'c1'; bishop.square = 'g1'; break;
        }
        case 70:
          assert.equal(action.cardId, 'think-again'); assert.equal(action.target, undefined); assert.ok(saved);
          pieces = structuredClone(saved.pieces); half = saved.half; full = saved.full; ep = structuredClone(saved.ep);
          fenTurn = 'black'; turn.phase = 'beforeMove'; turn.moveMade = false; break;
        case 79: {
          assert.equal(action.cardId, 'resurrection'); assert.deepEqual(action.target, { pieceId: 'black-pawn-c7', to: 'c7' });
          const p = pieces.find(p => p.id === 'black-pawn-c7')!;
          assert.equal(p.zone, 'captured'); assert.equal(p.capturedBy, 'white'); assert.equal(at(pieces, 'c7'), undefined);
          p.zone = 'board'; p.square = 'c7'; delete p.capturedBy; consumeMove(true); break;
        }
        case 92:
          assert.equal(action.cardId, 'cowardice'); assert.deepEqual(action.target, [{ from: 'e4', to: 'e3' }]);
          assert.equal(at(pieces, 'e3'), undefined); movePiece('e4', 'e3'); break;
        case 94: {
          assert.equal(action.cardId, 'evil-eye'); assert.deepEqual(action.target, { attacker: 'e2', victim: 'c3' });
          const attacker = at(pieces, 'e2')!; assert.equal(attacker.role, 'knight'); assert.equal(at(pieces, 'c3')!.neutral, true);
          assert.ok(geometry(pieces, attacker, 'c3', true));
          const hypothetical = structuredClone(pieces); hypothetical.find(p => p.id === 'white-pawn-c2')!.zone = 'captured';
          hypothetical.find(p => p.id === attacker.id)!.square = 'c3';
          assert.deepEqual(threats(hypothetical, 'white', step), []);
          capture('c3', 'white'); players.black.discard.push(neutralCard); consumeMove(true); break;
        }
        case 100:
          assert.equal(action.cardId, 'breakthrough'); assert.deepEqual(action.target, [{ from: 'e5', to: 'e4' }]);
          assert.equal(at(pieces, 'e5')!.role, 'pawn'); assert.equal(at(pieces, 'e4')!.owner, 'white');
          capture('e4', 'black'); movePiece('e5', 'e4'); consumeMove(true); break;
        case 107: {
          assert.equal(action.cardId, 'fireball'); assert.equal(action.target, 'd7');
          assert.deepEqual(trace.steps[index - 1]!.action, { type: 'move', from: 'd6', to: 'd7' });
          const blast = pieces.filter(p => p.zone === 'board' && !p.royal && Math.max(Math.abs(xy(p.square!)[0] - 3), Math.abs(xy(p.square!)[1] - 6)) <= 1);
          assert.deepEqual(blast.map(p => p.id).sort(), ['white-rook-a1', 'black-pawn-c7', 'black-queen-d8'].sort());
          for (const p of blast) capture(p.square!, 'white'); half = 0; break;
        }
        default: assert.fail(`Unreviewed card row ${step}`);
      }
    }
    const result = applyAction(actual, action); assert.deepEqual(actual, immutable, `${label}: input immutability`);
    assert.ok(result.ok, label); actual = result.state;
    assert.deepEqual(actual.pieces, pieces, `${label}: independent physical identities and capturedBy`);
    assert.deepEqual(actual.players, players, `${label}: physical card zones and draws`);
    assert.deepEqual(actual.turn, turn, `${label}: timing and card allowances`);
    assert.equal(actual.fen, `${physicalFen(pieces)} ${fenTurn[0]} ${rights} - ${half} ${full}`, `${label}: all six FEN fields`);
    assert.deepEqual(actual.enPassant, ep, `${label}: raw en-passant opportunity`);
    const epCaptures = ep.flatMap(op => pieces.filter(p => p.zone === 'board' && p.role === 'pawn'
      && (p.neutral || p.owner === fenTurn) && geometry(pieces, p, op.target, true)));
    assert.deepEqual(epCaptures, [], `${label}: legal en-passant availability is separately empty`);
    const effects: unknown[] = [];
    if (step === 6) effects.push({ type: 'vendetta', owner: 'white', card: vendettaCard });
    if (step >= 22 && step < 94) effects.push({ type: 'neutrality', owner: 'black', card: neutralCard, pieceId: 'white-pawn-c2' });
    if (step >= 49 && step <= 52) effects.push({ type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-rook-h8' });
    assert.deepEqual(actual.effects, effects, `${label}: complete effects`);
    for (const color of ['white', 'black'] as const) {
      const checking = color === 'black' ? step === 51 ? ['white-bishop-f1'] : step === 106 ? ['white-rook-a1'] : [] : [];
      assert.deepEqual(threats(pieces, color, step), checking, `${label}: independent ${color} royal threats including neutral control`);
      assert.equal(isKingInCheck(actual, color), checking.length > 0, label);
    }
    assert.equal(actual.orientation, 0, label); assert.equal(actual.outcome, null, label);
    if (step === 51) {
      assert.deepEqual(actual.pendingRescue, { before: immutable, fen: immutable.fen,
        pieces: immutable.pieces, enPassant: [], historyLength: 27, movedPieceIds: ['black-king-e8'] }, label);
      assert.equal(immutable.fen, '1n1qkbnR/4p1pp/pp1p1p2/2pB4/5PP1/PPP4b/1rNPP2P/r1BQK1NR b - - 2 12');
      assert.equal(applyAction(actual, { type: 'endTurn' }).ok, false, 'must rescue King before ending turn');
    } else assert.equal(actual.pendingRescue ?? null, null, label);
    for (const key of ['pendingAbduction', 'pendingDoomsayer', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const)
      assert.equal(actual[key] ?? null, null, `${label}: absent ${key}`);
    for (const key of ['underElfHill', 'plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const)
      assert.deepEqual(actual[key] ?? [], [], `${label}: empty ${key}`);
    assert.deepEqual(actual.chaosForbidden ?? null, step === 70 ? { player: 'black', movement: 'black-queen-d8:d8:d7' } : null, label);
    if (step === 70) {
      assert.equal(legalDests(actual).get('d8')?.includes('d7') ?? false, false);
      const beforeRepeat = structuredClone(actual);
      assert.equal(applyAction(actual, { type: 'move', from: 'd8', to: 'd7' }).ok, false);
      assert.deepEqual(actual, beforeRepeat);
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 12);
  assert.equal(actual.fen, '1n3bnR/B5k1/p4ppp/1p6/5PP1/PP1Np1NB/1r1P3P/2rQK3 w - - 2 27');
});

test('iteration 139 deterministic engine replay', () => { replayTrace(trace); });
