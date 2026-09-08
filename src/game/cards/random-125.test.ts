import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Board } from 'chessops/board';
import { attacks } from 'chessops/attacks';
import { makeBoardFen } from 'chessops/fen';
import { makeSquare, parseSquare } from 'chessops/util';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, Role, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Read sequentially against rules §§11,13.6,14.1,15.4,16.3, card text,
// and artwork KC2_card2, KC5_card2, KC7_card4, KC11_card2, KC14_card3, KC18_card3.
const rationales = `
1 b1-c3: White Knight jumps to empty c3.
2 White ends its completed Knight move.
3 h7-h5: Black Pawn crosses empty h6 and offers h6 en passant.
4 Black ends; h6 opportunity survives into White's turn.
5 g2-g4: White Pawn crosses g3, expires h6 and offers g3 en passant.
6 White ends; g3 opportunity survives.
7 b8-a6: Black Knight jumps to empty a6; g3 opportunity expires.
8 Earthquake after Black's move rotates forward clockwise to east/west; White h2 Pawn promotes Rook first, Black a7 Pawn Knight second; physical squares stay fixed.
9 Black ends; the retained Earthquake persists.
10 g1-f3: White Knight jumps to empty f3 under the unchanged Knight geometry.
11 White ends its Knight move.
12 h5-f5: Black Pawn starts on its new first rank, crosses empty g5, advances west twice and offers g5 en passant.
13 Mystic Shield after Black's move protects the just-moved physical h7 Pawn on f5 during White's next turn; card is discarded.
14 Black ends; protection and g5 EP are available during White's turn.
15 h2xh8: White promoted Rook crosses h3-h7, captures Black's original h8 Rook; kingside right and EP expire.
16 White ends; Mystic Shield expires at the end of its protected turn.
17 g8-h6: Black Knight jumps to empty h6.
18 Black ends its Knight move.
19 Forced March replaces White's move: b2-b1 and g4-g5 are distinct empty squares one sideways step under orientation 90; no promotion or EP.
20 White ends its replacement move.
21 a7-c6: Black's promoted Knight jumps to empty c6.
22 Black ends its Knight move.
23 g5-h5: White Pawn advances east to its last rank and promotes to Queen.
24 White ends its promotion move.
25 c6-a7: Black's promoted Knight jumps back to empty a7.
26 Black ends its Knight move.
27 f3-g1: White Knight jumps to its vacated starting square.
28 White ends its Knight move.
29 a6-c5: Black's original b8 Knight jumps to empty c5.
30 Black ends its Knight move.
31 c1-b2: White Bishop moves diagonally to the square vacated by Forced March.
32 White ends its Bishop move.
33 a7-b5: Black's promoted Knight jumps to empty b5.
34 Black ends its Knight move.
35 b1-c1: White Pawn advances one empty square east, without promotion.
36 White ends its Pawn move.
37 a8-a3: Black Rook traverses empty a7/a6/a5/a4; queenside rights expire.
38 Black ends its Rook move.
39 f2-g2: White Pawn advances one empty square east.
40 White ends its Pawn move.
41 f5-e5: Black Pawn advances one empty square west.
42 Black ends its Pawn move.
43 e2-f2: White Pawn advances east into the vacated square.
44 White ends its Pawn move.
45 c5-d3: Black Knight jumps to d3 and checks White's King e1.
46 Black ends; White must answer the d3 Knight check.
47 f1xd3: White Bishop crosses empty e2 and captures Black's checking original b8 Knight, curing check.
48 White ends after curing its King's check.
49 a3-a7: Black Rook crosses vacant a4/a5/a6 to a7.
50 Black ends its Rook move.
51 d3-h7: White Bishop crosses empty e4/f5/g6 to h7.
52 White ends its Bishop move.
53 a7-a8: Black Rook returns to empty a8; castling rights do not return.
54 Black ends its Rook move.
55 h1-h4: White's original Rook crosses empty h2/h3; White kingside rights expire.
56 White ends its Rook move.
57 a8xa2: Black Rook crosses a7-a3 and captures White's original a2 Pawn.
58 Black ends its Rook capture.
59 h8xf8: White's promoted Rook crosses g8, captures Black's f8 Bishop and checks Black's e8 King.
60 Earthquake after White's move turns forward to south/north; White c1 Pawn is the sole new last-rank Pawn and promotes Queen; Black remains in Rook check.
61 White ends; Black receives the turn in check from f8 Rook.
62 g7xf8=R: Black Pawn captures the checking promoted Rook diagonally north and promotes Rook on the new last rank; check is cured.
63 Black ends its promotion capture.
64 Confabulation replaces White's move: g2 Pawn advances south onto its own nonroyal g1 Knight; retain both identities in one composite, no Pawn promotion.
65 White ends its replacement merge move.
66 f8-g8: Black's promoted Rook moves one empty file.
67 Black ends its Rook move.
68 e1-f1: White King steps to safe empty f1; its remaining queenside right expires.
69 White ends its King move.
70 a2-a4: Black Rook crosses vacant a3 to a4.
71 Black ends its Rook move.
72 h5-g4: White's promoted Queen moves one diagonal square.
73 White ends its Queen move.
74 a4-c4: Black Rook crosses vacant b4 to c4.
75 Black ends its Rook move.
76 a1-a8: White Rook traverses the now-empty a-file to a8.
77 White ends its Rook move.
78 c4-d4: Black Rook moves one empty file.
79 Black ends its Rook move.
80 a8-a4: White Rook crosses empty a7/a6/a5 to a4.
81 White ends its Rook move.
82 Evangelists replaces Black's move: swap Black c8 Bishop and White b2 Bishop, preserving ownership and all identities without capture.
83 Black ends its replacement Bishop swap.
84 h4-h1: White Rook crosses empty h3/h2 to h1.
85 White ends its Rook move.
86 e8-f8: Black King steps to safe empty f8.
87 Black ends its King move.
88 g4-h5: White's promoted Queen steps diagonally to h5.
89 White ends its Queen move.
90 e5-e6: Black Pawn advances one empty square north under orientation 180.
91 Black ends its Pawn move.
92 Lost Castle replaces White's move: swap White h1 Rook and Black d4 Rook; g1 composite blocks Black h1 Rook's line to White f1 King.
93 White ends its replacement Rook swap.
94 d7xc8=Q: Black Pawn captures White's original c1 Bishop diagonally north and promotes Queen on c8.
95 Black ends its promotion capture.
96 h5-h4: White's promoted Queen moves one empty rank.
97 White ends its Queen move.
98 g8-g4: Black's promoted Rook crosses empty g7/g6/g5 to g4.
99 Black ends its Rook move.
100 d4-d5: White's original h1 Rook moves one empty rank.
101 White ends its Rook move.
102 b2-a1: Black's original c8 Bishop moves diagonally to empty a1.
103 Black ends its Bishop move.
104 d5-e5: White Rook moves one empty file.
105 White ends its Rook move.
106 d8-d4: Black's original Queen crosses empty d7/d6/d5 to d4.
107 Black ends its Queen move.
108 c1-b2: White's promoted Queen moves diagonally to empty b2.
109 White ends its Queen move.
110 g4-g3: Black's promoted Rook moves one empty rank.
111 Black ends its Rook move; both Kings are safe and White has its next turn.
`.trim().split('\n');

