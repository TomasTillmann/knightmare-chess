import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, Role, SquareName } from '../types.js';

// Independently reviewed from rules §§8–11, 13, 15.3, 16–20, 22 and cards.md.
// Artwork: KC18/3, KC15/4, KC19/1, KC16/3, KC9/2, KC10/3,
// KC19/4, KC10/4, KC13/3, KC10/1, KC15/3, KC1/1, KC15/1.
const rationale = [
  '1. c2-c4: initial pawn double through empty c3; c3 opportunity, no adjacent captor.',
  '2. Mystic Shield: just-moved c4 pawn protected for Black next turn; spend and draw Crab.',
  '3. End White: keep shield for Black; reset both card allowances.',
  '4. c7-c5: initial double through empty c6, no capture of shielded c4; replace EP.',
  '5. End Black: shield expires after the protected turn; c6 opportunity persists.',
  '6. Nb1-c3: empty L destination, expire c6 EP; halfmove becomes one.',
  '7. End White: Black to act; no card-zone changes.',
  '8. d7-d5: double through empty d6; no white pawn on c5/e5 to capture EP.',
  '9. End Black: White to act; retain d6 physical EP opportunity.',
  '10. h2-h3: single forward to empty h3; expire EP and reset halfmove.',
  '11. Abduction c8: opposing nonroyal Bishop temporarily away; consume card, draw Man of Straw.',
  '12. Reveal: concealment changes to recall; no second draw or physical change.',
  '13. Correct Black bishop/c8 identity answer restores identical Bishop without capture.',
  '14. End White: resolved challenge permits Black turn; Abduction remains spent.',
  '15. g7-g6: one empty forward square, ordinary pawn clock reset.',
  '16. End Black: White to act with fresh allowances.',
  '17. f2-f4: double through empty f3 creates f3 opportunity, no adjacent black captor.',
  '18. Chaos: immediate Black reaction rewinds f4 to f2 and clocks/EP; ban exact repeat; draw Fireball.',
  '19. Nc3-e4: different legal L move satisfies cancellation; f2 stays restored.',
  '20. End White: Black reaction allowance resets for its own turn.',
  '21. Nb8-d7: L jump to square vacated by pawn; quiet move.',
  '22. End Black: White to act, preserve board and zones.',
  '23. Ne4xc5: L capture of black c-pawn; capturedBy white, halfmove zero.',
  '24. End White: capture remains physical loss; no optional discard chosen.',
  '25. Ng8-f6: L jump to empty f6.',
  '26. End Black: White to act; no cards played.',
  '27. Qd1-a4: diagonal through vacated c2/b3; legal quiet move.',
  '28. End White: Black to act with Queen on a4.',
  '29. b7-b6: one empty forward square.',
  '30. End Black: White to act, no zone or effect changes.',
  '31. Qa4xa7: clear a5/a6 ray captures black a-pawn for White.',
  '32. End White: Black turn, captured a-pawn stays out.',
  '33. Nd7xc5: L capture of white b1 Knight for Black.',
  '34. End Black: White to act after Knight capture.',
  '35. g2-g3: one empty forward square.',
  '36. Black Plots: any-time reaction; no remaining held card is legal in this window; draw Resurrection.',
  '37. End White: unused Plots allowance closes; Black receives normal turn.',
  '38. Bf8-h6: clear g7 diagonal, no capture.',
  '39. Truce: Black after-move continuing capture ban; retain card and draw Breakthrough.',
  '40. End Black: Truce still active; White to act.',
  '41. Qa7-a4: clear a6/a5, quiet; a4-b5-c6-d7-e8 opens check and terminates Truce.',
  '42. End White: Black receives check-response turn; Truce is discarded.',
  '43. Bc8-d7: blocks the actual a4-e8 checking diagonal at d7.',
  '44. End Black: check cured; White to act.',
  '45. Ng1-f3: L jump to empty f3.',
  '46. End White: Black to act without card changes.',
  '47. Rh8-f8: clear g8 horizontal ray; lose Black kingside castling right.',
  '48. End Black: White to act; moved Rook cannot regain castling.',
  '49. Qa4xa8: clear a5/a6/a7 captures a8 Rook; lose Black queenside castling.',
  '50. End White: Black to act; both Black castling rights lost.',
  '51. Nf6-g4: L jump to empty g4.',
  '52. End Black: White to act with no card action.',
  '53. Qa8-a7: one empty vertical square.',
  '54. End White: Black to act, preserve physical identities.',
  '55. Nc5-e6: empty L destination; noncapture qualifies for Charge.',
  '56. Charge: same e6 Knight takes second L move to empty g7; no extra turn clock; draw No Quarter.',
  '57. End Black: extra Knight move complete; White to act.',
  '58. e2-e4: initial double through e3; no black pawn on d4/f4 for EP.',
  '59. End White: Black to act, physical e3 opportunity retained.',
  '60. Rf8-h8: clear g8 horizontal ray; EP expires, rights stay lost.',
  '61. End Black: White to act.',
  '62. e4xd5: white pawn diagonal captures black d-pawn; reset capture clock.',
  '63. End White: Black to act with d-pawn captured by White.',
  '64. Qd8-a8: clear c8/b8 horizontal ray.',
  '65. End Black: White to act; no continuing effects.',
  '66. Nf3-h2: L jump to h2 vacated by h-pawn.',
  '67. End White: Black to act.',
  '68. Bh6-e3: clear g5/f4 diagonal, no capture; valid Fireball trigger.',
  '69. Fireball e3: capture center Bishop plus d2/f2 Pawns for Black; e1 King outside blast; draw Under Elf Hill.',
  '70. End Black: all three captured identities stay out; White to act.',
  '71. Rh1-g1: one empty horizontal square; revoke White kingside castling.',
  '72. End White: Black to act; only Q castling remains.',
  '73. f7-f5: double through empty f6; d5 pawn cannot capture f6 EP.',
  '74. End Black: White to act; physical f6 opportunity retained.',
  '75. Bc1-g5: clear d2/e3/f4 diagonal after Fireball; EP expires.',
  '76. Coup h3: safe owned pawn becomes royal, e1 becomes capturable Prince; retain Coup, draw Assassin.',
  '77. End White: Black must threaten h3 royal, not e1 Prince.',
  '78. Qa8-c8: clear b8 ray; no check on h3.',
  '79. End Black: White to act under Coup.',
  '80. Bg5-c1: clear f4/e3/d2 return diagonal.',
  '81. End White: Black to act, h3 royal remains safe.',
  '82. Ng4-e5: empty L destination; no attack on royal h3.',
  '83. End Black: White to act.',
  '84. g3-g4: one empty forward square; keeps h3 royal safe.',
  '85. Dungeon: opposing e5 Knight relocates to vacant h1 corner, no capture; ban Black next turn, draw Split Knight.',
  '86. End White: begin Black restricted turn; h1 Knight cannot move/capture.',
  '87. g6-g5: unrelated pawn advances one empty square while Knight stays imprisoned.',
  '88. End Black: Dungeon restriction expires; no retained card.',
  '89. Qa7-a4: clear a6/a5 ray; d7 Bishop blocks a4-e8 line.',
  '90. End White: Black to act; no check.',
  '91. Qc8-d8: one empty horizontal square.',
  '92. End Black: White to act.',
  '93. Bf1-e2: adjacent empty diagonal, h3 royal safe.',
  '94. End White: Black to act.',
  '95. Qd8-c8: one empty horizontal square.',
  '96. End Black: White to act, no physical losses.',
  '97. Ra1-b1: empty adjacent square; revoke final White queenside castling right.',
  '98. End White: Black to act; all castling rights absent.',
  '99. Breakthrough g5xg4: forward pawn capture replaces move, checks h3 royal; Rg1xg4 remains escape; draw Fatal Attraction.',
  '100. End Black: White receives check-response turn.',
  '101. Rg1xg4: clear g2/g3 ray captures checking g-pawn for White, cures h3 check.',
  '102. End White: Black to act after check escape.',
  '103. f5xg4: diagonal pawn capture of White Rook, checks h3 royal.',
  '104. End Black: White receives check-response turn.',
  '105. Be2xg4: clear f3 diagonal captures checking f-pawn and cures h3 check.',
  '106. End White: Black to act after legal escape.',
  '107. Under Elf Hill: black e8 royal goes away, consumes replacement move, advances quiet clock; draw Rebirth.',
  '108. End Black: White to act, Black King absent and cannot threaten.',
  '109. Assassin Rb1xc1: own Bishop capture via one rook step replaces move; capturedBy white; draw Panic.',
  '110. End White: mandatory Black royal return becomes due before ordinary actions.',
  '111. Return g8: vacant safe edge square restores same King, no clocks/draw; King frozen this turn.',
  '112. e7-e5: double through empty e6 while returned King stays still; d5 pawn has legal e6 EP.',
  '113. Siege: owned g7 Knight and h8 Rook swap, no capture or clock advance; e6 EP survives; draw Fog of War.',
  '114. End Black: returned-King restriction expires; retain e6 EP for White.',
  '115. Qa4-a8: clear a5/a6/a7 file; declines EP, c8 Queen blocks line to g8 King.',
  '116. End White: Black to act, EP expired.',
  '117. Qc8-d8: horizontal step still blocks White Queen a8 ray to g8 King.',
  '118. End Black: White to act; 50 move commands, all intervening choices resolved.',
];

