import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyAction, isKingInCheck, legalDests, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/198.json', import.meta.url), 'utf8')) as RandomTrace;

// Independently reviewed in order against rules §§8–11, 14.3, 17.1, 19.1, 20,
// cards.md and KC7/9/11/12/14/19/20 artwork. The oracle never reads review rows or hashes.
const rationales = [
  '1. h2-h3: White Pawn advances one empty square.',
  '2. Close White turn after h3; reset both card allowances.',
  '3. g7-g5: Black Pawn advances through empty g6 from home; record g6 EP.',
  '4. Close Black turn; no White Pawn can capture on g6.',
  '5. a2-a4: White Pawn advances through a3 from home; record a3 EP.',
  '6. Close White turn; no Black Pawn can capture on a3.',
  '7. a7-a6: Black Pawn advances one empty square; expire a3 EP.',
  '8. Close Black turn after a6 without another clock tick.',
  '9. a1-a3: White Rook traverses empty a2; revoke queenside castling.',
  '10. Close White turn after Ra3.',
  '11. d7-d5: Black Pawn advances through d6 from home; record d6 EP.',
  '12. Close Black turn; no White Pawn can capture on d6.',
  '13. e2-e4: White Pawn advances through e3 from home; replace EP with e3.',
  '14. Close White turn; Black d5 Pawn is too far from e3 for EP.',
  '15. c8-d7: Black Bishop takes one vacant diagonal step.',
  '16. Close Black turn after Bd7.',
  '17. c2-c4: White Pawn advances through c3 from home; record c3 EP.',
  '18. Close White turn; Black d5 Pawn cannot capture c3.',
  '19. d5xe4: Black Pawn takes White original e2 Pawn diagonally; captor Black.',
  '20. Close Black turn after the capture; no EP remains.',
  '21. g2-g3: White Pawn advances one empty square.',
  '22. White Forbidden City after move marks empty b5, retains card and draws Fog of War.',
  '23. Close White turn; b5 remains an impassable square.',
  '24. d7-g4: Black Bishop traverses empty e6 and f5; avoids b5.',
  '25. Close Black turn after Bg4.',
  '26. b2-b3: White Pawn advances one vacant square.',
  '27. Close White turn after b3.',
  '28. b8-d7: Black Knight jumps two files and one rank.',
  '29. Close Black turn after Nd7.',
  '30. a3-a2: White Rook moves one square down its clear file.',
  '31. White Crab after move marks own original g2 Pawn on g3; retain card and draw Blessing.',
  '32. Close White turn; Crab stays on g3 with diagonal Pawn attacks.',
  '33. a6-a5: Black Pawn advances one empty square.',
  '34. Close Black turn after a5.',
  '35. f1-e2: White Bishop moves one vacant diagonal step.',
  '36. Close White turn after Be2.',
  '37. f7-f6: Black Pawn advances one vacant square.',
  '38. Close Black turn after f6.',
  '39. e2-f3: White Bishop moves one vacant diagonal step.',
  '40. Close White turn after Bf3.',
  '41. f6-f5: Black Pawn advances one vacant square.',
  '42. Close Black turn after f5.',
  '43. d1-c2: White Queen moves one vacant diagonal step.',
  '44. Close White turn after Qc2.',
  '45. c7-c5: Black Pawn advances through empty c6 from home; record c6 EP.',
  '46. Close Black turn; White c4 Pawn cannot capture c6.',
  '47. f3-d1: White Bishop traverses vacant e2; destination is empty.',
  '48. Close White turn after Bd1; EP has expired.',
  '49. f8-g7: Black Bishop moves one vacant diagonal step.',
  '50. Close Black turn after Bg7.',
  '51. White Blessing instead of move takes h3 Pawn diagonally backward to empty g2; reset Pawn clock.',
  '52. Close White turn; spent Blessing replaced by Haunting Memories.',
  '53. d7-f8: Black Knight jumps two files and one rank to empty f8.',
  '54. Close Black turn after Nf8.',
  '55. f2-f4: White Pawn advances through f3; Black e4 Pawn can legally capture en passant.',
  '56. Close White turn retaining physical and serialized f3 EP for Black.',
  '57. b7-b6: Black chooses a quiet Pawn move instead; f3 EP expires.',
  '58. Close Black turn after b6.',
  '59. White Evangelists instead of move simultaneously swaps own c1 Bishop with Black g4 Bishop.',
  '60. Close White turn; swap made no capture or arrival move and drew Knightmare.',
  '61. c1-a3: Black Bishop traverses vacant b2; a3 is empty.',
  '62. Close Black turn after Ba3.',
  '63. e1-f2: White King steps diagonally to safe f2; revoke remaining White castling.',
  '64. Close White turn after Kf2.',
  '65. d8-d4: Black Queen traverses empty d7,d6,d5, checking White f2 along e3.',
  '66. Close Black turn; White receives a checked turn with ordinary escape e2.',
  '67. f2-e2: White King escapes the d4-e3-f2 Queen diagonal.',
  '68. Close White turn after the safe King escape.',
  '69. a3-b4: Black Bishop moves one vacant diagonal step.',
  '70. Close Black turn after Bb4.',
  '71. g1-f3: White Knight jumps one file and two ranks.',
  '72. Close White turn after Nf3.',
  '73. g7-f6: Black Bishop moves one vacant diagonal step.',
  '74. Close Black turn after Bf6.',
  '75. f3-g1: White Knight returns by its ordinary jump.',
  '76. Close White turn after Ng1.',
  '77. f8-g6: Black Knight jumps one file and two ranks.',
  '78. Close Black turn after Ng6.',
  '79. c2-c1: White Queen moves one empty square down the file.',
  '80. Black Chaos reacts immediately, restores Qc2 and clocks, removes canceled move, bans c2-c1.',
  '81. c2xe4: White chooses different Queen diagonal through empty d3, captures Black original d7 Pawn.',
  '82. Close White turn; replacement clears prohibition and next Black card allowance resets.',
  '83. Black Blessing instead of move takes c5 Pawn backward diagonally to empty d6; Pawn clock resets.',
  '84. Close Black turn; Blessing spent and Tournament drawn.',
  '85. e4-c6: White Queen traverses empty d5, checking Black e8 along d7.',
  '86. Close White turn; Black has the ordinary King escape f7.',
  '87. e8-f7: Black King leaves the c6-d7-e8 diagonal; revoke both Black castling rights.',
  '88. Close Black turn after safe Kf7.',
  '89. b1-c3: White Knight jumps one file and two ranks.',
  '90. Close White turn after Nc3.',
  '91. d4-d5: Black Queen moves one vacant square up the file.',
  '92. Close Black turn after Qd5.',
  '93. d1-c2: White Bishop moves one vacant diagonal step.',
  '94. Close White turn after Bc2.',
  '95. d5-c5: Black Queen moves one vacant square left.',
  '96. Close Black turn after Qc5.',
  '97. h1-h3: White Rook traverses empty h2 to empty h3.',
  '98. Close White turn after Rh3.',
  '99. Black Tournament swaps own g8 Knight with White g1 Knight; Ng1 checks e2, but Kd3 escapes.',
  '100. White Knightmare immediately rewinds both Knights and clocks, returns Tournament and its draw, bans that exact swap.',
  '101. Black replays returned Tournament using its different g6 Knight; same White King check has Kd3 escape.',
  '102. Close Black turn; reset allowances and clear replacement prohibition.',
  '103. e2-d3: White King escapes Black g1 Knight check by a safe diagonal step.',
  '104. Close White turn after Kd3.',
  '105. h7xg6: Black Pawn captures swapped White original g1 Knight; captor Black.',
  '106. Black Man-Trap after move marks own g8 Knight square, retains card, draws Fog of War.',
  '107. Close Black turn; no arrival on g8 has sprung the trap.',
  '108. c3-d1: White Knight jumps one file and two ranks; never visits g8.',
  '109. Close White turn after Nd1.',
  '110. f7-e6: Black King steps diagonally; White Qc6 ray stops at Black d6 Pawn.',
  '111. Close Black turn after safe Ke6.',
  '112. White Long Jump instead of move relocates d1 Knight to empty opposite-colored c1; no capture.',
  '113. Close White turn; Long Jump spent and Guardian drawn.',
  '114. a8-a7: Black Rook moves one vacant square down its file.',
  '115. Close Black turn after the fiftieth regular command; all three retained markers persist.',
];

