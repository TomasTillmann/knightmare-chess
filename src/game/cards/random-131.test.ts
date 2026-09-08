import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, Role, SquareName } from '../types.js';

// Independently reviewed against rules §§8–15, 22.4 and all ten printed cards.
// Every row has its own reason; generated state hashes are only a replay guard.
const reasons = [
  '1. a2-a3: White pawn advances one onto empty a3.',
  '2. End White turn; no spending, drawing or board changes.',
  '3. f7-f6: Black pawn advances one onto empty f6.',
  '4. Figure Dance after move rotates all four rooks simultaneously a1-h1-h8-a8-a1; no capture; revoke all castling.',
  '5. End Black turn with Figure Dance spent and Coup drawn.',
  '6. e2-e4: both e3 and e4 empty; record e3 opportunity, no adjacent enemy pawn for FEN EP.',
  '7. End White turn; preserve e3 opportunity.',
  '8. b7-b6: one-square pawn advance; expire e3 opportunity.',
  '9. End Black turn; neither card allowance used.',
  '10. f2-f4: f3 and f4 empty; opportunity f3 is not capturable.',
  '11. End White turn; preserve f3 opportunity.',
  '12. a7-a6: one-square pawn advance; expire f3.',
  '13. Anathema after move exchanges opposing bishop f1 and rook h1, preserving identities; draw Evangelists.',
  '14. End Black turn; no further move granted by Anathema.',
  '15. Qd1-f3 follows clear e2 diagonal; empty destination.',
  '16. End White turn; halfmove clock retained.',
  '17. Evangelists instead of move swaps Black Bc8 with White Bh1; spend, draw Breakthrough, advance Black clock once.',
  '18. End Black replacement turn.',
  '19. b2-b4 crosses empty b3; uncapturable b3 opportunity.',
  '20. End White turn preserving b3 opportunity.',
  '21. a6-a5 advances Black pawn; expire b3.',
  '22. End Black turn.',
  '23. Ke1-e2: adjacent empty square, royal safe.',
  '24. End White turn.',
  '25. Ra1-a2: adjacent empty file square.',
  '26. End Black turn.',
  '27. Ke2-f2: adjacent empty square, royal safe.',
  '28. End White turn.',
  '29. Nb8-a6: one-by-two jump onto empty a6.',
  '30. End Black turn.',
  '31. a3-a4: forward empty square, pawn clock reset.',
  '32. End White turn.',
  '33. Ra2-a1: one-square rook move back to empty a1.',
  '34. End Black turn.',
  '35. Qf3-e3: one-square horizontal move.',
  '36. End White turn.',
  '37. Na6-c5: two-by-one jump onto empty c5.',
  '38. End Black turn.',
  '39. Nb1-a3: one-by-two jump onto empty a3.',
  '40. End White turn.',
  '41. Ra1xc1 crosses vacant b1; capture white-bishop-c1 by Black.',
  '42. End Black turn with bishop captured.',
  '43. Qe3-b3 traverses empty d3 and c3.',
  '44. End White turn.',
  '45. Nc5-a6: two-by-one jump to empty a6.',
  '46. End Black turn.',
  '47. Rf1xc1 crosses empty e1,d1; capture black-rook-a8 by White.',
  '48. Siege after move swaps White Ng1 and Rh8; draw Treason.',
  '49. End White turn, preserving the rook capture and swap.',
  '50. c7-c6: empty one-square advance.',
  '51. End Black turn.',
  '52. Na3-b5: one-by-two jump.',
  '53. Treason after move swaps enemy Ra8 and Na6; draw Mystic Shield.',
  '54. End White turn.',
  '55. h7-h6: one-square pawn advance.',
  '56. Coup after move crowns c6 pawn without changing pawn movement; e8 King becomes capturable Prince; retain card and draw Fireball.',
  '57. End Black turn; c6 remains the royal identity.',
  '58. Kf2-f3: adjacent empty safe square.',
  '59. End White turn.',
  '60. Ra6-a7: adjacent empty square; royal pawn stays c6.',
  '61. End Black turn.',
  '62. d2-d4 crosses empty d3, creates uncapturable d3 opportunity.',
  '63. End White turn retaining d3 opportunity.',
  '64. Prince e8-f7: adjacent empty square; royal safety belongs to c6 pawn.',
  '65. End Black turn.',
  '66. Rg1-e1 crosses empty f1.',
  '67. End White turn.',
  '68. Prince f7-e6: adjacent empty square; Prince may be attacked.',
  '69. End Black turn.',
  '70. f4-f5: one-square advance may attack capturable Prince e6.',
  '71. End White turn; attacked Prince is not a checked King.',
  '72. Prince e6-d5: adjacent square, allowed even where White pawns attack it.',
  '73. End Black turn.',
  '74. g2-g3 opens Bh1-g2-f3 against White King; provisional rescue must remain pending.',
  '75. Challenge d7 is eligible (d6 vacant); it suppresses all other Black captures including Bh1xf3 and cures check; spend and draw Forbidden City.',
  '76. End White turn with Challenge binding Black next move.',
  '77. d7-d6 fulfills Challenge and expires it; Bh1 again checks White f3, legally giving check to opponent.',
  '78. End Black turn; White must answer Bh1 check.',
  '79. Nb5xd6 captures black-pawn-d7 by White but leaves Bh1 check; provisional rescue pending.',
  '80. Forbidden City f7 cannot block h1-g2-f3; fizzle and rewind the provisional capture, clear capturedBy, spend/draw Under Elf Hill; White move remains available.',
  '81. Kf3-f2 steps away from Bh1 diagonal; safe after failed rescue, no second card available.',
  '82. End White turn after replacement regular move.',
  '83. Ra7-d7 crosses vacant b7,c7.',
  '84. End Black turn.',
  '85. Bc8xd7 captures black-rook-h8 by White and gives diagonal check to royal pawn c6.',
  '86. End White turn; Black must answer B d7 check.',
  '87. Qd8xd7 captures white-bishop-f1 by Black and removes the checking bishop.',
  '88. End Black turn; royal pawn c6 safe.',
  '89. Under Elf Hill replaces White move: f2 royal goes away, not captured; draw Haunting Memories, clock advances once.',
  '90. End White turn; return is not due on Black turn.',
  '91. Qd7-d8: adjacent file move while White royal absent.',
  '92. End Black turn; mandatory White royal edge return becomes due.',
  '93. Return White royal to empty safe edge h4; no clock, draw, card or move consumed; King movement forbidden this turn.',
  '94. Qb3-d3 crosses empty c3; returned royal stays h4.',
  '95. End White turn expires returned-King movement restriction.',
  '96. Bh1-f3 crosses empty g2; destination vacant.',
  '97. End Black turn.',
  '98. Nh8-g6: one-by-two jump to empty g6.',
  '99. End White turn.',
  '100. Prince d5-c4 steps onto empty square; White pawn/queen threats do not constrain nonroyal Prince.',
  '101. End Black turn.',
  '102. c2-c3: one-square pawn advance.',
  '103. Mystic Shield selects just-moved c3 pawn; protect through Black next turn; spend/draw Doomsayer.',
  '104. End White turn; Shield begins Black protected turn.',
  '105. d6-d5: one-square Black pawn move.',
  '106. End Black turn expires Mystic Shield.',
  '107. Ng6xf8: knight jump captures black-bishop-f8 by White.',
  '108. End White turn.',
  '109. d5xe4: forward diagonal Black pawn capture of white-pawn-e2.',
  '110. End Black turn.',
  '111. Re1-e2: adjacent empty file square.',
  '112. End White turn; fifty move commands and all reactions resolved.',
];

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const square = (value: string): SquareName => { assert.match(value, /^[a-h][1-8]$/); return value as SquareName; };
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
function geometry(piece: PieceState, to: string, pieces: PieceState[], capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    if (dx || dy !== forward && !(dy === 2 * forward && (piece.owner === 'white' ? y <= 1 : y >= 6))) return false;
  } else if (!(piece.role === 'bishop' ? ax === ay : piece.role === 'rook' ? !dx || !dy : !dx || !dy || ax === ay)) return false;
  for (let i = 1; i < Math.max(ax, ay); i++) {
    const crossed = String.fromCharCode(97 + x + Math.sign(dx) * i) + (y + Math.sign(dy) * i + 1);
    if (pieces.some(p => p.zone === 'board' && p.square === crossed)) return false;
  }
  return true;
}

