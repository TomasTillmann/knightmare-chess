import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck, cardPlayTargets, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed in order against rules §§8–13,16,20–22 and printed metadata.
const rationales = [
  '1 g2-g4 crosses empty g3; initial Pawn double step; no royal attack.',
  '2 White ends safely; g3 opportunity survives into Black turn.',
  '3 h7-h6 is one forward empty square and expires g3.',
  '4 Black ends with both Kings safe.',
  '5 c2-c4 crosses empty c3 and creates c3 opportunity.',
  '6 White ends; no Black Pawn can use c3.',
  '7 d7-d5 crosses d6 and creates d6 opportunity.',
  '8 Black ends; c4 Pawn is not on rank five for en passant.',
  '9 b2-b4 crosses b3 and creates b3 opportunity.',
  '10 White ends safely; no opposing adjacent Pawn.',
  '11 a7-a5 crosses a6 and creates a6 opportunity.',
  '12 Black ends; b4 Pawn cannot capture en passant from rank four.',
  '13 f2-f4 crosses f3 and creates f3 opportunity.',
  '14 White ends safely; no opposing adjacent Pawn.',
  '15 Bc8-f5 traverses empty d7,e6; expires en passant.',
  '16 Black ends with both Kings safe.',
  '17 c4-c5 advances one empty square.',
  '18 White ends safely.',
  '19 d5-d4 advances one empty square for Black.',
  '20 Black ends safely.',
  '21 Qd1-c2 moves one diagonal into vacated c2.',
  '22 White ends safely.',
  '23 Bf5-e4 moves one empty diagonal.',
  '24 Black hand-3 Truce is after-move Continuing Effect; draw deck-0 Cowardice.',
  '25 Black ends; Truce remains because neither raw King attack nor stalemate exists.',
  '26 Ke1-f2 is adjacent, vacated and raw-safe; White loses both castle rights.',
  '27 White ends; Truce remains.',
  '28 h6-h5 is a quiet forward step; Truce forbids no part of it.',
  '29 Black ends; raw Kings remain safe.',
  '30 a2-a3 is a quiet forward step.',
  '31 White ends; Truce remains.',
  '32 Be4-d5 moves one quiet diagonal.',
  '33 Black ends; Truce remains.',
  '34 Qc2-a4 traverses b3; Qa4-b5-c6-d7-e8 checks Black and ends Truce.',
  '35 White ends with Black checked but Nb8-c6 available; no mate.',
  '36 Ra8-a6 crosses a7 but leaves Qa4-e8 check; held Merciless Ra6-c6 is a concrete cure.',
  '37 Black deck-0 Cowardice f4-f3 cannot cure Qa4-e8: spend/draw, fizzle and undo Ra8-a6.',
  '38 Nb8-c6 legally blocks Qa4-e8; prior Rook token cannot grant a stale card permission.',
  '39 Black ends safely and resets allowances.',
  '40 Ng1-f3 is a knight jump to an empty square.',
  '41 White ends safely.',
  '42 Ke8-d7 is adjacent and safe with c6 blocking Qa4.',
  '43 Black ends; Black castle rights are gone.',
  '44 b4xa5 captures physical black-pawn-a7 diagonally.',
  '45 White ends with that Pawn captured by White.',
  '46 Rh8-h6 crosses empty h7.',
  '47 Black ends safely.',
  '48 Ra1-a2 moves to the square vacated by a2-a3.',
  '49 White ends safely.',
  '50 Kd7-c8 moves to an adjacent safe square.',
  '51 Black hand-0 Man-Trap marks owned Pawn square g7 after move; retained effect, draw Madman.',
  '52 Black ends; g7 trap remains untriggered.',
  '53 h2-h3 advances one square.',
  '54 White hand-1 Siege swaps physical Nf3 and Ra2, preserving clocks and h3 move trigger.',
  '55 White ends; swap creates no check.',
  '56 Black deck-1 Passing in the Night exchanges f7/h3 and h5/c5 atomically instead of move.',
  '57 Black ends; Pawn exchange has empty moved-identity token and no en passant.',
  '58 Rf3-c3 traverses empty e3,d3.',
  '59 White ends; g7 trap persists.',
  '60 Nc6-b8 is a knight jump, with Kc8 safe.',
  '61 Black ends safely.',
  '62 Qa4xd4 crosses empty b4,c4 and captures physical black-pawn-d7.',
  '63 White ends safely.',
  '64 Bd5-e4 is one empty diagonal.',
  '65 Black ends safely.',
  '66 Qd4-d3 moves one empty file square.',
  '67 White ends safely.',
  '68 Rh6-d6 crosses g6,f6,e6.',
  '69 Black ends safely.',
  '70 f4-f5 advances one empty square.',
  '71 White ends safely.',
  '72 Be4xd3 captures White original Queen diagonally.',
  '73 Black ends; Queen remains captured by Black.',
  '74 Rc3xc5 crosses c4 and captures physical black-pawn-h7 relocated by Passing in the Night.',
  '75 White ends safely.',
  '76 Rd6-c6 moves one empty rank square.',
  '77 Black ends safely.',
  '78 Rc5-c3 crosses c4 to an empty destination.',
  '79 White ends safely.',
  '80 Ra8-a7 moves one empty file square.',
  '81 Black ends safely.',
  '82 White hand-4 Breakthrough replaces move with d2xd3 forward capture of black-bishop-c8.',
  '83 White ends; both card and move spent.',
  '84 Black hand-1 Betrayal kills White f5 Pawn on Black half, returns captured black-pawn-h7 there.',
  '85 g7-g5 crosses g6; g7 trap remains at its marked square, creating g6 en passant.',
  '86 Black ends; h5 White Pawn can legally capture g6 en passant.',
  '87 Rc3-c2 forgoes en passant; g6 expires.',
  '88 White ends safely.',
  '89 f5xg4 captures white-pawn-g2 with returned black-pawn-h7.',
  '90 Black ends safely.',
  '91 e2-e3 advances into an empty square.',
  '92 White hand-2 Mystic Shield protects just-moved physical e2 Pawn at e3 for Black next turn.',
  '93 White ends; temporary Shield survives.',
  '94 Rc6-c5 moves one square; protected e3 Pawn is untouched.',
  '95 Black ends and Mystic Shield expires.',
  '96 Rc2-c4 crosses c3 to empty c4.',
  '97 White ends safely.',
  '98 Ng8-f6 jumps to an empty square.',
  '99 Black ends safely.',
  '100 Rc4-f4 crosses d4,e4.',
  '101 White ends safely.',
  '102 Rc5-c3 crosses c4.',
  '103 Black ends safely.',
  '104 Rf4-e4 moves one rank square.',
  '105 White ends safely.',
  '106 Black deck-3 Dark Mirror replaces move: g4xh5 captures backward, physical white-pawn-c2.',
  '107 White deck-2 Vulture reacts immediately: take exact Dark Mirror, discard deck-3 Dubbing, draw Think Again.',
  '108 Black ends; White has six cards and both allowances reset.',
  '109 Kf2-e2 is adjacent and safe.',
  '110 White ends safely.',
  '111 Rc3-b3 moves one rank square without giving check.',
  '112 Black ends safely; 50 move commands plus 10 card actions and 52 closures reviewed.',
];

