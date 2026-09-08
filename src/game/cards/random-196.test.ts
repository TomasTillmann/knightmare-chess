import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { CardInstance, Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed in sequence against rules §§8–11, 13, 15–16, 18–21,
// cards.md and the catalog's printed timing/persistence metadata.
const rationales = [
  '1. White f2-f3 is a single unobstructed Pawn advance.',
  '2. White closes a safe completed turn; no card is spent.',
  '3. Black f7-f6 is a single unobstructed Pawn advance.',
  '4. Black closes the turn; the fullmove number already advanced.',
  '5. White a2-a3 advances one square into empty a3.',
  '6. White closes with board and hand unchanged.',
  '7. Black e7-e6 advances one square into empty e6.',
  '8. Black Anathema swaps opposing Bishop f1 and Rook a1 after the move; identities and movement rights survive this non-move exchange.',
  '9. End Black turn, resetting both card allowances.',
  '10. White Knight g1-h3 makes a legal 1-by-2 jump.',
  '11. End White turn with neither royal threatened.',
  '12. Black h7-h6 advances one clear square.',
  '13. End Black turn without changing the board.',
  '14. White d2-d3 advances one clear square.',
  '15. End White turn with no pending obligation.',
  '16. Black Bishop f8-c5 follows empty e7 and d6.',
  '17. End Black turn with no card or draw.',
  '18. White Bishop c1-f4 follows empty d2 and e3.',
  '19. End White turn; both royal threat scans are clear.',
  '20. Black b7-b5 crosses empty b6; record the physical en-passant victim even though White has no captor.',
  '21. End Black turn preserves the new en-passant opportunity.',
  '22. White Knight h3-g1 jumps back; Black b-Pawn en-passant expires.',
  '23. End White turn, with safe kings.',
  '24. Black Bishop c5-e3 passes through empty d4.',
  '25. End Black turn; e3 Bishop is not aligned with King e1.',
  '26. White Assassin moves Queen d1 through vacant c1 to capture own Knight b1; consumes the move and records White as captor.',
  '27. End White replacement-move turn.',
  '28. Black Bishop e3-g1 passes empty f2 and captures White original g1 Knight.',
  '29. End Black turn with the captured identity retained.',
  '30. White e2-e3 advances into the Bishop-vacated square.',
  '31. End White turn safely.',
  '32. Black c7-c6 advances one square.',
  '33. Black Truce is legal after the move; retain its physical card, draw Treason, and prohibit captures until a royal attack.',
  '34. End Black turn; raw royal scans show no check that would terminate Truce.',
  '35. White Queen b1-a2 makes a noncapturing diagonal step during Truce.',
  '36. End White turn; raw royal scans remain clear.',
  '37. Black King e8-f8 steps to an empty safe square, permanently losing Black castling rights.',
  '38. End Black turn; Truce remains because neither King is attacked.',
  '39. White Bishop f4-g5 makes a noncapturing diagonal step.',
  '40. End White turn; both raw royal scans are clear.',
  '41. Black Bishop g1-f2 gives a diagonal check on e1, immediately ending and discarding Truce.',
  '42. End Black turn; checked White receives its escape turn.',
  '43. White h2-h4 provisionally leaves Bishop f2 checking e1; held Challenge on movable Black Pawn f6 is a concrete same-turn cure.',
  '44. Challenge f6 suppresses the other Black pieces capture rights, curing e1 check; spend and replace Challenge while preserving h3 raw FEN en-passant.',
  '45. End White rescue turn succeeds immutably; Black must next use the named f6 Pawn.',
  '46. Black f6-f5 satisfies Challenge, removes that obligation, and restores Bishop f2 check on White e1.',
  '47. End Black turn gives checked White its next turn.',
  '48. White King e1xf2 captures the unprotected checking Bishop and loses White castling rights.',
  '49. End White turn after resolving check.',
  '50. Black e6-e5 makes a clear single Pawn advance.',
  '51. End Black turn safely.',
  '52. White King f2-g3 moves diagonally to an unattacked empty square.',
  '53. End White turn safely.',
  '54. Black Rook h8-h7 moves one clear square.',
  '55. End Black turn safely.',
  '56. White Queen a2-b3 makes one diagonal step.',
  '57. End White turn safely.',
  '58. Black Queen d8-b6 passes empty c7.',
  '59. End Black turn safely.',
  '60. Before moving, White Pacifism marks the own Bishop now on a1; retain the card and draw Onslaught.',
  '61. White Rook h1-h3 passes empty h2; Pacifism affects the separate a1 Bishop only.',
  '62. End White turn; reset the card allowance after Pacifism.',
  '63. Black b5-b4 advances into empty b4.',
  '64. End Black turn safely.',
  '65. White Blessing replaces the move with Bishop g5-f4, a clear noncapture; draw Resurrection.',
  '66. End White replacement-move turn.',
  '67. Black Knight g8-e7 makes a 2-by-1 jump to empty e7.',
  '68. End Black turn safely.',
  '69. White d3-d4 advances one square.',
  '70. End White turn safely.',
  '71. Black Rook h7-h8 returns along an empty file.',
  '72. End Black turn safely.',
  '73. White King g3-h2 steps to an empty unattacked square.',
  '74. End White turn safely.',
  '75. Black King f8-e8 steps back without regaining castling rights.',
  '76. End Black turn safely.',
  '77. White Pawn a3xb4 captures the original Black b7 Pawn diagonally forward.',
  '78. End White turn with capturedBy White recorded.',
  '79. Black g7-g5 crosses vacant g6; no White Pawn can capture en passant.',
  '80. End Black turn preserves its physical en-passant record.',
  '81. White Queen b3-d5 passes empty c4, expiring en-passant.',
  '82. End White turn safely.',
  '83. Black Bombard moves Rook a8-a2, jumping exactly own Pawn a7; a6,a5,a4,a3,a2 are empty and the jumped Pawn remains.',
  '84. End Black replacement-move turn safely.',
  '85. White Queen d5-d6 steps along the file to an empty square.',
  '86. End White turn safely.',
  '87. Black Passing in the Night swaps e5/c2 and h6/f3 Pawn pairs simultaneously; no captures, promotion, or moved-piece shield identities.',
  '88. End Black Pawn-exchange turn.',
  '89. White original a1 Rook moves f1-b1 through vacant e1,d1,c1.',
  '90. White Neutrality marks opposing Bishop c8 after the move; preserve its Black owner and physical identity.',
  '91. End White turn with both royal threat scans including neutral control.',
  '92. Black g5-g4 advances one empty square.',
  '93. End Black turn safely.',
  '94. White Queen d6-c5 makes one diagonal step.',
  '95. White Man-Trap secretly marks h3 occupied by own Rook; retain the card, omit secret target from public history.',
  '96. End White turn with trap awaiting an opposing arrival.',
  '97. Black d7-d6 advances one empty square; it does not arrive on h3.',
  '98. End Black turn; neutral Bishop ray obeys blockers and both-controller royal safety.',
  '99. White Queen c5-d5 moves one square horizontally.',
  '100. End White turn safely.',
  '101. Black Queen b6-b7 moves one square vertically.',
  '102. Black Curse marks opposing Queen d5 after moving; keep card beside board and draw Heresy.',
  '103. End Black turn with Curse attached to the White Queen identity.',
  '104. White original c2 Pawn, swapped to e5, advances e5-e6 without losing original identity.',
  '105. End White turn safely.',
  '106. Black a7-a5 advances through vacant a6; no White Pawn is positioned for en-passant.',
  '107. End Black turn preserves the a6 physical opportunity.',
  '108. White King h2-h1 steps to a safe empty square; en-passant expires.',
  '109. End White turn safely.',
  '110. Black g4-g3 advances one square; trap h3 is not triggered.',
  '111. End Black turn safely.',
  '112. White King h1-g1 steps onto an unattacked empty square.',
  '113. End White turn safely.',
  '114. Black Rook h8xh6 passes empty h7 and captures the White original f2 Pawn; h3 trap remains untouched.',
  '115. End the fiftieth regular-move command with no pending choice or illegal royal state.',
];

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/196.json', import.meta.url), 'utf8')) as RandomTrace;
const expectedCards: Record<number, [Color, string]> = {
  8: ['black', 'black-hand-1-anathema'],
  26: ['white', 'white-hand-3-assassin'],
  33: ['black', 'black-hand-4-truce'],
  44: ['white', 'white-hand-0-challenge'],
  60: ['white', 'white-deck-1-pacifism'],
  65: ['white', 'white-deck-0-blessing'],
  83: ['black', 'black-hand-0-bombard'],
  87: ['black', 'black-hand-3-passing-in-the-night'],
  90: ['white', 'white-hand-1-neutrality'],
  95: ['white', 'white-hand-4-man-trap'],
  102: ['black', 'black-deck-3-curse'],
};
const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
type Effect = { type: string; owner: Color; card?: CardInstance; pieceId?: string; player?: Color; square?: SquareName };

function path(pieces: PieceState[], from: string, to: string): string[] {
  const [x, y] = xy(from), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), 'ray alignment');
  return Array.from({ length: Math.max(Math.abs(dx), Math.abs(dy)) - 1 }, (_, i) => square(x + (i + 1) * Math.sign(dx), y + (i + 1) * Math.sign(dy)))
    .filter(s => pieces.some(p => p.zone === 'board' && p.square === s));
}

