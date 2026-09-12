import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in order against rules §§8–11, 13.6, 17.3, 18.2, 22.4,
// cards.md, and KC1/2/6/10/15/16/17 artwork. Every line is one reviewed action.
const review = `
1 c2-c3 | White Pawn advances one square to empty c3.
2 . | White finishes the c-Pawn turn; Black receives its allowance.
3 b8-c6 | Black Knight jumps one file and two ranks to empty c6.
4 . | Black finishes the Knight turn; White receives its allowance.
5 a2-a3 | White Pawn advances one square to empty a3.
6 # | Rebirth returns the enemy c6 Knight to its empty original b8 square after White moves.
7 . | White ends with Rebirth spent and its ordinary a-Pawn move preserved.
8 # | Black replaces its move with Under Elf Hill; e8 royal is away, never captured, and loses both rights.
9 . | Black ends its replacement turn; its King remains away for White's turn.
10 a1-a2 | White Rook moves one rank to the square vacated by its a-Pawn, losing Q-side rights.
11 . | White ends; Black's mandatory King return becomes due.
12 @e8 | Black returns its same King to empty safe edge e8; it cannot move this turn.
13 # | Black uses Plots before moving; only existing Disintegration and Assassin have legal targets. Full pawn rank blocks Forced March, Merciless is after-move.
14 h7-h6 | Black Pawn advances one rank; ordinary movement closes the unused Plots allowance.
15 . | Black ends; its returned King's movement restriction expires.
16 # | White Disintegration kills its own d2 Pawn before moving, without a capture or clock advance.
17 g1-h3 | White Knight jumps to empty h3; the dead d2 Pawn stays dead.
18 . | White ends after its Knight move and single card.
19 d7-d6 | Black Pawn advances one rank to empty d6.
20 . | Black finishes the d-Pawn turn.
21 a3-a4 | White Pawn advances one rank to empty a4.
22 . | White finishes the a-Pawn turn.
23 g7-g5 | Black Pawn double advances through empty g6; g6 opportunity exists but White has no adjacent Pawn on f5/h5.
24 . | Black ends; g6 opportunity survives until White's move, with no legal en-passant captor.
25 h1-g1 | White Rook moves to vacated g1, expires g6 opportunity, and loses its last castling right.
26 . | White finishes the Rook turn with neither side retaining castling rights.
27 d6-d5 | Black Pawn advances one rank to empty d5.
28 . | Black ends the d-Pawn turn.
29 b1-a3 | White Knight jumps to empty a3 after the a-Pawn has advanced.
30 . | White ends the second Knight's development turn.
31 # | Black Disintegration kills its own f7 Pawn before moving; no captor or extra move is recorded.
32 b7-b6 | Black Pawn advances one rank to empty b6.
33 . | Black ends after the b-Pawn move and Disintegration.
34 d1-d3 | White Queen travels through d2, now empty because of Disintegration, to empty d3.
35 . | White finishes the Queen turn.
36 b6-b5 | Black Pawn advances one rank to empty b5.
37 . | Black ends the b-Pawn advance.
38 # | White replaces its move with Under Elf Hill; original e1 King goes away and the quiet clock advances once.
39 . | White ends; its King stays absent during Black's turn.
40 e8-f7 | Black King moves diagonally to the square vacated by its dead f-Pawn; f7 is safe.
41 . | Black ends, making White's mandatory return due.
42 @b1 | White returns its original King to vacant safe edge b1 and keeps both ordinary allowances.
43 b2-b4 | White Pawn double advances through b3; no Black Pawn is on a4/c4 to capture en passant.
44 # | White Challenge names movable enemy g8 Knight after moving; f6 is a legal witness. It preserves b3 opportunity.
45 . | White ends; returned-King restriction expires and Black must use its g8 Knight.
46 g8-f6 | Black moves the challenged Knight by an L jump to empty f6, satisfying Challenge and expiring b3 opportunity.
47 . | Black finishes the compelled Knight turn with no remaining Challenge.
48 d3-g6 | White Queen follows clear e4/f5 diagonal to g6 and checks the Black King on f7.
49 . | White ends its checking move; Black must answer Qg6's diagonal check.
50 h8-g8 | Black Rook shifts one file but leaves Qg6-f7 check; held Merciless permits Rg8xg6 through empty g7 to rescue, so this move remains provisional, never endTurn.
51 # | Treason swaps White Rg1/Na3, which cannot cure Qg6-f7. It fizzles, spends/draws once, and rolls back the underlying illegal Rh8-g8 move.
52 f7-e6 | Black King escapes diagonally to e6; its f6 Knight interrupts Qg6's horizontal ray.
53 . | Black ends the legal replacement King move with Treason still spent.
54 a4-b5 | White a-Pawn captures Black b-Pawn diagonally; captor is White and the clock resets.
55 . | White ends after the b5 capture.
56 a7-a6 | Black Pawn advances one rank to empty a6.
57 . | Black ends the a-Pawn move.
58 a2-b2 | White Rook shifts one file to b2, vacated by the b-Pawn.
59 . | White ends the Rook transfer.
60 a8-a7 | Black Rook advances one rank to empty a7.
61 . | Black ends the Rook move.
62 b5-b6 | White original a-Pawn advances one rank to empty b6.
63 . | White ends the advanced a-Pawn move.
64 f8-g7 | Black Bishop moves one diagonal step to g7, vacated by the g-Pawn.
65 . | Black ends the Bishop move.
66 c1-g5 | White Bishop traverses empty d2/e3/f4 and captures Black g-Pawn on g5; White is the captor.
67 . | White ends after the Bishop capture.
68 d8-d6 | Black Queen descends through empty d7 to empty d6.
69 . | Black ends the Queen move.
70 f2-f4 | White Pawn double advances via empty f3; neither Black e4 nor g4 Pawn exists, so en passant is unavailable.
71 . | White ends while the f3 opportunity remains serialized only in the opportunity list.
72 d6-f4 | Black Queen crosses empty e5 to capture White f-Pawn on f4; Black is the captor and f3 expires.
73 . | Black ends the Queen capture.
74 b2-b3 | White Rook advances one rank to empty b3.
75 . | White ends the b-Rook move.
76 c8-d7 | Black Bishop moves one diagonal step to empty d7.
77 . | Black ends the Bishop move.
78 b4-b5 | White original b-Pawn advances one rank to empty b5 behind its a-Pawn.
79 . | White ends the b-Pawn advance.
80 # | Black Forced March simultaneously shifts d5-c5 and e7-f7 into initially empty distinct squares; consumes the move, creates no en passant.
81 . | Black ends after the two sideways Pawn moves and single replacement card.
82 g6-f5 | White Queen steps diagonally to empty f5 and checks Black King e6.
83 . | White ends its checking Queen move.
84 e6-e7 | Black King steps to empty e7, escaping Qf5; e7 is outside the Queen's lines.
85 . | Black ends its King escape.
86 e2-e3 | White Pawn advances one rank to empty e3.
87 . | White ends the e-Pawn move.
88 d7-c8 | Black Bishop returns diagonally to empty c8.
89 . | Black ends the Bishop return.
90 f5-e6 | White Queen steps diagonally to empty e6, checking Black King on e7 along the file.
91 . | White ends the Queen check.
92 c8-e6 | Black Bishop travels through empty d7 and captures White Queen e6, curing check; Black is the captor.
93 . | Black ends its checking-piece capture; the immediate Legacy window closes.
94 b1-c2 | White King steps diagonally to empty c2; the square is safe under the actual board geometry.
95 . | White ends the King move.
96 f4-a4 | Black Queen traverses empty e4/d4/c4/b4 to a4; White Rb3 blocks its a4-b3-c2 ray.
97 . | Black ends the Queen's fourth-rank transfer.
98 b6-c7 | White original a-Pawn captures Black c-Pawn diagonally; it is still unpromoted on rank seven.
99 . | White ends the c7 capture.
100 # | Black Assassin replaces its move with Ke7xf7 capturing its own original e-Pawn; f7 is safe and Black is the captor.
101 . | Black ends the Assassin replacement move with its own Pawn captured, not dead.
102 h3-f2 | White Knight jumps two files and one rank to f2, vacated by the captured f-Pawn.
103 . | White ends the Knight move.
104 a4-g4 | Black Queen crosses empty b4/c4/d4/e4/f4 to g4.
105 # | Black Challenge names White c3 Pawn after moving; c3-c4 is a legal witness with White King safe.
106 . | Black ends; White's next move must use its original c-Pawn.
107 c3-c4 | White Pawn advances one rank, satisfies Challenge, and leaves its King safe.
108 . | White ends with Challenge consumed.
109 a7-c7 | Black Rook travels through empty b7 and captures White original a-Pawn on c7; Black is the captor.
110 . | Black ends after the Rook capture.
111 f2-e4 | White Knight jumps one file and two ranks to empty e4.
112 . | White ends the Knight move.
113 f7-e8 | Black King steps diagonally to empty e8, which is safe.
114 . | Black ends the King return to e8 without restoring castling rights.
115 g1-h1 | White Rook shifts one file to empty h1; moving home does not restore castling.
116 . | White ends move command fifty with all obligations resolved and Black to act.
`.trim().split('\n');