const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(piece.square!); const [a, b] = xy(to);
  const dx = a - x, dy = b - y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === direction;
    return dx === 0 && (dy === direction || dy === 2 * direction && (y === (direction === 1 ? 1 : 6))
      && !at(pieces, `${piece.square![0]}${y + direction + 1}`));
  }
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (!(piece.role !== 'bishop' && (dx === 0 || dy === 0) || piece.role !== 'rook' && ax === ay)) return false;
  for (let n = 1; n < Math.max(ax, ay); n++) {
    if (at(pieces, `${String.fromCharCode(97 + x + n * Math.sign(dx))}${y + n * Math.sign(dy) + 1}`)) return false;
  }
  return true;
}
function attacked(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces, p, king.square!, true));
}
function boardFen(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, index) => {
    let row = '', empty = 0;
    for (const file of 'abcdefgh') {
      const piece = at(pieces, `${file}${8 - index}`);
      if (!piece) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += piece.owner === 'white' ? letters[piece.role].toUpperCase() : letters[piece.role];
    }
    return row + (empty || '');
  }).join('/');
}
const normalizeHistory = (events: GameEvent[]) => events.map(({ movedPieceId: _id, movedRoles: _roles, ...event }) => event);
function immutableApply(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state), payload = structuredClone(action);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'input state immutable');
  assert.deepEqual(action, payload, 'input command payload immutable');
  assert.ok(result.ok, JSON.stringify(action));
  return result.state;
}