function boardFen(pieces: PieceState[]): string {
  const letters: Record<Role, string> = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, index) => {
    let row = '', empty = 0;
    for (const file of 'abcdefgh') {
      const p = pieces.find(p => p.zone === 'board' && p.square === file + (8 - index));
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 131 independently accounts for every action and physical identity', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/131.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(reasons.length, trace.steps.length);
  let state = createGameState(trace.initial);
  // Construct the standard physical set independently of reducer/createGameState.
  let pieces: PieceState[] = [];
  const back: Role[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (const color of ['white', 'black'] as const) for (const [file, role] of [...'abcdefgh'].map((f, i) => [f, back[i]!] as const)) {
    for (const [r, rank] of [[role, color === 'white' ? 1 : 8], ['pawn', color === 'white' ? 2 : 7]] as const) {
      const s = square(file + rank);
      pieces.push({ id: `${color}-${r}-${s}`, owner: color, role: r, originalRole: r, square: s, zone: 'board', promoted: false, royal: r === 'king', neutral: false });
    }
  }
  pieces.sort((a, b) => { const [x,y] = xy(a.square!), [u,v] = xy(b.square!); return y * 8 + x - v * 8 - u; });
  const player = (color: Color): GameState['players']['white'] => ({
    hand: trace.initial.hands![color]!.map((cardId, i) => ({ id: `${color}-hand-${i}-${cardId}`, cardId })),
    deck: trace.initial.decks![color]!.map((cardId, i) => ({ id: `${color}-deck-${i}-${cardId}`, cardId })), discard: [],
  });
  const players: GameState['players'] = { white: player('white'), black: player('black') };
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let active = 'w', rights = 'KQkq', half = 0, full = 1, effects: unknown[] = [], enPassant: GameState['enPassant'] = [];
  let underElfHill: GameState['underElfHill'];
  const fen = () => `${boardFen(pieces)} ${active} ${rights} - ${half} ${full}`;
  const at = (s: string) => { const p = pieces.find(p => p.zone === 'board' && p.square === s); assert.ok(p, s); return p; };
  const swap = (a: string, b: string) => { const p = at(a), q = at(b); [p.square, q.square] = [q.square, p.square]; };
  const sort = (ps: PieceState[]) => [...ps].sort((a,b) => a.id.localeCompare(b.id));
  const snapshots = new Map<number, { pieces: PieceState[]; fen: string; enPassant: GameState['enPassant']; turn: GameState['turn']; effects: unknown[]; players: GameState['players'] }>();
  let historyLength = 0;
  let shieldMove: GameState['shieldMove'];
  let cardResponse: GameState['cardResponse'];
  const playedCards: NonNullable<GameState['playedCards']> = [];
  const checks = (color: Color, step: number): boolean => {
    const king = pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
    if (!king) return false;
    return pieces.some(p => p.zone === 'board' && p.owner !== color
      && !(step >= 75 && step <= 76 && p.owner === 'black' && p.id !== 'black-pawn-d7')
      && !(step >= 93 && step <= 94 && p.id === 'white-king-e1')
      && geometry(p, king.square!, pieces, true));
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1, label = reasons[index]!;
    assert.ok(label.startsWith(`${step}.`));
    const before = { pieces: structuredClone(pieces), fen: fen(), enPassant: structuredClone(enPassant), turn: structuredClone(turn), effects: structuredClone(effects), players: structuredClone(players) };
    snapshots.set(step, before);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = at(action.from), victim = pieces.find(p => p.zone === 'board' && p.square === action.to);
      assert.equal(mover.owner, turn.color, label);
      assert.equal(turn.moveMade, false, label);
      assert.ok(geometry(mover, action.to, pieces, !!victim), label);
      assert.ok(!victim || victim.owner !== turn.color && !victim.royal, label);
      if (step === 77) assert.equal(mover.id, 'black-pawn-d7');
      assert.ok(!(underElfHill?.some(e => e.returned && e.pieceId === mover.id)), label);
      const [x, y] = xy(action.from), [, ty] = xy(action.to);
      enPassant = mover.role === 'pawn' && Math.abs(ty - y) === 2
        ? [{ pawnId: mover.id, target: square(String.fromCharCode(x + 97) + ((ty + y) / 2 + 1)) }] : [];
      // None of these double moves has an adjacent opposing pawn; FEN EP stays '-'.
      for (const ep of enPassant) assert.ok(!pieces.some(p => p.owner !== mover.owner && p.role === 'pawn' && p.square && geometry(p, ep.target, pieces, true)));
      if (victim) Object.assign(victim, { square: null, zone: 'captured', capturedBy: turn.color });
      mover.square = square(action.to);
      half = mover.role === 'pawn' || victim ? 0 : half + 1;
      if (turn.color === 'black') full++;
      active = turn.color === 'white' ? 'b' : 'w';
      turn.phase = 'afterMove'; turn.moveMade = true;
      historyLength++;
      shieldMove = { player: turn.color, pieceIds: [mover.id], capturedOpponent: !!victim };
      // A historical card response token can remain; its history length no
      // longer matches after this move, so immediate responses are closed.
      if (step === 77) effects = effects.slice(0, 1);
    } else if (action.type === 'endTurn') {
      assert.ok(turn.moveMade, label);
      turn = { color: opposite(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shieldMove = undefined; cardResponse = undefined;
      if (step === 92) underElfHill = [{ pieceId: 'white-king-e1', player: 'white', returning: true }];
      if (step === 95) underElfHill = [];
      if (step === 106) effects = effects.slice(0, 1);
    } else if (action.type === 'playCard') {
      assert.equal(turn.phase, step === 17 || step === 89 ? 'beforeMove' : 'afterMove', `printed card timing: ${label}`);
      assert.equal(turn.cardPlays[turn.color], 0, label);
      const hand = players[turn.color].hand;
      const idx = hand.findIndex(c => c.id === action.cardInstanceId && c.cardId === action.cardId);
      assert.ok(idx >= 0, label);
      const [card] = hand.splice(idx, 1); assert.ok(card);
      playedCards.push({ player: turn.color, cardInstanceId: card.id });
      if (action.cardId !== 'coup') players[turn.color].discard.push(card);
      const draw = players[turn.color].deck.shift(); assert.ok(draw); hand.push(draw);
      turn.cardPlays[turn.color]++;
      historyLength++;
      switch (step) {
        case 4: {
          const corners: Record<string, SquareName> = { a1: 'h1', h1: 'h8', h8: 'a8', a8: 'a1' };
          for (const p of pieces) if (p.square && corners[p.square]) p.square = corners[p.square]!;
          rights = '-'; break;
        }
        case 13: swap('f1', 'h1'); break;
        case 17: swap('c8', 'h1'); active = 'w'; full++; half++; turn.phase = 'afterMove'; turn.moveMade = true; enPassant = []; shieldMove = { player: 'black', pieceIds: [], capturedOpponent: false }; break;
        case 48: swap('g1', 'h8'); break;
        case 53: swap('a8', 'a6'); break;
        case 56:
          at('e8').royal = false; at('c6').royal = true;
          effects.push({ type: 'coup', owner: 'black', card, princeId: 'black-king-e8', kingId: 'black-pawn-c7', princeRole: 'king' }); break;
        case 75:
          assert.ok(geometry(at('d7'), 'd6', pieces, false));
          effects.push({ type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-pawn-d7' }); break;
        case 80: {
          // Failed rescue rewinds the attempted move but preserves spending once.
          const prior = snapshots.get(79)!;
          pieces = structuredClone(prior.pieces); enPassant = structuredClone(prior.enPassant);
          const fields = prior.fen.split(' '); active = fields[1]!; half = Number(fields[4]); full = Number(fields[5]);
          turn.phase = 'beforeMove'; turn.moveMade = false; historyLength--;
          // The last attempted move descriptor remains inert in beforeMove;
          // it grants neither a completed move nor an after-move card window.
          break;
        }
        case 89:
          Object.assign(at('f2'), { square: null, zone: 'away' });
          underElfHill = [{ pieceId: 'white-king-e1', player: 'white', returning: false }];
          half++; active = 'b'; enPassant = []; turn.phase = 'afterMove'; turn.moveMade = true; shieldMove = { player: 'white', pieceIds: [], capturedOpponent: false }; break;
        case 103: effects.push({ type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-pawn-c2' }); break;
        default: assert.fail(`Unreviewed card: ${label}`);
      }
      cardResponse = { player: turn.color, historyLength };
    } else if (action.type === 'returnKing') {
      assert.equal(action.to, 'h4'); assert.ok(!pieces.some(p => p.square === 'h4'));
      const royal = pieces.find(p => p.id === 'white-king-e1')!;
      Object.assign(royal, { square: 'h4', zone: 'board' });
      underElfHill = [{ pieceId: 'white-king-e1', player: 'white', returning: true, returned: true }];
    } else assert.fail(`Unreviewed action ${label}`);

    const input = structuredClone(state);
    const result = applyAction(state, action);
    assert.deepEqual(state, input, `complete structuredClone immutability: ${label}`);
    assert.ok(result.ok, label); state = result.state;
    assert.deepEqual(sort(state.pieces), sort(pieces), `all identities including capturedBy: ${label}`);
    assert.equal(state.fen, fen(), `all six FEN fields: ${label}`);
    assert.deepEqual(state.players, players, `all physical card zones: ${label}`);
    assert.deepEqual(state.turn, turn, label);
    assert.deepEqual(state.effects, effects, label);
    assert.deepEqual(state.enPassant, enPassant, label);
    assert.deepEqual(state.underElfHill ?? [], underElfHill ?? [], label);
    assert.equal(state.orientation, 0, label);
    // The exact piece/effect assertions exclude Neutrality and Truce here;
    // neither controller-safety recursion nor underlying Truce expiry applies.
    assert.equal(state.outcome, null, label);
    assert.equal(state.history.length, historyLength, label);
    assert.deepEqual(state.cardResponse, cardResponse, label);
    assert.deepEqual(state.shieldMove, shieldMove, label);
    assert.deepEqual(state.playedCards ?? [], playedCards, label);
    assert.equal(state.turnCheckpoint ?? null, null, label);
    assert.equal(!!state.fogCheckpoint, action.type === 'playCard', label);
    if (state.fogCheckpoint && action.type === 'playCard') {
      assert.deepEqual(state.fogCheckpoint, { before: input, player: before.turn.color, card: { id: action.cardInstanceId, cardId: action.cardId }, historyLength }, `exact Fog cancellation checkpoint: ${label}`);
    }
    const hasChaos = action.type === 'move' || step === 17 || step === 89;
    assert.equal(!!state.chaosCheckpoint, hasChaos, label);
    if (state.chaosCheckpoint) {
      const movement = pieces.flatMap(p => {
        const prior = before.pieces.find(q => q.id === p.id)!;
        return prior.square === p.square && prior.zone === p.zone ? [] : [`${p.id}:${prior.square ?? prior.zone}:${p.square ?? p.zone}`];
      }).sort().join('|');
      assert.deepEqual(state.chaosCheckpoint, { before: input, movement, historyLength,
        card: action.type === 'playCard' ? { id: action.cardInstanceId, cardId: action.cardId } : undefined,
      }, `exact Chaos cancellation checkpoint: ${label}`);
    }
    const captured = pieces.filter(p => p.zone === 'captured' && before.pieces.find(q => q.id === p.id)!.zone === 'board').map(p => p.id);
    assert.deepEqual(state.legacyCapture, captured.length ? { historyLength, pieceIds: captured } : undefined, label);
    if (step === 80) assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), [], 'undone move does not enable Mystic Shield');
    for (const key of ['pendingAbduction', 'pendingDoomsayer', 'plotsExecution', 'chaosForbidden', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key] ?? null, null, `${key}: ${label}`);
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(state[key] ?? [], [], `${key}: ${label}`);
    assert.equal(!!state.pendingRescue, step === 74 || step === 79, label);
    if (state.pendingRescue) {
      assert.deepEqual(state.pendingRescue.before, input, `complete rescue rollback checkpoint: ${label}`);
      assert.deepEqual(Object.keys(state.pendingRescue).sort(), ['before', 'fen', 'pieces', 'enPassant', 'historyLength', 'movedPieceIds'].sort());
      assert.equal(state.pendingRescue.fen, before.fen, label);
      assert.deepEqual(sort(state.pendingRescue.pieces), sort(before.pieces), label);
      assert.deepEqual(state.pendingRescue.enPassant, before.enPassant, label);
      assert.equal(state.pendingRescue.historyLength, historyLength - 1, label);
      assert.deepEqual(state.pendingRescue.movedPieceIds, shieldMove!.pieceIds, label);
    }
    // Physical royals, not FEN k/K: Coup crowns c6, Under Elf Hill temporarily removes h4 King.
    assert.equal(checks('white', step), [74, 77, 78, 79, 80].includes(step), `independent white royal attack: ${label}`);
    assert.equal(checks('black', step), [85, 86].includes(step), `independent black royal attack: ${label}`);
  }
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10);
  assert.equal(state.fen, 'n2q1Nn1/4p1p1/1pp2p1p/pN3P2/PPkPp2K/2PQ1bP1/4R2P/2R5 b - - 1 26');
});

test('iteration 131 preserves its deterministic generated trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/131.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace);
  replayTrace(trace);
});
