import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, Role, SquareName } from '../types.js';

// Read rules §§8–14, 17.3, 20 and the 13 played cards' final_cards artwork.
// Explicit human review: cards alter only the properties named by their text.
const rationales = `
1. Long Jump sends white Ng1 to empty opposite-color a6, replacing the move.
2. End White's completed Long Jump turn; reset both card allowances.
3. Ghostwalk Bc8-e6 crosses own d7 pawn, ends empty, and replaces Black's move.
4. End Black's completed Ghostwalk turn without another board change.
5. Na6xc7 is a (2,1) jump capturing the black c7 pawn and checking e8.
6. End White's capture turn; Black must answer the knight check.
7. Qd8xc7 is an adjacent diagonal capture removing the checking knight.
8. End Black's completed capture turn, preserving both captured identities.
9. Nb1-c3 is a (1,2) jump to an empty square.
10. End White's completed knight turn without a card draw.
11. Black b7-b6 advances one unobstructed square in orientation zero.
12. End Black's completed pawn turn with the halfmove clock at zero.
13. White h2-h3 advances one unobstructed square.
14. End White's completed pawn turn without changing the board.
15. Ng8-h6 is a (1,2) jump to an empty square.
16. After Black's move Earthquake turns clockwise to 90; opponent h3 promotes to bishop first, then a7 to queen; retain the continuing card.
17. End Black's turn; the orientation and both promotions persist.
18. At 90 degrees White g2-h2 advances toward the h-file and promotes to bishop.
19. End White's promotion turn; retain promoted physical pawn identity.
20. Be6-f5 is an adjacent diagonal quiet move.
21. End Black's completed bishop turn.
22. Promoted Bh2-d6 passes empty g3,f4,e5; promoted pieces use their current role.
23. End White's completed bishop turn.
24. Nh6-g4 is a (1,2) quiet jump.
25. End Black's completed knight turn.
26. White Tournament swaps own Nc3 with black Nb8 simultaneously, replacing the move without capture.
27. End White's Tournament turn and reset card allowances.
28. Guardian moves black b6-a6 one square forward at 90 degrees; no follower, capture, en-passant, or card-authorized promotion (§13.2).
29. End Black's Guardian turn; the pawn remains an unpromoted pawn on a6.
30. White f2-g2 is one empty forward square at 90 degrees.
31. End White's completed pawn turn.
32. Qc7-a5 is a diagonal through now-empty b6.
33. End Black's completed queen turn.
34. White promoted Bd6xe7 captures the black e7 pawn diagonally.
35. End White's bishop capture turn.
36. Black Tournament exchanges own Nc3 with white Nb8, consuming its move.
37. End Black's Tournament turn with both knight identities preserved.
38. Ra1-b1 is one horizontal empty step and removes White's queenside castling right.
39. After White's move Holy Quest swaps black Bf5 and Nb8; clocks and completed move remain.
40. End White's turn after its rook move and legal after-move swap.
41. Qa5-b5 moves one horizontal empty square.
42. End Black's completed queen turn.
43. Passing in the Night swaps white b2/h7 and d2/a6 with two black pawns simultaneously; no promotion at h7 because this card does not authorize it.
44. End White's replacement pawn-swap turn.
45. Promoted Qa7-e3 passes empty b6,c5,d4 on a diagonal.
46. After Black's move Cathedral swaps own Rh8 and Bf8 without capture; the h8 right persists through a non-move swap (serialized h).
47. End Black's turn with swap positions and unchanged clocks.
48. Promoted Be7-b4 passes empty d6,c5 diagonally.
49. End White's bishop turn.
50. Nf5-d6 makes a (2,1) quiet jump.
51. End Black's knight turn.
52. Rb1xb2 captures the black pawn that Passing in the Night placed there.
53. White's after-move Earthquake rotates 90 to 180; no unpromoted pawn is on either new last rank, so no promotions occur.
54. End White's turn; both Earthquake cards remain active.
55. Ng4-h6 makes a (1,2) quiet jump.
56. End Black's knight turn at orientation 180.
57. Promoted Bh3-e6 passes empty g4,f5 diagonally.
58. End White's bishop turn.
59. Nd6-b7 makes a (2,1) quiet jump.
60. End Black's knight turn.
61. Promoted Bb4-d6 passes empty c5 diagonally.
62. End White's bishop turn.
63. Qb5-g5 crosses empty c5,d5,e5,f5 horizontally.
64. End Black's queen turn.
65. Promoted Be6-f5 makes one diagonal quiet step.
66. End White's bishop turn.
67. At 180 degrees Black d2-d4 is an allowed two-square advance from its first rank across empty d3; store d3 en-passant opportunity though no white pawn can capture it.
68. End Black's pawn turn; en-passant opportunity survives into White's turn but FEN has no legally capturable target.
69. Dark Mirror lets white a6xb7 capture backward at 180 degrees, taking Black's knight; clear old en-passant.
70. End White's Dark Mirror replacement turn.
71. Qg5-f6 moves one diagonal empty square.
72. End Black's queen turn.
73. At 180 degrees White a2-a1 is a normal forward pawn move and promotes to rook.
74. End White's promotion turn; the new rook gains no castling rights.
75. Promoted Qe3-e6 passes empty e4,e5 vertically.
76. End Black's queen turn.
77. Rh1xh6 crosses empty h2,h3,h4,h5, captures Black's knight and removes White's remaining castling right.
78. End White's rook capture turn.
79. Ra8-a6 crosses empty a7 and removes Black's queenside castling right.
80. End Black's rook turn; only Black's original h8 right remains.
81. Promoted Bf5-e4 makes an adjacent diagonal quiet move.
82. End White's bishop turn.
83. Bb8xd6 crosses empty c7 and captures White's promoted g2 pawn, preserving its promoted bishop identity in captivity.
84. End Black's capture turn.
85. Qd1-d2 moves one empty vertical square.
86. End White's queen turn.
87. Qf6xf1 crosses empty f5,f4,f3,f2 and captures White's original bishop, checking Ke1 horizontally.
88. End Black's capture turn; White must escape the queen check.
89. At 180 degrees white e2xf1 captures the checking queen diagonally forward and promotes to bishop.
90. End White's promotion-capture turn with its King safe.
91. Assassin permits black Rf8xf7 to capture its own pawn; capturedBy is Black and moving the original h8 rook extinguishes its remaining right.
92. End Black's Assassin replacement turn with no castling rights.
93. White b7-b6 advances one empty square toward rank one at 180 degrees.
94. End White's pawn turn.
95. Promoted Qe6-e5 moves one empty vertical square.
96. End Black's queen turn.
97. Rh6-g6 moves one empty horizontal square.
98. End White's rook turn.
99. Madman jumps black d4-f6 diagonally over its own queen on e5; queen stays and no capture occurs.
100. End Black's Madman replacement turn.
101. Qd2-e3 moves one empty diagonal square.
102. End White's queen turn.
103. Ra6xb6 captures White's d2 pawn that moved through a6,b7,b6.
104. End Black's rook capture turn.
105. Promoted Bf1-c4 passes empty e2,d3 diagonally.
106. End White's bishop turn.
107. Rf7-e7 moves one empty horizontal square.
108. End Black's rook turn.
109. Nc3-a4 makes a (2,1) quiet jump.
110. End White's knight turn.
111. Promoted Qe5-h2 passes empty f4,g3 diagonally.
112. End Black's queen turn.
113. Rb2-b4 passes empty b3 vertically.
114. End White's rook turn.
115. Black Evangelists swaps own Bh8 with white Bc1; replace the move without capture or role/owner changes.
116. End Black's Evangelists turn.
117. Qe3xc1 passes empty d2 and captures the black bishop placed by Evangelists.
118. End White's queen capture turn.
119. Re7-e5 passes empty e6 vertically.
120. End Black's rook turn.
121. Rb4-b2 passes empty b3 vertically.
122. End White's rook turn.
123. Black plays Plots before moving: retain the move, spend/draw once, open two immediate extra plays for originally legal hand cards only; none is mandatory.
124. Bd6-a3 passes empty c5,b4; this regular move closes all unused Plots allowances (§17.3).
125. End Black's completed 50th regular move; White starts with reset allowances, no pending choices, and both Kings safe.
`.trim().split('\n');

