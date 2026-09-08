import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/147.json', import.meta.url), 'utf8')) as RandomTrace;
// Each numbered row was reviewed against rules §§8–15,17.3,19.2,20 and the
// catalog's printed timing. Expected transitions below do not consume trace hashes.
const review = `
1 b1-c3 | White Knight jumps to empty c3.
2 end | White finishes Nc3; Black receives fresh allowances.
3 f7-f5 | Black Pawn crosses empty f6; f6 EP exists but no White Pawn can take it.
4 end | Black finishes f5; EP opportunity survives into White turn.
5 card | Disintegration kills own d2 Pawn before moving; f6 EP serializes raw but remains uncapturable.
6 c1-d2 | White Bishop steps diagonally onto the vacated d2; EP expires.
7 end | White finishes Bd2 with Disintegration already spent.
8 b8-c6 | Black Knight jumps onto empty c6.
9 end | Black finishes Nc6.
10 d1-b1 | White Queen crosses empty c1 to empty b1.
11 card | Cathedral swaps controlled Rh1 and Bf1 after Qb1; no capture or extra clock tick.
12 end | Cathedral completes White turn; swapped identities persist.
13 g8-h6 | Black Knight jumps to h6.
14 end | Black finishes Nh6.
15 card | Tournament exchanges White Nc3 and Black Nh6 as White replacement move.
16 end | Replacement swap completes White turn without an ordinary move.
17 c3-b1 | Black Knight captures White Queen on b1; Black is the captor.
18 card | Abduction temporarily conceals opponent Nh6 after the capture; no capture yet.
19 reveal | Concealment advances to recall, preserving the away Knight and position.
20 answer | White correctly recalls its physical Knight at h6; return it without capture.
21 end | Resolved recall allows Black to end the turn.
22 h6-g8 | White Knight jumps back to empty g8.
23 end | White finishes Ng8.
24 e7-e6 | Black Pawn advances one square to e6.
25 end | Black finishes e6.
26 d2-e3 | White Bishop moves one diagonal step onto e3.
27 card | Rebirth relocates enemy Nc6 to its valid starting square g8, capturing White Ng8 for the White card owner.
28 end | Rebirth finishes White turn; captured Knight stays captured.
29 h7-h6 | Black Pawn advances into h6 vacated by the White Knight.
30 end | Black finishes h6.
31 e1-d2 | King steps to d2, attacked by Black Nb1; held Holy Quest can swap Nb1/Bf8 to cure the check, permitting pending rescue.
32 card | Crab on e2 cannot stop Nb1 attacking d2; spend it, restore King e1, clocks, rights, and move opportunity.
33 f2-f3 | White uses the restored move to advance f2 Pawn one square.
34 end | Safe f3 ends White turn; Crab remains discarded.
35 card | Black Plots preserves before-move eligibility: only Ghostwalk in its existing hand qualifies.
36 g7-g5 | Black Pawn crosses empty g6; an ordinary move closes unused Plots allowance.
37 end | Black finishes g5; uncapturable g6 EP remains until White moves.
38 a1-b1 | White Rook captures Black Knight on b1 and loses queenside castling right.
39 end | White finishes Rxb1.
40 b7-b5 | Black Pawn crosses empty b6; new b6 EP is uncapturable.
41 end | Black finishes b5.
42 a2-a4 | White Pawn crosses empty a3; Black b5 Pawn can capture a4 normally, not en passant.
43 end | White finishes a4.
44 c8-a6 | Black Bishop crosses vacated b7 to a6.
45 end | Black finishes Ba6.
46 e3-f2 | White Bishop steps back diagonally to empty f2.
47 end | White finishes Bf2.
48 d8-b8 | Black Queen crosses empty c8 to b8.
49 end | Black finishes Qb8.
50 g1-h3 | White Knight jumps onto h3.
51 end | White finishes Nh3.
52 f8-g7 | Black Bishop steps diagonally into vacated g7.
53 card | Black Holy Quest swaps opposing Bh1 and Nh3 after its move.
54 end | Black finishes; White Bishop is h3 and Knight h1.
55 f2-g1 | White Bishop moves diagonally to empty g1.
56 card | White Holy Quest swaps Black Bg7 and Ng8 without capture.
57 end | White finishes; Black Bishop is g8 and Knight g7.
58 b5-a4 | Black Pawn captures White a-Pawn diagonally on a4.
59 end | Black finishes bxa4.
60 e1-d1 | White King steps to safe d1 and forfeits both remaining royal castling permissions.
61 end | White finishes Kd1.
62 e8-f8 | Black King steps to safe f8 and loses its castling rights.
63 end | Black finishes Kf8.
64 g1-d4 | White Bishop crosses empty f2 and e3 to d4.
65 end | White finishes Bd4.
66 a6-e2 | Black Bishop crosses b5,c4,d3 and captures White e2 Pawn, checking adjacent Kd1.
67 end | Black finishes Bxe2; White receives its check-response turn.
68 card | Guardian c2-c3 does not cure Be2 attacking Kd1; it fizzles spent, and the checked player retains its move.
69 d1-e1 | White King steps off Be2 diagonal to safe e1.
70 end | White ends its safe escape after the Guardian fizzle.
71 b8-e8 | Black Queen crosses empty c8,d8 to e8.
72 end | Black finishes Qe8.
73 f1-f2 | White Rook advances to empty f2.
74 end | White finishes Rf2.
75 g8-h7 | Black Bishop moves diagonally into vacated h7.
76 end | Black finishes Bh7.
77 b2-b3 | White Pawn advances one square to b3.
78 end | White finishes b3.
79 a8-d8 | Black Rook crosses empty b8,c8 to d8.
80 end | Black finishes Rd8.
81 d4-g7 | White Bishop crosses empty e5,f6, captures Black Knight g7, and checks King f8.
82 end | White finishes Bxg7; Black receives check response.
83 f8-g7 | Black King captures checking Bishop g7; destination is safe.
84 end | Black finishes Kxg7.
85 b1-a1 | White Rook slides to empty a1.
86 card | White Neutrality marks opposing Pawn f5 after moving; retain original Black ownership and forward direction.
87 end | White ends; the Neutrality marker persists.
88 card | Black Ghostwalk moves its controlled neutral Pawn f5-f4 as the move, without capture or obstruction.
89 end | Black finishes Ghostwalk; neutral Pawn remains f4.
90 e1-d2 | White King steps to d2, which Be2 does not attack orthogonally.
91 end | White finishes Kd2.
92 g7-g6 | Black King steps to safe g6; neutral f4 Pawn attacks e3,g3, neither King.
93 end | Black finishes Kg6.
94 a1-g1 | White Rook crosses empty b1,c1,d1,e1,f1 to g1.
95 end | White finishes Rg1.
96 e8-e7 | Black Queen moves one rank into vacated e7.
97 card | Black Peace Talks cancels the exact White Neutrality marker; discard both cards to their owners and restore Pawn control.
98 end | Black finishes; no continuing effects remain.
99 g1-e1 | White Rook crosses empty f1 to e1.
100 end | White finishes Re1.
101 e2-d1 | Black Bishop steps diagonally to d1; White King d2 is not on that diagonal.
102 end | Black finishes Bd1.
103 h3-g4 | White Bishop steps diagonally to g4.
104 end | White finishes Bg4.
105 a7-a5 | Black Pawn crosses a6 to a5; no White Pawn can capture on a6 en passant.
106 end | Black finishes a5.
107 f2-f1 | White Rook steps back to empty f1.
108 end | White finishes Rf1.
109 d7-d5 | Black Pawn crosses empty d6; d6 EP is uncapturable.
110 end | Black finishes d5.
111 h2-h4 | White Pawn crosses h3; Black g5 Pawn could capture h4 normally but cannot take h3 en passant.
112 end | White finishes h4.
113 d8-d6 | Black Rook crosses vacated d7 to d6.
114 end | Black finishes Rd6.
115 g4-f5 | White Bishop steps to f5 and gives adjacent diagonal check on Black Kg6.
116 end | White ends legally; Black has its response turn to Bf5 check.
`.trim().split('\n');