const cards: Record<number, GameAction> = {
  22: { type: 'playCard', cardId: 'forbidden-city', cardInstanceId: 'white-hand-1-forbidden-city', target: 'b5' },
  31: { type: 'playCard', cardId: 'crab', cardInstanceId: 'white-hand-2-crab', target: 'g3' },
  51: { type: 'playCard', cardId: 'blessing', cardInstanceId: 'white-deck-1-blessing', target: [{ from: 'h3', to: 'g2' }] },
  59: { type: 'playCard', cardId: 'evangelists', cardInstanceId: 'white-hand-4-evangelists', target: { own: 'c1', opponent: 'g4' } },
  80: { type: 'playCard', cardId: 'chaos', cardInstanceId: 'black-hand-1-chaos' },
  83: { type: 'playCard', cardId: 'blessing', cardInstanceId: 'black-hand-2-blessing', target: [{ from: 'c5', to: 'd6' }] },
  99: { type: 'playCard', cardId: 'tournament', cardInstanceId: 'black-deck-1-tournament', target: { own: 'g8', opponent: 'g1' } },
  100: { type: 'playCard', cardId: 'knightmare', cardInstanceId: 'white-deck-3-knightmare' },
  101: { type: 'playCard', cardId: 'tournament', cardInstanceId: 'black-deck-1-tournament', target: { own: 'g6', opponent: 'g1' } },
  106: { type: 'playCard', cardId: 'man-trap', cardInstanceId: 'black-hand-4-man-trap', target: 'g8' },
  112: { type: 'playCard', cardId: 'long-jump', cardInstanceId: 'white-hand-0-long-jump', target: [{ from: 'd1', to: 'c1' }] },
};
const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;