const colors = ['white', 'black'] as const;
const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (x: number, y: number): SquareName => {
  const s = `${String.fromCharCode(97 + x)}${y + 1}`;
  assert.match(s, /^[a-h][1-8]$/);
  return s as SquareName;
};
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);

// No reducer destination or threat helper contributes to this geometry oracle.
function geometry(pieces: PieceState[], p: PieceState, to: string, capture: boolean): boolean {
  assert.ok(p.square);
  const [x, y] = xy(p.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  if (!dx && !dy) return false;
  if (p.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const d = p.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === d;
    return dx === 0 && (dy === d || dy === 2 * d && (p.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, square(x, y + d))) && !at(pieces, to);
  }
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
  if (!(p.role === 'bishop' ? diagonal : p.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let i = 1; i < Math.max(Math.abs(dx), Math.abs(dy)); i++) {
    if (at(pieces, square(x + i * Math.sign(dx), y + i * Math.sign(dy)))) return false;
  }
  return true;
}

type Oracle = Pick<GameState, 'pieces' | 'players' | 'turn' | 'effects' | 'enPassant'> & {
  rights: string; epFen: string; half: number; full: number; fenColor: Color;
  abduction: 'concealment' | 'recall' | null;
  elf: NonNullable<GameState['underElfHill']>;
  forbidden: GameState['chaosForbidden'];
};

function threatened(o: Oracle, color: Color, ignoreTruce = false): boolean {
  const king = o.pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  if (!king?.square) return false;
  if (!ignoreTruce && o.effects.some(e => (e as { type: string }).type === 'truce')) return false;
  return o.pieces.some(p => {
    if (p.owner === color || p.zone !== 'board') return false;
    if (o.elf.some(e => e.pieceId === p.id && e.returned && e.player === o.turn.color)) return false;
    if (o.effects.some(e => {
      const effect = e as { type: string; player?: Color; pieceId?: string };
      return effect.type === 'dungeon' && effect.player === p.owner && o.turn.color === p.owner && effect.pieceId === p.id;
    })) return false;
    return geometry(o.pieces, p, king.square!, true);
  });
}

function fen(o: Oracle): string {
  const symbols: Record<Role, string> = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  const rows: string[] = [];
  for (let y = 7; y >= 0; y--) {
    let row = '', empty = 0;
    for (let x = 0; x < 8; x++) {
      const p = at(o.pieces, square(x, y));
      if (!p) { empty++; continue; }
      if (empty) row += empty;
      empty = 0;
      row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role];
    }
    rows.push(row + (empty || ''));
  }
  return `${rows.join('/')} ${o.fenColor[0]} ${o.rights || '-'} ${o.epFen} ${o.half} ${o.full}`;
}

function initialOracle(trace: RandomTrace): Oracle {
  const pieces: PieceState[] = [];
  const back: Role[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (const owner of colors) for (let x = 0; x < 8; x++) for (const pawn of [false, true]) {
    const role = pawn ? 'pawn' : back[x]!;
    const s = square(x, owner === 'white' ? pawn ? 1 : 0 : pawn ? 6 : 7);
    pieces.push({ id: `${owner}-${role}-${s}`, owner, role, originalRole: role, square: s,
      zone: 'board', promoted: false, royal: role === 'king', neutral: false });
  }
  const player = (c: Color) => ({
    hand: trace.initial.hands![c]!.map((cardId, i) => ({ id: `${c}-hand-${i}-${cardId}`, cardId })),
    deck: trace.initial.decks![c]!.map((cardId, i) => ({ id: `${c}-deck-${i}-${cardId}`, cardId })), discard: [],
  });
  return { pieces, players: { white: player('white'), black: player('black') },
    turn: { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } },
    effects: [], enPassant: [], rights: 'KQkq', epFen: '-', half: 0, full: 1, fenColor: 'white',
    abduction: null, elf: [], forbidden: undefined };
}

const physical = (pieces: PieceState[]) => [...pieces].sort((a, b) => a.id.localeCompare(b.id));
function verify(state: GameState, o: Oracle, n: number) {
  const label = `action ${n}: ${rationale[n - 1] ?? 'initial state'}`;
  assert.deepEqual(physical(state.pieces), physical(o.pieces), `${label}: every identity, zone and actual capturedBy`);
  assert.equal(state.fen, fen(o), `${label}: independent six-field FEN`);
  assert.deepEqual(state.players, o.players, `${label}: ordered physical card zones`);
  assert.deepEqual(state.turn, o.turn, `${label}: turn and both allowances`);
  assert.deepEqual(state.effects, o.effects, `${label}: complete effects`);
  assert.deepEqual(state.enPassant, o.enPassant, `${label}: physical EP opportunities`);
  assert.deepEqual(state.underElfHill ?? [], o.elf, `${label}: mandatory return and freeze`);
  assert.deepEqual(state.chaosForbidden, o.forbidden, `${label}: exact cancellation restriction`);
  assert.equal(state.pendingRescue ?? null, null, `${label}: no unresolved illegal move`);
  assert.equal(state.pendingDoomsayer ?? null, null);
  assert.deepEqual(state.riposteLostMoves ?? [], []);
  assert.equal(state.riposteSkipped, undefined);
  assert.equal(state.riposteCheckDeferred, undefined);
  assert.deepEqual(state.fogLocked ?? [], []);
  assert.equal(state.plotsExecution, undefined);
  assert.equal(state.orientation, 0);
  assert.equal(state.outcome, null);
  if (o.abduction) {
    assert.ok(state.pendingAbduction);
    const { before, ...pending } = state.pendingAbduction;
    assert.deepEqual(pending, { phase: o.abduction, player: 'black', durationMs: 10000,
      pieceId: 'black-bishop-c8', requiresPieceId: false });
    assert.equal(before.fen, 'rnbqkbnr/pp2pppp/8/2pp4/2P5/2N4P/PP1PPPP1/R1BQKBNR b KQkq - 0 3');
    const restored = structuredClone(o.pieces);
    Object.assign(restored.find(p => p.id === 'black-bishop-c8')!, { square: 'c8', zone: 'board' });
    assert.deepEqual(physical(before.pieces), physical(restored));
  } else assert.equal(state.pendingAbduction ?? null, null);
  if (n === 36) {
    // §17.3 freezes action 35: White's quiet g2-g3, with no capture or
    // opposing-card response. Siege/Charge/Truce/Fireball require Black's
    // own move; the replacement Resurrection was not held in that window.
    assert.deepEqual(state.plotsAllowances, [{
      player: 'black', remaining: 2, eligibleCards: [],
      window: {
        phase: 'afterMove', moveMade: true,
        shieldMove: { player: 'white', pieceIds: ['white-pawn-g2'], capturedOpponent: false },
        reaction: { type: 'move', from: 'g2', to: 'g3' },
        capture: undefined,
        legacyCapture: undefined,
        cardResponse: undefined,
        fogCheckpoint: undefined,
      },
    }], `${label}: exact allowance and pre-card immediate-response window`);
  } else assert.deepEqual(state.plotsAllowances ?? [], []);
  for (const color of colors) {
    const check = threatened(o, color);
    const expectedCheck = color === 'black' ? n === 41 || n === 42 : [99, 100, 103, 104].includes(n);
    assert.equal(check, expectedCheck, `${label}: independently enumerated ${color} royal threats`);
    assert.equal(isKingInCheck(state, color), check, `${label}: public ${color} check agrees with geometry/restrictions`);
  }
}

test('iteration 138 deterministic replay core', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/138.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace);
  replayTrace(trace);
});