// The independent model covers only the rules exercised by this deterministic trace.
function advance(expected: GameState, action: GameAction, row: number, rollback?: GameState): GameState {
  const e = structuredClone(expected), actor = e.turn.color;
  const fields = e.fen.split(' ');
  let moved = false, pawnMove = false, captured = false;
  const move = (from: string, to: SquareName, variant?: 'breakthrough' | 'dark-mirror') => {
    const p = at(e.pieces, from)!; assert.ok(p); assert.equal(p.owner, actor);
    const victim = at(e.pieces, to);
    assert.ok(!victim || victim.owner !== actor && !victim.royal);
    if (variant) {
      assert.equal(p.role, 'pawn'); assert.ok(victim);
      const [x, y] = xy(from), [a, b] = xy(to), direction = actor === 'white' ? 1 : -1;
      assert.ok(variant === 'breakthrough' ? a === x && b - y === direction : Math.abs(a - x) === 1 && b - y === -direction);
    } else assert.ok(geometry(e.pieces, p, to, !!victim), `row ${row} movement geometry`);
    if (victim) { victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor; captured = true; }
    if (e.effects.some(effect => (effect as { type: string }).type === 'truce')) assert.ok(!captured, 'Truce forbids capture');
    p.square = to; pawnMove = p.role === 'pawn'; moved = true;
    e.shieldMove = { player: actor, pieceIds: [p.id], capturedOpponent: captured };
    if (p.role === 'king') fields[2] = fields[2]!.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '') || '-';
    if (p.originalRole === 'rook') {
      const right = ({ a1: 'Q', h1: 'K', a8: 'q', h8: 'k' } as Record<string, string>)[from];
      if (right) fields[2] = fields[2]!.replace(right, '') || '-';
    }
    e.enPassant = pawnMove && Math.abs(Number(from[1]) - Number(to[1])) === 2
      ? [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }] : [];
    return { p, victim };
  };
  if (action.type === 'move') {
    assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
    assert.match(action.to, /^[a-h][1-8]$/); assert.equal(action.promotion, undefined);
    assert.equal(e.turn.moveMade, false);
    const { p, victim } = move(action.from, action.to as SquareName);
    e.history.push({ type: 'move', from: action.from as SquareName, to: action.to as SquareName,
      ...(victim ? { capturedId: victim.id } : {}), movedPieceId: p.id, movedRoles: [p.role] });
    e.turn.moveMade = true; e.turn.phase = 'afterMove';
    if (row === 36) e.pendingRescue = { fen: expected.fen, pieces: structuredClone(expected.pieces),
      enPassant: structuredClone(expected.enPassant), historyLength: expected.history.length,
      movedPieceIds: [p.id], before: structuredClone(expected) };
  } else if (action.type === 'endTurn') {
    assert.ok(e.turn.moveMade); assert.equal(attacked(e.pieces, actor), false);
    e.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    delete e.shieldMove; delete e.cardResponse;
    e.effects = e.effects.filter(effect => (effect as { type: string; player?: Color }).type !== 'mystic-shield'
      || (effect as { player: Color }).player !== other(actor));
  } else if (action.type === 'playCard') {
    const owner: Color = row === 107 ? 'white' : actor;
    const card = e.players[owner].hand.find(c => c.id === action.cardInstanceId);
    assert.ok(card); assert.equal(card.cardId, action.cardId); assert.equal(e.turn.cardPlays[owner], 0);
    assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(owner === actor ? e.turn.phase : 'afterOpponentCard'));
    if (owner !== actor) assert.equal(e.cardResponse?.player, actor);
    e.players[owner].hand = e.players[owner].hand.filter(c => c.id !== card.id);
    e.turn.cardPlays[owner]++;
    e.playedCards = [...e.playedCards ?? [], { player: owner, cardInstanceId: card.id }];
    let event: GameEvent = { type: 'cardPlayed', cardId: card.cardId, movement: [], preservePreviousMove: e.turn.moveMade };
    switch (card.cardId) {
      case 'truce': e.effects.push({ type: 'truce', owner, card }); break;
      case 'man-trap':
        assert.equal(action.target, 'g7'); assert.equal(at(e.pieces, 'g7')?.owner, owner);
        e.effects.push({ type: 'man-trap', owner, card, square: 'g7' }); break;
      case 'cowardice': {
        assert.deepEqual(action.target, [{ from: 'f4', to: 'f3' }]);
        assert.ok(rollback); assert.equal(at(e.pieces, 'f4')?.owner, 'white'); assert.ok(!at(e.pieces, 'f3'));
        const proposed = structuredClone(e.pieces); at(proposed, 'f4')!.square = 'f3';
        assert.equal(attacked(proposed, actor), true, 'Cowardice cannot cure Qa4-e8');
        e.pieces = structuredClone(rollback.pieces); e.fen = rollback.fen; e.enPassant = structuredClone(rollback.enPassant);
        e.history = structuredClone(rollback.history); e.pendingRescue = null;
        e.turn.moveMade = false; e.turn.phase = 'beforeMove';
        event = { type: 'cardFizzled', cardId: card.cardId, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false };
        break;
      }
      case 'siege': {
        assert.deepEqual(action.target, { knight: 'f3', rook: 'a2' });
        const n = at(e.pieces, 'f3')!, r = at(e.pieces, 'a2')!;
        assert.equal(n.role, 'knight'); assert.equal(r.role, 'rook'); assert.equal(n.owner, owner); assert.equal(r.owner, owner);
        n.square = 'a2'; r.square = 'f3';
        event.target = { knight: 'f3', rook: 'a2' };
        event.movement = [{ from: 'a2', to: 'f3' }, { from: 'f3', to: 'a2' }]; break;
      }
      case 'passing-in-the-night': {
        const pairs = [{ from: 'f7', to: 'h3' }, { from: 'h5', to: 'c5' }] as const;
        assert.deepEqual(action.target, pairs);
        for (const { from, to } of pairs) {
          const own = at(e.pieces, from)!, opponent = at(e.pieces, to)!;
          assert.equal(own.role, 'pawn'); assert.equal(own.owner, actor);
          assert.equal(opponent.role, 'pawn'); assert.equal(opponent.owner, other(actor));
          own.square = to; opponent.square = from;
        }
        event.target = [...pairs]; event.movement = [{ from: 'c5', to: 'h5' }, { from: 'h3', to: 'f7' }, ...pairs];
        e.enPassant = []; moved = true; pawnMove = true;
        e.shieldMove = { player: actor, pieceIds: [], capturedOpponent: false };
        e.turn.moveMade = true; e.turn.phase = 'afterMove'; break;
      }
      case 'breakthrough': case 'dark-mirror': {
        const target = card.cardId === 'breakthrough' ? { from: 'd2', to: 'd3' } as const : { from: 'g4', to: 'h5' } as const;
        assert.deepEqual(action.target, [target]);
        const { victim } = move(target.from, target.to, card.cardId);
        event.target = [target]; event.movement = [target]; event.capturedId = victim!.id;
        e.turn.moveMade = true; e.turn.phase = 'afterMove'; break;
      }
      case 'betrayal': {
        assert.deepEqual(action.target, { pieceId: 'black-pawn-h7', to: 'f5' });
        const victim = at(e.pieces, 'f5')!, replacement = e.pieces.find(p => p.id === 'black-pawn-h7')!;
        assert.equal(victim.owner, 'white'); assert.equal(victim.role, 'pawn'); assert.equal(victim.royal, false);
        assert.equal(replacement.zone, 'captured'); assert.equal(replacement.owner, actor);
        victim.zone = 'dead'; victim.square = null; delete victim.capturedBy;
        replacement.zone = 'board'; replacement.square = 'f5'; delete replacement.capturedBy;
        event.target = { pieceId: replacement.id, to: 'f5' }; break;
      }
      case 'mystic-shield':
        assert.equal(action.target, 'e3'); assert.deepEqual(e.shieldMove?.pieceIds, ['white-pawn-e2']);
        e.effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: 'white-pawn-e2' });
        event.target = 'e3'; event.player = owner; break;
      case 'merciless': {
        assert.deepEqual(action.target, [{ from: 'a6', to: 'c6' }]);
        assert.deepEqual(e.shieldMove, { player: 'black', pieceIds: ['black-rook-a8'], capturedOpponent: false });
        const { p } = move('a6', 'c6');
        assert.equal(p.id, 'black-rook-a8');
        moved = false; // Additional move clears EP but does not advance either clock again (§21.3).
        fields[3] = '-'; e.pendingRescue = null;
        event = { type: 'cardPlayed', cardId: 'merciless', from: 'a6', to: 'c6', movedPieceId: p.id,
          movedRoles: ['rook'], target: [{ from: 'a6', to: 'c6' }], preservePreviousMove: false,
          movement: [{ from: 'a6', to: 'c6' }] };
        break;
      }
      case 'vulture': {
        assert.equal(action.target, undefined);
        const taken = e.players.black.discard.pop()!;
        assert.deepEqual(taken, { id: 'black-deck-3-dark-mirror', cardId: 'dark-mirror' });
        const extra = e.players.white.deck.shift()!;
        assert.deepEqual(extra, { id: 'white-deck-3-dubbing', cardId: 'dubbing' });
        e.players.white.discard.push(extra);
        // Replacement precedes the transferred card in the public hand ordering.
        e.players.white.hand.push(e.players.white.deck.shift()!, taken);
        event.player = owner; break;
      }
      default: assert.fail(`unreviewed card ${card.cardId}`);
    }
    if (!CARD_CATALOG[card.cardId]!.continuing) e.players[owner].discard.push(card);
    if (card.cardId !== 'vulture') e.players[owner].hand.push(e.players[owner].deck.shift()!);
    e.history.push(event); e.cardResponse = { player: owner, historyLength: e.history.length };
  } else assert.fail('unreviewed action');
  if (moved) {
    fields[1] = actor === 'white' ? 'b' : 'w'; fields[4] = pawnMove || captured ? '0' : String(Number(fields[4]) + 1);
    fields[5] = String(Number(fields[5]) + (actor === 'black' ? 1 : 0));
    fields[3] = '-';
    for (const opportunity of e.enPassant) {
      for (const p of e.pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === other(actor))) {
        if (!geometry(e.pieces, p, opportunity.target, true)) continue;
        const simulated = structuredClone(e.pieces);
        simulated.find(q => q.id === p.id)!.square = opportunity.target;
        const victim = simulated.find(q => q.id === opportunity.pawnId)!; victim.square = null; victim.zone = 'captured';
        if (!attacked(simulated, other(actor))) fields[3] = opportunity.target;
      }
    }
  }
  if (row !== 37) { fields[0] = boardFen(e.pieces); e.fen = fields.join(' '); }
  if (e.effects.some(effect => (effect as { type: string }).type === 'truce') && (attacked(e.pieces, 'white') || attacked(e.pieces, 'black'))) {
    e.effects = e.effects.filter(effect => {
      const item = effect as { type: string; card: { id: string; cardId: string } };
      if (item.type !== 'truce') return true;
      e.players.black.discard.push(item.card); return false;
    });
  }
  return e;
}

