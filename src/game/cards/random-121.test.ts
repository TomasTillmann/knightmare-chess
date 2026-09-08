import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { makeFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { Board } from 'chessops/board';

// Ordered review from rules.md §§8–13, 17–20, cards.md, and the sixteen played
// cards' artwork in final_cards. Each line describes this particular action.
const rationales = `
1 Pawn b2-b3 advances into empty b3; pawn clock resets.
2 White ends; Black receives fresh allowances, board and clocks remain.
3 Pawn h7-h5 traverses empty h6; h6 en-passant opportunity is recorded.
4 Black ends; White inherits the h6 opportunity.
5 Pawn f2-f4 traverses empty f3 and replaces h6 with f3 en passant.
6 White challenges movable Black Knight b8 after moving; passive marker preserves f3.
7 White ends; Challenge obligates Black to use physical Knight b8.
8 Assassin replaces Black move: Knight b8-d7 captures its own d7 Pawn, satisfies Challenge, clears en passant.
9 Black ends after Assassin; captured d7 Pawn belongs to Black and was captured by Black.
10 White Knight g1-h3 jumps to empty h3.
11 Black uses any-time Plots after White move; none of its other four cards has opponent-move timing, so saved eligibility is empty.
12 White ends; unused two-card Plots allowance expires.
13 Black Knight d7-b8 returns by L jump; d7 Pawn stays captured.
14 Black ends with unchanged board and clocks.
15 White Pawn g2-g3 advances one into empty g3.
16 White ends; both allowances reset.
17 Black Knight g8-h6 jumps to empty h6.
18 White Think Again cancels g8-h6, restores Black move/clocks, and forbids that exact replacement; reactor spends and draws once.
19 Black Pawn c7-c6 is a different replacement move; Think Again expenditure remains.
20 Black ends; replacement prohibition expires and White allowance refreshes.
21 White Dubbing sends Queen d1-f2 by L jump without capture or transformation; it replaces the move.
22 White ends after the replacement Queen move.
23 Black Pawn e7-e6 advances into empty e6.
24 Black ends; White receives a normal move.
25 White Pawn b3-b4 advances into empty b4.
26 White ends with Queen still f2 and Bishop still c1.
27 Black Queen d8-d3 follows empty d7,d6,d5,d4; d7 Pawn was removed by Assassin.
28 Black Anathema simultaneously swaps opposing Bishop c1 and Rook h1; identities and unmoved castling eligibility remain.
29 Black ends after the swap; h1 now holds the original c1 Bishop.
30 White Queen f2-b6 follows clear e3,d4,c5 diagonal.
31 White Holy Quest swaps Black Bishop f8 with Knight b8 without capture, moving or transforming either identity.
32 White ends; Black Knight b8 identity is at f8 and Bishop f8 identity at b8.
33 Black Blessing moves Pawn h5-g4 diagonally into empty g4; replacement move, no en passant.
34 Black ends after the Blessing Pawn move.
35 White original c1 Bishop h1-g2 moves diagonally into empty g2.
36 White ends; all swapped identities remain attached to their pieces.
37 Black Queen d3-g6 follows empty e4,f5 diagonal.
38 Black ends; no card or board change.
39 White Queen b6-d4 follows empty c5.
40 White ends with Queen on d4.
41 Black Annexation sends e6 Pawn through empty e5 to empty e4; starting away from e7 creates no en passant.
42 Black ends after its replacement Pawn move.
43 White Bishop g2-e4 traverses empty f3 and captures Black original e7 Pawn for White.
44 White ends; e7 Pawn stays captured, not dead.
45 Black King e8-d8 enters the White Queen d4 ray through empty d5,d6,d7; temporary rescue is required, castling is provisionally revoked.
46 Black Doomsayer spends/draws and opens White immediate naming choice; King safety waits for that mandatory response.
47 White names Pawn a2, which cannot cure Queen d4 against King d8: Doomsayer and illegal King move roll back, card stays spent, a2 stays alive.
48 Black Rook h8-h5 passes empty h7,h6; legal replacement revokes only Black kingside castling.
49 Black ends; White gains fresh allowances.
50 White Bishop e4-d3 retreats one diagonal square.
51 White ends; captured Black e7 Pawn remains captured by White.
52 Black original f8 Bishop b8-f4 passes c7,d6,e5 and captures White original f2 Pawn for Black.
53 Black ends; White has no f-Pawn on board.
54 White King e1-f2 moves one diagonal into safety, removing both White castling rights.
55 White ends; Black queenside is the only remaining castling right.
56 Black Rook h5-h7 follows clear h6.
57 White Bog immediately shortens that two-square Rook move to h6, retaining the completed move and clocks.
58 Black ends; Bog remains spent and White next-turn allowance is fresh.
59 White Pawn c2-c3 advances into empty c3.
60 White ends; no pending choices or rescue.
61 Black Bishop f4-g5 moves one diagonal square.
62 Black ends with Bishop g5.
63 White original h1 Rook c1-d1 crosses one empty file.
64 White ends; no new rights arise from the Rook relocation.
65 Black Queen g6-e4 follows empty f5 diagonal.
66 Black ends; Queen e4 does not yet attack White King f2.
67 White Pawn a2-a3 advances one square.
68 White ends; a2 is empty despite the earlier rolled-back Doomsayer selection.
69 Black Queen e4-f3 gives check down f3-f2.
70 Black ends legally; White must answer the Queen check.
71 White Queen d4-g4 passes empty e4,f4 and captures Black h7 Pawn but does not answer f3-f2; rescue remains mandatory.
72 White Disintegration of b4 cannot cure check: spend/draw it, restore b4 and the illegal Queen capture, return h7 Pawn to g4 with capturedBy cleared.
73 White King f2-e1 is the safe replacement; Queen f3 does not attack e1.
74 White ends with Disintegration allowance spent only on the completed turn.
75 Black Bishop g5-d2 follows f4,e3 and captures White d2 Pawn, giving check diagonally to King e1.
76 Black ends; White must escape Bishop d2.
77 White Bishop d3-f5 follows e4 but leaves Bishop d2 checking King e1; staged move requires rescue.
78 White Abduction conceals Black c8 Bishop in away zone, retains pending rescue, and opens the Black memory challenge.
79 Reveal closes concealment and starts recall without a board, clock, draw or allowance change.
80 Black correctly identifies c8 Bishop; restoring it cannot cure d2-e1 check, so restore White Bishop d3 and pre-move clocks while keeping Abduction spent.
81 White King e1-d2 captures the checking original f8 Bishop safely for White.
82 White ends after the successful replacement capture.
83 Black Pawn b7-b6 advances into empty b6.
84 Black ends with b6 occupied by original b7 Pawn.
85 White Queen d4-d8 follows clear d5,d6,d7 and checks Black King e8.
86 White ends; Black must answer Queen d8.
87 Black Dubbing g7-h5 is geometrically valid but leaves King e8 checked; card fizzles, Pawn stays g7, Regular Move remains because turn began checked.
88 Black King e8-d8 captures undefended White Queen, removing final Black castling right.
89 Black ends; White Queen is captured by Black.
90 White original f1 Bishop f1-g2 enters empty g2.
91 White ends after the quiet Bishop move.
92 Black Queen f3-d3 passes empty e3 and captures White original c1 Bishop, checking King d2.
93 Black ends; White must answer adjacent Queen d3.
94 White Evil Eye uses legal King d2 capture capability to remove undefended Queen d3 without moving the King; it replaces the move and cures check.
95 White ends; Black Queen is captured by White.
96 Black Pawn f7-f6 advances into empty f6.
97 Black ends; no effects or pending obligations.
98 White original h1 Rook d1-f1 passes empty e1.
99 White ends; both Queens remain captured.
100 Black Bishop c8-f5 passes empty d7,e6.
101 Black ends; original c8 Bishop now f5.
102 White Rook a1-a2 advances into vacated a2.
103 White ends; a2 Rook does not regain castling rights.
104 Black Rook h6-g6 moves horizontally into empty g6.
105 Black ends; no capture or card change.
106 White Pawn a3-a4 advances into empty a4.
107 White Fatal Attraction marks own Pawn b4 after moving; retains card and freezes adjacent nonroyals including a4 and c3.
108 White ends; b4 magnet and frozen neighbors persist.
109 Black Pawn a7-a5 passes clear a6 and may enter magnet adjacency; it becomes frozen only on arrival, recording a6 en passant.
110 Black ends; a6 opportunity remains for White reply.
111 White Rook f1-c1 passes clear e1,d1; outside magnet adjacency and expires a6 en passant.
112 White ends; magnet remains b4.
113 Black Knight g8-h6 jumps to empty h6, outside magnet adjacency.
114 Black ends; a5 remains frozen beside b4.
115 White Knight h3-g1 jumps to empty g1; no capture.
116 White ends; all card zones and magnet remain.
117 Black Guardian moves c6 Pawn one forward to empty c5; no following piece is required, arrival beside b4 freezes it, no en passant.
118 Black ends after Guardian; c5 Pawn and a5 Pawn remain trapped.
119 White Bishop g2-e4 passes clear f3, starting outside magnet adjacency.
120 White ends; e4 Bishop is not adjacent to b4.
121 Black Bishop f5-e6 moves one diagonal square, outside magnet adjacency.
122 Black ends: 50 regular move commands reviewed, no rescue or mandatory choices unresolved.
`.trim().split('\n');

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
function frozen(piece: PieceState, step: number): boolean {
  if (step < 107 || piece.royal || !piece.square || piece.id === 'white-pawn-b2') return false;
  const [x, y] = xy(piece.square);
  return Math.max(Math.abs(x - 1), Math.abs(y - 3)) === 1;
}
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === forward;
    if (dx || dy !== forward && !(dy === 2 * forward && (y === 1 || y === 6))) return false;
  } else if (!(piece.role !== 'bishop' && (!dx || !dy) || piece.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (!distance) return false;
  for (let n = 1; n < distance; n++) {
    const square = String.fromCharCode(97 + x + Math.sign(dx) * n) + String(y + Math.sign(dy) * n + 1);
    if (pieces.some(p => p.square === square && p.zone === 'board')) return false;
  }
  return true;
}

test('iteration 121 has an independent physical, card-zone, clock and royal oracle for every action', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/121.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.moves, 50);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  let turn = structuredClone(state.turn);
  let setup = parseFen(state.fen).unwrap();
  let ep = structuredClone(state.enPassant);
  const snapshots = new Map<number, { pieces: PieceState[]; setup: typeof setup; ep: typeof ep }>();
  const expectedFen = () => {
    setup.board = Board.empty();
    for (const p of pieces) if (p.zone === 'board') setup.board.set(parseSquare(p.square!)!, { color: p.owner, role: p.role });
    return makeFen(setup);
  };
  const movePiece = (from: string, to: string, actor: Color, clock = true) => {
    assert.match(to, /^[a-h][1-8]$/);
    const p = pieces.find(p => p.zone === 'board' && p.square === from)!;
    assert.ok(p, from);
    const victim = pieces.find(p => p.zone === 'board' && p.square === to);
    if (victim) { assert.equal(victim.royal, false); victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor; }
    p.square = to as SquareName;
    if (clock) {
      setup.halfmoves = p.role === 'pawn' || victim ? 0 : setup.halfmoves + 1;
      setup.fullmoves += actor === 'black' ? 1 : 0;
      setup.turn = opposite(actor);
      if (p.royal) for (const sq of actor === 'white' ? [0, 7] : [56, 63]) setup.castlingRights = setup.castlingRights.without(sq);
      if (p.role === 'rook') setup.castlingRights = setup.castlingRights.without(parseSquare(from)!);
      ep = [];
      setup.epSquare = undefined; // No trace move gives an adjacent enemy Pawn a legal EP capture.
      if (p.role === 'pawn' && from[0] === to[0] && Math.abs(Number(from[1]) - Number(to[1])) === 2) {
        ep = [{ target: (from[0]! + String((Number(from[1]) + Number(to[1])) / 2)) as SquareName, pawnId: p.id }];
      }
      turn.phase = 'afterMove'; turn.moveMade = true;
    }
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, message = rationales[index]!;
    assert.ok(message.startsWith(`${n} `));
    snapshots.set(n, { pieces: structuredClone(pieces), setup: parseFen(expectedFen()).unwrap(), ep: structuredClone(ep) });
    const before = structuredClone(state);
    const actor = turn.color;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const p = pieces.find(p => p.square === action.from)!;
      assert.equal(p.owner, actor, message);
      assert.equal(frozen(p, n - 1), false, message);
      assert.ok(reaches(pieces, p, action.to, pieces.some(p => p.square === action.to)), message);
      movePiece(action.from, action.to, actor);
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, message);
      turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'playCard') {
      const owner = players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const hand = players[owner].hand;
      const cardIndex = hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0, message);
      const [card] = hand.splice(cardIndex, 1);
      assert.equal(card!.cardId, action.cardId);
      assert.equal(turn.cardPlays[owner], 0, message);
      turn.cardPlays[owner]++;
      if (![46, 107].includes(n)) players[owner].discard.push(card!);
      const drawn = players[owner].deck.shift(); if (drawn) hand.push(drawn);
      if ([8, 21, 33, 41, 117].includes(n)) {
        const [{ from, to }] = action.target as Array<{ from: string; to: string }>;
        movePiece(from, to, owner);
        if (n === 41 || n === 117) ep = [];
      } else if (n === 28 || n === 31) {
        const [a, b] = n === 28 ? ['c1', 'h1'] : ['f8', 'b8'];
        const pa = pieces.find(p => p.square === a)!, pb = pieces.find(p => p.square === b)!;
        [pa.square, pb.square] = [pb.square, pa.square];
      } else if (n === 57) movePiece('h7', 'h6', 'black', false);
      else if (n === 78) { const p = pieces.find(p => p.square === 'c8')!; p.square = null; p.zone = 'away'; }
      else if (n === 94) {
        const p = pieces.find(p => p.square === 'd3')!;
        assert.ok(reaches(pieces, pieces.find(p => p.square === 'd2')!, 'd3', true));
        p.square = null; p.zone = 'captured'; p.capturedBy = 'white';
        setup.halfmoves = 0; setup.turn = 'black'; ep = [];
        turn.moveMade = true; turn.phase = 'afterMove';
      } else assert.ok([6, 11, 18, 46, 72, 87, 107].includes(n), message);
    } else assert.ok([47, 79, 80].includes(n), message);
    const rollback = ({ 18: 17, 47: 45, 72: 71, 80: 77 } as Record<number, number>)[n];
    if (rollback) {
      const saved = snapshots.get(rollback)!;
      pieces = structuredClone(saved.pieces); setup = parseFen(makeFen(saved.setup)).unwrap(); ep = structuredClone(saved.ep);
      turn.phase = 'beforeMove'; turn.moveMade = false;
      if (n === 47) players.black.discard.push({ id: 'black-deck-2-doomsayer', cardId: 'doomsayer' });
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${message}: full structuredClone input immutability`);
    assert.ok(result.ok, message);
    state = result.state;
    assert.deepEqual(state.pieces, pieces, `${message}: every physical identity/owner/role/zone/capturedBy`);
    assert.deepEqual(state.players, players, `${message}: every physical card in all six zones`);
    assert.deepEqual(state.turn, turn, message);
    assert.deepEqual(state.enPassant, ep, message);
    assert.equal(state.fen, expectedFen(), `${message}: independently reconstructed board, rights, side and clocks`);
    const effects: unknown[] = n >= 6 && n <= 7 ? [{ type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-knight-b8' }]
      : n === 46 ? [{ type: 'doomsayer', owner: 'black', card: { id: 'black-deck-2-doomsayer', cardId: 'doomsayer' } }]
      : n >= 107 ? [{ type: 'fatal-attraction', owner: 'white', card: { id: 'white-hand-1-fatal-attraction', cardId: 'fatal-attraction' }, pieceId: 'white-pawn-b2' }] : [];
    assert.deepEqual(state.effects, effects, message);
    assert.equal(state.orientation, 0);
    assert.equal(state.outcome, null);
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 46 ? { player: 'white', cardInstanceId: 'black-deck-2-doomsayer' } : null, message);
    const rescueStart = [45, 46].includes(n) ? 45 : n === 71 ? 71 : [77, 78, 79].includes(n) ? 77 : undefined;
    assert.equal(!!state.pendingRescue, !!rescueStart, message);
    if (rescueStart) {
      const saved = snapshots.get(rescueStart)!;
      assert.deepEqual(state.pendingRescue!.pieces, saved.pieces, message);
      assert.equal(state.pendingRescue!.fen, makeFen(saved.setup), message);
      assert.deepEqual(state.pendingRescue!.enPassant, saved.ep, message);
      assert.deepEqual(state.pendingRescue!.movedPieceIds, [rescueStart === 45 ? 'black-king-e8' : rescueStart === 71 ? 'white-queen-d1' : 'white-bishop-c1'], message);
    }
    if (n === 78 || n === 79) {
      assert.ok(state.pendingAbduction);
      const { before: concealedBefore, ...pending } = state.pendingAbduction;
      assert.deepEqual(pending, { phase: n === 78 ? 'concealment' : 'recall', player: 'black', durationMs: 10000, pieceId: 'black-bishop-c8', requiresPieceId: false }, message);
      assert.deepEqual(concealedBefore.pieces, snapshots.get(78)!.pieces, message);
    } else assert.equal(state.pendingAbduction ?? null, null, message);
    assert.deepEqual(state.underElfHill ?? [], [], message);
    assert.deepEqual(state.riposteLostMoves ?? [], [], message);
    assert.deepEqual(state.chaosForbidden ?? null, n === 18 ? { player: 'black', movement: 'black-knight-g8:g8:h6' } : null, message);
    if (n === 11) {
      assert.equal(state.plotsAllowances?.length, 1);
      assert.deepEqual(state.plotsAllowances![0]!.eligibleCards, []);
      assert.equal(state.plotsAllowances![0]!.remaining, 2);
      assert.equal(state.plotsAllowances![0]!.player, 'black');
    } else assert.deepEqual(state.plotsAllowances ?? [], [], message);
    for (const color of ['white', 'black'] as const) {
      const king = pieces.find(p => p.owner === color && p.royal)!;
      const attacked = pieces.some(p => p.owner !== color && p.zone === 'board' && !frozen(p, n) && reaches(pieces, p, king.square!, true));
      const checked = color === 'black' ? [45, 46, 85, 86, 87].includes(n) : [69, 70, 71, 72, 75, 76, 77, 78, 79, 80, 92, 93].includes(n);
      assert.equal(attacked, checked, `${message}: independent ${color} royal attack rays`);
      if (action.type === 'endTurn' && color === actor) assert.equal(attacked, false, message);
    }
  }
  assert.equal(state.fen, 'r2k1n2/6p1/1p2bprn/p1p5/PP2B1p1/2P3P1/R2KP2P/1NR3N1 w - - 2 27');
});

test('deterministic iteration 121 replays', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/121.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace.steps.length > 0);
  replayTrace(trace);
});