const cards: Record<number, GameAction> = {
  6: { type: 'playCard', cardId: 'rebirth', cardInstanceId: 'white-hand-4-rebirth', target: [{ from: 'c6', to: 'b8' }] },
  8: { type: 'playCard', cardId: 'under-elf-hill', cardInstanceId: 'black-hand-4-under-elf-hill' },
  13: { type: 'playCard', cardId: 'plots-within-plots', cardInstanceId: 'black-hand-0-plots-within-plots', target: { player: 'black' } },
  16: { type: 'playCard', cardId: 'disintegration', cardInstanceId: 'white-hand-3-disintegration', target: 'd2' },
  31: { type: 'playCard', cardId: 'disintegration', cardInstanceId: 'black-hand-2-disintegration', target: 'f7' },
  38: { type: 'playCard', cardId: 'under-elf-hill', cardInstanceId: 'white-deck-0-under-elf-hill' },
  44: { type: 'playCard', cardId: 'challenge', cardInstanceId: 'white-hand-2-challenge', target: 'g8' },
  51: { type: 'playCard', cardId: 'treason', cardInstanceId: 'black-deck-2-treason', target: { rook: 'g1', knight: 'a3' } },
  80: { type: 'playCard', cardId: 'forced-march', cardInstanceId: 'black-hand-1-forced-march', target: [{ from: 'd5', to: 'c5' }, { from: 'e7', to: 'f7' }] },
  100: { type: 'playCard', cardId: 'assassin', cardInstanceId: 'black-deck-0-assassin', target: [{ from: 'e7', to: 'f7' }] },
  105: { type: 'playCard', cardId: 'challenge', cardInstanceId: 'black-deck-5-challenge', target: 'c3' },
};

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const square = (file: number, rank: number): SquareName => {
  const name = `${String.fromCharCode(97 + file)}${rank + 1}`;
  assert.match(name, /^[a-h][1-8]$/);
  return name as SquareName;
};
const at = (pieces: PieceState[], name: string) => pieces.find(p => p.zone === 'board' && p.square === name);