function clearRay(pieces: PieceState[], from: string, to: string, forbidden: boolean): boolean {
  const [x, y] = xy(from), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
  const length = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 1; i <= length; i++) {
    const square = String.fromCharCode(97 + x + Math.sign(dx) * i) + (1 + y + Math.sign(dy) * i);
    if (forbidden && square === 'b5' || i < length && at(pieces, square)) return false;
  }
  return length > 0;
}

function attacked(pieces: PieceState[], color: Color, forbidden: boolean): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  assert.equal(king.zone, 'board');
  return pieces.some(p => {
    if (p.owner === color || p.zone !== 'board') return false;
    const [x, y] = xy(p.square!), [kx, ky] = xy(king.square!), dx = kx - x, dy = ky - y;
    if (p.role === 'pawn') return Math.abs(dx) === 1 && dy === (p.owner === 'white' ? 1 : -1);
    if (p.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
    if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    const aligned = p.role === 'queen' || p.role === 'rook' && (dx === 0 || dy === 0)
      || p.role === 'bishop' && Math.abs(dx) === Math.abs(dy);
    return aligned && clearRay(pieces, p.square!, king.square!, forbidden);
  });
}

function board(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, i) => {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = at(pieces, String.fromCharCode(97 + f) + (8 - i));
      if (!p) { empty++; continue; }
      if (empty) row += empty;
      empty = 0;
      row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

function epCaptors(expected: GameState): PieceState[] {
  const opportunity = expected.enPassant[0];
  if (!opportunity) return [];
  const victim = expected.pieces.find(p => p.id === opportunity.pawnId)!;
  const capturing = other(victim.owner);
  const [x, y] = xy(opportunity.target);
  return expected.pieces.filter(p => {
    if (p.owner !== capturing || p.zone !== 'board' || p.role !== 'pawn' || p.square === null) return false;
    const [px, py] = xy(p.square);
    if (Math.abs(px - x) !== 1 || y - py !== (capturing === 'white' ? 1 : -1)) return false;
    const next = structuredClone(expected.pieces);
    Object.assign(next.find(q => q.id === victim.id)!, { square: null, zone: 'captured' });
    next.find(q => q.id === p.id)!.square = opportunity.target;
    return !attacked(next, capturing, expected.effects.length > 0);
  });
}

function immutableAction(state: GameState, action: GameAction) {
  const before = structuredClone(state), payload = structuredClone(action);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'GameState input is immutable');
  assert.deepEqual(action, payload, 'GameAction payload is immutable');
  return result;
}