const coords = (square: string): [number, number] => {
  assert.match(square, /^[a-h][1-8]$/);
  return [square.charCodeAt(0) - 97, Number(square[1]) - 1];
};
const squareAt = (x: number, y: number): SquareName => {
  const square = `${String.fromCharCode(97 + x)}${y + 1}`;
  coords(square);
  return square as SquareName;
};
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';

test('iteration 133 independent physical, movement, card, clock, and royal oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/133.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860133);
  assert.equal(trace.steps.length, 125);
  assert.equal(rationales.length, trace.steps.length);
  rationales.forEach((reason, i) => assert.ok(reason.startsWith(`${i + 1}. `)));
  let actual = createGameState(trace.initial);
  const pieces: PieceState[] = [];
  const back: Role[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (const rank of [0, 1, 6, 7]) for (let file = 0; file < 8; file++) {
    const owner: Color = rank < 2 ? 'white' : 'black';
    const role = rank === 1 || rank === 6 ? 'pawn' : back[file]!;
    const square = squareAt(file, rank);
    pieces.push({ id: `${owner}-${role}-${square}`, owner, role, originalRole: role, square,
      zone: 'board', promoted: false, royal: role === 'king', neutral: false });
  }
  const players: GameState['players'] = { white: { hand: [], deck: [], discard: [] }, black: { hand: [], deck: [], discard: [] } };
  for (const owner of ['white', 'black'] as const) {
    players[owner].hand = trace.initial.hands![owner]!.map((cardId, i) => ({ id: `${owner}-hand-${i}-${cardId}`, cardId }));
    players[owner].deck = trace.initial.decks![owner]!.map((cardId, i) => ({ id: `${owner}-deck-${i}-${cardId}`, cardId }));
  }
  const effects: unknown[] = [];
  const playedCards: NonNullable<GameState['playedCards']> = [];
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let orientation = 0, halfmove = 0, fullmove = 1;
  let fenActor: Color = 'white';
  let ep: GameState['enPassant'] = [];
  const rights = new Set(['white-rook-h1', 'white-rook-a1', 'black-rook-h8', 'black-rook-a8']);
  const at = (square: string) => pieces.find(piece => piece.zone === 'board' && piece.square === square);
  const forward = (owner: Color): [number, number] => {
    const sign = owner === 'white' ? 1 : -1;
    return orientation === 0 ? [0, sign] : orientation === 90 ? [sign, 0] : [0, -sign];
  };
  const lastRank = (piece: PieceState, square: string) => {
    const [x, y] = coords(square), [dx, dy] = forward(piece.owner);
    return dx === 1 ? x === 7 : dx === -1 ? x === 0 : dy === 1 ? y === 7 : y === 0;
  };
  const geometry = (piece: PieceState, to: string, capture: boolean, ghost = false): boolean => {
    const [x, y] = coords(piece.square!), [tx, ty] = coords(to);
    const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (!ax && !ay) return false;
    if (piece.role === 'knight') return ax * ay === 2;
    if (piece.role === 'king') return Math.max(ax, ay) === 1;
    if (piece.role === 'pawn') {
      const [fx, fy] = forward(piece.owner);
      const advance = dx * fx + dy * fy, sideways = Math.abs(dx * fy - dy * fx);
      if (capture) return advance === 1 && sideways === 1;
      if (sideways || (advance !== 1 && advance !== 2)) return false;
      if (advance === 1) return true;
      const rank = fx === 1 ? x : fx === -1 ? 7 - x : fy === 1 ? y : 7 - y;
      return rank <= 1 && !at(squareAt(x + fx, y + fy));
    }
    if (piece.role === 'bishop' ? ax !== ay : piece.role === 'rook' ? !!ax && !!ay : ax !== ay && !!ax && !!ay) return false;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    for (let n = 1; n < Math.max(ax, ay); n++) {
      const blocker = at(squareAt(x + sx * n, y + sy * n));
      if (blocker && (!ghost || blocker.owner !== piece.owner)) return false;
    }
    return true;
  };
  const check = (owner: Color) => {
    const king = pieces.find(piece => piece.royal && piece.owner === owner)!;
    // No neutral piece or capture-limiting effect occurs in this reviewed trace.
    // Assert that precondition: §11.7 / §15.1 neutral legal-capture constraints
    // must never silently be replaced by geometric attacks in a changed trace.
    assert.ok(pieces.every(piece => !piece.neutral));
    assert.ok(effects.every(effect => (effect as { type: string }).type === 'earthquake'));
    return pieces.some(piece => piece.zone === 'board' && piece.owner !== owner && geometry(piece, king.square!, true));
  };
  const boardFen = () => Array.from({ length: 8 }, (_, i) => {
    let row = '', empty = 0;
    for (let x = 0; x < 8; x++) {
      const piece = at(squareAt(x, 7 - i));
      if (!piece) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const letter = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[piece.role];
      row += piece.owner === 'white' ? letter.toUpperCase() : letter;
    }
    return row + (empty || '');
  }).join('/');
  const expectedFen = () => {
    for (const opportunity of ep) {
      const victim = pieces.find(piece => piece.id === opportunity.pawnId)!;
      assert.ok(!pieces.some(piece => piece.zone === 'board' && piece.role === 'pawn'
        && piece.owner !== victim.owner && geometry(piece, opportunity.target, true)),
      'stored en-passant opportunities have no geometrically eligible capturing pawn in this trace');
    }
    // Rights remain tied to starting coordinates across the non-move Cathedral swap.
    const castling = [...rights].map(id => id === 'white-rook-h1' ? 'K' : id === 'white-rook-a1' ? 'Q'
      : id === 'black-rook-a8' ? 'q' : at('h8')?.role === 'rook' ? 'k' : 'h').join('') || '-';
    return `${boardFen()} ${fenActor[0]} ${castling} - ${halfmove} ${fullmove}`;
  };
  const movePiece = (from: string, to: string, promotion?: unknown, captureOwn = false, ghost = false, special = false) => {
    const piece = at(from); assert.ok(piece);
    assert.equal(piece.owner, turn.color);
    const victim = at(to);
    if (victim) { assert.equal(victim.owner, captureOwn ? piece.owner : opposite(piece.owner)); assert.equal(victim.royal, false); }
    if (!special) assert.ok(geometry(piece, to, !!victim, ghost), `${from}-${to}: independent geometry/path`);
    const pawn = piece.role === 'pawn';
    rights.delete(piece.id);
    if (victim) { rights.delete(victim.id); victim.zone = 'captured'; victim.square = null; victim.capturedBy = turn.color; }
    piece.square = squareAt(...coords(to));
    if (promotion !== undefined) {
      assert.ok(pawn && lastRank(piece, to));
      assert.ok(['bishop', 'rook', 'queen', 'knight'].includes(promotion as string));
      piece.role = promotion as Role; piece.promoted = true;
    }
    return pawn || !!victim;
  };
  const swap = (a: string, b: string, roleA: Role, roleB: Role, ownerA: Color, ownerB: Color) => {
    const first = at(a), second = at(b); assert.ok(first && second && first !== second);
    assert.equal(first.role, roleA); assert.equal(second.role, roleB);
    assert.equal(first.owner, ownerA); assert.equal(second.owner, ownerB);
    [first.square, second.square] = [second.square, first.square];
  };
  assert.deepEqual(actual.pieces, pieces);
  assert.deepEqual(actual.players, players);
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1, reason = rationales[index]!;
    const original = structuredClone(actual);
    let completesMove = false, resetClock = false;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.equal(turn.moveMade, false);
      const piece = at(action.from)!; assert.ok(piece);
      const [x, y] = coords(action.from), [tx, ty] = coords(action.to);
      const pawn = piece.role === 'pawn';
      ep = pawn && Math.max(Math.abs(tx - x), Math.abs(ty - y)) === 2
        ? [{ target: squareAt((x + tx) / 2, (y + ty) / 2), pawnId: piece.id }] : [];
      resetClock = movePiece(action.from, action.to, action.promotion);
      if (pawn && lastRank(piece, action.to)) assert.ok(action.promotion, 'normal final-rank move must promote');
      completesMove = true;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true);
      assert.equal(check(turn.color), false, reason);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') assert.fail('unreviewed mandatory action');
      const owner = turn.color, other = opposite(owner);
      assert.equal(turn.cardPlays[owner], 0, 'normal card allowance');
      const hand = players[owner].hand;
      const cardIndex = hand.findIndex(card => card.id === action.cardInstanceId && card.cardId === action.cardId);
      assert.ok(cardIndex >= 0, 'physical card is in the acting hand');
      const card = hand.splice(cardIndex, 1)[0]!;
      const afterMove = ['earthquake', 'holy-quest', 'cathedral'].includes(action.cardId);
      assert.equal(turn.phase, afterMove ? 'afterMove' : 'beforeMove', 'printed timing');
      if (action.cardId !== 'earthquake') players[owner].discard.push(card);
      hand.push(players[owner].deck.shift()!);
      playedCards.push({ player: owner, cardInstanceId: card.id });
      turn.cardPlays[owner]++;
      switch (action.cardId) {
        case 'long-jump':
          assert.deepEqual(action.target, [{ from: 'g1', to: 'a6' }]);
          assert.equal(at('g1')!.role, 'knight'); assert.equal(at('a6'), undefined);
          assert.notEqual(coords('g1').reduce((a, b) => a + b) % 2, coords('a6').reduce((a, b) => a + b) % 2);
          resetClock = movePiece('g1', 'a6', undefined, false, false, true); break;
        case 'ghostwalk':
          assert.deepEqual(action.target, [{ from: 'c8', to: 'e6' }]);
          assert.equal(at('e6'), undefined); resetClock = movePiece('c8', 'e6', undefined, false, true); break;
        case 'earthquake': {
          const target = step === 16 ? { direction: 'clockwise', promotions: [{ square: 'h3', role: 'bishop' }, { square: 'a7', role: 'queen' }] }
            : { direction: 'clockwise', promotions: [] };
          assert.deepEqual(action.target, target);
          orientation += 90;
          const promoting = pieces.filter(piece => piece.zone === 'board' && piece.role === 'pawn' && lastRank(piece, piece.square!));
          assert.deepEqual(promoting.map(piece => piece.square).sort(), target.promotions.map(item => item.square).sort());
          for (const item of target.promotions) { const piece = at(item.square)!; piece.role = item.role as Role; piece.promoted = true; }
          effects.push({ type: 'earthquake', owner, card, direction: 'clockwise', target }); break;
        }
        case 'tournament':
          assert.deepEqual(action.target, { own: 'c3', opponent: 'b8' }); swap('c3', 'b8', 'knight', 'knight', owner, other); break;
        case 'guardian':
          assert.deepEqual(action.target, [{ from: 'b6', to: 'a6' }]);
          assert.equal(at('b6')!.role, 'pawn'); assert.equal(at('a6'), undefined);
          resetClock = movePiece('b6', 'a6'); break;
        case 'holy-quest':
          assert.deepEqual(action.target, { bishop: 'f5', knight: 'b8' }); swap('f5', 'b8', 'bishop', 'knight', other, other); break;
        case 'passing-in-the-night':
          assert.deepEqual(action.target, [{ from: 'b2', to: 'h7' }, { from: 'd2', to: 'a6' }]);
          swap('b2', 'h7', 'pawn', 'pawn', owner, other); swap('d2', 'a6', 'pawn', 'pawn', owner, other); resetClock = true; break;
        case 'cathedral':
          assert.deepEqual(action.target, { rook: 'h8', bishop: 'f8' }); swap('h8', 'f8', 'rook', 'bishop', owner, owner); break;
        case 'dark-mirror':
          assert.deepEqual(action.target, [{ from: 'a6', to: 'b7' }]);
          assert.equal(orientation, 180); assert.equal(at('a6')!.role, 'pawn'); assert.equal(at('b7')!.owner, other);
          resetClock = movePiece('a6', 'b7', undefined, false, false, true); break;
        case 'assassin':
          assert.deepEqual(action.target, [{ from: 'f8', to: 'f7' }]);
          resetClock = movePiece('f8', 'f7', undefined, true); break;
        case 'madman':
          assert.deepEqual(action.target, [{ from: 'd4', to: 'f6' }]);
          assert.equal(at('d4')!.role, 'pawn'); assert.ok(at('e5')); assert.equal(at('f6'), undefined);
          resetClock = movePiece('d4', 'f6', undefined, false, false, true); break;
        case 'evangelists':
          assert.deepEqual(action.target, { own: 'h8', opponent: 'c1' }); swap('h8', 'c1', 'bishop', 'bishop', owner, other); break;
        case 'plots-within-plots': assert.deepEqual(action.target, { player: 'black' }); break;
        default: assert.fail(`unreviewed card ${action.cardId}`);
      }
      completesMove = !afterMove && action.cardId !== 'plots-within-plots';
      if (completesMove) ep = [];
    }
    if (completesMove) {
      halfmove = resetClock ? 0 : halfmove + 1;
      if (turn.color === 'black') fullmove++;
      fenActor = opposite(turn.color);
      turn.phase = 'afterMove'; turn.moveMade = true;
    }
    const result = applyAction(actual, action);
    assert.deepEqual(actual, original, `${reason}: input immutability including capturedBy`);
    assert.ok(result.ok, reason);
    actual = result.state;
    assert.deepEqual(actual.pieces, pieces, `${reason}: full physical oracle`);
    assert.deepEqual(actual.players, players, `${reason}: complete ordered hand/deck/discard oracle`);
    assert.deepEqual(actual.effects, effects, `${reason}: full effect records`);
    assert.deepEqual(actual.turn, turn, `${reason}: full turn/allowance oracle`);
    assert.equal(actual.orientation, orientation, reason);
    assert.equal(actual.fen, expectedFen(), `${reason}: all six FEN fields`);
    assert.deepEqual(actual.enPassant, ep, reason);
    assert.deepEqual(actual.playedCards ?? [], playedCards, reason);
    for (const key of ['pendingRescue', 'pendingAbduction', 'pendingDoomsayer', 'outcome', 'chaosForbidden', 'riposteSkipped', 'riposteCheckDeferred', 'plotsExecution'] as const)
      assert.equal(actual[key] ?? null, null, `${reason}: no ${key}`);
    assert.deepEqual(actual.underElfHill ?? [], [], reason);
    assert.deepEqual(actual.riposteLostMoves ?? [], [], reason);
    assert.deepEqual(actual.fogLocked ?? [], [], reason);
    for (const owner of ['white', 'black'] as const) {
      const threatened = check(owner);
      assert.equal(threatened, owner === 'white' ? [87, 88].includes(step) : [5, 6].includes(step), `${reason}: reviewed ${owner} threat`);
      assert.equal(isKingInCheck(actual, owner), threatened, `${reason}: independent ${owner} attack state`);
    }
    if (action.type === 'playCard') assert.equal(check(opposite(turn.color)), false, 'no played regular card directly mates: it does not even give check');
    if (step !== 123) assert.deepEqual(actual.plotsAllowances ?? [], [], reason);
    else {
      // Heresy is after-move; Riposte lacks a capture; Man of Straw lacks check;
      // Vulture lacks an immediate opposing card; Crusade is newly drawn.
      assert.deepEqual(actual.plotsAllowances, [{ player: 'black', remaining: 2, eligibleCards: [],
        window: { phase: 'beforeMove', moveMade: false, shieldMove: undefined, capture: undefined,
          legacyCapture: undefined, cardResponse: undefined, fogCheckpoint: undefined,
          reaction: { type: 'move', from: 'b4', to: 'b2', movedPieceId: 'white-rook-a1', movedRoles: ['rook'] } } }]);
    }
  }
  assert.equal(trace.steps.filter(step => step.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 15);
  assert.equal(actual.fen, '4k2B/3p2pP/1r3pR1/4r3/N1B1B3/b7/1RP3Pq/R1Q1K3 w - - 3 31');
});

test('iteration 133 deterministic replay core', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/133.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
