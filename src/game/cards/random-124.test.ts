import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Board } from 'chessops/board';
import { attacks } from 'chessops/attacks';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in order against rules §§8–11 and the twelve printed
// card images named by catalog metadata. Each line is one reviewed action.
const rationales = `
1 d2-d3: White Pawn advances to the empty adjacent square.
2 White ends its completed move; Black receives a fresh allowance.
3 a7-a6: Black Pawn advances one empty square.
4 Black ends its completed move; White receives a fresh allowance.
5 b1-d2: White Knight jumps to the square vacated at 1.
6 White ends after its Knight move.
7 c7-c5: Black Pawn crosses empty c6; c6 is the EP target.
8 Black ends; the c6 EP opportunity survives into White's turn.
9 g1-f3: White Knight jumps to empty f3; the old EP expires.
10 White ends after its Knight move.
11 c5-c4: Black Pawn advances to empty c4.
12 Black ends after its Pawn move.
13 h1-g1: White Rook moves one file; kingside rights are lost.
14 White ends after its Rook move.
15 f7-f6: Black Pawn advances one square.
16 Black ends after its Pawn move.
17 g1-h1: White Rook returns; lost castling rights do not return.
18 White ends after its Rook move.
19 d8-c7: Black Queen moves one diagonal square.
20 Black ends after its Queen move.
21 a2-a4: White Pawn crosses empty a3; records a3 EP.
22 White ends with the a3 EP opportunity available.
23 g7-g6: Black Pawn advances and expires a3 EP.
24 Black ends after its Pawn move.
25 b2-b4: White Pawn crosses b3; Black c4 Pawn can capture EP.
26 White ends with b3 EP available to Black.
27 c7-g3: Queen traverses empty d6/e5/f4; does not capture.
28 Black ends after its Queen move; b3 EP has expired.
29 c1-b2: White Bishop enters the vacated Pawn square.
30 White ends after its Bishop move.
31 b8-c6: Black Knight makes an ordinary jump.
32 Black ends after its Knight move.
33 d2xc4: White Knight captures Black's original c7 Pawn.
34 White ends after its capture.
35 d7-d5: Black Pawn crosses d6 and records d6 EP.
36 Challenge after Black's move names White f2 Pawn; fxg3 is legal.
37 Black ends; Challenge remains for White's next move.
38 f2xg3: Named Pawn captures the Black Queen, fulfilling Challenge.
39 White ends; Challenge and old EP have expired.
40 d5-d4: Black Pawn advances to empty d4.
41 Black ends after its Pawn move.
42 f3xd4: White Knight captures Black's original d7 Pawn.
43 White ends after its capture.
44 h7-h5: Black Pawn crosses h6 and records h6 EP.
45 Black ends with h6 EP available.
46 d4-f5: White Knight jumps to empty f5; EP expires.
47 White ends after its Knight move.
48 Hidden Passage replaces Black's move: e8 King jumps to safe empty e6.
49 Black ends; moving its King permanently lost both castling rights.
50 e2-e3: White Pawn advances to empty e3.
51 White ends after its Pawn move.
52 c6-d8: Black Knight jumps to the vacated Queen square.
53 Black ends after its Knight move.
54 c4-d6: White Knight jumps to empty d6.
55 White ends after its Knight move.
56 g8-h6: Black Knight jumps to empty h6.
57 Figure Dance simultaneously rotates all four Rooks a1-h1-h8-a8-a1; no capture.
58 Black ends; Figure Dance lost the remaining White queenside rights.
59 a4-a5: White Pawn advances to empty a5.
60 White ends after its Pawn move.
61 e6xd6: Black King captures the Knight but is attacked by f5 Knight; rescue required.
62 Treason swaps enemy h8 Rook/f5 Knight after Black's move, removing the d6 attack.
63 Black may end only after Treason has cured its King's check.
64 h1-g1: Original a1 Rook moves one empty file.
65 White ends after its Rook move.
66 Breakthrough replaces Black's move: a6 Pawn captures the White Pawn straight ahead on a5.
67 Black ends after its replacement capture.
68 h8xg6: White Knight captures Black's original g7 Pawn.
69 White ends after its Knight capture.
70 Disintegration before Black's move makes its e7 Pawn dead, without capture or move use.
71 h5-h4: Black retains and uses its normal move after Disintegration.
72 Black ends with its single card allowance spent.
73 f1-e2: White Bishop moves one empty diagonal square.
74 White ends after its Bishop move.
75 a1xd1: Black Rook crosses b1/c1, captures White Queen and checks e1 King.
76 Black ends; White receives its turn in check.
77 e2xd1: White Bishop captures the checking Rook and cures the check.
78 No Quarter after that ordinary capture makes only Black's original a8 Rook dead.
79 White ends after its capture and No Quarter.
80 d6-c7: Black King steps diagonally to a safe empty square.
81 Black ends after its King move.
82 Evil Eye replaces White's move: f5 Rook threatens a5 along e5/d5/c5/b5; Pawn captured, Rook stays.
83 White ends after its replacement capture.
84 f8-d6: Black Bishop crosses vacant e7 to empty d6.
85 Black ends after its Bishop move.
86 g6-f4: White Knight makes an ordinary jump.
87 White ends after its Knight move.
88 b7-b6: Black Pawn advances one empty square.
89 Black ends after its Pawn move.
90 Sanctuary replaces White's move: clear f1 permits e1 King-g1 and g1 Rook-f1 despite prior moves.
91 White ends after Sanctuary; both royal positions are safe.
92 c8xf5: Black Bishop crosses d7/e6 and captures White's original h1 Rook.
93 Black ends after its Bishop capture.
94 f4-h3: White Knight jumps to empty h3.
95 White ends after its Knight move.
96 a8-c8: Black's original h8 Rook crosses empty b8 to empty c8.
97 Black ends after its Rook move.
98 e3-e4: White Pawn advances one empty square.
99 White ends after its Pawn move.
100 c7-b8: Black King steps diagonally to a safe empty square.
101 Black ends after its King move.
102 g1-f2: White King steps diagonally to safe empty f2.
103 White ends after its King move.
104 Bombard replaces Black's move: c8 Rook jumps d8 Knight, crosses empty e8/f8, lands g8.
105 Black ends after its replacement Rook move.
106 b2-c1: White Bishop moves one diagonal square.
107 Plots after White's move grants two immediate uses; only existing Holy War/Cowardice qualify.
108 White declines both optional Plots uses by ending; new Anathema was never eligible.
109 d6-e5: Black Bishop moves one diagonal square.
110 Black ends after its Bishop move.
111 d3-d4: White Pawn advances one empty square.
112 White ends after its Pawn move.
113 e5xg3: Black Bishop crosses empty f4, captures original White f2 Pawn, checks f2 King.
114 Black ends; White receives its turn in check.
115 c1-b2: White Bishop moves while its King remains checked by g3 Bishop; rescue required.
116 Anathema swaps Black g3 Bishop/g8 Rook after White's move; f2 King is no longer attacked.
117 White ends only after Anathema has cured its King's check.
`.trim().split('\n');

