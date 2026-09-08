import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

// Explicit in-order review. Each move is independently checked below against the
// physical board, not the reducer's destination or check implementation.
const review = `
1 b2-b4 | White Pawn crosses empty b3 and b4; b3 is an uncapturable EP opportunity.
2 end | White finishes; Black receives the move with the b3 opportunity intact.
3 c7-c6 | Black Pawn advances one empty square and expires b3 EP.
4 end | Black finishes; White receives move and fresh allowances.
5 b1-a3 | White Knight jumps one file and two ranks to empty a3.
6 end | White finishes the quiet Knight move.
7 g7-g5 | Black Pawn crosses empty g6 to g5; no White Pawn can take EP.
8 end | Black finishes, preserving the g6 opportunity for White.
9 h2-h4 | White Pawn crosses empty h3; g6 expires and h3 becomes uncapturable EP.
10 end | White hands the h3 opportunity to Black.
11 d7-d5 | Black Pawn crosses empty d6; no White Pawn can capture en passant.
12 end | Black completes the Pawn move and retains d6 for White.
13 a3-b5 | White Knight jumps to empty b5, expiring d6 EP.
14 end | White finishes; both Kings remain safe.
15 pacifism | Black before-move card marks its nonroyal h7 Pawn; retain card and draw Split Knight.
16 h7-h6 | Pacifist Pawn may advance quietly; its physical marker travels to h6.
17 end | Black finishes; the Pacifism marker persists and allowances reset.
18 c2-c3 | White Pawn advances one empty square.
19 end | White finishes and Black receives an ordinary move.
20 b8-a6 | Black Knight makes an ordinary quiet jump to a6.
21 think-again | White immediately cancels b8-a6; restore all pre-move clocks and board, forbid that exact movement, draw Anathema.
22 c6-b5 | Black makes a different replacement, capturing White's b1 Knight diagonally with its c7 Pawn.
23 end | Black completes replacement; White's reaction allowance resets.
24 a2-a3 | White Pawn advances one rank to empty a3.
25 end | White completes the quiet Pawn move.
26 c8-e6 | Black Bishop crosses empty d7 along the diagonal to e6.
27 end | Black completes the quiet Bishop move.
28 h4-h5 | White Pawn advances to empty h5; Pacifist h6 is not captured.
29 end | White completes its Pawn advance.
30 e6-c8 | Black Bishop returns diagonally through empty d7.
31 end | Black finishes, leaving no movement obligation.
32 c1-b2 | White Bishop moves one diagonal step onto vacated b2.
33 crab | White after-move card marks its b4 Pawn as Crab; board and clocks stay, draw Sanctuary.
34 end | White finishes; Crab and Pacifism remain attached to their physical Pawns.
35 e8-d7 | Black King steps diagonally into safe empty d7 and loses both castling rights.
36 end | Black finishes its safe royal move.
37 a1-b1 | White Rook moves horizontally to vacated b1 and loses queenside castling rights.
38 end | White finishes the quiet Rook move.
39 a7-a5 | Black Pawn crosses empty a6 and a5; no White Pawn on b5 can take EP.
40 end | Black finishes, preserving the uncapturable a6 EP opportunity.
41 b2-c1 | White Bishop steps diagonally back to c1 and expires a6 EP.
42 end | White completes the Bishop move.
43 a5-a4 | Black Pawn advances one rank to empty a4.
44 end | Black finishes the Pawn advance.
45 h1-h3 | White Rook crosses empty h2 to h3; the remaining White castling right is lost.
46 end | White finishes; castling rights are now absent for both players.
47 d7-d6 | Black King steps to safe d6; Crab b4 cannot attack that square.
48 end | Black completes its royal move.
49 h3-h4 | White Rook advances one empty file square to h4.
50 end | White finishes and the Rook becomes a legal Pawn capture target.
51 g5-h4 | Black g7 Pawn captures White's h1 Rook diagonally; Black is the captor.
52 end | Black completes the capturing move.
53 b1-a1 | White Rook returns horizontally to a1 without restoring castling rights.
54 end | White finishes its quiet Rook move.
55 b8-a6 | Black Knight can now repeat this formerly canceled move on a later turn.
56 peace-talks | Black after-move card cancels its h7 Pawn's Pacifism; discard Peace Talks then Pacifism, draw Chaos.
57 end | Black finishes; Crab alone remains active.
58 b4-c5 | White Crab moves one forward diagonal into empty c5, checking Black King d6.
59 end | White ends the checking move; Black receives its escape turn.
60 d6-c7 | Black King escapes Crab's forward diagonal attack by moving to safe c7.
61 end | Black finishes with both Kings safe.
62 d1-a4 | White Queen crosses empty c2 and b3 to capture Black's a7 Pawn on a4.
63 end | White completes the Queen capture.
64 c7-c6 | Black King steps safely to c6: Crab c5 cannot attack straight forward; b5 Pawn blocks Queen a4's diagonal.
65 end | Black finishes the safe King move.
66 c5-d6 | White Crab moves one forward diagonal into empty d6; King c6 remains safe.
67 end | White completes the Crab move.
68 e7-d6 | Black e7 Pawn captures the Crab diagonally; capture discards Crab and credits Black.
69 end | Black finishes; there are no Continuing Effects left.
70 a4-b3 | White Queen moves one diagonal step into empty b3.
71 end | White completes the quiet Queen move.
72 d8-e8 | Black Queen moves horizontally to the vacated royal starting square.
73 end | Black completes the quiet Queen move.
74 b3-b1 | White Queen crosses empty b2 down the file into empty b1.
75 end | White finishes its Queen move.
76 a6-c7 | Black Knight jumps two files and one rank onto empty c7.
77 end | Black completes the Knight move.
78 a3-a4 | White a2 Pawn advances one empty square.
79 end | White completes its Pawn move.
80 a8-a6 | Black Rook crosses empty a7 down the file into empty a6.
81 end | Black finishes the Rook move.
82 breakthrough | White replaces its move with h5xh6: ordinary h2 Pawn captures straight forward, now Pacifism is gone; draw Fireball.
83 end | White completes the replacement capture with no additional move.
84 a6-a4 | Black Rook crosses empty a5 and captures White's a2 Pawn on a4.
85 end | Black completes the Rook capture.
86 b1-b2 | White Queen advances one empty file square to b2.
87 end | White finishes its Queen move.
88 c6-c5 | Black King steps safely to c5; White Queen b2 does not attack c5.
89 end | Black completes its royal move.
90 winged-victory | White replaces its move by returning its captured a2 Pawn to empty central e4; clear capturedBy and draw Charge.
91 end | White finishes the Pawn-return replacement move.
92 e8-c6 | Black Queen crosses empty d7 diagonally to empty c6.
93 chaos | White immediately cancels e8-c6; restore board and clocks, forbid that exact movement, draw Lost Castle.
94 g8-e7 | Black Knight makes a different replacement jump onto empty e7; cancellation restriction expires.
95 end | Black finishes; White's reaction allowance resets.
96 g1-h3 | White Knight jumps to empty h3.
97 end | White completes the quiet Knight move.
98 a4-a8 | Black Rook crosses empty a5, a6, a7 to empty a8 without capturing.
99 fireball | Black explodes the just-moved a8 Rook, capturing it and adjacent b7 Pawn; no other neighbor is occupied, draw Winged Victory.
100 end | Black finishes after Fireball with no extra move and safe Kings.
101 h3-g1 | White Knight jumps back to empty g1.
102 end | White completes its Knight move.
103 f8-h6 | Black Bishop crosses empty g7 to capture White's h2 Pawn at h6.
104 end | Black completes its Bishop capture.
105 b2-a3 | White Queen steps diagonally to a3, checking King c5 through empty b4.
106 chaos | Black cancels the checking b2-a3 move immediately, restores the safe pre-move board and clocks, forbids repetition, draws Haunting Memories.
107 e2-e3 | White chooses a different replacement by advancing its e2 Pawn one empty rank.
108 end | White ends with safe Kings; Black receives the move and fresh card allowances.
`.trim().split('\n');

