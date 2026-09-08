import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/126.json', import.meta.url), 'utf8')) as RandomTrace;
// Reviewed against rules §§8, 11, 13.10, 16.3, 17.1, 20, 22.4 and the
// eleven printed cards: KC18/3, KC16/1, KC3/4, KC3/2, KC17/3, KC2/3,
// KC15/1, KC11/2, KC17/1, KC20/1, KC15/3. No Continuing Effects occur.
const rationales = `
1 Knight b1-c3 jumps to an empty square.
2 White ends the completed move; Black begins with fresh allowances.
3 Black pawn g7-g6 advances one empty square.
4 Black ends; White begins, without physical changes.
5 Knight c3-b1 makes the reverse legal jump.
6 White ends; Black begins, retaining the board.
7 Black pawn c7-c6 advances one empty square.
8 Black ends; White begins.
9 White pawn f2-f3 advances one empty square.
10 White ends; Black begins.
11 Bishop f8-h6 slides through vacated g7.
12 Mystic Shield protects the just-moved h6 bishop for White's next turn; discard and draw Siege.
13 Black ends; protection persists into White's turn.
14 Bombard moves rook a1-a6 over exactly the a2 pawn; a3-a5 are empty; revoke Q, draw Guardian.
15 White ends; the shield's opponent-turn duration expires.
16 Squaring the Circle relocates e7 pawn to sole empty corner a1; other corners occupied; no promotion; draw Cathedral.
17 Black ends the replacement move.
18 Rook a6-a5 slides one empty square.
19 White ends; Black begins.
20 Queen d8-b6 slides through empty c7.
21 Black ends; White begins.
22 Knight g1-h3 jumps to an empty square.
23 White ends; Black begins.
24 Pawn d7-d5 double-steps through empty d6; EP opportunity d6 exists, no adjacent white pawn can use it.
25 Black ends, retaining that EP opportunity for White.
26 Madman jumps g2-e4 over own f3 pawn without capture; expire d6 EP; draw Chaos.
27 White ends the replacement move.
28 Bishop c8-d7 moves diagonally to the vacated square.
29 Black ends; White begins.
30 Pawn a2-a3 advances one square.
31 White ends; Black begins.
32 Bishop d7-h3 crosses e6,f5,g4 and captures white g1 knight; Black is captor.
33 Black ends; captured knight remains captured.
34 Rook a5-a6 moves one empty square.
35 White ends; Black begins.
36 Pawn d5-d4 advances one empty square.
37 Black ends; White begins.
38 Evil Eye lets a6 rook capture adjacent b6 queen while staying a6; White is captor; draw Doppelganger.
39 White ends the replacement move; queen remains captured.
40 Bishop h3-g2 moves one empty diagonal square.
41 Black ends; White begins.
42 Rook a6-a5 slides one empty square.
43 White ends; Black begins.
44 Pawn b7-b5 double-steps through b6; EP b6 is recorded but no adjacent white pawn can capture.
45 Black ends, retaining EP for White.
46 Pawn a3-a4 moves forward; the b6 EP opportunity expires.
47 White ends; Black begins.
48 King e8-e7 moves to a safe adjacent square; revoke both black castling rights.
49 Black ends; White begins.
50 Guardian advances h2-h4 through h3, then h1 rook follows to h3; no EP; revoke K; draw Haunting Memories.
51 White ends the replacement move.
52 Bishop g2-f3 captures white f2 pawn; Black is captor.
53 Black ends; pawn remains captured.
54 Rook a5-a6 slides one empty square.
55 White ends; Black begins.
56 Pawn d4-d3 advances one empty square.
57 Siege swaps black g8 knight and a8 rook after the move, preserving identities and clocks; draw Evangelists.
58 Black ends; White begins.
59 Pawn c2-c3 advances one empty square.
60 White ends; Black begins.
61 The original a8 rook slides g8-f8 one square.
62 Black ends; White begins.
63 The original g2 pawn advances e4-e5.
64 White ends; Black begins.
65 Knight b8-a6 captures white a1 rook; Black is captor.
66 Black ends; rook remains captured.
67 Bishop f1-g2 moves one empty diagonal square.
68 White ends; Black begins.
69 Evangelists swaps black f3 bishop and white c1 bishop instead of a move; identities persist; draw Under Elf Hill.
70 Black ends the replacement move.
71 Pawn a4-b5 captures black b7 pawn diagonally; White is captor.
72 White ends; black pawn remains captured.
73 Pawn d3-e2 captures white e2 pawn diagonally; Black is captor.
74 Black ends; white pawn remains captured.
75 White original c1 bishop slides f3-c6 through e4,d5 and captures black c7 pawn; White is captor.
76 White ends; captured pawn remains captured.
77 King e7-e6 moves to a safe adjacent square.
78 Black ends; White begins.
79 White h1 rook slides h3-h1 through vacant h2; castling rights stay lost.
80 White ends; Black begins.
81 King e6-e7 returns to a safe adjacent square.
82 Treason swaps white h1 rook and b1 knight after Black's move; preserve clocks and identities; draw Riposte.
83 Black ends; White begins.
84 Bishop c6-d5 moves one empty diagonal square.
85 White ends; Black begins.
86 Pawn g6-g5 advances one empty square.
87 Black ends; White begins.
88 King e1-f2 moves to a safe empty diagonal square; black e2 pawn attacks d1/f1, not f2.
89 White ends; Black begins.
90 Black original a8 rook slides f8-c8 through e8,d8.
91 Knightmare cancels that rook move, restores f8 and pre-move clocks, keeps Black active and bans repetition; draw Tournament.
92 Black chooses a different move: h8 rook slides to g8; cancellation allowance remains spent.
93 Black ends; fresh allowances for White.
94 King f2-g1 moves to a safe adjacent square.
95 White ends; Black begins.
96 Original g8 knight jumps a8-c7 to empty c7.
97 Black ends; White begins.
98 Pawn d2-d3 advances into vacant d3.
99 White ends; Black begins.
100 Under Elf Hill removes black King e7 to away instead of a move, retaining identity; draw Fanatic.
101 Black ends; King remains away during White's turn.
102 Queen d1-f1 slides through vacant e1; absent black King gives no check.
103 White ends; Black must return the King before moving.
104 King returns to empty safe edge h5; h4 pawn attacks g5, not h5; no clock advance and King cannot move this turn.
105 Black uses a different piece: original b8 knight jumps a6-c5; returned King stays immobile.
106 Black ends; the returned King's movement restriction expires.
107 Original b1 knight jumps h1-f2 to an empty square.
108 White ends; Black begins.
109 Original g8 knight jumps c7-e6 to an empty square.
110 Black ends; White begins.
111 Original h1 rook slides b1-c1, capturing black original c8 bishop; White is captor.
112 White ends; bishop remains captured.
113 Black original a8 rook slides f8-e8 one empty square.
114 Black ends; White begins.
115 White original c1 bishop captures original g8 knight d5-e6; White is captor.
116 White ends; knight remains captured.
117 Black original b8 knight jumps c5-a4 to empty a4.
118 Black ends; White begins with both royals safe and no pending choice.
`.trim().split('\n');