test('iteration 124: independently reviewed physical, card, clock and royal state', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/124.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860124);
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  const turn = structuredClone(state.turn);
  let ep: GameState['enPassant'] = [];
  let halfmoves = 0, fullmoves = 1, rights = 'KQkq';
  let fenActor: Color = 'white';
  let effects: unknown[] = [];
  const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
  const at = (square: string) => {
    const piece = pieces.find(p => p.square === square && p.zone === 'board');
    assert.ok(piece, `expected occupant at ${square}`);
    return piece;
  };
  const revoke = (piece: PieceState) => {
    const keys: Record<string, string> = { 'white-king-e1': 'KQ', 'black-king-e8': 'kq',
      'white-rook-a1': 'Q', 'white-rook-h1': 'K', 'black-rook-a8': 'q', 'black-rook-h8': 'k' };
    for (const key of keys[piece.id] ?? '') rights = rights.replace(key, '');
  };
  const remove = (piece: PieceState, zone: 'captured' | 'dead', actor: Color) => {
    assert.equal(piece.royal, false);
    revoke(piece);
    piece.square = null;
    piece.zone = zone;
    if (zone === 'captured') piece.capturedBy = actor;
    else delete piece.capturedBy;
  };
  const relocate = (from: string, to: SquareName) => {
    const piece = at(from);
    revoke(piece);
    piece.square = to;
  };
  const swap = (a: string, b: string) => {
    const first = at(a), second = at(b);
    revoke(first); revoke(second);
    [first.square, second.square] = [second.square, first.square];
  };
  const board = () => {
    const result = Board.empty();
    for (const p of pieces) if (p.square) result.set(parseSquare(p.square)!, { color: p.owner, role: p.role });
    return result;
  };
  let moves = 0, cards = 0;
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationales[index]!.startsWith(`${n} `));
    const label = rationales[index]!;
    const before = structuredClone(state);
    const action = step.action;
    const actor = turn.color;
    let movedId: string | undefined;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.to, /^[a-h][1-8]$/);
      assert.equal(turn.moveMade, false, label);
      const piece = at(action.from);
      assert.equal(piece.owner, actor, label);
      movedId = piece.id;
      const from = parseSquare(action.from)!, to = parseSquare(action.to)!;
      const victim = pieces.find(p => p.square === action.to && p.zone === 'board');
      if (victim) assert.equal(victim.owner, opposite(actor), label);
      if (piece.role === 'pawn') {
        const direction = actor === 'white' ? 8 : -8;
        if (victim) assert.ok(to - from === direction - 1 || to - from === direction + 1, label);
        else {
          assert.ok(to - from === direction || to - from === direction * 2, label);
          if (to - from === direction * 2) {
            assert.equal(Math.floor(from / 8), actor === 'white' ? 1 : 6, label);
            assert.equal(board().has(from + direction), false, label);
          }
        }
      } else assert.ok(attacks({ color: actor, role: piece.role }, from, board().occupied).has(to), label);
      if (n === 38) assert.equal(piece.id, 'white-pawn-f2', label);
      const double = piece.role === 'pawn' && Math.abs(to - from) === 16;
      ep = double ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: piece.id }] : [];
      halfmoves = victim || piece.role === 'pawn' ? 0 : halfmoves + 1;
      if (victim) remove(victim, 'captured', actor);
      relocate(action.from, action.to as SquareName);
      fullmoves += actor === 'black' ? 1 : 0;
      fenActor = opposite(actor);
      turn.phase = 'afterMove'; turn.moveMade = true;
      if (n === 38) effects = [];
      moves++;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label);
      turn.color = opposite(actor); turn.phase = 'beforeMove'; turn.moveMade = false;
      turn.cardPlays = { white: 0, black: 0 };
    } else if (action.type === 'playCard') {
      assert.equal(turn.cardPlays[actor], 0, label);
      const hand = players[actor].hand;
      const cardIndex = hand.findIndex(card => card.id === action.cardInstanceId && card.cardId === action.cardId);
      assert.ok(cardIndex >= 0, label);
      const [card] = hand.splice(cardIndex, 1);
      players[actor].discard.push(card!);
      hand.push(players[actor].deck.shift()!);
      turn.cardPlays[actor]++;
      const replacement = ['hidden-passage', 'breakthrough', 'evil-eye', 'sanctuary', 'bombard'].includes(action.cardId);
      assert.equal(turn.phase, replacement || action.cardId === 'disintegration' ? 'beforeMove' : 'afterMove', label);
      switch (action.cardId) {
        case 'challenge':
          assert.equal(at('f2').role, 'pawn');
          assert.equal(at('g3').owner, 'black');
          effects = [{ type: 'challenge', owner: 'black', player: 'white', pieceId: 'white-pawn-f2' }];
          break;
        case 'hidden-passage': relocate('e8', 'e6'); halfmoves++; break;
        case 'figure-dance': {
          const destinations: Record<string, SquareName> = { a1: 'h1', h1: 'h8', h8: 'a8', a8: 'a1' };
          const corners = ['a1', 'h1', 'h8', 'a8'].map(at);
          for (const piece of corners) { revoke(piece); piece.square = destinations[piece.square!]!; }
          break;
        }
        case 'treason': swap('h8', 'f5'); break;
        case 'breakthrough': remove(at('a5'), 'captured', actor); relocate('a6', 'a5'); halfmoves = 0; break;
        case 'disintegration': remove(at('e7'), 'dead', actor); break;
        case 'no-quarter': {
          const victim = pieces.find(p => p.id === 'black-rook-a8')!;
          assert.equal(victim.zone, 'captured'); assert.equal(victim.capturedBy, 'white');
          remove(victim, 'dead', actor); break;
        }
        case 'evil-eye':
          assert.ok(attacks({ color: 'white', role: 'rook' }, parseSquare('f5')!, board().occupied).has(parseSquare('a5')!));
          remove(at('a5'), 'captured', actor); halfmoves = 0; break;
        case 'sanctuary':
          assert.equal(board().has(parseSquare('f1')!), false);
          relocate('g1', 'f1'); relocate('e1', 'g1'); halfmoves++; break;
        case 'bombard':
          assert.equal(at('d8').role, 'knight');
          for (const square of ['e8', 'f8', 'g8']) assert.equal(board().has(parseSquare(square)!), false);
          relocate('c8', 'g8'); halfmoves++; break;
        case 'plots-within-plots': break;
        case 'anathema': swap('g3', 'g8'); break;
        default: assert.fail(`unreviewed card ${action.cardId}`);
      }
      if (replacement) {
        ep = []; fullmoves += actor === 'black' ? 1 : 0;
        fenActor = opposite(actor); turn.phase = 'afterMove'; turn.moveMade = true;
      }
      cards++;
    } else assert.fail(`unreviewed action ${action.type}`);

    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${label}: complete input immutability`);
    assert.equal(result.ok, true, label);
    state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: every physical identity including unchanged and removed pieces`);
    assert.deepEqual(state.players, players, `${label}: every physical card in hand/deck/discard`);
    assert.deepEqual(state.turn, turn, `${label}: turn and card allowance`);
    assert.deepEqual(state.effects, effects, `${label}: exact effects`);
    assert.deepEqual(state.enPassant, ep, `${label}: physical EP victims`);
    const expectedFenEp = n === 25 || n === 26 ? 'b3' : '-';
    assert.equal(state.fen, `${makeBoardFen(board())} ${fenActor[0]} ${rights || '-'} ${expectedFenEp} ${halfmoves} ${fullmoves}`, label);
    assert.equal(state.orientation, 0, label);
    assert.equal(state.outcome, null, label);
    for (const color of ['white', 'black'] as const) {
      const king = pieces.find(p => p.royal && p.owner === color)!;
      const checkers = pieces.filter(p => p.square && p.owner !== color &&
        attacks({ color: p.owner, role: p.role }, parseSquare(p.square)!, board().occupied).has(parseSquare(king.square!)!)).map(p => p.id);
      const expected = n === 61 && color === 'black' ? ['white-knight-g1']
        : [75, 76].includes(n) && color === 'white' ? ['black-rook-a8']
        : [113, 114, 115].includes(n) && color === 'white' ? ['black-bishop-f8'] : [];
      assert.deepEqual(checkers, expected, `${label}: independent royal threats for ${color}`);
    }
    if ([61, 115].includes(n)) {
      assert.deepEqual(state.pendingRescue, { before, fen: before.fen, pieces: before.pieces,
        enPassant: before.enPassant, historyLength: before.history.length, movedPieceIds: [movedId] }, label);
    } else assert.equal(state.pendingRescue ?? null, null, label);
    assert.equal(state.pendingDoomsayer ?? null, null, label);
    assert.equal(state.pendingAbduction ?? null, null, label);
    assert.deepEqual(state.underElfHill ?? [], [], label);
    if (n === 107) {
      assert.deepEqual(state.plotsAllowances, [{ player: 'white', remaining: 2,
        eligibleCards: ['white-hand-0-holy-war', 'white-deck-1-cowardice'],
        window: { phase: 'afterMove', moveMade: true,
          capture: undefined, cardResponse: undefined, fogCheckpoint: undefined, legacyCapture: undefined,
          shieldMove: { player: 'white', pieceIds: ['white-bishop-c1'], capturedOpponent: false },
          reaction: { type: 'move', from: 'b2', to: 'c1' } } }], label);
    } else assert.deepEqual(state.plotsAllowances ?? [], [], label);
  }
  assert.equal(moves, 50); assert.equal(cards, 12);
  assert.equal(state.fen, '1k1n2b1/8/1p3p1n/5b2/1P1PP2p/6rN/1BP2KPP/3B1R2 b - - 1 28');
  assert.equal(parseFen(state.fen).unwrap().fullmoves, 28);
  assert.equal(replayTrace(trace).fen, state.fen);
});