const cards: Record<number, { cardId: string; cardInstanceId: string; target: unknown }> = {
  5: { cardId: 'disintegration', cardInstanceId: 'white-hand-2-disintegration', target: 'd2' },
  11: { cardId: 'cathedral', cardInstanceId: 'white-hand-1-cathedral', target: { rook: 'h1', bishop: 'f1' } },
  15: { cardId: 'tournament', cardInstanceId: 'white-hand-0-tournament', target: { own: 'c3', opponent: 'h6' } },
  18: { cardId: 'abduction', cardInstanceId: 'black-hand-1-abduction', target: 'h6' },
  27: { cardId: 'rebirth', cardInstanceId: 'white-hand-3-rebirth', target: [{ from: 'c6', to: 'g8' }] },
  32: { cardId: 'crab', cardInstanceId: 'white-hand-4-crab', target: 'e2' },
  35: { cardId: 'plots-within-plots', cardInstanceId: 'black-hand-4-plots-within-plots', target: { player: 'black' } },
  53: { cardId: 'holy-quest', cardInstanceId: 'black-hand-0-holy-quest', target: { bishop: 'h1', knight: 'h3' } },
  56: { cardId: 'holy-quest', cardInstanceId: 'white-deck-1-holy-quest', target: { bishop: 'g7', knight: 'g8' } },
  68: { cardId: 'guardian', cardInstanceId: 'white-deck-0-guardian', target: [{ from: 'c2', to: 'c3' }] },
  86: { cardId: 'neutrality', cardInstanceId: 'white-deck-3-neutrality', target: 'f5' },
  88: { cardId: 'ghostwalk', cardInstanceId: 'black-hand-3-ghostwalk', target: [{ from: 'f5', to: 'f4' }] },
  97: { cardId: 'peace-talks', cardInstanceId: 'black-deck-0-peace-talks', target: 'white-deck-3-neutrality' },
};

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const at = (board: PieceState[], square: string) => board.find(p => p.zone === 'board' && p.square === square);
function geometry(board: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === direction;
    return dx === 0 && (dy === direction || dy === direction * 2
      && (piece.owner === 'white' ? y <= 1 : y >= 6)
      && !at(board, `${piece.square[0]}${y + direction + 1}`));
  }
  const aligned = piece.role === 'bishop' ? Math.abs(dx) === Math.abs(dy)
    : piece.role === 'rook' ? dx === 0 || dy === 0 : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
  if (!aligned) return false;
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    if (at(board, `${String.fromCharCode(97 + x + n * Math.sign(dx))}${y + n * Math.sign(dy) + 1}`)) return false;
  }
  return true;
}

