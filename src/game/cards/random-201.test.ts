import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed in chronological order against rules §§11, 13, 17, 20–22.
// Every line covers the complete transition assertions below, including quiet ends.
const rationales = `
1 Nb1-a3 jumps to an empty square.
2 White closes its quiet knight turn; no card draw.
3 h7-h6 advances one square without capture.
4 Black closes its pawn turn.
5 e2-e4 crosses empty e3; records e3 but no adjacent black captor.
6 White closes; the physical e-pawn opportunity persists.
7 d7-d5 crosses empty d6 and replaces the previous opportunity.
8 Black closes; no white pawn can capture d6.
9 Qd1-h5 has clear e2,f3,g4 diagonal.
10 White Disintegration kills its original d2 Pawn after moving, draws Fanatic.
11 White closes with d2 dead and its card allowance resetting.
12 Bc8-e6 crosses vacated d7.
13 Black Siege exchanges its g8 Knight and h8 Rook; neither is a move or capture.
14 Black closes; the exchange preserves the prior Bishop move token only until close.
15 Ra1-b1 enters the vacated Knight square and loses queenside castling.
16 White closes its rook turn.
17 Black Madman jumps d5-f3 over the white e4 Pawn without capturing it.
18 Black closes the replacement move.
19 h2-h3 advances one empty square.
20 White closes its pawn turn.
21 Qd8-d2 follows the entirely empty d-file and checks Ke1 diagonally.
22 Black closes; White gets its check response.
23 Bc1xd2 captures the checking physical black Queen.
24 White closes with its King safe.
25 Nb8-c6 jumps to an empty square.
26 Black closes its knight turn.
27 Qh5-d5 crosses empty g5,f5,e5.
28 White closes its queen turn.
29 Nc6-e5 is a legal quiet knight jump.
30 White Knightmare cancels exactly Nc6-e5, restores clocks and forbids its repetition.
31 Be6xd5 is a different replacement; captures the physical white Queen.
32 Black closes; White next receives fresh card allowance.
33 Bd2-e3 traverses one diagonal square.
34 White closes its bishop turn.
35 f7-f6 advances one square.
36 Black closes its pawn turn.
37 Bf1-d3 passes through vacated e2.
38 White closes its bishop turn.
39 Ke8-d7 is one safe diagonal step and removes both black castling rights.
40 Black closes its king turn.
41 Be3-b6 crosses empty d4,c5.
42 White closes its bishop turn.
43 Black Hidden Passage relocates royal d7-f7 to an empty safe square instead of moving.
44 Black closes the royal replacement move.
45 Bd3-a6 crosses empty c4,b5.
46 White closes its bishop turn.
47 Ra8-e8 crosses empty b8,c8,d8.
48 Black closes its rook turn.
49 White Fanatic advances b2-b5 through empty b3,b4; creates no en-passant right.
50 White closes the replacement pawn move.
51 Re8-b8 crosses empty d8,c8.
52 Black closes its rook turn.
53 c2-c4 crosses empty c3; no adjacent black pawn can capture c3.
54 White closes with that physical pawn opportunity retained.
55 Kf7-g6 is one safe diagonal step.
56 Black closes its king turn.
57 Bb6-c5 is a quiet diagonal step.
58 White closes its bishop turn.
59 Nc6-d8 is a quiet knight jump.
60 Black closes its knight turn.
61 Ng1-e2 is a quiet knight jump.
62 White closes its knight turn.
63 Black Evil Eye uses b7 Pawn threatening a6 Bishop; captures that Bishop without moving b7.
64 Black closes its capture replacement move.
65 Rb1-d1 crosses empty c1.
66 White closes its rook turn.
67 Tournament h8/a3 would put White Knight on h8 attacking Kg6, so it fizzles and consumes the safe-start replacement move.
68 Black closes with unchanged physical pieces and spent Tournament.
69 Rh1-g1 moves one square and removes the last castling right.
70 White closes its rook turn.
71 f3xg2 captures the white g2 Pawn diagonally with the original black d7 Pawn.
72 White Hostage captures its c4 Pawn for Black and returns the exact g2 Pawn to c4; no movement or rollback.
73 Black closes with both physical pawn identities preserved in their new zones.
74 Rg1xg2 captures the original black d7 Pawn and checks Kg6 along the clear g-file.
75 White closes; Black must cure the rook check.
76 Bd5-e6 provisionally leaves Rg2 checking Kg6; held Crusade can move the same Bishop e6-g4 to interpose.
77 Black Crusade immediately moves e6-g4 through empty f5, blocking the rook; extra move does not increment clocks.
78 Black successfully closes the rescued turn.
79 Ne2-d4 is a quiet knight jump.
80 White closes its knight turn.
81 a7-a5 crosses a6; White b5 Pawn has a safe en-passant capture on a6.
82 Black closes with the legal a6 en-passant target retained.
83 Nd4-e2 declines en-passant and expires the a6 opportunity.
84 White closes its knight turn.
85 c7-c6 advances into an empty square.
86 Black closes its pawn turn.
87 Ke1-d2 is a safe adjacent diagonal move.
88 White closes its king turn.
89 e7-e5 crosses empty e6; neither white Pawn on b5 nor e4 can capture e6.
90 Black closes with an uncapturable physical e6 opportunity and FEN dash.
91 Kd2-c3 is a safe adjacent diagonal move.
92 White closes its king turn.
93 Rb8-a8 is a quiet horizontal step.
94 Black closes its rook turn.
95 b5-b6 advances into an empty square.
96 White closes its pawn turn.
97 Ra8-c8 crosses empty b8.
98 Black closes its rook turn.
99 Rd1xd8 crosses empty d2-d7 and captures the black original b8 Knight.
100 White closes its capture turn.
101 Rc8-b8 is a quiet horizontal step.
102 Black closes its rook turn.
103 Rg2-g1 is a quiet vertical step.
104 White closes its rook turn.
105 Bf8-d6 crosses empty e7.
106 Black closes its bishop turn.
107 White Masquerade moves non-Pawn Rg1-f1 along an empty queen ray without capture.
108 White closes the replacement move.
109 Bd6-e7 is a quiet diagonal step.
110 Black closes its bishop turn.
111 Bc5-b4 is a quiet diagonal step.
112 White closes its bishop turn.
113 Bg4-f3 is a quiet diagonal step.
114 Black closes its bishop turn.
115 Ne2-f4 is a quiet knight jump.
116 White closes move command fifty; no unresolved obligation remains.
`.trim().split('\n');