test('iteration 198: independent ordered physical, resource, timing and royal oracle', () => {
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 115);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11);
  let actual = createGameState(trace.initial), expected = createGameState(trace.initial);
  const checkpoints = new Map<number, GameState>();
  let rights = 'KQkq', half = 0, full = 1, fenTurn: Color = 'white';
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, why = rationales[index]!;
    assert.ok(why.startsWith(`${n}.`));
    checkpoints.set(n, structuredClone(expected));
    const actor = expected.turn.color;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(why, new RegExp(`${from}[-x]${to}:`));
      assert.match(to, /^[a-h][1-8]$/);
      assert.equal(expected.turn.moveMade, false);
      const p = at(expected.pieces, from)!;
      assert.ok(p, why); assert.equal(p.owner, actor);
      const target = at(expected.pieces, to);
      if (target) { assert.equal(target.owner, other(actor)); assert.equal(target.royal, false); }
      const [x, y] = xy(from), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
      assert.ok(!expected.effects.length || to !== 'b5');
      if (p.role === 'pawn') {
        const direction = actor === 'white' ? 1 : -1;
        if (target) { assert.equal(Math.abs(dx), 1); assert.equal(dy, direction); }
        else { assert.equal(dx, 0); assert.ok(dy === direction || dy === 2 * direction && y === (actor === 'white' ? 1 : 6)); }
        if (Math.abs(dy) === 2) assert.equal(at(expected.pieces, from[0]! + (Number(from[1]) + direction)), undefined);
      } else if (p.role === 'knight') assert.equal(Math.abs(dx) * Math.abs(dy), 2);
      else {
        if (p.role === 'king') assert.equal(Math.max(Math.abs(dx), Math.abs(dy)), 1);
        if (p.role === 'bishop') assert.equal(Math.abs(dx), Math.abs(dy));
        if (p.role === 'rook') assert.ok(dx === 0 || dy === 0);
        assert.ok(clearRay(expected.pieces, from, to, expected.effects.length > 0), why);
      }
      p.square = to as SquareName;
      if (target) Object.assign(target, { square: null, zone: 'captured', capturedBy: actor });
      expected.history.push({ type: 'move', from: from as SquareName, to: to as SquareName, ...(target ? { capturedId: target.id } : {}) });
      if (p.role === 'king') rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '');
      if (p.role === 'rook') rights = rights.replace(({ a1: 'Q', h1: 'K', a8: 'q', h8: 'k' } as Record<string, string>)[from] ?? '~', '');
      expected.enPassant = p.role === 'pawn' && Math.abs(dy) === 2
        ? [{ target: (from[0]! + ((Number(from[1]) + Number(to[1])) / 2)) as SquareName, pawnId: p.id }] : [];
      half = p.role === 'pawn' || target ? 0 : half + 1;
      if (actor === 'black') full++;
      fenTurn = other(actor);
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
      expected.shieldMove = { player: actor, pieceIds: [p.id], capturedOpponent: !!target };
      delete expected.chaosForbidden;
    } else if (action.type === 'endTurn') {
      assert.match(why, /Close/);
      assert.equal(expected.turn.moveMade, true);
      assert.equal(attacked(expected.pieces, actor, expected.effects.length > 0), false, why);
      expected.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      delete expected.shieldMove; delete expected.chaosForbidden; delete expected.cardResponse;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') assert.fail('No unreviewed mandatory actions');
      assert.deepEqual(action, cards[n], why);
      const owner: Color = n === 80 ? 'black' : n === 100 ? 'white' : actor;
      const definition = CARD_CATALOG[action.cardId]!;
      assert.ok(definition.timing.includes(owner === actor ? expected.turn.phase : 'afterOpponentMove'));
      assert.equal(expected.turn.cardPlays[owner], 0);
      if (n === 80 || n === 100) {
        expected = structuredClone(checkpoints.get(n - 1)!);
        const fields = expected.fen.split(' ');
        rights = fields[2] === '-' ? '' : fields[2]!; half = Number(fields[4]); full = Number(fields[5]);
        fenTurn = fields[1] === 'w' ? 'white' : 'black';
        expected.chaosForbidden = n === 80
          ? { player: 'white', movement: 'white-queen-d1:c2:c1' }
          : { player: 'black', movement: 'black-knight-g8:g8:g1|white-knight-g1:g1:g8' };
        expected.history.push({ type: 'cardPlayed', cardId: action.cardId, player: owner,
          movement: n === 80 ? [{ from: 'c1', to: 'c2' }] : [{ from: 'g8', to: 'g1' }, { from: 'g1', to: 'g8' }], preservePreviousMove: true });
      }
      const resources = expected.players[owner];
      const physical = resources.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(physical, why); assert.equal(physical.cardId, action.cardId);
      resources.hand = resources.hand.filter(c => c.id !== physical.id);
      const replacement = resources.deck.shift()!;
      assert.ok(replacement); resources.hand.push(replacement);
      expected.turn.cardPlays[owner]++;
      (expected.playedCards ??= []).push({ player: owner, cardInstanceId: physical.id });
      if (!definition.continuing) resources.discard.push(physical);
      if ([22, 31, 106].includes(n)) {
        assert.equal(expected.turn.moveMade, true);
        if (n === 22) {
          assert.equal(at(expected.pieces, 'b5'), undefined);
          expected.effects.push({ type: 'forbidden-city', owner, card: physical, square: 'b5' });
          expected.history.push({ type: 'cardPlayed', cardId: action.cardId, target: 'b5' });
        } else if (n === 31) {
          assert.equal(at(expected.pieces, 'g3')!.id, 'white-pawn-g2');
          expected.effects.push({ type: 'crab', owner, card: physical, pieceId: 'white-pawn-g2' });
          expected.history.push({ type: 'cardPlayed', cardId: action.cardId, target: 'g3', movement: [], preservePreviousMove: true });
        } else {
          assert.equal(at(expected.pieces, 'g8')!.id, 'black-knight-g8');
          expected.effects.push({ type: 'man-trap', owner, card: physical, square: 'g8' });
          expected.history.push({ type: 'cardPlayed', cardId: action.cardId, movement: [], preservePreviousMove: true });
        }
      } else if (n !== 80 && n !== 100) {
        assert.equal(expected.turn.moveMade, false);
        const swaps: Record<number, [SquareName, SquareName]> = { 59: ['c1', 'g4'], 99: ['g1', 'g8'], 101: ['g1', 'g6'] };
        let movement: Array<{ from: SquareName; to: SquareName }>, moved: string[];
        if (swaps[n]) {
          const [from, to] = swaps[n]!;
          const first = at(expected.pieces, from)!, second = at(expected.pieces, to)!;
          assert.equal(first.owner, 'white'); assert.equal(second.owner, 'black');
          assert.equal(first.role, n === 59 ? 'bishop' : 'knight'); assert.equal(second.role, first.role);
          first.square = to; second.square = from;
          movement = [{ from, to }, { from: to, to: from }]; moved = []; half++;
        } else {
          const [from, to]: [SquareName, SquareName] = n === 51 ? ['h3', 'g2'] : n === 83 ? ['c5', 'd6'] : ['d1', 'c1'];
          const p = at(expected.pieces, from)!;
          assert.equal(p.owner, actor); assert.equal(at(expected.pieces, to), undefined);
          if (n === 112) {
            assert.equal(p.role, 'knight');
            const [x, y] = xy(from), [tx, ty] = xy(to);
            assert.notEqual((x + y) % 2, (tx + ty) % 2);
          } else {
            assert.equal(p.role, 'pawn'); assert.ok(clearRay(expected.pieces, from, to, true));
            assert.equal(Math.abs(xy(from)[0] - xy(to)[0]), Math.abs(xy(from)[1] - xy(to)[1]));
          }
          p.square = to; moved = [p.id]; movement = [{ from, to }]; half = p.role === 'pawn' ? 0 : half + 1;
        }
        expected.enPassant = [];
        if (actor === 'black') full++;
        fenTurn = other(actor);
        expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
        expected.shieldMove = { player: actor, pieceIds: moved, capturedOpponent: false };
        delete expected.chaosForbidden;
        expected.history.push({ type: 'cardPlayed', cardId: action.cardId, target: action.target as NonNullable<GameState['history'][number]['target']>, movement, preservePreviousMove: false });
      }
      expected.cardResponse = { player: owner, historyLength: expected.history.length };
    }
    const captors = epCaptors(expected);
    const ep = captors.length ? expected.enPassant[0]!.target : '-';
    expected.fen = `${board(expected.pieces)} ${fenTurn[0]} ${rights || '-'} ${ep} ${half} ${full}`;
    const result = immutableAction(actual, action);
    assert.ok(result.ok, why);
    actual = result.state;
    for (const field of ['pieces', 'players', 'effects', 'history', 'turn', 'enPassant', 'fen', 'orientation', 'outcome'] as const)
      assert.deepEqual(actual[field], expected[field], `${why}: ${field}`);
    for (const field of ['shieldMove', 'chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred', 'cardResponse'] as const)
      assert.deepEqual(actual[field] ?? null, expected[field] ?? null, `${why}: ${field}`);
    for (const field of ['plotsAllowances', 'fogLocked', 'riposteLostMoves', 'playedCards'] as const)
      assert.deepEqual(actual[field] ?? [], expected[field] ?? [], `${why}: ${field}`);
    for (const field of ['pendingRescue', 'pendingDoomsayer', 'pendingAbduction'] as const)
      assert.equal(actual[field] ?? null, null, `${why}: no pending obligation`);
    assert.deepEqual(actual.underElfHill ?? [], []);
    const queryBefore = structuredClone(actual);
    for (const color of ['white', 'black'] as const)
      assert.equal(isKingInCheck(actual, color), attacked(expected.pieces, color, n >= 22), `${why}: ${color} royal`);
    assert.deepEqual(actual, queryBefore, 'Royal queries are immutable');
    if (expected.enPassant.length) {
      const epState = structuredClone(actual), victim = expected.pieces.find(p => p.id === expected.enPassant[0]!.pawnId)!;
      epState.turn = { color: other(victim.owner), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const before = structuredClone(epState), destinations = legalDests(epState), target = expected.enPassant[0]!.target;
      for (const p of expected.pieces.filter(p => p.role === 'pawn' && p.owner !== victim.owner && p.zone === 'board'))
        assert.equal(destinations.get(p.square!)?.includes(target) ?? false, captors.some(c => c.id === p.id), `${why}: EP capture availability`);
      assert.deepEqual(epState, before, 'EP query input is immutable');
    }
    if (n === 80 || n === 100) {
      const repeat: GameAction = n === 80 ? { type: 'move', from: 'c2', to: 'c1' } : cards[99]!;
      const rejected = immutableAction(actual, repeat);
      assert.equal(rejected.ok, false, 'Canonical canceled movement cannot repeat');
      assert.deepEqual(rejected.state, actual);
      const before = structuredClone(actual);
      if (n === 80) assert.equal(legalDests(actual).get('c2')?.includes('c1') ?? false, false);
      else assert.ok(!cardPlayTargets(actual, 'tournament').some(target => JSON.stringify(target) === JSON.stringify({ own: 'g8', opponent: 'g1' })));
      assert.deepEqual(actual, before, 'Cancellation queries are immutable');
    }
    if (n === 99 || n === 101) {
      assert.equal(attacked(expected.pieces, 'white', true), true);
      const escape = structuredClone(expected.pieces);
      assert.equal(at(escape, 'd3'), undefined);
      at(escape, 'e2')!.square = 'd3';
      assert.equal(attacked(escape, 'white', true), false, 'Concrete Kd3 proves the regular swap did not cause direct mate');
    }
  }
  assert.equal(actual.fen, '6nr/r3p3/1pQpkbp1/p1q2pp1/PbP2PB1/1P1K2PR/R1BP2P1/2N3n1 w - - 4 28');
});

test('iteration 198: reviewed trace digest compatibility', () => {
  replayTrace(trace);
});