function threats(board: PieceState[], color: Color): string[] {
  const king = board.find(p => p.royal && p.owner === color && p.zone === 'board');
  assert.ok(king?.square);
  return board.filter(p => p.zone === 'board' && p.id !== king.id && (p.owner !== color || p.neutral)
    && geometry(board, p, king.square!, true)).filter(p => {
    if (!p.neutral) return true;
    // §15.1: a neutral attacker must also leave its controller's King safe.
    const hypothetical = structuredClone(board).filter(q => q.id !== king.id);
    hypothetical.find(q => q.id === p.id)!.square = king.square;
    const controller = opposite(color), ownKing = hypothetical.find(q => q.royal && q.owner === controller)!;
    return !hypothetical.some(q => q.zone === 'board' && q.id !== ownKing.id && (q.owner !== controller || q.neutral)
      && geometry(hypothetical, q, ownKing.square!, true));
  }).map(p => p.id).sort();
}

function placement(board: PieceState[]): string {
  const glyph = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, i) => {
    let rank = '', empty = 0;
    for (const file of 'abcdefgh') {
      const p = at(board, `${file}${8 - i}`);
      if (!p) { empty++; continue; }
      if (empty) { rank += empty; empty = 0; }
      rank += p.owner === 'white' ? glyph[p.role].toUpperCase() : glyph[p.role];
    }
    return rank + (empty || '');
  }).join('/');
}