// Physical-board geometry; no reducer destinations/check helpers supply this oracle.
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === direction;
    return dx === 0 && (dy === direction || dy === 2 * direction
      && y === (piece.owner === 'white' ? 1 : 6) && !at(pieces, square(x, y + direction)));
  }
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
  if (!(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let i = 1; i < Math.max(Math.abs(dx), Math.abs(dy)); i++) {
    if (at(pieces, square(x + i * Math.sign(dx), y + i * Math.sign(dy)))) return false;
  }
  return true;
}

function checked(model: GameState, color: Color): boolean {
  const king = model.pieces.find(p => p.royal && p.owner === color && p.zone === 'board');
  if (!king?.square) return false;
  const actor = opposite(color);
  const challenge = model.effects.find((e): e is Extract<GameState['effects'][number], { type: 'challenge' }> =>
    typeof e === 'object' && e !== null && 'type' in e && e.type === 'challenge');
  return model.pieces.some(p => p.zone === 'board' && p.owner === actor
    && !(challenge?.player === actor && challenge.pieceId !== p.id)
    && !model.underElfHill?.some(e => e.pieceId === p.id && e.returned)
    && geometry(model.pieces, p, king.square!, true));
}

function boardFen(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, row) => {
    let rank = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = at(pieces, square(file, 7 - row));
      if (!p) { empty++; continue; }
      if (empty) rank += empty;
      empty = 0;
      rank += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return rank + (empty || '');
  }).join('/');
}

