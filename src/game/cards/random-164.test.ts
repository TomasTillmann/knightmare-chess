import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Reviewed sequentially against rules §§8, 11.6, 13.1, 13.11, 16.3,
// 18.1 (Vendetta), 20 (swaps), 22.1 and the six cards' printed catalog metadata.
// Each row is an independently reviewed action, not an acceptance-derived label.
const review = [
  '1 b1a3: White Knight jumps to empty a3.',
  '2 end: Black receives the move; no card or clock change.',
  '3 h7h6: Black Pawn advances one empty square.',
  '4 end: White receives the move.',
  '5 g2g3: White Pawn advances one empty square.',
  '6 end: Black receives the move.',
  '7 lost-castle: Black swaps h8 Rook with White a1 Rook; consumes replacement move, loses k/Q rights; swap gives no Shield trigger.',
  '8 end: White receives the move; neither swapped Rook attacks a King.',
  '9 h8h7: White Rook moves down one empty square.',
  '10 end: Black receives the move.',
  '11 e7e5: Black Pawn double-steps through empty e6; record e6 opportunity but no White Pawn can use it.',
  '12 end: White receives the move; e6 opportunity survives.',
  '13 dark-mirror: White b2 Pawn captures Black h8 Rook backward on a1; no promotion, capture clock reset.',
  '14 end: Black receives the move; Dark Mirror is spent.',
  '15 d7d5: Black Pawn double-steps through empty d6; no White Pawn can capture en passant.',
  '16 end: White receives the move; d6 opportunity survives.',
  '17 c1b2: White Bishop moves one diagonal square vacated by Dark Mirror.',
  '18 end: Black receives the move.',
  '19 b7b6: Black Pawn advances one empty square.',
  '20 end: White receives the move.',
  '21 g1f3: White Knight jumps to empty f3.',
  '22 end: Black receives the move.',
  '23 d8h4: Black Queen traverses empty e7/f6/g5 diagonal.',
  '24 end: White receives the move.',
  '25 d1b1: White Queen traverses vacant c1 to b1.',
  '26 end: Black receives the move.',
  '27 h4g3: Black Queen captures White g2 Pawn on adjacent diagonal.',
  '28 end: White receives the move.',
  '29 h2h3: White Pawn advances without capture; qualifies as Fireball center.',
  '30 fireball: White h3 Pawn and adjacent Black g3 Queen are captured by White; f3 Knight lies outside blast.',
  '31 end: Black receives the move; Fireball is spent.',
  '32 g7g5: Black Pawn double-steps through empty g6; no White Pawn has en-passant geometry.',
  '33 vendetta: Black plays continuing effect after its move; next player must capture if possible.',
  '34 end: White has captures, including h1xh6; Vendetta remains.',
  '35 h1h6: White Rook crosses clear h2/h3/h4/h5, captures h7 Pawn and loses K right.',
  '36 end: Black can capture that Rook with f8 Bishop; Vendetta remains.',
  '37 f8h6: Black Bishop crosses clear g7 and captures White h1 Rook.',
  '38 end: White has f3xe5; Vendetta remains.',
  '39 f3e5: White Knight captures Black e7 Pawn under Vendetta.',
  '40 end: Black has no legal capture; Vendetta ends and its physical card enters Black discard.',
  '41 c8e6: Black Bishop crosses clear d7 to empty e6.',
  '42 end: White receives the move.',
  '43 e5c4: White Knight jumps to empty c4.',
  '44 end: Black receives the move.',
  '45 a7a5: Black Pawn double-steps through empty a6; no White Pawn can capture en passant.',
  '46 end: White receives the move; a6 opportunity survives.',
  '47 h7h8: White Rook advances one empty square.',
  '48 end: Black receives the move.',
  '49 b8c6: Black Knight jumps to empty c6.',
  '50 end: White receives the move.',
  '51 f1h3: White Bishop crosses clear g2 to empty h3.',
  '52 end: Black receives the move.',
  '53 a8a6: Black Rook crosses empty a7; loses final q right.',
  '54 end: White receives the move.',
  '55 h3f5: White Bishop crosses empty g4 to f5.',
  '56 end: Black receives the move.',
  '57 h6g7: Black Bishop moves one empty diagonal square.',
  '58 end: White receives the move.',
  '59 b2e5: White Bishop crosses empty c3/d4 to e5.',
  '60 end: Black receives the move.',
  '61 g7f8: Black Bishop retreats one empty diagonal square.',
  '62 end: White receives the move.',
  '63 h8h2: White Rook crosses empty h7/h6/h5/h4/h3.',
  '64 end: Black receives the move.',
  '65 d5d4: Black Pawn advances one empty square.',
  '66 end: White receives the move.',
  '67 e5f4: White Bishop moves one empty diagonal square.',
  '68 end: Black receives the move.',
  '69 d4d3: Black Pawn advances one empty square.',
  '70 end: White receives the move.',
  '71 h2h6: White Rook crosses clear h3/h4/h5.',
  '72 end: Black receives the move.',
  '73 e6d7: Black Bishop retreats one empty diagonal square.',
  '74 end: White receives the move.',
  '75 e2e3: White Pawn advances one empty square.',
  '76 end: Black receives the move.',
  '77 f8e7: Black Bishop moves one empty diagonal square.',
  '78 end: White receives the move.',
  '79 h6d6: White Rook crosses empty g6/f6/e6.',
  '80 end: Black receives the move.',
  '81 d7e6: Black Bishop moves one empty diagonal square.',
  '82 cowardice: Black pushes White d2 Pawn backward to vacant d1; no promotion, clock advance or new actual-move trigger.',
  '83 end: White receives the move.',
  '84 c2c3: White Pawn advances one empty square.',
  '85 end: Black receives the move.',
  '86 g8h6: Black Knight jumps to empty h6.',
  '87 end: White receives the move.',
  '88 f4g3: White Bishop moves one empty diagonal square.',
  '89 end: Black receives the move.',
  '90 c6a7: Black Knight jumps to empty a7.',
  '91 end: White receives the move.',
  '92 winged-victory: White g2 Pawn was captured by Black; returns on empty central d5, clearing captor, consuming replacement move.',
  '93 end: Black receives the move; returned Pawn has no Shield movement trigger.',
  '94 a7c8: Black Knight jumps to empty c8.',
  '95 end: White receives the move.',
  '96 f5h3: White Bishop crosses empty g4.',
  '97 end: Black receives the move.',
  '98 g5g4: Black Pawn advances one empty square.',
  '99 end: White receives the move.',
  '100 d6d8: White Rook crosses empty d7, checks Black King e8 along rank.',
  '101 end: Black gets its checked turn; e8xd8 is a safe ordinary escape.',
  '102 e8d8: Black King captures checking Rook on undefended d8.',
  '103 end: White receives the move; check is cured.',
  '104 h3g2: White Bishop moves one empty diagonal square.',
  '105 end: Black receives the move.',
  '106 e7f8: Black Bishop retreats one empty diagonal square.',
  '107 end: White receives the move.',
  '108 d1d2: Displaced White Pawn moves forward from first rank under §13.1.',
  '109 end: Black receives the move; 50 Regular Move commands reviewed.',
];

