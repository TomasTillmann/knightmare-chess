import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

// Reviewed against rules §§8–13, 16, 18.3, 20, 21.1, 22.6, cards.md,
// and artwork KC14/2, KC6/1, KC16/1, KC13/3, KC3/3, KC18/3,
// KC11/1, KC7/1, KC9/1 and KC14/1. Every row also has independent
// physical identities, both royal threats, six FEN fields, zones and obligations.
const rationale = [
  '1. c2-c3: White pawn advances one empty square; no capture.',
  '2. White completes its move; Black receives fresh card allowances.',
  '3. f7-f5: Black pawn crosses empty f6; no White pawn can capture en passant.',
  '4. Black ends; the f6 opportunity survives into White’s turn.',
  '5. Long Jump replaces White’s move: g1 and empty f7 have opposite colors; no capture, draw Betrayal.',
  '6. White ends its replacement move; the f7 knight does not check e8.',
  '7. e8xf7: Black king captures the unprotected White g1 knight; revoke both Black castling rights.',
  '8. Black ends; captured knight belongs to White and capturedBy is Black.',
  '9. h1-g1: White rook moves one clear file-step; revoke K right.',
  '10. White ends; the remaining Q right is retained.',
  '11. b8-a6: Black knight jumps one file and two ranks.',
  '12. Rebirth after Black’s move sends enemy a1 rook to empty h1, a rook starting square; revoke Q, draw Earthquake.',
  '13. Black ends; Rebirth is spent, no second move or clock increment.',
  '14. f2-f4: White pawn crosses empty f3; no Black pawn can use f3 en passant.',
  '15. White ends; f3 opportunity remains for Black.',
  '16. b7-b5: Black pawn crosses empty b6; no adjacent White captor.',
  '17. Black ends; b6 opportunity remains for White.',
  '18. e2-e3: White pawn advances one empty square; b6 expires.',
  '19. White ends; both kings remain safe.',
  '20. d7-d5: Black pawn crosses empty d6; no adjacent White pawn.',
  '21. Black ends; d6 opportunity remains for White.',
  '22. g2-g4: White pawn crosses empty g3; d6 expires and no Black pawn can use g3.',
  '23. White ends; g3 opportunity remains for Black.',
  '24. Bombard replaces Black’s move: a8-b8 is straight and empty; its optional jump is unused, draw Dungeon.',
  '25. Black ends; Bombard consumed its move and g3 opportunity.',
  '26. f1-c4: White bishop traverses empty e2 and d3.',
  '27. White ends; bishop’s c4-f7 diagonal is blocked by Black pawn d5.',
  '28. g7-g6: Black pawn advances one empty square.',
  '29. Dungeon after Black’s move relocates enemy a2 pawn to empty a1; no promotion or capture, freeze next White turn, draw Pacifism.',
  '30. Black ends; Dungeon continues through White’s following turn.',
  '31. h2-h3: White advances its unrestrained h-pawn; a1 pawn stays frozen.',
  '32. White ends; Dungeon expires exactly now.',
  '33. d8-e8: Black queen moves one rank-step into empty e8.',
  '34. Black ends; no continuing restriction remains.',
  '35. d2-d4: White pawn traverses empty d3; no Black pawn can capture on d3.',
  '36. White ends; d3 opportunity survives for Black.',
  '37. f7-e6: Black king moves one diagonal; White bishop c4 ray remains blocked at d5.',
  '38. Black ends; d3 opportunity expired on the king move.',
  '39. e1-f2: White king moves one diagonal to empty safe f2.',
  '40. White ends; all castling rights were already lost.',
  '41. Pacifism before Black’s move marks its nonroyal h8 rook; retain card, draw Curse, keep regular move.',
  '42. d5xc4: Black pawn captures the White f1 bishop diagonally; Black is captor.',
  '43. Black ends; Pacifism remains and forbids h8 captures and threats.',
  '44. f2-g3: White king takes one diagonal step to an unattacked square.',
  '45. White ends; no pending rescue or choice exists.',
  '46. f8-g7: Black bishop moves one diagonal to empty g7.',
  '47. Mystic Shield after Black’s move protects precisely its just-moved f8 bishop on White’s next turn; discard and draw Haunting Memories.',
  '48. Black ends; bishop shield activates for White’s turn.',
  '49. h1-h2: White original a1 rook advances to empty h2; shielded bishop is untouched.',
  '50. White ends; Mystic Shield expires, Pacifism remains.',
  '51. e8-c6: Black queen traverses empty d7 on the diagonal.',
  '52. Curse after Black’s move marks enemy original a1 rook now h2; retain card, limit distance to two, draw Hostage.',
  '53. Black ends; Curse and Pacifism persist by physical identity.',
  '54. b1-a3: White knight jumps one file and two ranks.',
  '55. White ends; no effect expires.',
  '56. e6-d7: Black king moves one safe diagonal.',
  '57. Black ends; no card was played this turn.',
  '58. e3-e4: White pawn advances to empty e4.',
  '59. White ends; pawn move reset halfmove count.',
  '60. d7-e8: Black king returns one safe diagonal; castling rights do not return.',
  '61. Black ends; restrictions persist.',
  '62. g3-f3: White king moves one horizontal square.',
  '63. White ends; f3 is safe from all active enemy captures.',
  '64. e8-f8: Black king moves one horizontal square.',
  '65. Black ends; no special obligation is introduced.',
  '66. f3-e3: White king moves one horizontal square.',
  '67. White ends; Black queen c6 is not diagonally aligned with e3.',
  '68. g8-f6: Black knight makes a legal two-by-one jump.',
  '69. Black ends; knight f6 does not attack White king e3.',
  '70. g1-h1: White original h1 rook moves one square; it is not the cursed a1 rook.',
  '71. White ends; cursed rook remains h2.',
  '72. a6-b4: Black knight jumps one file and two ranks.',
  '73. Black ends; b4 knight does not attack e3.',
  '74. d1-a4: White queen traverses empty c2 and b3 diagonally.',
  '75. White ends; no capture or card was played.',
  '76. e7-e6: Black pawn advances one empty square.',
  '77. Crab after Black’s move marks owned b5 pawn; retain physical pawn role, draw Passing in the Night.',
  '78. Black ends; Crab can move and capture only one forward diagonal.',
  '79. h1-e1: White uncursed h1 rook crosses empty g1 and f1; cursed a1 rook remains h2.',
  '80. White ends; Crab and both other continuing effects remain.',
  '81. f8-g8: Black king moves one safe horizontal square.',
  '82. Black ends; no card allowance is carried into White’s turn.',
  '83. d4-d5: White pawn advances one empty square.',
  '84. White ends; no en-passant right from a single advance.',
  '85. c6-b6: Black queen moves one horizontal square and checks White king e3 along empty c5 and d4.',
  '86. Black ends; White is in check from b6 queen and has the legal e3-e2 escape.',
  '87. e3-e2: White king moves one vertical square out of the b6-e3 checking diagonal.',
  '88. Peace Talks after White’s move cancels retained Black Crab, discards Crab to Black and itself to White, draw Cowardice; b5 pawn has legal ordinary status.',
  '89. White ends; only Pacifism and Curse remain.',
  '90. c7-c5: Black pawn crosses empty c6; White d5 can legally capture c6 en passant, so FEN includes c6.',
  '91. Black ends; d5xc6 en passant remains a legal alternative.',
  '92. a4xb4: White queen captures Black original b8 knight one square horizontally, declining en passant; White is captor.',
  '93. White ends; c6 opportunity is gone.',
  '94. b6-c7: Black queen moves one diagonal to the pawn’s vacated square.',
  '95. Holy Quest after Black’s move swaps enemy bishop c1 and knight a3 simultaneously; no capture or extra clock increment, draw Under Elf Hill.',
  '96. Black ends; bishop a3 and knight c1 preserve White physical identities.',
  '97. e2-f2: White king moves one horizontal square.',
  '98. White ends; no pending choice exists.',
  '99. b8-b7: Black original a8 rook moves one vertical square.',
  '100. Black ends; pacifist h8 rook remains stationary.',
  '101. b4-b3: White queen moves one vertical square.',
  '102. White ends; both kings remain safe.',
  '103. f6-e8: Black knight makes a two-rank, one-file jump.',
  '104. Black ends; no effect expiry.',
  '105. c1-d3: White original b1 knight makes a two-rank, one-file jump after Holy Quest.',
  '106. White ends; no capture.',
  '107. e6-e5: Black pawn advances to empty e5, resetting halfmove clock.',
  '108. Black ends; no en-passant opportunity.',
  '109. e1-g1: White original h1 rook crosses empty f1; h2 cursed rook is a different physical identity.',
  '110. White ends; no card played.',
  '111. c7-b6: Black queen returns one diagonal square, completing regular move command 50.',
  '112. Black ends with White to act, no unresolved obligation, halfmove 2 and fullmove 27.',
];