const cardActions: Record<number, GameAction> = {
  10: { type: 'playCard', cardId: 'disintegration', cardInstanceId: 'white-hand-1-disintegration', target: 'd2' },
  13: { type: 'playCard', cardId: 'siege', cardInstanceId: 'black-hand-4-siege', target: { knight: 'g8', rook: 'h8' } },
  17: { type: 'playCard', cardId: 'madman', cardInstanceId: 'black-hand-1-madman', target: [{ from: 'd5', to: 'f3' }] },
  30: { type: 'playCard', cardId: 'knightmare', cardInstanceId: 'white-hand-3-knightmare' },
  43: { type: 'playCard', cardId: 'hidden-passage', cardInstanceId: 'black-hand-0-hidden-passage', target: [{ from: 'd7', to: 'f7' }] },
  49: { type: 'playCard', cardId: 'fanatic', cardInstanceId: 'white-deck-0-fanatic', target: 'b2' },
  63: { type: 'playCard', cardId: 'evil-eye', cardInstanceId: 'black-deck-1-evil-eye', target: { attacker: 'b7', victim: 'a6' } },
  67: { type: 'playCard', cardId: 'tournament', cardInstanceId: 'black-deck-0-tournament', target: { own: 'h8', opponent: 'a3' } },
  72: { type: 'playCard', cardId: 'hostage', cardInstanceId: 'white-hand-0-hostage', target: { pieceId: 'white-pawn-g2', pawn: 'c4' } },
  77: { type: 'playCard', cardId: 'crusade', cardInstanceId: 'black-hand-2-crusade', target: [{ from: 'e6', to: 'g4' }] },
  107: { type: 'playCard', cardId: 'masquerade', cardInstanceId: 'white-deck-1-masquerade', target: [{ from: 'g1', to: 'f1' }] },
};

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
function reaches(pieces: PieceState[], piece: PieceState, to: string, attack: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  const a = Math.abs(dx), b = Math.abs(dy);
  if (!a && !b) return false;
  if (piece.role === 'knight') return a * b === 2;
  if (piece.role === 'king') return Math.max(a, b) === 1;
  if (piece.role === 'pawn') {
    const d = piece.owner === 'white' ? 1 : -1;
    if (attack) return a === 1 && dy === d;
    return dx === 0 && !at(pieces, to) && (dy === d || dy === 2 * d && y === (d === 1 ? 1 : 6)
      && !at(pieces, `${piece.square[0]}${y + d + 1}`));
  }
  if (!(piece.role === 'bishop' ? a === b : piece.role === 'rook' ? !a || !b : a === b || !a || !b)) return false;
  for (let n = 1; n < Math.max(a, b); n++) {
    if (at(pieces, `${String.fromCharCode(97 + x + n * Math.sign(dx))}${y + n * Math.sign(dy) + 1}`)) return false;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  assert.ok(king.square);
  return pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(pieces, p, king.square!, true));
}
function placement(pieces: PieceState[]): string {
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = at(pieces, `${String.fromCharCode(97 + file)}${8 - rank}`);
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const symbol = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' }[p.role];
      row += p.owner === 'white' ? symbol.toUpperCase() : symbol;
    }
    return row + (empty || '');
  }).join('/');
}
function immutableApply(state: GameState, action: GameAction) {
  const before = structuredClone(state), payload = structuredClone(action);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'GameState input remains immutable');
  assert.deepEqual(action, payload, 'GameAction input remains immutable');
  return result;
}