// Independent physical move ledger: step, from, to, captured original identity.
const ordinary = `1 b1 c3;3 g7 g6;5 c3 b1;7 c7 c6;9 f2 f3;11 f8 h6;
18 a6 a5;20 d8 b6;22 g1 h3;24 d7 d5;28 c8 d7;30 a2 a3;
32 d7 h3 white-knight-g1;34 a5 a6;36 d5 d4;40 h3 g2;42 a6 a5;44 b7 b5;
46 a3 a4;48 e8 e7;52 g2 f3 white-pawn-f2;54 a5 a6;56 d4 d3;59 c2 c3;
61 g8 f8;63 e4 e5;65 b8 a6 white-rook-a1;67 f1 g2;
71 a4 b5 black-pawn-b7;73 d3 e2 white-pawn-e2;75 f3 c6 black-pawn-c7;
77 e7 e6;79 h3 h1;81 e6 e7;84 c6 d5;86 g6 g5;88 e1 f2;90 f8 c8;
92 h8 g8;94 f2 g1;96 a8 c7;98 d2 d3;102 d1 f1;105 a6 c5;
107 h1 f2;109 c7 e6;111 b1 c1 black-bishop-c8;113 f8 e8;
115 d5 e6 black-knight-g8;117 c5 a4`.split(';').map(line => line.trim().split(/\s+/));

const cards: Record<number, [Color, string, string]> = {
  12: ['black', 'mystic-shield', 'siege'], 14: ['white', 'bombard', 'guardian'],
  16: ['black', 'squaring-the-circle', 'cathedral'], 26: ['white', 'madman', 'chaos'],
  38: ['white', 'evil-eye', 'doppelganger'], 50: ['white', 'guardian', 'haunting-memories'],
  57: ['black', 'siege', 'evangelists'], 69: ['black', 'evangelists', 'under-elf-hill'],
  82: ['black', 'treason', 'riposte'], 91: ['white', 'knightmare', 'tournament'],
  100: ['black', 'under-elf-hill', 'fanatic'],
};