const cards: Record<number, GameAction> = {
  7: { type: 'playCard', cardId: 'lost-castle', cardInstanceId: 'black-hand-1-lost-castle', target: { own: 'h8', opponent: 'a1' } },
  13: { type: 'playCard', cardId: 'dark-mirror', cardInstanceId: 'white-hand-1-dark-mirror', target: [{ from: 'b2', to: 'a1' }] },
  30: { type: 'playCard', cardId: 'fireball', cardInstanceId: 'white-deck-0-fireball', target: 'h3' },
  33: { type: 'playCard', cardId: 'vendetta', cardInstanceId: 'black-hand-0-vendetta' },
  82: { type: 'playCard', cardId: 'cowardice', cardInstanceId: 'black-hand-4-cowardice', target: [{ from: 'd2', to: 'd1' }] },
  92: { type: 'playCard', cardId: 'winged-victory', cardInstanceId: 'white-hand-3-winged-victory', target: { pieceId: 'white-pawn-g2', to: 'd5' } },
};

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(piece.square!), [u, v] = xy(to), dx = u - x, dy = v - y;
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === forward;
    if (dx) return false;
    if (dy === forward) return true;
    return dy === 2 * forward && (piece.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, `${String.fromCharCode(97 + x)}${y + forward + 1}`);
  }
  if (piece.role === 'bishop' && Math.abs(dx) !== Math.abs(dy)) return false;
  if (piece.role === 'rook' && dx && dy) return false;
  if (piece.role === 'queen' && dx && dy && Math.abs(dx) !== Math.abs(dy)) return false;
  for (let i = 1; i < Math.max(Math.abs(dx), Math.abs(dy)); i++) {
    if (at(pieces, `${String.fromCharCode(97 + x + Math.sign(dx) * i)}${y + Math.sign(dy) * i + 1}`)) return false;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(pieces, p, king.square!, true));
}
function captures(pieces: PieceState[], color: Color): string[] {
  return pieces.filter(p => p.zone === 'board' && p.owner === color).flatMap(p =>
    pieces.filter(q => q.zone === 'board' && q.owner !== color && !q.royal && reaches(pieces, p, q.square!, true))
      .filter(q => !checked(pieces.map(r => r.id === p.id ? { ...r, square: q.square } : r.id === q.id ? { ...r, zone: 'captured', square: null } : r), color))
      .map(q => `${p.square}${q.square}`));
}
function placement(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0;
    for (const file of 'abcdefgh') {
      const p = at(pieces, `${file}${8 - rank}`);
      if (!p) { empty++; continue; }
      if (empty) row += empty;
      empty = 0;
      row += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 164: 109 independently reviewed actions, physical identities and all clocks/windows', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/164.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860164);
  assert.equal(review.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces);
  assert.equal(placement(pieces), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  for (const p of pieces) {
    const rank = Number(p.square![1]), file = p.square!.charCodeAt(0) - 97;
    const owner = rank < 3 ? 'white' : 'black';
    const role = rank === 2 || rank === 7 ? 'pawn' : (['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'] as const)[file]!;
    assert.deepEqual(p, { id: `${owner}-${role}-${p.square}`, owner, role, originalRole: role,
      square: p.square, zone: 'board', promoted: false, royal: role === 'king', neutral: false });
  }
  const players = structuredClone(state.players);
  const history: GameEvent[] = [];
  const playedCards: NonNullable<GameState['playedCards']> = [];
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let ep: GameState['enPassant'] = [], effects: unknown[] = [];
  let shield: GameState['shieldMove'];
  let rights = 'KQkq', half = 0, full = 1, fenColor = 'w';
  let moveCount = 0, cardCount = 0;
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, reason = review[index]!;
    assert.ok(reason.startsWith(`${n} `));
    const notation = reason.split(' ')[1]!.replace(':', '');
    const expectedAction = cards[n] ?? (notation === 'end' ? { type: 'endTurn' } : { type: 'move', from: notation.slice(0, 2), to: notation.slice(2) });
    assert.deepEqual(action, expectedAction, reason);
    const before = structuredClone(state), actor = turn.color;
    let capturedIds: string[] = [], actualMove = false, replacement = false;
    let card: { id: string; cardId: string } | undefined;
    const capture = (p: PieceState) => { assert.equal(p.royal, false); p.zone = 'captured'; p.square = null; p.capturedBy = actor; capturedIds.push(p.id); };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/);
      assert.equal(turn.moveMade, false);
      const p = at(pieces, from)!, victim = at(pieces, to);
      assert.ok(p, reason); assert.equal(p.owner, actor);
      assert.notEqual(victim?.owner, actor);
      assert.ok(reaches(pieces, p, to, !!victim), reason);
      if (effects.length) assert.ok(captures(pieces, actor).includes(from + to), 'Vendetta mandatory capture');
      ep = p.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2
        ? [{ pawnId: p.id, target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName }] : [];
      if (victim) capture(victim);
      p.square = to as SquareName;
      if (p.id === 'white-rook-h1') rights = rights.replace('K', '');
      if (p.id === 'black-rook-a8') rights = rights.replace('q', '');
      if (p.royal) rights = actor === 'white' ? rights.replace(/[KQ]/g, '') : rights.replace(/[kq]/g, '');
      half = victim || p.role === 'pawn' ? 0 : half + 1;
      full += actor === 'black' ? 1 : 0; fenColor = actor === 'white' ? 'b' : 'w';
      history.push({ type: 'move', from: from as SquareName, to: to as SquareName,
        ...(victim ? { capturedId: victim.id } : {}), ...(actor === 'black' ? { movedPieceId: p.id, movedRoles: [p.role] } : {}) });
      turn = { ...turn, phase: 'afterMove', moveMade: true };
      shield = { player: actor, pieceIds: [p.id], capturedOpponent: !!victim };
      actualMove = true; moveCount++;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true);
      assert.equal(checked(pieces, actor), false, 'turn cannot end in self-check');
      turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined;
      if (effects.length && !captures(pieces, turn.color).length) {
        assert.equal(n, 40, 'only reviewed Vendetta expiry');
        effects = []; players.black.discard.push({ id: 'black-hand-0-vendetta', cardId: 'vendetta' });
      }
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unreviewed action');
      cardCount++;
      const position = players[actor].hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(position >= 0); card = players[actor].hand[position]!;
      assert.equal(card.cardId, action.cardId); assert.equal(turn.cardPlays[actor], 0);
      replacement = [7, 13, 92].includes(n);
      assert.equal(turn.phase, replacement ? 'beforeMove' : 'afterMove');
      const event: GameEvent = { type: 'cardPlayed', cardId: card.cardId, ...(action.target === undefined ? {} : { target: action.target as GameEvent['target'] }), movement: [], preservePreviousMove: !replacement };
      if (n === 7) {
        const white = at(pieces, 'a1')!, black = at(pieces, 'h8')!;
        assert.equal(white.id, 'white-rook-a1'); assert.equal(black.id, 'black-rook-h8');
        white.square = 'h8'; black.square = 'a1'; rights = 'Kq'; half++;
        event.movement = [{ from: 'a1', to: 'h8' }, { from: 'h8', to: 'a1' }];
        shield = { player: actor, pieceIds: [], capturedOpponent: false };
      } else if (n === 13) {
        const p = at(pieces, 'b2')!, victim = at(pieces, 'a1')!;
        assert.equal(p.role, 'pawn'); assert.equal(p.owner, 'white'); assert.equal(victim.owner, 'black');
        capture(victim); p.square = 'a1'; half = 0;
        event.capturedId = victim.id; event.movement = [{ from: 'b2', to: 'a1' }];
        shield = { player: actor, pieceIds: [p.id], capturedOpponent: true };
      } else if (n === 30) {
        assert.deepEqual(shield, { player: 'white', pieceIds: ['white-pawn-h2'], capturedOpponent: false });
        const center = at(pieces, 'h3')!;
        const [x, y] = xy(center.square!);
        const victims = pieces.filter(p => p.zone === 'board' && !p.royal && Math.max(Math.abs(xy(p.square!)[0] - x), Math.abs(xy(p.square!)[1] - y)) <= 1);
        assert.deepEqual(victims.map(p => p.id), ['white-pawn-h2', 'black-queen-d8']);
        victims.forEach(capture); half = 0;
        event.capturedIds = [...capturedIds]; event.player = actor;
      } else if (n === 33) {
        effects = [{ type: 'vendetta', owner: actor, card: { ...card } }];
      } else if (n === 82) {
        const p = at(pieces, 'd2')!; assert.equal(p.owner, 'white'); assert.equal(p.originalRole, 'pawn');
        assert.equal(p.promoted, false); assert.equal(at(pieces, 'd1'), undefined);
        p.square = 'd1'; event.movement = [{ from: 'd2', to: 'd1' }];
      } else if (n === 92) {
        const p = pieces.find(p => p.id === 'white-pawn-g2')!;
        assert.equal(p.zone, 'captured'); assert.equal(p.capturedBy, 'black'); assert.equal(p.role, 'pawn');
        assert.equal(at(pieces, 'd5'), undefined);
        p.square = 'd5'; p.zone = 'board'; delete p.capturedBy; half = 0;
        shield = { player: actor, pieceIds: [], capturedOpponent: false };
      } else throw new Error('unreviewed card');
      players[actor].hand.splice(position, 1);
      players[actor].hand.push(players[actor].deck.shift()!);
      if (n !== 33) players[actor].discard.push(card);
      turn = { ...turn, cardPlays: { ...turn.cardPlays, [actor]: 1 } };
      if (replacement) {
        ep = []; full += actor === 'black' ? 1 : 0; fenColor = actor === 'white' ? 'b' : 'w';
        turn = { ...turn, phase: 'afterMove', moveMade: true };
      }
      history.push(event); playedCards.push({ player: actor, cardInstanceId: card.id });
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${reason}: input immutability including capturedBy/checkpoints`);
    assert.ok(result.ok, reason); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${reason}: complete physical identities, zones and captors`);
    assert.deepEqual(state.players, players, `${reason}: exact hand/deck/discard order and physical card IDs`);
    assert.deepEqual(state.turn, turn, reason); assert.deepEqual(state.effects, effects, reason);
    assert.deepEqual(state.history, history, reason); assert.deepEqual(state.playedCards ?? [], playedCards, reason);
    assert.deepEqual(state.enPassant, ep, reason); assert.equal(state.orientation, 0);
    // No prospective capturing Pawn has the required geometry on any double-step in this trace.
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!;
      const captor = opposite(victim.owner);
      const candidates = pieces.filter(p => p.zone === 'board' && p.owner === captor && p.role === 'pawn' && reaches(pieces, p, opportunity.target, true));
      assert.deepEqual(candidates, [], `${reason}: raw EP record is not a legal EP capture`);
      const prospective = { ...state, turn: { color: captor, phase: 'beforeMove' as const, moveMade: false, cardPlays: { white: 0, black: 0 } } };
      const destinations = legalDests(prospective);
      for (const p of pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === captor)) {
        assert.equal(destinations.get(p.square!)?.includes(opportunity.target) ?? false, false);
      }
    }
    assert.equal(state.fen, `${placement(pieces)} ${fenColor} ${rights || '-'} - ${half} ${full}`, `${reason}: all six FEN fields`);
    for (const color of ['white', 'black'] as const) {
      const threat = checked(pieces, color);
      assert.equal(threat, color === 'black' && [100, 101].includes(n), `${reason}: independent royal threats`);
      assert.equal(isKingInCheck(state, color), threat, `${reason}: engine agrees with physical-board attack oracle`);
    }
    assert.equal(state.pendingRescue ?? null, null, 'independent actor safety leaves no provisional rescue');
    assert.equal(state.pendingAbduction ?? null, null); assert.equal(state.pendingDoomsayer ?? null, null);
    assert.deepEqual(state.underElfHill ?? [], []); assert.equal(state.outcome, null);
    assert.equal(state.chaosForbidden, undefined); assert.equal(state.plotsExecution, undefined);
    assert.deepEqual(state.plotsAllowances ?? [], []); assert.deepEqual(state.fogLocked ?? [], []);
    assert.deepEqual(state.riposteLostMoves ?? [], []); assert.equal(state.riposteSkipped, undefined);
    assert.equal(state.riposteCheckDeferred, undefined); assert.equal(state.turnCheckpoint ?? null, null);
    assert.deepEqual(state.shieldMove, shield, `${reason}: complete actual-move identity trigger`);
    assert.deepEqual(state.cardResponse, card ? { player: actor, historyLength: history.length } : undefined);
    assert.deepEqual(state.legacyCapture, capturedIds.length ? { historyLength: history.length, pieceIds: capturedIds } : undefined);
    assert.deepEqual(state.fogCheckpoint, card ? { before, player: actor, card, historyLength: history.length } : undefined);
    const changes = pieces.flatMap(p => {
      const old = before.pieces.find(q => q.id === p.id)!;
      return old.square === p.square && old.zone === p.zone ? [] : [`${p.id}:${old.square ?? old.zone}:${p.square ?? p.zone}`];
    }).sort().join('|');
    assert.deepEqual(state.chaosCheckpoint, actualMove || replacement ? { before, movement: changes, historyLength: history.length, card } : undefined);
  }
  assert.equal(moveCount, 50); assert.equal(cardCount, 6);
  assert.equal(state.fen, '2nk1b2/2p2p2/rp2b2n/p2P4/2N3p1/N1PpP1B1/P2P1PB1/PQ2K3 b - - 0 27');
  assert.equal(replayTrace(trace).fen, state.fen);
});