const targets: Record<number, unknown> = {
  15: 'h7', 21: undefined, 33: 'b4', 56: 'black-hand-1-pacifism',
  82: [{ from: 'h5', to: 'h6' }], 90: { pieceId: 'white-pawn-a2', to: 'e4' },
  93: undefined, 99: 'a8', 106: undefined,
};
const cardIds: Record<number, string> = {
  15: 'black-hand-1-pacifism', 21: 'white-hand-2-think-again', 33: 'white-hand-0-crab',
  56: 'black-hand-0-peace-talks', 82: 'white-hand-1-breakthrough', 90: 'white-hand-4-winged-victory',
  93: 'white-hand-3-chaos', 99: 'black-hand-3-fireball', 106: 'black-deck-1-chaos',
};
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const square = (file: number, rank: number) => `${String.fromCharCode(97 + file)}${rank + 1}`;
type Effect = { type: string; owner: Color; card: { id: string; cardId: string }; pieceId: string };

function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, effects: Effect[]): boolean {
  const [x, y] = xy(piece.square!); const [tx, ty] = xy(to);
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (capture && effects.some(e => e.type === 'pacifism' && e.pieceId === piece.id)) return false;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture || effects.some(e => e.type === 'crab' && e.pieceId === piece.id)) return ax === 1 && dy === forward;
    return dx === 0 && (dy === forward || dy === 2 * forward && (piece.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, square(x, y + forward)));
  }
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (!(piece.role === 'bishop' ? ax === ay : piece.role === 'rook' ? dx === 0 || dy === 0 : ax === ay || dx === 0 || dy === 0)) return false;
  for (let i = 1; i < Math.max(ax, ay); i++) if (at(pieces, square(x + i * Math.sign(dx), y + i * Math.sign(dy)))) return false;
  return true;
}