function verify(actual: GameState, expected: GameState, row: number): void {
  const queryInput = structuredClone(actual);
  for (const key of ['pieces', 'players', 'fen', 'turn', 'effects', 'enPassant', 'orientation', 'outcome'] as const)
    assert.deepEqual(actual[key], expected[key], `row ${row}: ${key}`);
  assert.deepEqual(normalizeHistory(actual.history), normalizeHistory(expected.history), `row ${row}: full history`);
  actual.history.forEach((event, index) => {
    if (event.movedPieceId !== undefined) assert.equal(event.movedPieceId, expected.history[index]!.movedPieceId);
    if (event.movedRoles !== undefined) assert.deepEqual(event.movedRoles, expected.history[index]!.movedRoles);
  });
  for (const key of ['shieldMove', 'playedCards', 'cardResponse', 'chaosForbidden', 'plotsExecution', 'fogLocked',
    'riposteSkipped', 'riposteCheckDeferred', 'pendingAbduction', 'pendingDoomsayer'] as const)
    assert.deepEqual(actual[key] ?? null, expected[key] ?? null, `row ${row}: ${key}`);
  for (const key of ['plotsAllowances', 'riposteLostMoves', 'underElfHill'] as const)
    assert.deepEqual(actual[key] ?? [], [], `row ${row}: ${key}`);
  assert.equal(!!actual.pendingRescue, row === 36);
  if (row === 36) {
    const { before, ...token } = actual.pendingRescue!;
    const { before: expectedBefore, ...expectedToken } = expected.pendingRescue!;
    assert.deepEqual(token, expectedToken);
    assert.ok(before && expectedBefore);
    verify(before, expectedBefore, 35);
  }
  for (const color of ['white', 'black'] as const) {
    const raw = attacked(expected.pieces, color);
    // No restrictive capture effect in this trace attacks a royal identity; Truce ends on raw check.
    if (expected.effects.some(effect => (effect as { type: string }).type === 'truce')) assert.equal(raw, false);
    assert.equal(isKingInCheck(actual, color), raw, `row ${row}: ${color} royal threat`);
    assert.equal(raw, color === 'black' && row >= 34 && row <= 37, `row ${row}: independently reviewed check`);
  }
  // Serialize raw EP independently from the actual legal capture, using the next mover's window.
  const prospective: Color = expected.fen.split(' ')[1] === 'w' ? 'white' : 'black';
  for (const opportunity of expected.enPassant) {
    const context = structuredClone(actual);
    context.turn = { color: prospective, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    delete context.shieldMove;
    for (const p of expected.pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === prospective)) {
      if (!geometry(expected.pieces, p, opportunity.target, true)) continue;
      const simulation = structuredClone(expected.pieces);
      simulation.find(q => q.id === p.id)!.square = opportunity.target;
      const victim = simulation.find(q => q.id === opportunity.pawnId)!;
      assert.equal(victim.owner, other(prospective));
      victim.zone = 'captured'; victim.square = null;
      const contextInput = structuredClone(context);
      assert.equal(!!legalDests(context).get(p.square!)?.includes(opportunity.target), !attacked(simulation, prospective));
      assert.deepEqual(context, contextInput, 'en-passant destination query is immutable');
    }
  }
  assert.deepEqual(actual, queryInput, `row ${row}: royal and destination queries are immutable`);
}

