import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { Color, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Each numbered rationale was reviewed in order against rules §§8–11, 13, 15,
// 17, 19–21 and the printed timing metadata. No trace digest is this oracle.
const rationales = [
  '1 f2f3: White Pawn advances one empty square.',
  '2 end: White closes its safe first move.',
  '3 c7c6: Black Pawn advances one empty square.',
  '4 end: Black yields after c6.',
  '5 plots-within-plots: White spends its normal allowance; only held Bombard is initially legal.',
  '6 b1a3: Knight jump closes the unused immediate Plots allowance.',
  '7 end: White yields with one card spent.',
  '8 b7b6: Black Pawn advances one square.',
  '9 end: Black yields after b6.',
  '10 bombard: h1 Rook jumps exactly the h2 Pawn and lands on empty h4; revoke K.',
  '11 end: Bombard consumed the White move.',
  '12 d8c7: Queen moves one diagonal square.',
  '13 end: Black yields after Qc7.',
  '14 h4c4: Rook crosses empty g4 f4 e4 d4.',
  '15 end: White yields after Rc4.',
  '16 f7f5: Pawn doubles through empty f6; EP opportunity is f6.',
  '17 doomsayer: Black retains the physical Continuing Effect and offers White an immediate choice.',
  '18 decline: White declines; Black remains active and the effect remains.',
  '19 name: Black says Pawn, loses its own e7 Pawn, and discards the resolved Doomsayer.',
  '20 end: Black yields after its naming action; uncapturable raw f6 may remain serialized.',
  '21 h2h4: White Pawn doubles through empty h3.',
  '22 end: White yields after h4.',
  '23 c7h2: Queen diagonal d6 e5 f4 g3 is empty.',
  '24 holy-war: Black exchanges its g8 Knight and f8 Bishop after the Queen move.',
  '25 end: Exchange grants no extra move.',
  '26 squaring-the-circle: Three corners occupied; e1-h1 would put White King under Qh2, so fizzle spends card and move.',
  '27 end: Original e1 King remains safe after the fizzle.',
  '28 f8g6: Relocated Knight makes an ordinary jump.',
  '29 end: Black yields after Ng6.',
  '30 a3b1: White Knight returns by an ordinary jump.',
  '31 end: White yields after Nb1.',
  '32 h2h3: Queen advances one file square.',
  '33 end: Black yields after Qh3.',
  '34 c4c3: White Rook retreats one empty square.',
  '35 end: White yields after Rc3.',
  '36 d7d5: Black Pawn doubles through d6.',
  '37 curse: Black marks the opposing c3 Rook; card stays beside the board.',
  '38 end: Curse remains attached to the h1 Rook identity.',
  '39 c3e3: Cursed Rook moves exactly two squares via d3.',
  '40 end: White yields after Re3.',
  '41 h7h5: Pawn doubles through h6; raw h6 is uncapturable by White.',
  '42 heresy: White f1 Bishop moves first to f2; c1 Bishop has no empty orthogonal neighbor; Black c8-d8 and g8-f8 follow.',
  '43 end: Heresy preserves clocks, Pawn EP record and previous movement token.',
  '44 e3e5: Cursed Rook advances two through e4; e8 King is three squares away and not threatened by Curse.',
  '45 end: White yields with both Kings safe.',
  '46 f8d6: Bishop crosses empty e7.',
  '47 end: Black yields after Bd6.',
  '48 c2c4: Pawn doubles through c3.',
  '49 panic: White imposes the next Black move deadline and discards this regular card.',
  '50 end: Deadline survives into Black turn.',
  '51 g6e7: Knight completes Black move in time, expiring Panic.',
  '52 end: Black yields after Ne7.',
  '53 e2e4: White Pawn doubles through e3.',
  '54 end: White yields after e4.',
  '55 confabulation: d6 Bishop reaches friendly b8 Knight diagonally through c7; merged object retains both identities and powers.',
  '56 end: Merge consumed the Black move.',
  '57 e1e2: White King steps onto a safe empty square and loses Q rights.',
  '58 end: White yields after Ke2.',
  '59 b8d6: Composite uses its Bishop component via empty c7.',
  '60 end: Black yields after composite Bd6.',
  '61 d1f1: Queen crosses vacated e1.',
  '62 end: White yields after Qf1.',
  '63 e7g6: Ordinary Black Knight jump.',
  '64 end: Black yields after Ng6.',
  '65 assassin: c1 Bishop captures its own b2 Pawn diagonally; Pawn capturedBy is White.',
  '66 end: Assassin replaces the White move.',
  '67 h3h2: Queen returns one square.',
  '68 end: Black yields after Qh2.',
  '69 b1c3: White Knight jumps to empty c3.',
  '70 end: White yields after Nc3.',
  '71 e8g8: Black castles across safe f8 to safe g8; h8 Rook moves to f8; Curse suppresses e5-e8 threat.',
  '72 end: Black yields after both castling identities moved.',
  '73 f2e1: White Bishop moves diagonally into vacated e1.',
  '74 end: White yields after Be1.',
  '75 resurrection: Return self-captured Black e7 Pawn to empty original Pawn square c7; clear capturedBy.',
  '76 end: Placement consumed the Black move without moving an arrival-trigger identity.',
  '77 e5e6: Cursed Rook moves one empty square.',
  '78 end: White yields after Re6.',
  '79 h2g1: Black Queen captures White g1 Knight.',
  '80 end: Black yields after Qxg1.',
  '81 e4d5: White Pawn captures Black d7 Pawn diagonally.',
  '82 end: White yields after exd5.',
  '83 d8g5: Black Bishop crosses empty e7 and f6.',
  '84 end: Black yields after Bg5.',
  '85 c3e4: White Knight jumps to empty e4.',
  '86 end: White yields after Ne4.',
  '87 g8f7: Black King steps diagonally to a safe square.',
  '88 end: Black yields after Kf7.',
  '89 e6e8: Cursed Rook moves exactly two through e7.',
  '90 end: White yields after Re8.',
  '91 d6b4: Composite uses Bishop movement through c5.',
  '92 end: Black yields after composite Bb4.',
  '93 a2a3: White Pawn advances one square.',
  '94 end: White yields after a3.',
  '95 a8b8: Black Rook moves one square.',
  '96 end: Black yields after Rb8.',
  '97 f3f4: White Pawn advances one square.',
  '98 end: White yields after f4.',
  '99 b4d5: Composite uses Knight jump and captures White e2 Pawn; both component identities are moved.',
  '100 end: Black yields after composite capture.',
  '101 a1c1: White Rook crosses empty b1.',
  '102 end: White yields after Rc1.',
  '103 madman: Resurrected c7 Pawn jumps diagonally over occupied b6 to empty a5; b6 Pawn is unharmed.',
  '104 end: Madman consumed Black move.',
  '105 c1c3: White Rook crosses empty c2.',
  '106 end: White yields after Rc3.',
  '107 winged-victory: Return opponent-captured Black d7 Pawn to empty central e5; clear capturedBy.',
  '108 end: Placement consumed Black move with empty arrival movement list.',
  '109 e4c5: White Knight jumps to empty c5.',
  '110 end: White yields after Nc5.',
  '111 g1h2: Black Queen moves one diagonal square.',
  '112 end: Black yields after Qh2.',
  '113 a3a4: White Pawn advances one square.',
  '114 cowardice: White pushes opposing g7 Pawn one backward square to empty g8, without promotion or clocks.',
  '115 end: White yields after its after-move card.',
  '116 h2h3: Black Queen advances one square.',
  '117 end: Black yields after Qh3.',
  '118 h4g5: White Pawn captures the Black c8 Bishop diagonally.',
  '119 end: White yields after hxg5.',
  '120 g8g7: Returned-to-back-rank Black Pawn advances one empty square.',
  '121 end: Black yields after g7.',
  '122 long-jump: White c5 Knight jumps to empty opposite-colored e6.',
  '123 end: Long Jump consumed White move.',
  '124 h3c3: Queen crosses empty g3 f3 e3 d3 and captures the White a1 Rook.',
  '125 end: Black closes the fiftieth regular move with both Kings safe.',
];

const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, curse: boolean, composite: boolean): boolean {
  const [x, y] = xy(piece.square!), [u, v] = xy(to), dx = u - x, dy = v - y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (curse && piece.id === 'white-rook-h1' && Math.max(ax, ay) > 2) return false;
  const roles = composite && piece.id === 'black-knight-b8' ? ['knight', 'bishop'] : [piece.role];
  return roles.some(role => {
    if (role === 'knight') return ax * ay === 2;
    if (role === 'king') return Math.max(ax, ay) === 1;
    if (role === 'pawn') {
      const forward = piece.owner === 'white' ? 1 : -1;
      if (capture) return ax === 1 && dy === forward;
      return dx === 0 && (dy === forward || dy === 2 * forward && y === (forward === 1 ? 1 : 6)
        && !pieces.some(p => p.square === `${piece.square![0]}${y + forward + 1}`));
    }
    if (!(role === 'bishop' ? ax === ay && ax > 0 : role === 'rook' ? (dx === 0) !== (dy === 0) : ax === ay && ax > 0 || (dx === 0) !== (dy === 0))) return false;
    for (let k = 1; k < Math.max(ax, ay); k++) {
      const square = `${String.fromCharCode(97 + x + Math.sign(dx) * k)}${y + Math.sign(dy) * k + 1}`;
      if (pieces.some(p => p.zone === 'board' && p.square === square)) return false;
    }
    return true;
  });
}
const threat = (pieces: PieceState[], color: Color, curse: boolean, composite: boolean) => {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces, p, king.square!, true, curse, composite));
};
function placement(pieces: PieceState[]): string {
  return Array.from({ length: 8 }, (_, rank) => {
    let text = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = pieces.find(p => p.square === `${String.fromCharCode(97 + file)}${8 - rank}`);
      if (!p) { empty++; continue; }
      if (empty) text += empty;
      empty = 0;
      const symbol = ({ pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k' })[p.role];
      text += p.owner === 'white' ? symbol.toUpperCase() : symbol;
    }
    return text + (empty || '');
  }).join('/');
}

test('iteration 195 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/195.json', import.meta.url), 'utf8')) as RandomTrace;
  if (trace.seed !== 860195 || trace.moves !== 50) throw new Error('iteration 195 seed/move contract');
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  const initialPieces: PieceState[] = [];
  for (const color of ['white', 'black'] as const) {
    const back = color === 'white' ? 1 : 8, pawnRank = color === 'white' ? 2 : 7;
    for (const [file, role] of ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'].entries()) {
      for (const [pieceRole, rank] of [[role, back], ['pawn', pawnRank]] as const) {
        const square = `${String.fromCharCode(97 + file)}${rank}` as SquareName;
        initialPieces.push({ id: `${color}-${pieceRole}-${square}`, owner: color, role: pieceRole as PieceState['role'],
          originalRole: pieceRole as PieceState['role'], square, zone: 'board', promoted: false, royal: pieceRole === 'king', neutral: false });
      }
    }
    assert.deepEqual(players[color], {
      hand: trace.initial.hands![color]!.map((cardId, i) => ({ id: `${color}-hand-${i}-${cardId}`, cardId })),
      deck: trace.initial.decks![color]!.map((cardId, i) => ({ id: `${color}-deck-${i}-${cardId}`, cardId })), discard: [],
    });
  }
  assert.deepEqual([...pieces].sort((a, b) => a.id.localeCompare(b.id)), initialPieces.sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal(state.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const history: GameEvent[] = [], effects: unknown[] = [], playedCards: NonNullable<GameState['playedCards']> = [];
  let turn = structuredClone(state.turn), ep: GameState['enPassant'] = [];
  let shield: GameState['shieldMove'], plots: GameState['plotsAllowances'];
  let half = 0, full = 1, rights = 'KQkq', fenColor = 'w';
  const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square)!;
  const byId = (id: string) => pieces.find(p => p.id === id)!;
  const curse = () => effects.some(e => (e as { type: string }).type === 'curse');
  const composite = () => effects.some(e => (e as { type: string }).type === 'confabulation');
  const move = (from: string, to: string) => { const p = at(from); assert.ok(p, from); p.square = to as SquareName; return p; };
  const capture = (p: PieceState, actor: Color) => { p.square = null; p.zone = 'captured'; p.capturedBy = actor; };
  const cards: Record<number, { id: string; target?: unknown }> = {
    5: { id: 'white-hand-2-plots-within-plots', target: { player: 'white' } },
    10: { id: 'white-hand-3-bombard', target: [{ from: 'h1', to: 'h4' }] },
    17: { id: 'black-hand-0-doomsayer' },
    24: { id: 'black-hand-2-holy-war', target: { knight: 'g8', bishop: 'f8' } },
    26: { id: 'white-hand-0-squaring-the-circle', target: [{ from: 'e1', to: 'h1' }] },
    37: { id: 'black-hand-3-curse', target: 'c3' },
    42: { id: 'black-hand-4-heresy', target: [{ from: 'f1', to: 'f2' }, { from: 'c8', to: 'd8' }, { from: 'g8', to: 'f8' }] },
    49: { id: 'white-hand-1-panic' },
    55: { id: 'black-deck-3-confabulation', target: [{ from: 'd6', to: 'b8' }] },
    65: { id: 'white-deck-3-assassin', target: [{ from: 'c1', to: 'b2' }] },
    75: { id: 'black-deck-1-resurrection', target: { pieceId: 'black-pawn-e7', to: 'c7' } },
    103: { id: 'black-deck-0-madman', target: [{ from: 'c7', to: 'a5' }] },
    107: { id: 'black-deck-5-winged-victory', target: { pieceId: 'black-pawn-d7', to: 'e5' } },
    114: { id: 'white-hand-4-cowardice', target: [{ from: 'g7', to: 'g8' }] },
    122: { id: 'white-deck-1-long-jump', target: [{ from: 'c5', to: 'e6' }] },
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, label = rationales[index]!;
    assert.ok(label.startsWith(`${n} `));
    const command = label.split(' ')[1]!.split(':')[0];
    const original = JSON.stringify(state), actionBefore = structuredClone(action), actor = turn.color;
    const advance = (reset: boolean) => {
      half = reset ? 0 : half + 1;
      if (actor === 'black') full++;
      fenColor = actor === 'white' ? 'b' : 'w';
      turn.phase = 'afterMove'; turn.moveMade = true; ep = [];
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(command, from + to, label);
      assert.equal(turn.phase, 'beforeMove'); assert.equal(turn.moveMade, false);
      const p = at(from), victim = at(to);
      assert.equal(p.owner, actor);
      assert.ok(!victim || victim.owner !== actor);
      if (n === 71) {
        assert.ok(rights.includes('k')); assert.equal(at('f8'), undefined); assert.equal(at('g8'), undefined);
        for (const square of ['e8', 'f8', 'g8']) {
          const probe = structuredClone(pieces); probe.find(p => p.id === 'black-king-e8')!.square = square as SquareName;
          assert.equal(threat(probe, 'black', curse(), composite()), false, `castling ${square}`);
        }
      } else assert.ok(geometry(pieces, p, to, !!victim, curse(), composite()), label);
      assert.ok(legalDests(state).get(from as SquareName)?.includes(to as SquareName), label);
      const movingIds = p.id === 'black-knight-b8' && composite() ? [p.id, 'black-bishop-f8'] : [p.id];
      if (victim) capture(victim, actor);
      move(from, to);
      if (n === 71) { move('h8', 'f8'); movingIds.push('black-rook-h8'); rights = ''; }
      if (n === 57) rights = rights.replace('Q', '');
      advance(p.role === 'pawn' || !!victim);
      if (p.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2)
        ep = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }];
      plots = undefined;
      shield = { player: actor, pieceIds: movingIds, capturedOpponent: !!victim };
      history.push({ type: 'move', from: from as SquareName, to: to as SquareName,
        ...(victim ? { capturedId: victim.id } : {}),
        ...(n === 118 ? { movedPieceId: p.id, movedRoles: ['pawn'] as const } : {}) });
      if (n === 51) effects.splice(effects.findIndex(e => (e as { type: string }).type === 'panic'), 1);
    } else if (action.type === 'endTurn') {
      assert.equal(command, 'end'); assert.equal(turn.moveMade, true);
      assert.equal(threat(pieces, actor, curse(), composite()), false, label);
      turn = { color: actor === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined; plots = undefined;
    } else if (action.type === 'playCard') {
      assert.equal(command, action.cardId);
      assert.deepEqual({ id: action.cardInstanceId, ...(action.target === undefined ? {} : { target: action.target }) }, cards[n]);
      assert.equal(turn.cardPlays[actor], 0);
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(turn.phase));
      const hand = players[actor].hand, card = hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card); assert.equal(card.cardId, action.cardId);
      assert.ok(cardPlayTargets(state, card.cardId).some(t => JSON.stringify(t) === JSON.stringify(action.target)), label);
      hand.splice(hand.indexOf(card), 1); hand.push(players[actor].deck.shift()!);
      turn.cardPlays[actor]++; playedCards.push({ player: actor, cardInstanceId: card.id });
      if (!CARD_CATALOG[card.cardId]!.continuing) players[actor].discard.push(card);
      let movement: NonNullable<GameEvent['movement']> = [];
      const replacement = [10, 26, 55, 65, 75, 103, 107, 122].includes(n);
      if (n === 5) plots = [{ player: 'white', remaining: 2, eligibleCards: ['white-hand-3-bombard'],
        window: { phase: 'beforeMove', moveMade: false, reaction: { type: 'move', from: 'c7', to: 'c6' },
          capture: undefined, cardResponse: undefined, fogCheckpoint: undefined, legacyCapture: undefined, shieldMove: undefined } }];
      if (n === 10) {
        assert.equal(at('h2').role, 'pawn'); assert.equal(at('h3'), undefined); assert.equal(at('h4'), undefined);
        move('h1', 'h4'); rights = rights.replace('K', ''); movement = [{ from: 'h1', to: 'h4' }];
      }
      if (n === 17) effects.push({ type: 'doomsayer', owner: actor, card });
      if (n === 24) {
        const knight = at('g8'), bishop = at('f8'); assert.equal(knight.role, 'knight'); assert.equal(bishop.role, 'bishop');
        knight.square = 'f8'; bishop.square = 'g8'; movement = [{ from: 'f8', to: 'g8' }, { from: 'g8', to: 'f8' }];
      }
      if (n === 26) {
        assert.deepEqual(['a1', 'a8', 'h1', 'h8'].filter(s => at(s)), ['a1', 'a8', 'h8']);
        const probe = structuredClone(pieces); probe.find(p => p.royal && p.owner === 'white')!.square = 'h1';
        assert.equal(threat(probe, 'white', false, false), true, 'Qh2 forbids corner landing');
      }
      if (n === 37) { assert.equal(at('c3').id, 'white-rook-h1'); effects.push({ type: 'curse', owner: actor, card, pieceId: 'white-rook-h1' }); }
      if (n === 42) {
        for (const [from, to] of [['f1', 'f2'], ['c8', 'd8'], ['g8', 'f8']] as const) {
          assert.equal(at(from).role, 'bishop'); assert.equal(at(to), undefined); move(from, to); movement.push({ from, to });
        }
        assert.ok(['b1', 'c2', 'd1'].every(s => at(s)), 'c1 Bishop has no empty color-changing adjacent destination');
      }
      if (n === 49) effects.push({ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 });
      if (n === 55) {
        assert.ok(geometry(pieces, at('d6'), 'b8', false, curse(), false)); assert.equal(at('b8').role, 'knight');
        const bishop = at('d6'); bishop.zone = 'away'; bishop.square = null;
        effects.push({ type: 'confabulation', owner: actor, card, pieceIds: ['black-knight-b8', 'black-bishop-f8'] });
        movement = [{ from: 'd6', to: 'b8' }];
      }
      if (n === 65) {
        assert.ok(geometry(pieces, at('c1'), 'b2', true, curse(), composite())); assert.equal(at('b2').owner, actor);
        capture(at('b2'), actor); move('c1', 'b2'); movement = [{ from: 'c1', to: 'b2' }];
      }
      if (n === 75 || n === 107) {
        const p = byId(n === 75 ? 'black-pawn-e7' : 'black-pawn-d7'), to = n === 75 ? 'c7' : 'e5';
        assert.equal(p.zone, 'captured'); assert.equal(p.capturedBy, n === 75 ? 'black' : 'white');
        assert.equal(at(to), undefined); p.zone = 'board'; p.square = to; delete p.capturedBy;
      }
      if (n === 103) {
        assert.equal(at('c7').id, 'black-pawn-e7'); assert.ok(at('b6')); assert.equal(at('a5'), undefined);
        move('c7', 'a5'); movement = [{ from: 'c7', to: 'a5' }];
      }
      if (n === 114) {
        assert.equal(at('g7').id, 'black-pawn-g7'); assert.equal(at('g8'), undefined);
        move('g7', 'g8'); movement = [{ from: 'g7', to: 'g8' }];
      }
      if (n === 122) {
        const [x, y] = xy('c5'), [u, v] = xy('e6'); assert.notEqual((x + y) % 2, (u + v) % 2);
        assert.equal(at('c5').role, 'knight'); assert.equal(at('e6'), undefined);
        move('c5', 'e6'); movement = [{ from: 'c5', to: 'e6' }];
      }
      if (replacement) {
        advance([65, 75, 103, 107].includes(n));
        const ids: Record<number, string[]> = { 10: ['white-rook-h1'], 55: ['black-bishop-f8'], 65: ['white-bishop-c1'],
          75: [], 103: ['black-pawn-e7'], 107: [], 122: ['white-knight-b1'] };
        shield = n === 26 ? undefined : { player: actor, capturedOpponent: false, pieceIds: ids[n]! };
      }
      history.push(n === 26 ? { type: 'cardFizzled', cardId: card.cardId, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false }
        : { type: 'cardPlayed', cardId: card.cardId,
          ...(n === 65 ? { capturedId: 'white-pawn-b2' } : {}),
          ...(n === 5 ? { player: 'white' as const } : action.target === undefined ? {} : { target: action.target as GameEvent['target'] }),
          movement, preservePreviousMove: !replacement });
    } else if (action.type === 'declineDoomsayer') {
      assert.equal(n, 18); assert.equal(command, 'decline'); assert.equal(action.player, 'white');
      history.push({ type: 'doomsayerDeclined', player: 'white' });
    } else if (action.type === 'namePiece') {
      assert.equal(n, 19); assert.equal(command, 'name');
      assert.deepEqual(action, { type: 'namePiece', speaker: 'black', name: 'pawn', losses: [{ effectId: 'black-hand-0-doomsayer', pieceId: 'black-pawn-e7' }] });
      capture(byId('black-pawn-e7'), 'black'); effects.length = 0;
      players.black.discard.push({ id: 'black-hand-0-doomsayer', cardId: 'doomsayer' });
      history.push({ type: 'pieceNamed', speaker: 'black', name: 'pawn', capturedIds: ['black-pawn-e7'], resolvedEffectIds: ['black-hand-0-doomsayer'] });
    } else assert.fail(`unreviewed action ${n}`);

    const result = applyAction(state, action);
    assert.deepEqual(action, actionBefore, `${label}: action payload immutable`);
    assert.equal(JSON.stringify(state), original, `${label}: action input immutable`);
    assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: complete physical oracle`);
    assert.deepEqual(state.players, players, `${label}: physical card accounting`);
    assert.deepEqual(state.effects, effects, `${label}: full effect records`);
    assert.deepEqual(state.history, history, `${label}: history including fizzle and naming`);
    assert.deepEqual(state.turn, turn, `${label}: turn and allowances`);
    assert.deepEqual(state.playedCards ?? [], playedCards);
    assert.deepEqual(state.enPassant, ep);
    assert.equal(state.fen, `${placement(pieces)} ${fenColor} ${rights || '-'} ${n === 19 || n === 20 ? 'f6' : n >= 41 && n <= 43 ? 'h6' : '-'} ${half} ${full}`, `${label}: all six FEN fields`);
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null);
    assert.equal(state.pendingRescue ?? null, null, `${label}: no provisional self-check`);
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 17 ? { player: 'white', cardInstanceId: 'black-hand-0-doomsayer' } : null);
    assert.equal(state.pendingAbduction ?? null, null); assert.deepEqual(state.underElfHill ?? [], []);
    assert.equal(state.chaosForbidden, undefined); assert.equal(state.plotsExecution, undefined);
    assert.deepEqual(state.plotsAllowances ?? [], plots ?? []);
    assert.deepEqual(state.fogLocked ?? [], []); assert.deepEqual(state.riposteLostMoves ?? [], []);
    assert.equal(state.riposteSkipped, undefined); assert.equal(state.riposteCheckDeferred, undefined);
    assert.deepEqual(state.shieldMove, shield, `${label}: full moved-identity token`);
    if (n === 17) {
      const beforeChoice = JSON.stringify(state);
      assert.equal(applyAction(state, { type: 'endTurn' }).ok, false, 'Doomsayer immediate choice must be resolved');
      assert.equal(JSON.stringify(state), beforeChoice, 'blocked endTurn is immutable');
    }
    const queryInput = JSON.stringify(state);
    for (const color of ['white', 'black'] as const) {
      const independentlyChecked = threat(pieces, color, curse(), composite());
      assert.equal(independentlyChecked, false, `${label}: ${color} physical royal safety`);
      assert.equal(isKingInCheck(state, color), independentlyChecked, `${label}: ${color} public check query`);
    }
    // Every recorded double-step is physically tracked; none in this trace has
    // an adjacent prospective enemy captor. Raw FEN targets do not grant EP.
    for (const opportunity of ep) {
      const passed = byId(opportunity.pawnId), prospective: Color = passed.owner === 'white' ? 'black' : 'white';
      const beforeMove = structuredClone(state);
      beforeMove.turn = { color: prospective, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const probeInput = JSON.stringify(beforeMove), destinations = legalDests(beforeMove);
      for (const p of pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === prospective)) {
        const candidate = geometry(pieces, p, opportunity.target, true, curse(), composite());
        assert.equal(candidate, false, `${label}: no adjacent EP captor ${p.id}`);
        assert.equal(destinations.get(p.square!)?.includes(opportunity.target) ?? false, false);
      }
      assert.equal(JSON.stringify(beforeMove), probeInput, 'prospective EP query is immutable');
    }
    assert.equal(JSON.stringify(state), queryInput, `${label}: query input immutable`);
  }
  assert.equal(Object.keys(cards).length, 15);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(state.fen, '1r2Rr2/p4kp1/1pp1N1n1/p2nppPp/P1P2P2/2q5/1B1PK1P1/4BQ2 w - - 0 30');
  replayTrace(trace);
});