const xy = (square: string): [number, number] => {
  assert.match(square, /^[a-h][1-8]$/);
  return [square.charCodeAt(0) - 97, Number(square[1]) - 1];
};
const square = (x: number, y: number): SquareName => {
  const value = String.fromCharCode(97 + x) + (y + 1);
  assert.match(value, /^[a-h][1-8]$/);
  return value as SquareName;
};
type Effect = { type: string; pieceId: string; owner: Color; player?: Color; card?: { id: string; cardId: string } };

// Pure geometry over our expected physical pieces; never uses reducer attack helpers.
function attacks(pieces: PieceState[], effects: Effect[], attacker: PieceState, target: PieceState, turn: Color): boolean {
  if (!attacker.square || !target.square || attacker.owner === target.owner) return false;
  const marked = (type: string, piece: PieceState) => effects.some(e => e.type === type && e.pieceId === piece.id);
  if (marked('pacifism', attacker) || marked('pacifism', target)) return false;
  if (effects.some(e => e.type === 'dungeon' && e.pieceId === attacker.id && e.player === attacker.owner)) return false;
  if (effects.some(e => e.type === 'mystic-shield' && e.pieceId === target.id && e.player !== turn && attacker.owner === turn)) return false;
  const [x, y] = xy(attacker.square), [tx, ty] = xy(target.square);
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (marked('curse', attacker) && Math.max(ax, ay) > 2) return false;
  if (attacker.role === 'pawn') return ax === 1 && dy === (attacker.owner === 'white' ? 1 : -1);
  if (attacker.role === 'knight') return ax * ay === 2;
  if (attacker.role === 'king') return Math.max(ax, ay) === 1;
  if (!(attacker.role === 'queen' && (ax === ay || !ax || !ay)
    || attacker.role === 'rook' && (!ax || !ay)
    || attacker.role === 'bishop' && ax === ay)) return false;
  for (let n = 1; n < Math.max(ax, ay); n++) {
    const at = square(x + Math.sign(dx) * n, y + Math.sign(dy) * n);
    if (pieces.some(p => p.zone === 'board' && p.square === at)) return false;
  }
  return true;
}