function attacks(pieces: PieceState[], effects: Effect[], color: Color, neutralSafety = true): boolean {
  const king = pieces.find(p => p.zone === 'board' && p.royal && p.owner === color)!;
  const [kx, ky] = xy(king.square!);
  return pieces.some(p => {
    if (p.zone !== 'board' || p.id === king.id || (!p.neutral && p.owner === color)) return false;
    if (effects.some(e => e.type === 'pacifism' && e.pieceId === p.id)) return false;
    const controller = other(color);
    if (effects.some(e => e.type === 'challenge' && e.player === controller && e.pieceId !== p.id)) return false;
    const [x, y] = xy(p.square!), dx = kx - x, dy = ky - y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    if (effects.some(e => e.type === 'curse' && e.pieceId === p.id) && distance > 2) return false;
    const geometry = p.role === 'pawn' ? Math.abs(dx) === 1 && dy === (p.owner === 'white' ? 1 : -1)
      : p.role === 'knight' ? Math.abs(dx) * Math.abs(dy) === 2
      : p.role === 'king' ? distance === 1
      : p.role === 'bishop' ? Math.abs(dx) === Math.abs(dy)
      : p.role === 'rook' ? dx === 0 || dy === 0 : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
    if (!geometry || (!['pawn', 'knight', 'king'].includes(p.role) && path(pieces, p.square!, king.square!).length)) return false;
    if (p.neutral && neutralSafety) {
      const captured = structuredClone(pieces);
      const victim = captured.find(q => q.id === king.id)!;
      victim.square = null; victim.zone = 'captured';
      const moved = captured.find(q => q.id === p.id)!;
      moved.square = king.square;
      // The neutral piece is controlled by the prospective captor for this capture.
      moved.neutral = false; moved.owner = controller;
      if (attacks(captured, effects, controller, false)) return false;
    }
    return true;
  });
}