function boardFen(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '';
    for (const file of 'abcdefgh') {
      const p = pieces.find(piece => piece.square === `${file}${8 - rank}`);
      row += p ? p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role] : '1';
    }
    return row.replace(/1+/g, empty => String(empty.length));
  }).join('/');
}

function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const from = piece.square!;
  const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = Number(to[1]) - Number(from[1]);
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    return dx === 0 && (dy === forward || dy === 2 * forward && from[1] === (forward === 1 ? '2' : '7')
      && !pieces.some(p => p.square === `${from[0]}${Number(from[1]) + forward}`));
  }
  const diagonal = ax === ay && ax > 0, straight = (dx === 0) !== (dy === 0);
  if (!(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let n = 1; n < Math.max(ax, ay); n++) {
    const square = `${String.fromCharCode(from.charCodeAt(0) + n * Math.sign(dx))}${Number(from[1]) + n * Math.sign(dy)}`;
    if (pieces.some(p => p.square === square)) return false;
  }
  return true;
}

test('iteration 126: every action has independent physical, card, phase, clock and royal expectations', () => {
  assert.equal(trace.seed, 860126);
  assert.equal(trace.steps.length, 118);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(ordinary.length, 50);
  let state = createGameState(trace.initial);
  // Construct original identities from the standard position, independently of reducer output.
  const pieces: PieceState[] = [];
  for (const owner of ['white', 'black'] as const) {
    for (const [file, role] of ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'].entries()) {
      for (const pawn of [false, true]) {
        const square = `${'abcdefgh'[file]}${owner === 'white' ? pawn ? 2 : 1 : pawn ? 7 : 8}` as SquareName;
        const current = (pawn ? 'pawn' : role) as PieceState['role'];
        pieces.push({ id: `${owner}-${current}-${square}`, owner, role: current, originalRole: current,
          square, zone: 'board', promoted: false, royal: current === 'king', neutral: false });
      }
    }
  }
  const player = (color: Color): GameState['players'][Color] => ({
    hand: trace.initial.hands![color]!.map((cardId, i) => ({ id: `${color}-hand-${i}-${cardId}`, cardId })),
    deck: trace.initial.decks![color]!.map((cardId, i) => ({ id: `${color}-deck-${i}-${cardId}`, cardId })), discard: [],
  });
  const players = { white: player('white'), black: player('black') };
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let half = 0, full = 1, fenTurn = 'w';
  const at = (square: string) => { const p = pieces.find(p => p.square === square); assert.ok(p, square); return p; };
  const relocate = (from: string, to: string) => { assert.match(to, /^[a-h][1-8]$/); at(from).square = to as SquareName; };
  const capture = (id: string, captor: Color) => {
    const victim = pieces.find(p => p.id === id); assert.ok(victim); assert.equal(victim.zone, 'board');
    victim.square = null; victim.zone = 'captured'; victim.capturedBy = captor;
  };
  const swap = (a: string, b: string) => { const first = at(a), second = at(b); [first.square, second.square] = [second.square, first.square]; };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, label = rationales[index]!;
    assert.ok(label.startsWith(`${n} `));
    let moves = false, resets = false;
    const row = ordinary.find(row => Number(row[0]) === n);
    if (row) {
      assert.equal(action.type, 'move');
      assert.ok(action.type === 'move');
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.deepEqual([action.from, action.to, action.promotion], [row[1], row[2], undefined], label);
      const mover = at(row[1]!);
      assert.equal(mover.owner, turn.color, label);
      assert.ok(reaches(pieces, mover, row[2]!, !!row[3]), label);
      resets = mover.role === 'pawn' || !!row[3];
      if (row[3]) { assert.equal(at(row[2]!).id, row[3]); capture(row[3], turn.color); }
      else assert.ok(!pieces.some(p => p.square === row[2]), label);
      relocate(row[1]!, row[2]!); moves = true;
    } else if (cards[n]) {
      const [color, cardId, draw] = cards[n];
      assert.ok(action.type === 'playCard'); assert.equal(action.cardId, cardId);
      const zone = players[color];
      const cardIndex = zone.hand.findIndex(card => card.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0); assert.equal(zone.hand[cardIndex]!.cardId, cardId);
      zone.discard.push(...zone.hand.splice(cardIndex, 1));
      const nextCard = zone.deck.shift()!; assert.equal(nextCard.cardId, draw); zone.hand.push(nextCard);
      turn.cardPlays[color]++;
      switch (n) {
        case 12: assert.equal(at('h6').id, 'black-bishop-f8'); break;
        case 14: relocate('a1', 'a6'); moves = true; break;
        case 16: relocate('e7', 'a1'); moves = resets = true; break;
        case 26: assert.equal(at('f3').id, 'white-pawn-f2'); relocate('g2', 'e4'); moves = resets = true; break;
        case 38: assert.ok(reaches(pieces, at('a6'), 'b6', true)); capture('black-queen-d8', 'white'); moves = resets = true; break;
        case 50: relocate('h2', 'h4'); relocate('h1', 'h3'); moves = resets = true; break;
        case 57: swap('g8', 'a8'); break;
        case 69: swap('f3', 'c1'); moves = true; break;
        case 82: swap('h1', 'b1'); break;
        case 91:
          relocate('c8', 'f8'); half--; full--; fenTurn = 'b';
          turn.phase = 'beforeMove'; turn.moveMade = false; break;
        case 100: { const king = at('e7'); king.square = null; king.zone = 'away'; moves = true; break; }
      }
    } else if (n === 104) {
      assert.deepEqual(action, { type: 'returnKing', to: 'h5' });
      const king = pieces.find(p => p.id === 'black-king-e8')!;
      assert.equal(king.zone, 'away'); king.square = 'h5'; king.zone = 'board';
    } else {
      assert.equal(action.type, 'endTurn', label); assert.equal(turn.moveMade, true, label);
      turn = { color: turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    }
    if (moves) {
      half = resets ? 0 : half + 1; if (turn.color === 'black') full++;
      fenTurn = turn.color === 'white' ? 'b' : 'w'; turn.phase = 'afterMove'; turn.moveMade = true;
    }
    const original = structuredClone(state), originalAction = structuredClone(action);
    const result = applyAction(state, action);
    assert.deepEqual(state, original, `${label}: complete input immutability`);
    assert.deepEqual(action, originalAction, `${label}: action immutability`);
    assert.ok(result.ok, label); state = result.state;
    const sorted = (items: PieceState[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(sorted(state.pieces), sorted(pieces), `${label}: complete physical identities/zones/captors`);
    assert.deepEqual(state.players, players, `${label}: complete card zones`);
    assert.deepEqual(state.turn, turn, `${label}: turn and allowances`);
    assert.deepEqual(state.effects, n >= 12 && n < 15 ? [{ type: 'mystic-shield', owner: 'black', player: 'black', pieceId: 'black-bishop-f8' }] : [], label);
    assert.equal(state.fen, `${boardFen(pieces)} ${fenTurn} ${n < 14 ? 'KQkq' : n < 48 ? 'Kkq' : n < 50 ? 'K' : '-'} - ${half} ${full}`, label);
    assert.deepEqual(state.enPassant, n === 24 || n === 25 ? [{ target: 'd6', pawnId: 'black-pawn-d7' }]
      : n === 44 || n === 45 ? [{ target: 'b6', pawnId: 'black-pawn-b7' }] : [], label);
    assert.equal(state.pendingRescue ?? null, null, label);
    assert.equal(state.pendingAbduction ?? null, null, label);
    assert.equal(state.pendingDoomsayer ?? null, null, label);
    assert.deepEqual(state.underElfHill ?? [], n >= 100 && n <= 105
      ? [{ pieceId: 'black-king-e8', player: 'black', returning: n >= 103, ...(n >= 104 ? { returned: true } : {}) }] : [], label);
    assert.deepEqual(state.chaosForbidden, n === 91 ? { player: 'black', movement: 'black-rook-a8:f8:c8' } : undefined, label);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    assert.deepEqual(state.plotsAllowances ?? [], []); assert.deepEqual(state.riposteLostMoves ?? [], []);
    for (const color of ['white', 'black'] as const) {
      const king = pieces.find(p => p.owner === color && p.royal)!;
      const attackers = king.square ? pieces.filter(p => p.owner !== color && p.zone === 'board'
        && !(n === 104 || n === 105 ? p.id === 'black-king-e8' : false)
        && reaches(pieces, p, king.square!, true)) : [];
      assert.deepEqual(attackers, [], `${label}: independent ${color} royal safety`);
      assert.equal(isKingInCheck(state, color), false, `${label}: engine ${color} check`);
    }
  }
  assert.equal(state.fen, '4r1r1/p4p1p/4B2b/1P2P1pk/n6P/2PP4/1P2pNB1/p1R2QK1 w - - 1 29');
  assert.equal(replayTrace(trace).fen, state.fen);
});