test('iteration 138 independent 118-action physical, timing and royal oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/138.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860138);
  assert.equal(trace.steps.length, 118);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((reason, i) => assert.ok(reason.startsWith(`${i + 1}. `)));
  let state = createGameState(trace.initial), o = initialOracle(trace);
  let previousMove: Oracle | undefined;
  let moves = 0, cards = 0, choices = 0;
  const revoke = (p: PieceState) => {
    const rights: Record<string, string> = { a1: 'Q', h1: 'K', a8: 'q', h8: 'k' };
    if (p.role === 'rook' && p.square) o.rights = o.rights.replace(rights[p.square] ?? '!', '');
    if (p.role === 'king') o.rights = o.rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
  };
  const capture = (p: PieceState, actor: Color) => {
    assert.equal(p.royal, false, 'never capture royal identity');
    revoke(p);
    p.zone = 'captured'; p.square = null; p.capturedBy = actor;
  };
  const completeMove = (pawn: boolean, captured: boolean) => {
    o.half = pawn || captured ? 0 : o.half + 1;
    if (o.turn.color === 'black') o.full++;
    o.fenColor = other(o.turn.color);
    o.turn.moveMade = true; o.turn.phase = 'afterMove';
    o.enPassant = []; o.epFen = '-'; o.forbidden = undefined;
  };
  const rejected = (action: Parameters<typeof applyAction>[1], label: string) => {
    const before = structuredClone(state);
    const result = applyAction(state, action);
    assert.equal(result.ok, false, label);
    assert.deepEqual(state, before, `${label}: immutable input including capturedBy`);
    assert.deepEqual(result.state, before, `${label}: atomic rejection`);
  };
  verify(state, o, 0);
  for (const [i, { action }] of trace.steps.entries()) {
    const n = i + 1;
    const input = structuredClone(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/);
      assert.equal(action.promotion, undefined, 'no promotion commanded in this trace');
      assert.equal(o.turn.moveMade, false);
      assert.equal(o.abduction, null);
      assert.ok(!o.elf.some(e => e.returning && !e.returned));
      previousMove = structuredClone(o);
      const p = at(o.pieces, action.from)!;
      assert.ok(p); assert.equal(p.owner, o.turn.color);
      const victim = at(o.pieces, action.to);
      if (victim) assert.equal(victim.owner, other(p.owner));
      assert.ok(geometry(o.pieces, p, action.to, !!victim), `${n}: independent move geometry/path`);
      assert.ok(!o.effects.some(e => {
        const d = e as { type: string; pieceId?: string; player?: Color };
        return d.type === 'dungeon' && d.pieceId === p.id && d.player === o.turn.color;
      }));
      assert.ok(!o.elf.some(e => e.returned && e.pieceId === p.id));
      if (o.forbidden) assert.notDeepEqual([action.from, action.to], ['f2', 'f4']);
      const [x, y] = xy(action.from), [, ty] = xy(action.to);
      revoke(p);
      if (victim) capture(victim, o.turn.color);
      p.square = action.to as SquareName;
      completeMove(p.role === 'pawn', !!victim);
      if (p.role === 'pawn' && Math.abs(ty - y) === 2) {
        const target = square(x, (y + ty) / 2);
        o.enPassant = [{ target, pawnId: p.id }];
        // Serialize EP only when an opposing pawn can actually capture safely.
        const captors = o.pieces.filter(q => q.zone === 'board' && q.owner !== p.owner && q.role === 'pawn'
          && geometry(o.pieces, q, target, true));
        if (captors.some(q => {
          const trial = structuredClone(o);
          Object.assign(trial.pieces.find(v => v.id === p.id)!, { square: null, zone: 'captured' });
          trial.pieces.find(v => v.id === q.id)!.square = target;
          return !threatened(trial, q.owner);
        })) o.epFen = target;
      }
      if (o.effects.some(e => (e as { type: string }).type === 'truce')
        && colors.some(c => threatened(o, c, true))) {
        const truce = o.effects.find(e => (e as { type: string }).type === 'truce') as { card: { id: string; cardId: string }; owner: Color };
        o.players[truce.owner].discard.push(truce.card);
        o.effects = o.effects.filter(e => e !== truce);
      }
      assert.equal(threatened(o, o.turn.color), false, `${n}: moving player's royal remains safe`);
      moves++;
    } else if (action.type === 'endTurn') {
      assert.equal(o.turn.moveMade, true);
      assert.equal(o.abduction, null);
      assert.equal(threatened(o, o.turn.color), false);
      const ended = o.turn.color;
      o.effects = o.effects.filter(e => {
        const effect = e as { type: string; player?: Color };
        return !(effect.type === 'mystic-shield' && effect.player !== ended
          || effect.type === 'dungeon' && effect.player === ended);
      });
      o.elf = o.elf.filter(e => !(e.returned && e.player === ended));
      o.turn = { color: other(ended), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      for (const e of o.elf) if (e.player === o.turn.color) e.returning = true;
      o.forbidden = undefined;
    } else if (action.type === 'playCard') {
      cards++;
      const owner = colors.find(c => o.players[c].hand.some(card => card.id === action.cardInstanceId))!;
      assert.ok(owner); assert.equal(o.turn.cardPlays[owner], 0);
      const expectedCard: Record<number, string> = { 2: 'mystic-shield', 11: 'abduction', 18: 'chaos',
        36: 'plots-within-plots', 39: 'truce', 56: 'charge', 69: 'fireball', 76: 'coup',
        85: 'dungeon', 99: 'breakthrough', 107: 'under-elf-hill', 109: 'assassin', 113: 'siege' };
      assert.equal(action.cardId, expectedCard[n]);
      const replacement = ['breakthrough', 'under-elf-hill', 'assassin'].includes(action.cardId);
      if (owner === o.turn.color) assert.equal(o.turn.phase, replacement ? 'beforeMove' : 'afterMove');
      else { assert.ok(['chaos', 'plots-within-plots'].includes(action.cardId)); assert.equal(o.turn.phase, 'afterMove'); }
      if (action.cardId === 'chaos') {
        assert.equal(n, 18); assert.equal(action.target, undefined); assert.ok(previousMove);
        o = structuredClone(previousMove);
        o.forbidden = { player: 'white', movement: 'white-pawn-f2:f2:f4' };
      }
      const zones = o.players[owner];
      const index = zones.hand.findIndex(c => c.id === action.cardInstanceId);
      const card = zones.hand.splice(index, 1)[0]!;
      assert.equal(card.cardId, action.cardId);
      if (!['truce', 'coup'].includes(card.cardId)) zones.discard.push(card);
      zones.hand.push(zones.deck.shift()!);
      o.turn.cardPlays[owner]++;
      switch (card.cardId) {
        case 'mystic-shield':
          assert.equal(action.target, 'c4');
          o.effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: 'white-pawn-c2' }); break;
        case 'abduction':
          assert.equal(action.target, 'c8');
          Object.assign(at(o.pieces, 'c8')!, { square: null, zone: 'away' });
          o.abduction = 'concealment'; break;
        case 'chaos': case 'plots-within-plots': break;
        case 'truce': o.effects.push({ type: 'truce', owner, card }); break;
        case 'charge': {
          assert.deepEqual(action.target, [{ from: 'e6', to: 'g7' }]);
          assert.equal(trace.steps[i - 1]!.action.type, 'move');
          const p = at(o.pieces, 'e6')!;
          assert.equal(p.id, 'black-knight-b8'); assert.ok(!at(o.pieces, 'g7'));
          assert.ok(geometry(o.pieces, p, 'g7', false)); p.square = 'g7'; break;
        }
        case 'fireball': {
          assert.equal(action.target, 'e3');
          assert.equal(at(o.pieces, 'e3')!.id, 'black-bishop-f8');
          const victims = o.pieces.filter(p => p.square && !p.royal && Math.max(Math.abs(xy(p.square)[0] - 4), Math.abs(xy(p.square)[1] - 2)) <= 1);
          assert.deepEqual(victims.map(p => p.id).sort(), ['black-bishop-f8', 'white-pawn-d2', 'white-pawn-f2']);
          victims.forEach(p => capture(p, owner)); o.half = 0; break;
        }
        case 'coup':
          assert.equal(action.target, 'h3');
          at(o.pieces, 'e1')!.royal = false; at(o.pieces, 'h3')!.royal = true;
          o.effects.push({ type: 'coup', owner, card, princeId: 'white-king-e1', kingId: 'white-pawn-h2', princeRole: 'king' }); break;
        case 'dungeon':
          assert.deepEqual(action.target, [{ from: 'e5', to: 'h1' }]);
          assert.ok(!at(o.pieces, 'h1')); assert.equal(at(o.pieces, 'e5')!.id, 'black-knight-g8');
          at(o.pieces, 'e5')!.square = 'h1';
          o.effects.push({ type: 'dungeon', owner, player: 'black', pieceId: 'black-knight-g8' }); break;
        case 'breakthrough':
          assert.deepEqual(action.target, [{ from: 'g5', to: 'g4' }]);
          assert.equal(at(o.pieces, 'g5')!.role, 'pawn'); assert.equal(at(o.pieces, 'g4')!.owner, 'white');
          capture(at(o.pieces, 'g4')!, owner); at(o.pieces, 'g5')!.square = 'g4'; completeMove(true, true); break;
        case 'under-elf-hill':
          assert.equal(action.target, undefined);
          Object.assign(at(o.pieces, 'e8')!, { square: null, zone: 'away' });
          o.elf = [{ pieceId: 'black-king-e8', player: 'black', returning: false }];
          completeMove(false, false); break;
        case 'assassin':
          assert.deepEqual(action.target, [{ from: 'b1', to: 'c1' }]);
          assert.equal(at(o.pieces, 'b1')!.owner, owner); assert.equal(at(o.pieces, 'c1')!.owner, owner);
          assert.ok(geometry(o.pieces, at(o.pieces, 'b1')!, 'c1', true));
          capture(at(o.pieces, 'c1')!, owner); at(o.pieces, 'b1')!.square = 'c1'; completeMove(false, true); break;
        case 'siege': {
          assert.deepEqual(action.target, { knight: 'g7', rook: 'h8' });
          const knight = at(o.pieces, 'g7')!, rook = at(o.pieces, 'h8')!;
          assert.equal(knight.role, 'knight'); assert.equal(rook.role, 'rook');
          assert.equal(knight.owner, owner); assert.equal(rook.owner, owner);
          knight.square = 'h8'; rook.square = 'g7'; break;
        }
        default: assert.fail(`unreviewed card ${card.cardId}`);
      }
      assert.equal(threatened(o, owner), false, `${n}: card leaves acting royal safe`);
      // Only Breakthrough gives check; the independently staged rook capture is a concrete escape.
      if (threatened(o, other(owner))) {
        assert.equal(card.cardId, 'breakthrough');
        const escape = structuredClone(o), rook = at(escape.pieces, 'g1')!;
        assert.ok(geometry(escape.pieces, rook, 'g4', true));
        Object.assign(at(escape.pieces, 'g4')!, { square: null, zone: 'captured' });
        rook.square = 'g4'; assert.equal(threatened(escape, 'white'), false, 'regular card does not directly mate');
      }
    } else if (action.type === 'revealAbduction') {
      assert.equal(o.abduction, 'concealment'); o.abduction = 'recall'; choices++;
    } else if (action.type === 'answerAbduction') {
      assert.equal(o.abduction, 'recall');
      assert.deepEqual(action, { type: 'answerAbduction', player: 'black', owner: 'black', role: 'bishop', square: 'c8', pieceId: 'black-bishop-c8' });
      Object.assign(o.pieces.find(p => p.id === action.pieceId)!, { square: 'c8', zone: 'board' });
      o.abduction = null; choices++;
    } else if (action.type === 'returnKing') {
      assert.equal(action.to, 'g8'); assert.equal(o.elf[0]!.returning, true);
      assert.ok(!at(o.pieces, 'g8'));
      Object.assign(o.pieces.find(p => p.id === 'black-king-e8')!, { square: 'g8', zone: 'board' });
      o.elf[0]!.returned = true; assert.equal(threatened(o, 'black'), false); choices++;
    } else assert.fail(`unreviewed action ${action.type}`);
    const result = applyAction(state, action);
    assert.deepEqual(state, input, `${n}: complete input immutability, including capturedBy`);
    assert.ok(result.ok, `${n}: ${rationale[i]}`);
    state = result.state;
    verify(state, o, n);
    if (n === 11 || n === 12) rejected({ type: 'endTurn' }, 'Abduction must resolve before turn end');
    if (n === 18) {
      rejected({ type: 'move', from: 'f2', to: 'f4' }, 'Chaos forbids canceled transition');
      assert.ok(!legalDests(state).get('f2')?.includes('f4'));
    }
    if (n === 86) rejected({ type: 'move', from: 'h1', to: 'f2' }, 'Dungeon forbids otherwise clear Knight jump');
    if (n === 110) rejected({ type: 'move', from: 'e7', to: 'e5' }, 'King return precedes ordinary movement');
    if (n === 111) rejected({ type: 'move', from: 'g8', to: 'f8' }, 'Returned King remains frozen');
  }
  assert.deepEqual({ actions: rationale.length, moves, cards, choices }, { actions: 118, moves: 50, cards: 13, choices: 3 });
  assert.equal(fen(o), 'Q2q2kn/3b2rp/1p6/3Pp3/2P3B1/7P/PP5N/2R1K2n w - - 2 27');
});