function board(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = pieces.find(p => p.zone === 'board' && p.square === square(file, 7 - rank));
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('iteration 196: all 115 actions have an independent physical and rules oracle', () => {
  assert.equal(rationales.length, 115);
  assert.equal(trace.steps.length, rationales.length);
  rationales.forEach((r, i) => assert.ok(r.startsWith(`${i + 1}. `)));
  let state = createGameState(trace.initial);
  let rescue: { cured: GameState; closed: GameState } | undefined;
  let pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  let effects: Effect[] = [], history: GameEvent[] = [];
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  let ep: GameState['enPassant'] = [], shield: GameState['shieldMove'];
  const played: NonNullable<GameState['playedCards']> = [];
  let cardResponse: GameState['cardResponse'];
  let half = 0, full = 1, fenColor = 'w', moves = 0, cards = 0;
  const at = (s: string) => { const p = pieces.find(p => p.zone === 'board' && p.square === s); assert.ok(p, `piece at ${s}`); return p; };
  const occupied = (s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
  const shift = (from: string, to: string, ownCapture = false, jump = false) => {
    const p = at(from), target = occupied(to);
    assert.ok(p.owner === turn.color || p.neutral);
    if (target) {
      assert.equal(target.owner === p.owner, ownCapture);
      assert.equal(target.royal, false);
      assert.ok(!effects.some(e => e.type === 'truce' || e.type === 'pacifism' && (e.pieceId === p.id || e.pieceId === target.id)));
    }
    const [x, y] = xy(from), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
    if (p.role === 'pawn') {
      assert.equal(dy > 0, p.owner === 'white');
      if (target) { assert.equal(Math.abs(dx), 1); assert.equal(Math.abs(dy), 1); }
      else { assert.equal(dx, 0); assert.ok(Math.abs(dy) === 1 || Math.abs(dy) === 2 && [1, 6].includes(y)); }
    } else if (p.role === 'knight') assert.equal(Math.abs(dx) * Math.abs(dy), 2);
    else if (p.role === 'king') assert.equal(Math.max(Math.abs(dx), Math.abs(dy)), 1);
    else if (p.role === 'bishop') assert.equal(Math.abs(dx), Math.abs(dy));
    else if (p.role === 'rook') assert.ok(dx === 0 || dy === 0);
    else assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy));
    if (!['king', 'knight'].includes(p.role)) assert.equal(path(pieces, from, to).length, jump ? 1 : 0);
    if (effects.some(e => e.type === 'curse' && e.pieceId === p.id)) assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) <= 2);
    const challenge = effects.find(e => e.type === 'challenge' && e.player === turn.color);
    if (challenge) assert.equal(challenge.pieceId, p.id);
    ep = p.role === 'pawn' && Math.abs(dy) === 2 ? [{ target: square(x, y + Math.sign(dy)), pawnId: p.id }] : [];
    if (target) { target.zone = 'captured'; target.square = null; target.capturedBy = turn.color; }
    p.square = to as SquareName;
    half = p.role === 'pawn' || target ? 0 : half + 1;
    shield = { player: turn.color, pieceIds: [p.id], capturedOpponent: !!target && target.owner !== turn.color };
    return { p, target };
  };
  const completeMove = () => { fenColor = turn.color === 'white' ? 'b' : 'w'; if (turn.color === 'black') full++; turn.phase = 'afterMove'; turn.moveMade = true; };
  const verify = (actual: GameState, n: number) => {
    const rights = n < 8 ? 'KQkq' : n < 37 ? 'KAkq' : n < 48 ? 'KA' : '-';
    const rawEp = n >= 43 && n <= 45 ? 'h3' : '-';
    assert.equal(actual.fen, `${board(pieces)} ${fenColor} ${rights} ${rawEp} ${half} ${full}`, `${n}: all six FEN fields`);
    assert.deepEqual(actual.pieces, pieces, `${n}: every physical identity and capture actor`);
    assert.deepEqual(actual.players, players, `${n}: complete ordered card zones`);
    assert.deepEqual(actual.effects, effects, `${n}: complete effects`);
    assert.deepEqual(actual.history, history, `${n}: complete history`);
    assert.deepEqual(actual.turn, turn, `${n}: allowance and phase`);
    assert.deepEqual(actual.enPassant, ep, `${n}: physical en-passant`);
    assert.deepEqual(actual.shieldMove, shield, `${n}: complete movement token`);
    assert.deepEqual(actual.playedCards ?? [], played);
    assert.deepEqual(actual.cardResponse, cardResponse);
    for (const key of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(actual[key], undefined, `${n}: ${key}`);
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(actual[key] ?? [], [], `${n}: ${key}`);
    assert.equal(actual.pendingAbduction ?? null, null);
    assert.equal(actual.pendingDoomsayer ?? null, null);
    assert.equal(actual.outcome, null);
    assert.equal(actual.orientation, 0);
    const frozen = JSON.stringify(actual);
    for (const color of ['white', 'black'] as const) {
      const raw = attacks(pieces, effects, color);
      if (effects.some(e => e.type === 'truce')) assert.equal(raw, false, `${n}: raw check would end Truce`);
      assert.equal(isKingInCheck(actual, color), raw, `${n}: independent ${color} royal attack scan`);
    }
    // Every recorded double push in this trace has no geometrically placed enemy Pawn.
    // Query in the prospective capturing player's before-move context, never the mover's window.
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!;
      const captor = other(victim.owner), [x, y] = xy(opportunity.target);
      const candidates = pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && (p.owner === captor || p.neutral)
        && Math.abs(xy(p.square!)[0] - x) === 1 && xy(p.square!)[1] + (p.owner === 'white' ? 1 : -1) === y);
      assert.equal(candidates.length, 0, `${n}: no en-passant captor; raw FEN and availability are distinct`);
      const context = structuredClone(actual);
      context.turn = { color: captor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      context.fen = context.fen.replace(/ [wb] /, captor === 'white' ? ' w ' : ' b ');
      const snapshot = JSON.stringify(context);
      const destinations = legalDests(context);
      for (const p of pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === captor)) {
        const [px] = xy(p.square!);
        if (px !== x) assert.equal(destinations.get(p.square!)?.includes(opportunity.target) ?? false, false);
      }
      assert.equal(JSON.stringify(context), snapshot, 'en-passant query immutability');
    }
    assert.equal(JSON.stringify(actual), frozen, `${n}: query immutability`);
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, before = structuredClone(state), immutable = JSON.stringify(state);
    const actionSnapshot = structuredClone(action);
    const actor = turn.color;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.equal(action.promotion, undefined);
      assert.equal(turn.moveMade, false);
      const { p, target } = shift(from, to);
      history.push({ type: 'move', from: from as SquareName, to: to as SquareName,
        ...(target ? { capturedId: target.id } : {}), ...(actor === 'white' ? { movedPieceId: p.id, movedRoles: [p.role] } : {}) });
      effects = effects.filter(e => e.type !== 'challenge' || e.player !== actor);
      // A before-move card's response marker remains historical after moving;
      // its historyLength no longer identifies the current event.
      completeMove(); moves++;
      if (effects.some(e => e.type === 'truce') && (attacks(pieces, effects, 'white') || attacks(pieces, effects, 'black'))) {
        for (const e of effects.filter(e => e.type === 'truce')) players[e.owner].discard.push(e.card!);
        effects = effects.filter(e => e.type !== 'truce');
      }
    } else if (action.type === 'endTurn') {
      assert.ok(turn.moveMade);
      assert.equal(attacks(pieces, effects, actor), false, `${n}: closing actor royal must be safe`);
      turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined; cardResponse = undefined;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw new Error('unreviewed action type');
      assert.deepEqual([actor, action.cardInstanceId], expectedCards[n], `${n}: exact physical card and owner`);
      const card = players[actor].hand.find(c => c.id === action.cardInstanceId);
      assert.ok(card); assert.equal(card.cardId, action.cardId);
      assert.equal(turn.cardPlays[actor], 0);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(turn.phase));
      const querySnapshot = JSON.stringify(state);
      assert.ok(cardPlayTargets(state, card.cardId).some(t => JSON.stringify(t) === JSON.stringify(action.target)));
      assert.equal(JSON.stringify(state), querySnapshot, 'target query immutability');
      const event: GameEvent = { type: 'cardPlayed', cardId: card.cardId, ...(action.target !== undefined && card.cardId !== 'man-trap' ? { target: action.target as GameEvent['target'] } : {}), movement: [], preservePreviousMove: turn.moveMade };
      if (card.cardId === 'anathema') {
        assert.deepEqual(action.target, { bishop: 'f1', rook: 'a1' });
        const bishop = at('f1'), rook = at('a1');
        assert.equal(bishop.role, 'bishop'); assert.equal(rook.role, 'rook');
        assert.equal(bishop.owner, other(actor)); assert.equal(rook.owner, other(actor));
        bishop.square = 'a1'; rook.square = 'f1';
        event.movement = [{ from: 'a1', to: 'f1' }, { from: 'f1', to: 'a1' }];
      } else if (['assassin', 'blessing', 'bombard'].includes(card.cardId)) {
        const expected = card.cardId === 'assassin' ? { from: 'd1', to: 'b1' } : card.cardId === 'blessing' ? { from: 'g5', to: 'f4' } : { from: 'a8', to: 'a2' };
        assert.deepEqual(action.target, [expected]);
        const { target } = shift(expected.from, expected.to, card.cardId === 'assassin', card.cardId === 'bombard');
        if (card.cardId === 'blessing') assert.equal(target, undefined);
        if (target) event.capturedId = target.id;
        event.movement = [expected as { from: SquareName; to: SquareName }];
        completeMove();
      } else if (card.cardId === 'passing-in-the-night') {
        assert.deepEqual(action.target, [{ from: 'e5', to: 'c2' }, { from: 'h6', to: 'f3' }]);
        const pairs = [['e5', 'c2'], ['h6', 'f3']] as const;
        for (const [from, to] of pairs) {
          const own = at(from), opp = at(to);
          assert.equal(own.role, 'pawn'); assert.equal(opp.role, 'pawn');
          assert.equal(own.owner, actor); assert.equal(opp.owner, other(actor));
          own.square = to; opp.square = from;
        }
        event.movement = [{ from: 'c2', to: 'e5' }, { from: 'f3', to: 'h6' }, { from: 'e5', to: 'c2' }, { from: 'h6', to: 'f3' }];
        ep = []; half = 0; shield = { player: actor, capturedOpponent: false, pieceIds: [] }; completeMove();
      } else if (card.cardId === 'challenge') {
        assert.equal(action.target, 'f6');
        assert.equal(at('f6').id, 'black-pawn-f7'); assert.equal(occupied('f5'), undefined);
        effects.push({ type: 'challenge', owner: actor, player: 'black', pieceId: 'black-pawn-f7' });
      } else if (card.cardId === 'truce') {
        assert.equal(action.target, undefined); effects.push({ type: 'truce', owner: actor, card });
      } else if (card.cardId === 'man-trap') {
        assert.equal(action.target, 'h3'); assert.equal(at('h3').owner, actor);
        effects.push({ type: 'man-trap', owner: actor, card, square: 'h3' });
      } else {
        const targetSquare = card.cardId === 'pacifism' ? 'a1' : card.cardId === 'neutrality' ? 'c8' : 'd5';
        assert.ok(['pacifism', 'neutrality', 'curse'].includes(card.cardId));
        assert.equal(action.target, targetSquare);
        const p = at(targetSquare); assert.equal(p.royal, false);
        assert.equal(p.owner, card.cardId === 'pacifism' ? actor : other(actor));
        if (card.cardId === 'neutrality') { assert.equal(p.role, 'bishop'); p.neutral = true; p.neutralBeforeEffects = false; }
        if (card.cardId === 'curse') assert.equal(p.role, 'queen');
        effects.push({ type: card.cardId, owner: actor, card, pieceId: p.id });
      }
      history.push(event); cards++;
      players[actor].hand = players[actor].hand.filter(c => c.id !== card.id);
      if (!CARD_CATALOG[card.cardId]!.continuing) players[actor].discard.push(card);
      const drawn = players[actor].deck.shift(); assert.ok(drawn); players[actor].hand.push(drawn);
      turn.cardPlays[actor]++;
      played.push({ player: actor, cardInstanceId: card.id });
      cardResponse = { player: actor, historyLength: history.length };
      assert.equal(attacks(pieces, effects, actor), false, `${n}: card leaves acting royal safe`);
      assert.equal(attacks(pieces, effects, other(actor)), false, `${n}: card does not directly mate`);
    }
    const result = applyAction(state, action);
    assert.equal(JSON.stringify(state), immutable, `${n}: action input immutability`);
    assert.deepEqual(action, actionSnapshot, `${n}: action payload immutability`);
    assert.ok(result.ok, rationales[index]); state = result.state;
    verify(state, n);
    assert.equal(!!state.pendingRescue, n === 43, `${n}: exact rescue obligation`);
    if (n === 43) {
      assert.deepEqual(state.pendingRescue, { before, fen: before.fen, pieces: before.pieces, enPassant: before.enPassant, historyLength: before.history.length, movedPieceIds: ['white-pawn-h2'] });
      const original = JSON.stringify(state);
      const endAction: GameAction = { type: 'endTurn' };
      const endSnapshot = structuredClone(endAction);
      const premature = applyAction(state, endAction);
      assert.equal(premature.ok, false, 'uncured check cannot close');
      assert.equal(JSON.stringify(state), original, 'rejected closure immutable');
      assert.deepEqual(endAction, endSnapshot, 'rejected closure action immutable');
      const cureAction: GameAction = { type: 'playCard', cardId: 'challenge', cardInstanceId: 'white-hand-0-challenge', target: 'f6' };
      const cureSnapshot = structuredClone(cureAction);
      const cured = applyAction(state, cureAction);
      assert.equal(JSON.stringify(state), original, 'rescue input immutable');
      assert.deepEqual(cureAction, cureSnapshot, 'rescue action immutable');
      assert.ok(cured.ok);
      // Store the concrete probe; the independent next two model steps verify
      // every board/card/effect/history/FEN/allowance field, not only a rescue flag.
      const closureBefore = JSON.stringify(cured.state);
      const closed = applyAction(cured.state, endAction);
      assert.equal(JSON.stringify(cured.state), closureBefore, 'rescue closure immutable');
      assert.deepEqual(endAction, endSnapshot, 'rescue closure action immutable');
      assert.ok(closed.ok);
      rescue = { cured: cured.state, closed: closed.state };
    }
    if (n === 44) { assert.ok(rescue); verify(rescue.cured, n); assert.equal(rescue.cured.pendingRescue, null); }
    if (n === 45) { assert.ok(rescue); verify(rescue.closed, n); assert.equal(rescue.closed.pendingRescue, null); }
  }
  assert.equal(moves, 50); assert.equal(cards, 11);
  assert.equal(state.fen, '1nb1k3/1q2n3/2ppP2r/p2Q1p2/1P1P1B1P/4PppR/rPp3P1/BR4K1 w - - 0 28');
  assert.equal(replayTrace(trace).fen, state.fen);
});