function rescueWitness(actual: GameState, expected: GameState): void {
  // Qa4-e8 is a4,b5,c6,d7,e8; a6-b6-c6 is clear. This held Rook card blocks c6.
  assert.equal(attacked(expected.pieces, 'black'), true);
  assert.ok(!at(expected.pieces, 'b6') && !at(expected.pieces, 'c6'));
  const action: GameAction = { type: 'playCard', cardId: 'merciless', cardInstanceId: 'black-hand-2-merciless',
    target: [{ from: 'a6', to: 'c6' }] };
  const e = advance(expected, action, 200), a = immutableApply(actual, action);
  verify(a, e, 200);
  assert.equal(a.fen, '1n1qkbnr/1pp1ppp1/2r5/p1Pb3p/QP1p1PP1/P7/3PPK1P/RNB2BNR w k - 3 10');
  const end: GameAction = { type: 'endTurn' };
  verify(immutableApply(a, end), advance(e, end, 201), 201);
}

test('random campaign iteration 203', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/203.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860203);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(step => step.action.type === 'move').length, 50);
  assert.equal(trace.steps.length, 112);
  assert.equal(rationales.length, trace.steps.length);
  assert.deepEqual(trace.steps.flatMap((step, index) => step.action.type === 'playCard'
    ? [[index + 1, step.action.cardInstanceId]] : []), [
    [24, 'black-hand-3-truce'], [37, 'black-deck-0-cowardice'], [51, 'black-hand-0-man-trap'],
    [54, 'white-hand-1-siege'], [56, 'black-deck-1-passing-in-the-night'], [82, 'white-hand-4-breakthrough'],
    [84, 'black-hand-1-betrayal'], [92, 'white-hand-2-mystic-shield'], [106, 'black-deck-3-dark-mirror'],
    [107, 'white-deck-2-vulture'],
  ]);
  let actual = createGameState(trace.initial), expected = structuredClone(actual), rollback: GameState | undefined;
  expected.pieces = [];
  for (const rank of [1, 2, 7, 8]) {
    for (const [fileIndex, file] of [...'abcdefgh'].entries()) {
      const role = rank === 2 || rank === 7 ? 'pawn'
        : (['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'] as const)[fileIndex]!;
      const owner: Color = rank < 3 ? 'white' : 'black';
      const square = `${file}${rank}` as SquareName;
      expected.pieces.push({ id: `${owner}-${role}-${square}`, owner, role, originalRole: role,
        square, zone: 'board', promoted: false, royal: role === 'king', neutral: false });
    }
  }
  assert.deepEqual(actual.pieces, expected.pieces, 'standard physical identities and flags');
  for (const color of ['white', 'black'] as const) {
    expected.players[color] = {
      hand: trace.initial.hands![color]!.map((cardId, index) => ({ id: `${color}-hand-${index}-${cardId}`, cardId })),
      deck: trace.initial.decks![color]!.map((cardId, index) => ({ id: `${color}-deck-${index}-${cardId}`, cardId })), discard: [],
    };
  }
  assert.deepEqual(actual.players, expected.players, 'initial physical card ownership and order');
  assert.equal(actual.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  for (const [index, step] of trace.steps.entries()) {
    const row = index + 1;
    assert.ok(rationales[index]!.startsWith(`${row} `));
    if (row === 36) rollback = structuredClone(expected);
    expected = advance(expected, step.action, row, rollback);
    actual = immutableApply(actual, step.action);
    verify(actual, expected, row);
    if (row === 36) rescueWitness(actual, expected);
    if (row === 37) {
      // The retained Rook token is historical. Reset allowance to isolate timing from spending.
      const probe = structuredClone(actual); probe.turn.cardPlays.black = 0;
      const queryInput = structuredClone(probe);
      assert.deepEqual(cardPlayTargets(probe, 'merciless'), []);
      assert.deepEqual(probe, queryInput, 'inert-token card target query is immutable');
      const action: GameAction = { type: 'playCard', cardId: 'merciless', cardInstanceId: 'black-hand-2-merciless',
        target: [{ from: 'a8', to: 'a6' }] };
      const input = structuredClone(probe), payload = structuredClone(action);
      const result = applyAction(probe, action);
      assert.deepEqual(probe, input); assert.deepEqual(action, payload);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
    }
  }
  replayTrace(trace);
});