test('iteration 125: independent physical, card, orientation, clock and royal state', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/125.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860125);
  assert.equal(trace.steps.length, 111);
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players), turn = structuredClone(state.turn);
  let orientation: GameState['orientation'] = 0;
  let ep: GameState['enPassant'] = [];
  let effects: unknown[] = [];
  let rights = 'KQkq', halfmoves = 0, fullmoves = 1, moves = 0, cards = 0;
  let fenActor: Color = 'white';
  const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
  const at = (square: string) => { const p = pieces.find(p => p.square === square && p.zone === 'board'); assert.ok(p, square); return p; };
  const board = () => {
    const b = Board.empty();
    for (const p of pieces) if (p.square) b.set(parseSquare(p.square)!, { color: p.owner, role: p.role });
    return b;
  };
  const revoke = (p: PieceState) => {
    const keys: Record<string, string> = { 'white-king-e1': 'KQ', 'black-king-e8': 'kq', 'white-rook-a1': 'Q', 'white-rook-h1': 'K', 'black-rook-a8': 'q', 'black-rook-h8': 'k' };
    for (const key of keys[p.id] ?? '') rights = rights.replace(key, '');
  };
  const relocate = (from: string, to: SquareName) => { const p = at(from); revoke(p); p.square = to; };
  const forward = (color: Color): [number, number] => {
    const sign = color === 'white' ? 1 : -1;
    return orientation === 0 ? [0, sign] : orientation === 90 ? [sign, 0] : [0, -sign];
  };
  const pawnThreat = (p: PieceState, target: number) => {
    const from = parseSquare(p.square!)!, [dx, dy] = forward(p.owner);
    const x = target % 8 - from % 8, y = Math.floor(target / 8) - Math.floor(from / 8);
    return dx ? x === dx && Math.abs(y) === 1 : y === dy && Math.abs(x) === 1;
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, label = rationales[index]!;
    assert.ok(label.startsWith(`${n} `));
    const before = structuredClone(state), actor = turn.color, action = step.action;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.to, /^[a-h][1-8]$/);
      assert.equal(turn.moveMade, false, label);
      const p = at(action.from), victim = pieces.find(p => p.square === action.to && p.zone === 'board');
      assert.equal(p.owner, actor, label);
      const from = parseSquare(action.from)!, to = parseSquare(action.to)!;
      let double = false;
      const pawn = p.role === 'pawn';
      if (pawn) {
        const [dx, dy] = forward(actor), distance = to - from, delta = dx + 8 * dy;
        if (victim) assert.ok(pawnThreat(p, to), label);
        else {
          assert.ok(distance === delta || distance === 2 * delta, label);
          double = distance === 2 * delta;
          if (double) {
            assert.equal(board().has(from + delta), false, label);
            // The only double moves are the two ordinary second-rank starts
            // and h5 on Black's newly rotated first rank.
            assert.ok([3, 5, 12].includes(n), label);
          }
        }
      } else assert.ok(attacks({ color: actor, role: p.role }, from, board().occupied).has(to), label);
      ep = double ? [{ target: makeSquare((from + to) / 2), pawnId: p.id }] : [];
      halfmoves = pawn || victim ? 0 : halfmoves + 1;
      if (victim) {
        assert.equal(victim.owner, opposite(actor), label);
        assert.equal(victim.royal, false, label);
        assert.notEqual(n >= 14 && n <= 15 ? victim.id : '', 'black-pawn-h7', label);
        revoke(victim); victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor;
      }
      relocate(action.from, action.to as SquareName);
      if (action.promotion) {
        assert.ok(pawn, label);
        assert.ok(['queen', 'rook', 'bishop', 'knight'].includes(String(action.promotion)), label);
        assert.equal(Number(orientation) === 90 ? action.to[0] : action.to[1], Number(orientation) === 90 ? 'h' : '8', label);
        p.role = action.promotion as Role; p.promoted = true;
      }
      fullmoves += actor === 'black' ? 1 : 0; fenActor = opposite(actor);
      turn.phase = 'afterMove'; turn.moveMade = true; moves++;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label);
      turn.color = opposite(actor); turn.phase = 'beforeMove'; turn.moveMade = false;
      turn.cardPlays = { white: 0, black: 0 };
      if (n === 16) effects = effects.filter(e => (e as { type: string }).type !== 'mystic-shield');
    } else if (action.type === 'playCard') {
      assert.equal(turn.cardPlays[actor], 0, label);
      const hand = players[actor].hand;
      const i = hand.findIndex(c => c.id === action.cardInstanceId && c.cardId === action.cardId);
      assert.ok(i >= 0, label);
      const card = hand.splice(i, 1)[0]!;
      const continuing = ['earthquake', 'confabulation'].includes(action.cardId);
      if (!continuing) players[actor].discard.push(card);
      hand.push(players[actor].deck.shift()!); turn.cardPlays[actor]++; cards++;
      const replacement = ['forced-march', 'confabulation', 'evangelists', 'lost-castle'].includes(action.cardId);
      assert.equal(turn.phase, replacement ? 'beforeMove' : 'afterMove', label);
      switch (action.cardId) {
        case 'earthquake': {
          orientation = n === 8 ? 90 : 180;
          const promotions = n === 8 ? [{ square: 'h2', role: 'rook' }, { square: 'a7', role: 'knight' }] : [{ square: 'c1', role: 'queen' }];
          const target = { direction: 'clockwise', promotions };
          assert.deepEqual(action.target, target, label);
          for (const promotion of promotions) { const p = at(promotion.square); assert.equal(p.role, 'pawn'); p.role = promotion.role as Role; p.promoted = true; }
          effects.push({ type: 'earthquake', owner: actor, card, direction: 'clockwise', target });
          break;
        }
        case 'mystic-shield':
          assert.equal(action.target, 'f5'); assert.equal(at('f5').id, 'black-pawn-h7');
          effects.push({ type: 'mystic-shield', owner: 'black', player: 'black', pieceId: 'black-pawn-h7' }); break;
        case 'forced-march':
          assert.deepEqual(action.target, [{ from: 'b2', to: 'b1' }, { from: 'g4', to: 'g5' }]);
          assert.equal(orientation, 90);
          for (const square of ['b1', 'g5']) assert.equal(board().has(parseSquare(square)!), false);
          relocate('b2', 'b1'); relocate('g4', 'g5'); halfmoves = 0; break;
        case 'confabulation': {
          assert.deepEqual(action.target, [{ from: 'g2', to: 'g1' }]);
          assert.equal(orientation, 180); assert.equal(at('g1').role, 'knight');
          const p = at('g2'); assert.equal(p.role, 'pawn'); assert.equal(p.owner, 'white');
          p.square = null; p.zone = 'away';
          effects.push({ type: 'confabulation', owner: 'white', card, pieceIds: ['white-knight-g1', 'white-pawn-f2'] });
          halfmoves = 0; break;
        }
        case 'evangelists': case 'lost-castle': {
          const own = action.cardId === 'evangelists' ? 'c8' : 'h1';
          const opponent = action.cardId === 'evangelists' ? 'b2' : 'd4';
          assert.deepEqual(action.target, { own, opponent });
          const a = at(own), b = at(opponent), role = action.cardId === 'evangelists' ? 'bishop' : 'rook';
          assert.equal(a.owner, actor); assert.equal(b.owner, opposite(actor));
          assert.equal(a.role, role); assert.equal(b.role, role);
          revoke(a); revoke(b); [a.square, b.square] = [b.square, a.square]; halfmoves++; break;
        }
        default: assert.fail(`unreviewed card ${action.cardId}`);
      }
      if (replacement) { ep = []; fullmoves += actor === 'black' ? 1 : 0; fenActor = opposite(actor); turn.phase = 'afterMove'; turn.moveMade = true; }
    } else assert.fail(`unreviewed action ${action.type}`);
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${label}: complete structuredClone input immutability`);
    assert.equal(result.ok, true, label); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: all physical identities, roles, zones and capture actors`);
    assert.deepEqual(state.players, players, `${label}: complete card hands, decks and discards`);
    assert.deepEqual(state.turn, turn, `${label}: turn and card allowance`);
    assert.deepEqual(state.effects, effects, `${label}: retained cards and temporary protection`);
    assert.deepEqual(state.enPassant, ep, `${label}: exact physical EP victims`);
    assert.equal(state.orientation, orientation, label);
    // No orthodox FEN EP capture is available at the three double steps;
    // orientation-90 opportunities are represented only by physical EP records.
    assert.equal(state.fen, `${makeBoardFen(board())} ${fenActor[0]} ${rights || '-'} - ${halfmoves} ${fullmoves}`, label);
    assert.equal(state.outcome, null, label);
    for (const color of ['white', 'black'] as const) {
      const king = pieces.find(p => p.royal && p.owner === color)!;
      const target = parseSquare(king.square!)!;
      const checkers = pieces.filter(p => p.square && p.owner !== color && (p.role === 'pawn'
        ? pawnThreat(p, target)
        : attacks({ color: p.owner, role: p.role }, parseSquare(p.square)!, board().occupied).has(target))).map(p => p.id);
      // The composite's second component is a south-facing Pawn on g1:
      // both capture destinations are off-board, so it adds no royal threat.
      const expected = color === 'white' && [45, 46].includes(n) ? ['black-knight-b8']
        : color === 'black' && [59, 60, 61].includes(n) ? ['white-pawn-h2'] : [];
      assert.deepEqual(checkers, expected, `${label}: independent ${color} royal threats`);
      assert.equal(isKingInCheck(state, color), expected.length > 0, `${label}: public ${color} check`);
    }
    assert.equal(state.pendingRescue ?? null, null, label);
    assert.equal(state.pendingDoomsayer ?? null, null, label);
    assert.equal(state.pendingAbduction ?? null, null, label);
    assert.deepEqual(state.underElfHill ?? [], [], label);
    assert.deepEqual(state.plotsAllowances ?? [], [], label);
  }
  assert.equal(moves, 50); assert.equal(cards, 7);
  assert.equal(state.fen, '2q2k2/1pp1pp1B/4p2n/1n2R3/R2q3Q/2N3r1/1QPP1P2/b2Q1KNr w - - 8 28');
  assert.equal(replayTrace(trace).fen, state.fen);
});