test('iteration 147: 116 independently reviewed actions, 50 move commands', () => {
  assert.equal(trace.seed, 860147);
  assert.equal(trace.steps.length, 116);
  assert.equal(review.length, trace.steps.length);
  const initial = createGameState(trace.initial);
  let state = initial;
  let board = structuredClone(initial.pieces);
  assert.equal(placement(board), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  const players = structuredClone(initial.players);
  let turn = structuredClone(initial.turn), ep: GameState['enPassant'] = [];
  let half = 0, full = 1, active = 'w', rawEp = '-', rights = new Set(['h1', 'a1', 'h8', 'a8']);
  let rescueBefore: GameState | undefined, abductBefore: GameState | undefined;
  let effects: unknown[] = [], historyLength = 0, shield: GameState['shieldMove'];
  let plots: GameState['plotsAllowances'] = [];
  const move = (from: string, to: string, actor: Color) => {
    const p = at(board, from), victim = at(board, to);
    assert.ok(p, `physical mover ${from}`);
    assert.ok(p.owner === actor || p.neutral, 'controlled mover');
    assert.ok(!victim || (!victim.royal && (victim.owner !== actor || victim.neutral || p.neutral)), 'capture target');
    assert.ok(geometry(board, p, to, !!victim), `${p.role} geometry ${from}-${to}`);
    shield = { player: actor, pieceIds: [p.id], capturedOpponent: !!victim && victim.owner !== actor };
    if (victim) { victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor; rights.delete(to); }
    p.square = to as SquareName;
    if (p.royal) { rights.delete(actor === 'white' ? 'h1' : 'h8'); rights.delete(actor === 'white' ? 'a1' : 'a8'); }
    if (p.role === 'rook') rights.delete(from);
    ep = [];
    if (p.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2) {
      ep = [{ pawnId: p.id, target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName }];
    }
    half = p.role === 'pawn' || victim ? 0 : half + 1;
    full += actor === 'black' ? 1 : 0;
    active = actor === 'white' ? 'b' : 'w'; rawEp = '-';
    turn.phase = 'afterMove'; turn.moveMade = true;
  };
  const swap = (a: string, b: string) => {
    const first = at(board, a), second = at(board, b);
    assert.ok(first && second);
    [first.square, second.square] = [second.square, first.square];
  };
  for (const [index, row] of review.entries()) {
    const n = index + 1, token = row.split(' ')[1]!, action = trace.steps[index]!.action;
    assert.ok(row.startsWith(`${n} `), 'numbered explicit rationale');
    const expected: GameAction = token === 'card' ? { type: 'playCard', ...cards[n]! }
      : token === 'end' ? { type: 'endTurn' }
      : token === 'reveal' ? { type: 'revealAbduction' }
      : token === 'answer' ? { type: 'answerAbduction', player: 'white', owner: 'white', role: 'knight', square: 'h6', pieceId: 'white-knight-b1' }
      : { type: 'move', from: token.split('-')[0], to: token.split('-')[1] };
    assert.deepEqual(action, expected, row);
    const before = structuredClone(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/);
      assert.equal(turn.moveMade, false);
      if (n === 31) rescueBefore = structuredClone(before);
      move(action.from, action.to, turn.color);
      if (n === 31) {
        assert.ok(players.white.hand.some(c => c.cardId === 'holy-quest'));
        const saved = structuredClone(board), knight = at(saved, 'b1')!, bishop = at(saved, 'f8')!;
        assert.equal(knight.role, 'knight'); assert.equal(bishop.role, 'bishop');
        assert.equal(knight.owner, 'black'); assert.equal(bishop.owner, 'black');
        [knight.square, bishop.square] = [bishop.square, knight.square];
        assert.deepEqual(threats(saved, 'white'), [], 'held Holy Quest supplies a viable rescue');
        assert.deepEqual(threats(saved, 'black'), [], 'rescue does not directly mate');
      }
      plots = []; historyLength++;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true);
      assert.deepEqual(threats(board, turn.color), [], row);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      plots = []; shield = undefined;
    } else if (action.type === 'playCard') {
      const actor = turn.color, player = players[actor], card = cards[n]!;
      const handIndex = player.hand.findIndex(c => c.id === card.cardInstanceId);
      assert.ok(handIndex >= 0); assert.equal(player.hand[handIndex]!.cardId, card.cardId);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(turn.phase));
      assert.equal(turn.cardPlays[actor], 0);
      const [physical] = player.hand.splice(handIndex, 1);
      assert.ok(physical);
      if (n !== 86) player.discard.push(physical);
      const draw = player.deck.shift(); assert.ok(draw); player.hand.push(draw);
      turn.cardPlays[actor]++; historyLength++;
      switch (n) {
        case 5: { const p = at(board, 'd2')!; p.square = null; p.zone = 'dead'; rawEp = 'f6'; break; }
        case 11: swap('h1', 'f1'); break;
        case 15: swap('c3', 'h6'); half++; active = 'b'; ep = []; rawEp = '-'; turn.phase = 'afterMove'; turn.moveMade = true;
          shield = { player: 'white', capturedOpponent: false, pieceIds: [] }; break;
        case 18: abductBefore = before; at(board, 'h6')!.zone = 'away'; board.find(p => p.id === 'white-knight-b1')!.square = null; break;
        case 27: {
          const victim = at(board, 'g8')!; victim.square = null; victim.zone = 'captured'; victim.capturedBy = 'white';
          at(board, 'c6')!.square = 'g8'; half = 0; break;
        }
        case 32:
          assert.ok(rescueBefore); assert.deepEqual(threats(board, 'white'), ['black-knight-g8']);
          board = structuredClone(rescueBefore.pieces); half = 0; full = 7; active = 'w'; rights = new Set(['h1', 'a1', 'h8', 'a8']);
          turn.phase = 'beforeMove'; turn.moveMade = false; historyLength--; break;
        case 35:
          plots = [{ player: 'black', remaining: 2, eligibleCards: ['black-hand-3-ghostwalk'], window: {
            phase: 'beforeMove', moveMade: false,
            capture: undefined, cardResponse: undefined, fogCheckpoint: undefined, legacyCapture: undefined, shieldMove: undefined,
            reaction: { type: 'move', from: 'f2', to: 'f3', movedPieceId: 'white-pawn-f2', movedRoles: ['pawn'] },
          } }]; break;
        case 53: swap('h1', 'h3'); break;
        case 56: swap('g7', 'g8'); break;
        case 68: {
          const proposed = structuredClone(board); at(proposed, 'c2')!.square = 'c3';
          assert.deepEqual(threats(proposed, 'white'), ['black-bishop-c8']); break;
        }
        case 86:
          at(board, 'f5')!.neutral = true; at(board, 'f5')!.neutralBeforeEffects = false;
          effects = [{ type: 'neutrality', owner: 'white', card: physical, pieceId: 'black-pawn-f7' }]; break;
        case 88: move('f5', 'f4', 'black'); break;
        case 97:
          at(board, 'f4')!.neutral = false; delete at(board, 'f4')!.neutralBeforeEffects;
          players.white.discard.push({ id: 'white-deck-3-neutrality', cardId: 'neutrality' }); effects = []; break;
        default: assert.fail(`Unreviewed card ${n}`);
      }
    } else if (action.type === 'answerAbduction') {
      const p = board.find(p => p.id === 'white-knight-b1')!; p.square = 'h6'; p.zone = 'board'; delete p.capturedBy;
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${row}: immutable input including additive metadata`);
    assert.ok(result.ok, row); state = result.state;
    assert.deepEqual(state.pieces, board, `${row}: physical identities/zones/captors`);
    assert.deepEqual(state.players, players, `${row}: exact ordered physical card zones`);
    assert.deepEqual(state.turn, turn, `${row}: turn and allowances`);
    assert.deepEqual(state.enPassant, ep, `${row}: EP opportunity`);
    assert.deepEqual(state.effects, effects, `${row}: complete effect records`);
    const castle = (rights.has('h1') ? (at(board, 'h1')?.role === 'rook' ? 'K' : 'H') : '')
      + (rights.has('a1') ? 'Q' : '') + (rights.has('h8') ? 'k' : '') + (rights.has('a8') ? 'q' : '');
    assert.equal(state.fen, `${placement(board)} ${active} ${castle || '-'} ${rawEp} ${half} ${full}`, `${row}: all six FEN fields`);
    for (const color of ['white', 'black'] as const) {
      const attacks = threats(board, color);
      const named = color === 'white' ? (n === 31 ? ['black-knight-g8'] : [66,67,68].includes(n) ? ['black-bishop-c8'] : [])
        : [81,82].includes(n) ? ['white-bishop-c1'] : [115,116].includes(n) ? ['white-bishop-f1'] : [];
      assert.deepEqual(attacks, named, `${row}: independent ${color} royal attackers`);
      assert.equal(isKingInCheck(state, color), attacks.length > 0, `${row}: public royal check`);
    }
    for (const opportunity of ep) {
      const victim = board.find(p => p.id === opportunity.pawnId)!;
      const captors = board.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner !== victim.owner
        && geometry(board, p, opportunity.target, true));
      assert.deepEqual(captors, [], `${row}: raw EP is not a legal capture`);
      const captor = opposite(victim.owner), prospective = structuredClone(state);
      prospective.turn = { color: captor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const fields = prospective.fen.split(' '); fields[1] = captor === 'white' ? 'w' : 'b'; prospective.fen = fields.join(' ');
      const dests = legalDests(prospective, false);
      for (const p of board.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner !== victim.owner)) {
        assert.ok(!dests.get(p.square!)?.includes(opportunity.target), `${row}: no fictitious EP capture`);
      }
    }
    assert.equal(state.history.length, historyLength, `${row}: history position`);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    assert.equal(state.chaosForbidden, undefined); assert.equal(state.plotsExecution, undefined);
    assert.deepEqual(state.plotsAllowances ?? [], plots); assert.deepEqual(state.fogLocked ?? [], []);
    assert.deepEqual(state.riposteLostMoves ?? [], []); assert.equal(state.riposteSkipped, undefined);
    assert.equal(state.riposteCheckDeferred, undefined); assert.deepEqual(state.shieldMove, shield);
    assert.deepEqual(state.underElfHill ?? [], []); assert.equal(state.pendingDoomsayer ?? null, null);
    if (n === 31) {
      assert.ok(rescueBefore);
      assert.deepEqual(state.pendingRescue, { before: rescueBefore, fen: rescueBefore.fen,
        pieces: rescueBefore.pieces, enPassant: [], historyLength: 16,
        movedPieceIds: ['white-king-e1'] });
    } else assert.equal(state.pendingRescue ?? null, null, row);
    if (n === 18 || n === 19) {
      assert.deepEqual(state.pendingAbduction, { phase: n === 18 ? 'concealment' : 'recall', player: 'white', durationMs: 10000,
        pieceId: 'white-knight-b1', requiresPieceId: false, before: abductBefore });
    } else assert.equal(state.pendingAbduction ?? null, null, row);
    if (n === 32 || n === 68) assert.equal(state.history.at(-1)?.reason, 'SELF_CHECK');
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13);
  assert.equal(state.fen, '7r/2p1q2b/3rp1kp/p2p1Bp1/p4p1P/1P3P2/2PK2P1/3bRR1N b - - 2 26');
  assert.equal(replayTrace(trace).fen, state.fen);
});