test('iteration 201 independently verified campaign replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/201.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860201);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 116);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  let history: GameEvent[] = [], turn = structuredClone(state.turn);
  const playedCards: NonNullable<GameState['playedCards']> = [];
  let cardResponse: GameState['cardResponse'];
  let ep: GameState['enPassant'] = [], shield: GameState['shieldMove'];
  let forbidden: GameState['chaosForbidden'];
  let rights = 'KQkq', half = 0, full = 1, active: Color = 'white';
  let previous: { pieces: PieceState[]; ep: GameState['enPassant']; fen: string; history: GameEvent[]; half: number; full: number; rights: string };
  let rescueProbe: GameState | undefined;
  const expectedFen = () => `${placement(pieces)} ${active[0]} ${rights || '-'} ${ep.some(e => pieces.some(p => p.owner === active && p.role === 'pawn' && p.zone === 'board' && reaches(pieces, p, e.target, true))) ? ep[0]!.target : '-'} ${half} ${full}`;
  for (const [i, step] of trace.steps.entries()) {
    const n = i + 1, action = step.action;
    assert.ok(rationales[i]!.startsWith(`${n} `));
    const before = structuredClone(state);
    const boardBefore = structuredClone(pieces);
    const capture = (p: PieceState, owner: Color) => { p.square = null; p.zone = 'captured'; p.capturedBy = owner; };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(to, /^[a-h][1-8]$/);
      const p = at(pieces, from)!, victim = at(pieces, to);
      assert.ok(p); assert.equal(p.owner, turn.color); assert.equal(turn.moveMade, false);
      assert.ok(reaches(pieces, p, to, !!victim), rationales[i]);
      if (victim) { assert.notEqual(victim.owner, p.owner); assert.equal(victim.royal, false); }
      previous = { pieces: structuredClone(pieces), ep: structuredClone(ep), fen: expectedFen(), history: structuredClone(history), half, full, rights };
      if (p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kqh]/g, '');
      if (from === 'a1') rights = rights.replace('Q', '');
      if (from === 'h1') rights = rights.replace('K', '');
      if (from === 'a8') rights = rights.replace('q', '');
      if (from === 'h8' && p.role === 'rook') rights = rights.replace(/[kh]/g, '');
      ep = p.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2
        ? [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }] : [];
      half = p.role === 'pawn' || victim ? 0 : half + 1;
      if (turn.color === 'black') full++;
      if (victim) capture(victim, turn.color);
      p.square = to as SquareName;
      history.push({ type: 'move', from: from as SquareName, to: to as SquareName,
        ...(victim ? { capturedId: victim.id } : {}),
        ...(turn.color === 'black' ? { movedPieceId: p.id, movedRoles: [p.role] } : {}) });
      shield = { player: turn.color, pieceIds: [p.id], capturedOpponent: !!victim };
      forbidden = undefined;
      active = opposite(turn.color); turn.phase = 'afterMove'; turn.moveMade = true;
      assert.equal(checked(pieces, turn.color), n === 76, rationales[i]);
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true); assert.equal(checked(pieces, turn.color), false);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined; forbidden = undefined;
      cardResponse = undefined;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('Unexpected choice');
      assert.deepEqual(action, cardActions[n], 'exact reviewed physical card and target');
      const owner: Color = n === 30 || n === 72 ? 'white' : turn.color;
      const card = players[owner].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card); assert.equal(card.cardId, action.cardId); assert.equal(turn.cardPlays[owner], 0);
      const timing = owner !== turn.color ? 'afterOpponentMove' : turn.phase;
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(timing));
      assert.equal(CARD_CATALOG[card.cardId]!.continuing, false);
      players[owner].hand = players[owner].hand.filter(c => c.id !== card.id);
      players[owner].discard.push(card); players[owner].hand.push(players[owner].deck.shift()!);
      turn.cardPlays[owner]++;
      let movement: Array<{ from: SquareName; to: SquareName }> = [];
      const replace = [17, 43, 49, 63, 67, 107].includes(n);
      if (n === 10) { const p = at(pieces, 'd2')!; p.square = null; p.zone = 'dead'; }
      if (n === 13) { at(pieces, 'g8')!.square = 'h8'; pieces.find(p => p.id === 'black-rook-h8')!.square = 'g8'; rights = rights.replace('k', 'h'); movement = [{ from: 'g8', to: 'h8' }, { from: 'h8', to: 'g8' }]; }
      const moves: Record<number, [SquareName, SquareName]> = { 17: ['d5', 'f3'], 43: ['d7', 'f7'], 49: ['b2', 'b5'], 77: ['e6', 'g4'], 107: ['g1', 'f1'] };
      if (moves[n]) {
        const [from, to] = moves[n]!, p = at(pieces, from)!;
        assert.ok(p); assert.equal(at(pieces, to), undefined);
        if (n === 17) assert.equal(at(pieces, 'e4')?.id, 'white-pawn-e2');
        if (n === 49) for (const s of ['b3', 'b4', 'b5']) assert.equal(at(pieces, s), undefined);
        if (n === 77 || n === 107) assert.ok(reaches(pieces, p, to, false));
        p.square = to; movement = [{ from, to }]; shield = { player: owner, pieceIds: [p.id], capturedOpponent: false };
        ep = [];
      }
      if (n === 63) {
        const victim = at(pieces, 'a6')!, attacker = at(pieces, 'b7')!;
        assert.ok(reaches(pieces, attacker, 'a6', true));
        const simulation = structuredClone(pieces);
        simulation.find(p => p.id === victim.id)!.zone = 'captured';
        simulation.find(p => p.id === victim.id)!.square = null;
        simulation.find(p => p.id === attacker.id)!.square = 'a6';
        assert.equal(checked(simulation, 'black'), false, 'Evil Eye requires a legal capture');
        capture(victim, 'black'); shield = { player: 'black', pieceIds: [], capturedOpponent: true };
      }
      if (n === 67) {
        const hypothetical = structuredClone(pieces);
        hypothetical.find(p => p.id === 'black-knight-g8')!.square = 'a3';
        hypothetical.find(p => p.id === 'white-knight-b1')!.square = 'h8';
        assert.equal(checked(hypothetical, 'black'), true, 'White Nh8 checks Kg6');
        assert.equal(checked(pieces, 'black'), false, 'safe before replacement fizzle');
        shield = undefined;
      }
      if (n === 72) {
        const returned = pieces.find(p => p.id === 'white-pawn-g2')!;
        assert.equal(returned.zone, 'captured'); assert.equal(history.at(-1)?.capturedId, returned.id);
        capture(at(pieces, 'c4')!, 'black'); returned.square = 'c4'; returned.zone = 'board'; delete returned.capturedBy; half = 0;
      }
      if (replace) {
        half = [17, 49, 63].includes(n) ? 0 : half + 1;
        if (owner === 'black') full++;
        ep = []; active = opposite(owner); turn.phase = 'afterMove'; turn.moveMade = true;
      }
      if (n === 30) {
        pieces = structuredClone(previous!.pieces); ep = structuredClone(previous!.ep);
        rights = previous!.rights; half = previous!.half; full = previous!.full; history = structuredClone(previous!.history);
        active = 'black'; turn.phase = 'beforeMove'; turn.moveMade = false; shield = undefined;
        forbidden = { player: 'black', movement: 'black-knight-b8:c6:e5' };
        history.push({ type: 'cardPlayed', cardId: 'knightmare', player: 'white', movement: [{ from: 'e5', to: 'c6' }], preservePreviousMove: true });
      } else if (n === 67) history.push({ type: 'cardFizzled', cardId: 'tournament', reason: 'SELF_CHECK', movement: [], preservePreviousMove: false });
      else history.push({ type: 'cardPlayed', cardId: card.cardId, target: action.target as GameEvent['target'], movement,
        preservePreviousMove: [10, 13, 72].includes(n),
        ...(n === 63 ? { capturedId: 'white-bishop-f1', capturedIds: ['white-bishop-f1'] } : {}),
        ...(n === 72 ? { player: 'white' as const, capturedId: 'white-pawn-c2', capturedIds: ['white-pawn-c2'] } : {}),
        ...(n === 77 ? { from: 'e6' as const, to: 'g4' as const, movedPieceId: 'black-bishop-c8', movedRoles: ['bishop' as const] } : {}) });
      assert.equal(checked(pieces, owner), false, rationales[i]);
      playedCards.push({ player: owner, cardInstanceId: card.id });
      cardResponse = { player: owner, historyLength: history.length };
    }
    const result = immutableApply(state, action);
    assert.ok(result.ok, rationales[i]); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${n}: complete physical identity and capture actor oracle`);
    assert.deepEqual(state.players, players, `${n}: exact hands, decks, discard ordering`);
    assert.deepEqual(state.effects, []); assert.deepEqual(state.history, history, `${n}: complete event history`);
    assert.deepEqual(state.playedCards ?? [], playedCards, `${n}: complete physical card play history, including fizzles`);
    // A token can remain historical after a move; its saved history position closes the immediate window.
    assert.deepEqual(state.cardResponse, cardResponse, `${n}: exact card response token`);
    assert.deepEqual(state.turn, turn); assert.deepEqual(state.enPassant, ep);
    assert.equal(state.fen, expectedFen(), `${n}: six FEN fields`);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    assert.deepEqual(state.shieldMove, shield); assert.deepEqual(state.chaosForbidden, forbidden);
    for (const key of ['plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined);
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(state[key] ?? [], []);
    assert.equal(state.pendingAbduction ?? null, null); assert.equal(state.pendingDoomsayer ?? null, null);
    const beforeQueries = structuredClone(state);
    for (const color of ['white', 'black'] as const) assert.equal(isKingInCheck(state, color), checked(pieces, color), `${n}: independent royal attack geometry`);
    assert.deepEqual(state, beforeQueries, 'royal queries are immutable');
    if (n === 30) {
      const repeat = immutableApply(state, { type: 'move', from: 'c6', to: 'e5' });
      assert.equal(repeat.ok, false); assert.deepEqual(repeat.state, state);
      assert.equal(legalDests(state).get('c6')?.includes('e5') ?? false, false);
    }
    if (n === 76) {
      assert.ok(state.pendingRescue);
      assert.deepEqual(state.pendingRescue.pieces, boardBefore);
      assert.equal(state.pendingRescue.fen, before.fen); assert.deepEqual(state.pendingRescue.enPassant, before.enPassant);
      assert.equal(state.pendingRescue.historyLength, before.history.length);
      assert.equal(state.pendingRescue.history, undefined, 'history is retained in the complete before snapshot');
      assert.ok(state.pendingRescue.before);
      for (const key of ['fen', 'pieces', 'enPassant', 'history', 'players', 'turn', 'effects', 'orientation', 'outcome', 'playedCards', 'cardResponse'] as const) {
        assert.deepEqual(state.pendingRescue.before[key], before[key], `rescue checkpoint ${key}`);
      }
      assert.deepEqual(state.pendingRescue.movedPieceIds, ['black-bishop-c8']);
      const premature = immutableApply(state, { type: 'endTurn' }); assert.equal(premature.ok, false);
      // Concrete held-card witness, independently fully accounted by the next two rows.
      const witness = immutableApply(state, structuredClone(cardActions[77]!));
      assert.ok(witness.ok); rescueProbe = witness.state;
      assert.deepEqual(rescueProbe.playedCards, [...playedCards, { player: 'black', cardInstanceId: 'black-hand-2-crusade' }]);
      assert.deepEqual(rescueProbe.cardResponse, { player: 'black', historyLength: 41 });
    } else assert.equal(state.pendingRescue ?? null, null);
    if (n === 77) {
      assert.deepEqual(state, rescueProbe, 'independent branch reaches the fully asserted cure state');
      const close = immutableApply(rescueProbe!, { type: 'endTurn' }); assert.ok(close.ok); rescueProbe = close.state;
      assert.deepEqual(rescueProbe.playedCards, playedCards, 'closing the cure preserves every physical card play');
      assert.equal(rescueProbe.cardResponse, undefined, 'closing the cure clears the response window');
    }
    if (n === 78) assert.deepEqual(state, rescueProbe, 'rescued turn closes with full physical/card/effect/history/FEN accounting');
    // Prospective capturing player, before-move context; simulate both Pawn motions.
    if (ep.length) {
      const prospective = structuredClone(state);
      prospective.turn = { color: active, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const original = structuredClone(prospective), dests = legalDests(prospective);
      assert.deepEqual(prospective, original);
      for (const pawn of pieces.filter(p => p.zone === 'board' && p.owner === active && p.role === 'pawn')) {
        const e = ep[0]!, geometry = reaches(pieces, pawn, e.target, true);
        const hypothetical = structuredClone(pieces);
        const victim = hypothetical.find(p => p.id === e.pawnId)!;
        victim.zone = 'captured'; victim.square = null;
        hypothetical.find(p => p.id === pawn.id)!.square = e.target;
        const legal = geometry && !checked(hypothetical, active);
        assert.equal(dests.get(pawn.square!)?.includes(e.target) ?? false, legal, `${n}: en-passant capture and royal safety`);
      }
    }
  }
  assert.equal(state.fen, '1r1R2rn/1p2b1p1/1Pp2pkp/p3p3/1BP1PN2/N1K2b1P/P4P2/5R2 b - - 8 28');
  replayTrace(trace);
});