function threatened(pieces: PieceState[], effects: Effect[], color: Color, turn: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  return pieces.some(p => p.zone === 'board' && attacks(pieces, effects, p, king, turn));
}

test('iteration 141 independent physical, movement, timing and obligation oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/141.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length, 112);
  assert.equal(rationale.length, trace.steps.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  let effects: Effect[] = [];
  let turn: GameState['turn'] = structuredClone(state.turn);
  let ep: GameState['enPassant'] = [];
  let rights = 'KQkq', half = 0, full = 1, fenTurn = 'w';
  const at = (s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
  const movePhysical = (from: string, to: string, actor: Color) => {
    const mover = at(from)!; assert.ok(mover);
    const victim = at(to);
    if (victim) {
      assert.notEqual(victim.owner, actor); assert.equal(victim.royal, false);
      assert.ok(!effects.some(e => e.type === 'pacifism' && (e.pieceId === victim.id || e.pieceId === mover.id)));
      victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor;
    }
    if (mover.id === 'black-king-e8') rights = rights.replace(/[kq]/g, '');
    if (mover.id === 'white-king-e1') rights = rights.replace(/[KQ]/g, '');
    for (const [id, right] of [['white-rook-h1', 'K'], ['white-rook-a1', 'Q'], ['black-rook-h8', 'k'], ['black-rook-a8', 'q']]) {
      if (mover.id === id || victim?.id === id) rights = rights.replace(right!, '');
    }
    mover.square = square(...xy(to));
    return { mover, victim };
  };
  const advanceClock = (pawn: boolean, capture: boolean) => {
    half = pawn || capture ? 0 : half + 1;
    if (turn.color === 'black') full++;
    fenTurn = turn.color === 'white' ? 'b' : 'w';
    turn.phase = 'afterMove'; turn.moveMade = true;
  };
  const legalEp = (): string[] => ep.flatMap(op => {
    const victim = pieces.find(p => p.id === op.pawnId)!;
    return pieces.filter(p => p.zone === 'board' && p.owner !== victim.owner && p.role === 'pawn').flatMap(p => {
      const [x, y] = xy(p.square!), [tx, ty] = xy(op.target);
      if (Math.abs(tx - x) !== 1 || ty - y !== (p.owner === 'white' ? 1 : -1) || at(op.target)) return [];
      const board = structuredClone(pieces);
      const removed = board.find(v => v.id === victim.id)!; removed.square = null; removed.zone = 'captured';
      board.find(v => v.id === p.id)!.square = op.target;
      return threatened(board, effects, p.owner, p.owner) ? [] : [p.square + op.target];
    });
  });
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, label = rationale[index]!;
    assert.ok(label.startsWith(`${n}.`));
    const original = structuredClone(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(action.promotion, undefined);
      assert.equal(turn.moveMade, false, label);
      const mover = at(from)!; assert.ok(mover, label); assert.equal(mover.owner, turn.color, label);
      const [x, y] = xy(from), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
      const victim = at(to);
      if (mover.role === 'pawn') {
        const direction = mover.owner === 'white' ? 1 : -1;
        if (victim) assert.ok(Math.abs(dx) === 1 && dy === direction, label);
        else {
          assert.equal(dx, 0, label);
          assert.ok(dy === direction || dy === 2 * direction && (mover.owner === 'white' ? y <= 1 : y >= 6), label);
          assert.ok(!at(square(x, y + direction)), label);
          assert.ok(!effects.some(e => e.type === 'crab' && e.pieceId === mover.id), label);
        }
      } else {
        const target: PieceState = { ...mover, owner: mover.owner === 'white' ? 'black' : 'white', square: to as SquareName };
        assert.ok(attacks(pieces, effects, mover, target, turn.color), label);
      }
      assert.ok(!effects.some(e => e.type === 'dungeon' && e.pieceId === mover.id && e.player === turn.color), label);
      ep = mover.role === 'pawn' && Math.abs(dy) === 2 ? [{ target: square(x, y + dy / 2), pawnId: mover.id }] : [];
      movePhysical(from, to, turn.color);
      advanceClock(mover.role === 'pawn', !!victim);
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label);
      assert.equal(threatened(pieces, effects, turn.color, turn.color), false, label);
      const ending = turn.color;
      effects = effects.filter(e => !(e.type === 'dungeon' && e.player === ending)
        && !(e.type === 'mystic-shield' && e.player !== ending));
      turn = { color: ending === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else {
      assert.equal(action.type, 'playCard', label);
      if (action.type !== 'playCard') throw new Error('Unreviewed action');
      const owner = turn.color, player = players[owner];
      const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0, label); assert.equal(turn.cardPlays[owner], 0, label);
      const card = player.hand.splice(cardIndex, 1)[0]!;
      assert.equal(card.cardId, action.cardId, label);
      const beforeMove = ['long-jump', 'bombard', 'pacifism'].includes(card.cardId);
      assert.equal(turn.phase, beforeMove ? 'beforeMove' : 'afterMove', label);
      turn.cardPlays[owner]++;
      let retained = false;
      switch (n) {
        case 5:
          assert.deepEqual(action.target, [{ from: 'g1', to: 'f7' }]);
          assert.equal(at('g1')!.role, 'knight'); assert.equal(at('f7'), undefined);
          assert.notEqual(xy('g1').reduce((a, b) => a + b) % 2, xy('f7').reduce((a, b) => a + b) % 2);
          movePhysical('g1', 'f7', owner); ep = []; advanceClock(false, false); break;
        case 12:
          assert.deepEqual(action.target, [{ from: 'a1', to: 'h1' }]);
          assert.equal(at('a1')!.id, 'white-rook-a1'); assert.equal(at('h1'), undefined);
          movePhysical('a1', 'h1', owner); break;
        case 24:
          assert.deepEqual(action.target, [{ from: 'a8', to: 'b8' }]);
          assert.equal(at('a8')!.id, 'black-rook-a8'); assert.equal(at('b8'), undefined);
          movePhysical('a8', 'b8', owner); ep = []; advanceClock(false, false); break;
        case 29:
          assert.deepEqual(action.target, [{ from: 'a2', to: 'a1' }]);
          assert.equal(at('a2')!.id, 'white-pawn-a2'); assert.equal(at('a1'), undefined);
          movePhysical('a2', 'a1', owner);
          effects.push({ type: 'dungeon', owner, player: 'white', pieceId: 'white-pawn-a2' }); break;
        case 41:
          assert.equal(action.target, 'h8'); assert.equal(at('h8')!.id, 'black-rook-h8');
          effects.push({ type: 'pacifism', owner, card, pieceId: 'black-rook-h8' }); retained = true; break;
        case 47:
          assert.equal(action.target, 'g7'); assert.equal(at('g7')!.id, 'black-bishop-f8');
          assert.deepEqual(trace.steps[index - 1]!.action, { type: 'move', from: 'f8', to: 'g7' });
          effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: 'black-bishop-f8' }); break;
        case 52:
          assert.equal(action.target, 'h2'); assert.equal(at('h2')!.id, 'white-rook-a1');
          effects.push({ type: 'curse', owner, card, pieceId: 'white-rook-a1' }); retained = true; break;
        case 77:
          assert.equal(action.target, 'b5'); assert.equal(at('b5')!.id, 'black-pawn-b7');
          effects.push({ type: 'crab', owner, card, pieceId: 'black-pawn-b7' }); retained = true; break;
        case 88: {
          assert.equal(action.target, 'black-hand-3-crab');
          const crab = effects.find(e => e.type === 'crab')!; assert.ok(crab.card);
          players.black.discard.push(crab.card); effects = effects.filter(e => e !== crab); break;
        }
        case 95: {
          assert.deepEqual(action.target, { bishop: 'c1', knight: 'a3' });
          const bishop = at('c1')!, knight = at('a3')!;
          assert.equal(bishop.id, 'white-bishop-c1'); assert.equal(knight.id, 'white-knight-b1');
          bishop.square = 'a3'; knight.square = 'c1'; break;
        }
        default: throw new Error(`Unreviewed card at ${n}`);
      }
      if (!retained) player.discard.push(card);
      player.hand.push(player.deck.shift()!);
    }
    const result = applyAction(state, action);
    assert.deepEqual(state, original, `${label}: full input immutability including capturedBy`);
    assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: complete independent physical identities and captures`);
    assert.deepEqual(state.players, players, `${label}: all card instances and zones`);
    assert.deepEqual(state.turn, turn, `${label}: exact phase, actor, move and allowances`);
    assert.deepEqual(state.effects, effects, `${label}: complete expected effect records`);
    assert.deepEqual(state.enPassant, ep, `${label}: stored opportunities`);
    assert.equal(state.orientation, 0, label);
    assert.equal(state.outcome, null, label);
    // No neutralizing, transforming, rescue, cancellation, or Plots card occurs.
    // Full physical comparison above proves there are no neutral controllers.
    assert.equal(state.pendingRescue ?? null, null, label);
    assert.equal(state.pendingAbduction ?? null, null, label);
    assert.equal(state.pendingDoomsayer ?? null, null, label);
    assert.deepEqual(state.underElfHill ?? [], [], label);
    assert.equal(state.chaosForbidden, undefined, label);
    assert.equal(state.plotsExecution, undefined, label);
    assert.deepEqual(state.plotsAllowances ?? [], [], label);
    assert.deepEqual(state.fogLocked ?? [], [], label);
    assert.deepEqual(state.riposteLostMoves ?? [], [], label);
    assert.equal(state.riposteSkipped, undefined, label);
    assert.equal(state.riposteCheckDeferred, undefined, label);
    for (const color of ['white', 'black'] as const) {
      const threat = threatened(pieces, effects, color, turn.color);
      assert.equal(threat, color === 'white' && (n === 85 || n === 86), `${label}: independent ${color} royal safety`);
      assert.equal(isKingInCheck(state, color), threat, `${label}: engine ${color} threat agrees`);
    }
    const available = legalEp();
    assert.deepEqual(available, n === 90 || n === 91 ? ['d5c6'] : [], `${label}: legal en-passant separately`);
    if (!turn.moveMade && ep.length) {
      const destinations = legalDests(state);
      for (const op of ep) {
        const candidates = pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === turn.color);
        for (const p of candidates) {
          const [x, y] = xy(p.square!), [tx, ty] = xy(op.target);
          if (Math.abs(tx - x) === 1 && ty - y === (turn.color === 'white' ? 1 : -1))
            assert.equal(destinations.get(p.square!)?.includes(op.target) ?? false, available.includes(p.square + op.target), label);
        }
      }
    }
    const board = Array.from({ length: 8 }, (_, rank) => {
      let row = '', empty = 0;
      for (let file = 0; file < 8; file++) {
        const p = at(square(file, 7 - rank));
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        const symbol = { pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k' }[p.role];
        row += p.owner === 'white' ? symbol.toUpperCase() : symbol;
      }
      return row + (empty || '');
    }).join('/');
    // This trace only serializes c6 at rows 90–91; all other double advances
    // have a stored opportunity but no legal opposing pawn capture.
    assert.equal(state.fen, `${board} ${fenTurn} ${rights || '-'} ${available.length ? ep[0]!.target : '-'} ${half} ${full}`, label);
  }
  assert.equal(state.fen, '2b1n1kr/pr4bp/1q4p1/1ppPpp2/2p1PPP1/BQPN3P/1P3K1R/P5R1 w - - 2 27');
});

test('iteration 141 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/141.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace.steps.length > 0);
  replayTrace(trace);
});