test('iteration 158: 116 independently reasoned actions, 50 move commands, 11 cards', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/158.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860158);
  assert.equal(review.length, 116);
  assert.equal(trace.steps.length, review.length);
  let state = createGameState(trace.initial);
  let model = structuredClone(state);
  assert.equal(model.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let active: Color = 'white', rights = 'KQkq', half = 0, full = 1;
  let rescueBefore: GameState | undefined;
  const spend = (action: Extract<GameAction, { type: 'playCard' }>) => {
    const player = model.players[model.turn.color];
    const index = player.hand.findIndex(c => c.id === action.cardInstanceId && c.cardId === action.cardId);
    assert.ok(index >= 0);
    assert.equal(model.turn.cardPlays[model.turn.color], 0);
    player.discard.push(player.hand.splice(index, 1)[0]!);
    player.hand.push(player.deck.shift()!);
    model.turn.cardPlays[model.turn.color]++;
  };
  const relocate = (from: string, to: SquareName) => {
    const p = at(model.pieces, from);
    assert.ok(p);
    assert.equal(at(model.pieces, to), undefined);
    p.square = to;
    return p;
  };
  const replacement = (reset: boolean) => {
    active = opposite(model.turn.color);
    if (model.turn.color === 'black') full++;
    half = reset ? 0 : half + 1;
    model.turn.phase = 'afterMove'; model.turn.moveMade = true;
    model.enPassant = [];
  };

  for (const [index, entry] of trace.steps.entries()) {
    const n = index + 1, reason = review[index]!;
    const match = reason.match(/^(\d+) (\S+) \| (.+)$/)!;
    assert.equal(Number(match[1]), n);
    const command = match[2]!;
    const expectedAction: GameAction = command === '#' ? cards[n]!
      : command === '.' ? { type: 'endTurn' }
      : command.startsWith('@') ? { type: 'returnKing', to: command.slice(1) }
      : { type: 'move', from: command.slice(0, 2), to: command.slice(3) };
    assert.deepEqual(entry.action, expectedAction, reason);
    const action = entry.action, actor = model.turn.color;
    const before = structuredClone(state);
    const modelBefore = structuredClone(model);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(to, /^[a-h][1-8]$/);
      const p = at(model.pieces, from), victim = at(model.pieces, to);
      assert.ok(p); assert.equal(p.owner, actor);
      assert.equal(model.turn.moveMade, false);
      assert.ok(geometry(model.pieces, p, to, !!victim), reason);
      assert.ok(!model.underElfHill?.some(e => e.pieceId === p.id && e.returned));
      for (const effect of model.effects) {
        const challenge = effect as { player: Color; pieceId: string };
        if (challenge.player === actor) assert.equal(p.id, challenge.pieceId);
      }
      if (victim) {
        assert.equal(victim.owner, opposite(actor)); assert.equal(victim.royal, false);
        victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor;
      }
      const [x, y] = xy(from), [, ty] = xy(to);
      p.square = to as SquareName;
      model.enPassant = p.role === 'pawn' && Math.abs(ty - y) === 2
        ? [{ target: square(x, (y + ty) / 2), pawnId: p.id }] : [];
      if (from === 'a1') rights = rights.replace('Q', '');
      if (from === 'h1') rights = rights.replace('K', '');
      half = p.role === 'pawn' || victim ? 0 : half + 1;
      if (actor === 'black') full++;
      active = opposite(actor);
      model.turn.phase = 'afterMove'; model.turn.moveMade = true;
      model.plotsAllowances = [];
      model.effects = [];
      model.shieldMove = { player: actor, pieceIds: [p.id], capturedOpponent: !!victim };
      model.history.push({ type: 'move', from: from as SquareName, to: to as SquareName,
        ...(victim ? { capturedId: victim.id } : {}), movedPieceId: p.id, movedRoles: [p.role] });
      if (n === 50) rescueBefore = before;
    } else if (action.type === 'endTurn') {
      assert.equal(model.turn.moveMade, true);
      assert.equal(checked(model, actor), false, reason);
      model.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      model.underElfHill = (model.underElfHill ?? []).filter(e => !e.returned)
        .map(e => e.player === model.turn.color ? { ...e, returning: true } : e);
      model.plotsAllowances = [];
      model.shieldMove = undefined;
    } else if (action.type === 'returnKing') {
      assert.ok(typeof action.to === 'string');
      assert.match(action.to, /^[a-h][1-8]$/);
      const to = action.to as SquareName, [x, y] = xy(to);
      assert.ok(x === 0 || x === 7 || y === 0 || y === 7);
      assert.equal(at(model.pieces, to), undefined);
      const pending = model.underElfHill!.find(e => e.player === actor)!;
      assert.equal(pending.returning, true);
      const king = model.pieces.find(p => p.id === pending.pieceId)!;
      assert.equal(king.zone, 'away'); king.zone = 'board'; king.square = to;
      pending.returned = true;
      assert.equal(checked(model, actor), false);
    } else if (action.type === 'playCard') {
      const timing = ['rebirth', 'challenge', 'treason'].includes(action.cardId) ? 'afterMove' : 'beforeMove';
      assert.equal(model.turn.phase, timing, reason);
      spend(action);
      let event: GameEvent = { type: 'cardPlayed', cardId: action.cardId, movement: [], preservePreviousMove: false };
      switch (n) {
        case 6:
          relocate('c6', 'b8');
          event = { ...event, target: [{ from: 'c6', to: 'b8' }], movement: [{ from: 'c6', to: 'b8' }], preservePreviousMove: true };
          break;
        case 8: case 38: {
          const king = model.pieces.find(p => p.owner === actor && p.royal)!;
          assert.equal(king.zone, 'board'); king.square = null; king.zone = 'away';
          rights = actor === 'black' ? rights.replace(/[kq]/g, '') : rights.replace(/[KQ]/g, '');
          model.underElfHill = [{ pieceId: king.id, player: actor, returning: false }];
          model.shieldMove = { player: actor, pieceIds: [], capturedOpponent: false };
          replacement(false);
          break;
        }
        case 13:
          model.plotsAllowances = [{ player: 'black', remaining: 2,
            eligibleCards: ['black-hand-2-disintegration', 'black-deck-0-assassin'],
            window: { phase: 'beforeMove', moveMade: false,
              capture: undefined, cardResponse: undefined, fogCheckpoint: undefined, legacyCapture: undefined, shieldMove: undefined,
              reaction: { type: 'move', from: 'a1', to: 'a2', movedPieceId: 'white-rook-a1', movedRoles: ['rook'] } } }];
          event = { ...event, player: 'black', preservePreviousMove: true };
          break;
        case 16: case 31: {
          const target = n === 16 ? 'd2' : 'f7', pawn = at(model.pieces, target)!;
          assert.equal(pawn.owner, actor); assert.equal(pawn.role, 'pawn');
          pawn.square = null; pawn.zone = 'dead'; delete pawn.capturedBy;
          event = { ...event, target };
          break;
        }
        case 44: case 105: {
          const target = n === 44 ? 'g8' : 'c3', witness = n === 44 ? 'f6' : 'c4';
          const p = at(model.pieces, target)!;
          assert.equal(p.owner, opposite(actor)); assert.ok(!p.royal && p.role !== 'queen');
          assert.equal(at(model.pieces, witness), undefined);
          assert.ok(geometry(model.pieces, p, witness, false));
          const hypothetical = structuredClone(model);
          hypothetical.pieces.find(piece => piece.id === p.id)!.square = witness;
          assert.equal(checked(hypothetical, p.owner), false);
          model.effects = [{ type: 'challenge', owner: actor, player: opposite(actor), pieceId: p.id }];
          event = { ...event, target, preservePreviousMove: true };
          break;
        }
        case 51: {
          assert.ok(rescueBefore);
          const proposed = structuredClone(model);
          const rook = at(proposed.pieces, 'g1')!, knight = at(proposed.pieces, 'a3')!;
          assert.equal(rook.owner, 'white'); assert.equal(rook.role, 'rook');
          assert.equal(knight.owner, 'white'); assert.equal(knight.role, 'knight');
          rook.square = 'a3'; knight.square = 'g1';
          assert.equal(checked(proposed, 'black'), true, 'Treason cannot cure Qg6-f7');
          model.pieces = structuredClone(rescueBefore.pieces);
          model.history.pop();
          model.enPassant = [];
          active = 'black'; half = 2; full = 11;
          model.turn.phase = 'beforeMove'; model.turn.moveMade = false;
          event = { type: 'cardFizzled', cardId: 'treason', reason: 'SELF_CHECK', movement: [], preservePreviousMove: false };
          break;
        }
        case 80:
          assert.equal(at(model.pieces, 'd5')!.role, 'pawn');
          assert.equal(at(model.pieces, 'e7')!.role, 'pawn');
          relocate('d5', 'c5'); relocate('e7', 'f7'); replacement(true);
          model.shieldMove = { player: 'black', pieceIds: ['black-pawn-d7', 'black-pawn-e7'], capturedOpponent: false };
          event = { ...event, target: [{ from: 'd5', to: 'c5' }, { from: 'e7', to: 'f7' }], movement: [{ from: 'd5', to: 'c5' }, { from: 'e7', to: 'f7' }] };
          break;
        case 100: {
          const king = at(model.pieces, 'e7')!, victim = at(model.pieces, 'f7')!;
          assert.equal(king.owner, 'black'); assert.equal(victim.owner, 'black');
          assert.equal(victim.royal, false); assert.ok(geometry(model.pieces, king, 'f7', true));
          victim.square = null; victim.zone = 'captured'; victim.capturedBy = 'black';
          king.square = 'f7'; replacement(true);
          model.shieldMove = { player: 'black', pieceIds: [king.id], capturedOpponent: false };
          event = { ...event, target: [{ from: 'e7', to: 'f7' }], movement: [{ from: 'e7', to: 'f7' }], capturedId: victim.id };
          break;
        }
        default: assert.fail(`Unreviewed card at ${n}`);
      }
      model.history.push(event);
    } else assert.fail('Unreviewed action');

    // None of the three double pushes has an adjacent prospective capturing Pawn.
    // Query legal availability in that player's before-move context, separately from raw FEN.
    for (const ep of model.enPassant) {
      const victim = model.pieces.find(p => p.id === ep.pawnId)!;
      const prospective = opposite(victim.owner);
      assert.equal(model.pieces.some(p => p.zone === 'board' && p.owner === prospective && p.role === 'pawn'
        && geometry(model.pieces, p, ep.target, true)), false, reason);
    }
    model.fen = `${boardFen(model.pieces)} ${active === 'white' ? 'w' : 'b'} ${rights || '-'} - ${half} ${full}`;
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${reason}: input immutability including capturedBy`);
    assert.ok(result.ok, reason);
    state = result.state;
    assert.deepEqual(state.pieces, model.pieces, `${reason}: full physical identities/zones/captors`);
    assert.equal(state.fen, model.fen, `${reason}: all six FEN fields`);
    assert.deepEqual(state.turn, model.turn, `${reason}: turn/phase/allowances`);
    assert.deepEqual(state.players, model.players, `${reason}: exact physical card accounting`);
    assert.deepEqual(state.effects, model.effects, `${reason}: exact effects`);
    assert.deepEqual(state.history, model.history, `${reason}: movement/capture/rewind history`);
    assert.deepEqual(state.enPassant, model.enPassant, `${reason}: prospective opportunity records`);
    assert.deepEqual(state.underElfHill ?? [], model.underElfHill ?? [], `${reason}: mandatory return/immobility`);
    assert.deepEqual(state.plotsAllowances ?? [], model.plotsAllowances ?? [], `${reason}: exact saved Plots window`);
    assert.deepEqual(state.shieldMove, model.shieldMove, `${reason}: exact latest movement token`);
    for (const key of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const)
      assert.equal(state[key], undefined, `${reason}: ${key}`);
    for (const key of ['fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(state[key] ?? [], [], `${reason}: ${key}`);
    for (const key of ['pendingAbduction', 'pendingDoomsayer', 'outcome'] as const) assert.equal(state[key] ?? null, null, `${reason}: ${key}`);
    assert.equal(state.orientation, 0);
    assert.ok(model.pieces.every(p => !p.neutral && p.role === p.originalRole && !p.promoted));
    for (const color of ['white', 'black'] as const) {
      const expectedCheck = color === 'black' && (n >= 48 && n <= 51 || n >= 82 && n <= 83 || n >= 90 && n <= 91);
      assert.equal(checked(model, color), expectedCheck, `${reason}: independent ${color} royal attack`);
      assert.equal(isKingInCheck(state, color), expectedCheck, `${reason}: public ${color} check`);
    }
    if (n === 50) {
      assert.deepEqual(state.pendingRescue, {
        before, fen: modelBefore.fen, pieces: modelBefore.pieces, enPassant: [],
        historyLength: 26, movedPieceIds: ['black-rook-h8'],
      }, 'Complete pre-move rescue checkpoint, including physical board and FEN');
      const saving = structuredClone(model), savingInput = structuredClone(state);
      const rook = at(saving.pieces, 'g8')!, queen = at(saving.pieces, 'g6')!;
      assert.ok(geometry(saving.pieces, rook, 'g6', true), 'Merciless path g8-g7-g6 is clear');
      assert.equal(queen.owner, 'white'); assert.equal(queen.role, 'queen');
      queen.zone = 'captured'; queen.square = null; queen.capturedBy = 'black'; rook.square = 'g6';
      assert.equal(checked(saving, 'black'), false, 'Merciless removes the sole checking Queen');
      assert.equal(checked(saving, 'white'), false, 'Merciless does not give direct mate');
      const saved = applyAction(state, { type: 'playCard', cardId: 'merciless',
        cardInstanceId: 'black-hand-3-merciless', target: [{ from: 'g8', to: 'g6' }] });
      assert.deepEqual(state, savingInput, 'Independent rescue probe leaves trace input unchanged');
      assert.ok(saved.ok, 'Held eligible Merciless is a concrete rescue, not inferred from pendingRescue');
      assert.deepEqual(saved.state.pieces, saving.pieces);
      assert.equal(saved.state.fen, `${boardFen(saving.pieces)} w - - 0 12`);
      assert.equal(saved.state.pendingRescue ?? null, null);
      assert.deepEqual(saved.state.turn, { color: 'black', phase: 'afterMove', moveMade: true, cardPlays: { white: 0, black: 1 } });
      const expectedPlayers = structuredClone(model.players), hand = expectedPlayers.black.hand;
      const index = hand.findIndex(card => card.id === 'black-hand-3-merciless');
      assert.ok(index >= 0); expectedPlayers.black.discard.push(hand.splice(index, 1)[0]!);
      hand.push(expectedPlayers.black.deck.shift()!);
      assert.deepEqual(saved.state.players, expectedPlayers);
    } else assert.equal(state.pendingRescue ?? null, null, `${reason}: no unreviewed rescue`);
    for (const ep of model.enPassant) {
      const victim = model.pieces.find(p => p.id === ep.pawnId)!;
      const prospective = opposite(victim.owner), context = structuredClone(state);
      context.turn = { color: prospective, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      context.fen = context.fen.replace(/ [wb] /, prospective === 'white' ? ' w ' : ' b ');
      const destinations = legalDests(context);
      for (const p of model.pieces.filter(p => p.zone === 'board' && p.owner === prospective && p.role === 'pawn'))
        assert.ok(!destinations.get(p.square!)?.includes(ep.target), `${reason}: no legal en passant`);
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11);
  assert.equal(state.fen, '1n2k2r/2r3b1/p3bn1p/1Pp3B1/2P1N1q1/NR2P3/2K3PP/5B1R b - - 3 27');
  replayTrace(trace);
});