function checked(pieces: PieceState[], color: Color, effects: Effect[]): boolean {
  const king = pieces.find(p => p.owner === color && p.royal && p.zone === 'board')!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces, p, king.square!, true, effects));
}

function boardFen(pieces: PieceState[]): string {
  return Array.from({ length: 8 }, (_, i) => {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = at(pieces, square(file, 7 - i));
      if (!p) { empty++; continue; }
      if (empty) row += empty;
      empty = 0;
      const letter = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[p.role];
      row += p.owner === 'white' ? letter.toUpperCase() : letter;
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 156 independently reviewed physical board and complete obligations', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/156.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860156);
  assert.equal(review.length, trace.steps.length);
  assert.equal(trace.steps.length, 108);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 9);
  let state = createGameState(trace.initial);
  const initialPieces: PieceState[] = [];
  for (const color of ['white', 'black'] as const) for (let file = 0; file < 8; file++) {
    for (const role of ['pawn', (['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'] as const)[file]!] as const) {
      const location = square(file, role === 'pawn' ? color === 'white' ? 1 : 6 : color === 'white' ? 0 : 7) as SquareName;
      initialPieces.push({ id: `${color}-${role}-${location}`, owner: color, role, originalRole: role, square: location,
        zone: 'board', promoted: false, royal: role === 'king', neutral: false });
    }
  }
  let pieces = initialPieces, effects: Effect[] = [], ep: GameState['enPassant'] = [];
  let active: Color = 'white', actor: Color = 'white', moved = false, half = 0, full = 1, rights = 'KQkq', historyLength = 0;
  let allowances = { white: 0, black: 0 };
  let shield: GameState['shieldMove'];
  const players = Object.fromEntries((['white', 'black'] as const).map(color => [color, {
    hand: trace.initial.hands![color]!.map((cardId, i) => ({ id: `${color}-hand-${i}-${cardId}`, cardId })),
    deck: trace.initial.decks![color]!.map((cardId, i) => ({ id: `${color}-deck-${i}-${cardId}`, cardId })), discard: [],
  }])) as unknown as GameState['players'];
  type Snapshot = { pieces: PieceState[]; effects: Effect[]; ep: GameState['enPassant']; active: Color; actor: Color;
    moved: boolean; half: number; full: number; rights: string; allowances: typeof allowances };
  let previous: Snapshot | undefined;
  const capture = (victim: PieceState, captor: Color) => {
    assert.equal(victim.royal, false);
    assert.ok(!effects.some(e => e.type === 'pacifism' && e.pieceId === victim.id));
    victim.zone = 'captured'; victim.square = null; victim.capturedBy = captor;
    for (const e of effects.filter(e => e.pieceId === victim.id)) players[e.owner].discard.push(e.card);
    effects = effects.filter(e => e.pieceId !== victim.id);
  };
  const move = (from: string, to: string, special = false) => {
    const piece = at(pieces, from)!; assert.ok(piece); assert.equal(piece.owner, actor);
    const victim = at(pieces, to);
    assert.ok(!victim || victim.owner !== actor);
    if (special) { assert.equal(piece.role, 'pawn'); assert.ok(victim); assert.equal(to, square(xy(from)[0], xy(from)[1] + 1)); }
    else assert.ok(geometry(pieces, piece, to, !!victim, effects), `${from}-${to}: independent geometry`);
    const [x, y] = xy(from), [, ty] = xy(to);
    ep = piece.role === 'pawn' && Math.abs(ty - y) === 2 ? [{ target: square(x, (y + ty) / 2) as SquareName, pawnId: piece.id }] : [];
    if (victim) capture(victim, actor);
    shield = { player: actor, pieceIds: [piece.id], capturedOpponent: !!victim };
    piece.square = to as SquareName;
    if (piece.royal) rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '');
    for (const [id, right] of [['white-rook-a1', 'Q'], ['white-rook-h1', 'K'], ['black-rook-a8', 'q'], ['black-rook-h8', 'k']])
      if (piece.id === id || victim?.id === id) rights = rights.replace(right!, '');
    half = piece.role === 'pawn' || victim ? 0 : half + 1;
    if (actor === 'black') full++;
    active = opposite(actor); moved = true;
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action;
    const [heading, rationale] = review[index]!.split(' | ');
    const [number, command] = heading!.split(' ');
    assert.equal(Number(number), n); assert.ok(rationale!.length > 0);
    const original = structuredClone(state);
    let forbidden: GameState['chaosForbidden'];
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(command, `${from}-${to}`); assert.equal(action.promotion, undefined);
      assert.equal(moved, false);
      previous = structuredClone({ pieces, effects, ep, active, actor, moved, half, full, rights, allowances });
      move(from, to); historyLength++;
    } else if (action.type === 'endTurn') {
      assert.equal(command, 'end'); assert.equal(moved, true); assert.equal(checked(pieces, actor, effects), false);
      actor = opposite(actor); moved = false; allowances = { white: 0, black: 0 };
      shield = undefined;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unreviewed action');
      assert.equal(action.cardId, command); assert.equal(action.cardInstanceId, cardIds[n]); assert.deepEqual(action.target, targets[n]);
      const owner: Color = cardIds[n]!.startsWith('white') ? 'white' : 'black';
      assert.equal(allowances[owner], 0);
      const player = players[owner], position = player.hand.findIndex(c => c.id === cardIds[n]);
      assert.ok(position >= 0); const card = player.hand.splice(position, 1)[0]!;
      if (['chaos', 'think-again'].includes(command!)) {
        assert.equal(owner, opposite(actor)); assert.equal(moved, true); assert.ok(previous);
        const last = trace.steps[index - 1]!.action; assert.equal(last.type, 'move');
        if (last.type !== 'move') throw new Error('expected cancellation trigger');
        const canceled = previous.pieces.find(p => p.square === last.from && p.zone === 'board')!;
        forbidden = { player: actor, movement: `${canceled.id}:${last.from}:${last.to}` };
        ({ pieces, effects, ep, active, actor, moved, half, full, rights, allowances } = structuredClone(previous));
        shield = undefined;
      } else {
        assert.equal(owner, actor);
        assert.equal(moved, !['pacifism', 'breakthrough', 'winged-victory'].includes(command!));
        historyLength++;
        if (command === 'pacifism' || command === 'crab') {
          const target = at(pieces, targets[n] as string)!;
          assert.equal(target.owner, owner); assert.equal(target.royal, false);
          if (command === 'crab') assert.equal(target.originalRole, 'pawn');
          effects.push({ type: command, owner, card, pieceId: target.id });
        } else if (command === 'peace-talks') {
          const effect = effects.find(e => e.card.id === targets[n])!; assert.ok(effect);
          // Physical discard order is the played card followed by the canceled effect.
          player.discard.push(card); players[effect.owner].discard.push(effect.card);
          effects = effects.filter(e => e !== effect);
        } else if (command === 'breakthrough') move('h5', 'h6', true);
        else if (command === 'winged-victory') {
          const pawn = pieces.find(p => p.id === 'white-pawn-a2')!;
          assert.equal(pawn.zone, 'captured'); assert.equal(pawn.capturedBy, 'black'); assert.equal(pawn.originalRole, 'pawn');
          assert.equal(at(pieces, 'e4'), undefined); pawn.square = 'e4'; pawn.zone = 'board'; delete pawn.capturedBy;
          moved = true; active = 'black'; half = 0; ep = [];
          shield = { player: owner, pieceIds: [], capturedOpponent: false };
        } else if (command === 'fireball') {
          assert.deepEqual(trace.steps[index - 1]!.action, { type: 'move', from: 'a4', to: 'a8' });
          const victims = pieces.filter(p => p.zone === 'board' && Math.max(Math.abs(xy(p.square!)[0]), Math.abs(xy(p.square!)[1] - 7)) <= 1 && !p.royal);
          assert.deepEqual(victims.map(p => p.id).sort(), ['black-pawn-b7', 'black-rook-a8']);
          victims.forEach(p => capture(p, owner)); half = 0;
        } else throw new Error(`unreviewed card ${command}`);
      }
      if (!['pacifism', 'crab', 'peace-talks'].includes(command!)) player.discard.push(card);
      player.hand.push(player.deck.shift()!); allowances[owner]++;
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, original, `row ${n}: input-state immutability including capturedBy`);
    assert.ok(result.ok, `row ${n}: ${rationale}`); state = result.state;
    const sort = (items: PieceState[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(sort(state.pieces), sort(pieces), `row ${n}: physical identities, zones, roles and actual captors`);
    assert.deepEqual(state.players, players, `row ${n}: exact physical cards in all three zones`);
    assert.deepEqual(state.effects, effects, `row ${n}: complete effect records`);
    assert.deepEqual(state.enPassant, ep, `row ${n}: EP opportunities`);
    assert.deepEqual(state.turn, { color: actor, phase: moved ? 'afterMove' : 'beforeMove', moveMade: moved, cardPlays: allowances });
    assert.equal(state.history.length, historyLength, `row ${n}: canceled move removed from history`);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    assert.equal(state.pendingRescue ?? null, null); assert.equal(state.pendingAbduction ?? null, null);
    assert.equal(state.pendingDoomsayer ?? null, null); assert.deepEqual(state.underElfHill ?? [], []);
    assert.deepEqual(state.chaosForbidden, forbidden, `row ${n}: complete cancellation movement token`);
    assert.equal(state.plotsExecution, undefined); assert.deepEqual(state.plotsAllowances ?? [], []);
    assert.deepEqual(state.fogLocked ?? [], []); assert.deepEqual(state.riposteLostMoves ?? [], []);
    assert.equal(state.riposteSkipped, undefined); assert.equal(state.riposteCheckDeferred, undefined); assert.deepEqual(state.shieldMove, shield);
    for (const color of ['white', 'black'] as const) {
      const expectedCheck = checked(pieces, color, effects);
      assert.equal(expectedCheck, color === 'black' && [58, 59, 105].includes(n), `row ${n}: independent royal attack geometry`);
      assert.equal(isKingInCheck(state, color), expectedCheck, `row ${n}: ${color} royal threats`);
    }
    // EP must be evaluated for the prospective capturing player before their move,
    // including the exposed-file/diagonal royal-safety consequence of removing the victim.
    let legalEp: string | undefined;
    const prospective = structuredClone(state);
    prospective.turn = { color: active, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    const prospectiveDests = ep.length ? legalDests(prospective) : new Map<SquareName, SquareName[]>();
    for (const opportunity of ep) for (const pawn of pieces.filter(p => p.zone === 'board' && p.owner === active && p.role === 'pawn')) {
      const geometric = geometry(pieces, pawn, opportunity.target, true, effects);
      const board = structuredClone(pieces), attacker = board.find(p => p.id === pawn.id)!, victim = board.find(p => p.id === opportunity.pawnId)!;
      attacker.square = opportunity.target; victim.square = null; victim.zone = 'captured';
      const allowed = geometric && !checked(board, active, effects);
      assert.equal(prospectiveDests.get(pawn.square!)?.includes(opportunity.target) ?? false, allowed, `row ${n}: prospective legal EP`);
      if (allowed) legalEp = opportunity.target;
    }
    assert.equal(legalEp, undefined, `row ${n}: reviewed double steps have no legal adjacent captor`);
    assert.equal(state.fen, `${boardFen(pieces)} ${active[0]} ${rights || '-'} ${legalEp ?? '-'} ${half} ${full}`, `row ${n}: all six FEN fields`);
  }
  assert.equal(state.fen, '2b1q2r/2n1np2/3p3b/1pkp4/4P2p/2P1P3/1Q1P1PP1/R1B1KBN1 b - - 0 25');
});

test('iteration 156 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/156.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
