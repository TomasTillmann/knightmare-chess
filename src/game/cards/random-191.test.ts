import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { CardInstance, Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Reviewed in order against rules §§8–11, 14.3–4, 15.4, 17.1, 18.4 and cards.md.
// Every number denotes an action, including reactions, failed cards and endTurn.
const rationales = [
  '1. Ng1-f3 is an unobstructed Knight jump.',
  '2. White ends a safe completed move; both card allowances reset.',
  '3. Black b7-b6 advances one empty square.',
  '4. Black ends safely; the board and clocks stay fixed.',
  '5. e2-e4 crosses vacant e3; the double advance creates an e3 opportunity.',
  '6. White retains Forbidden City on empty h6 after moving; draw once.',
  '7. End White turn; retain the City and e3 opportunity.',
  '8. c7-c5 crosses empty c6 and replaces the old en-passant opportunity.',
  '9. End Black turn with c6 opportunity retained.',
  '10. Irresistible Force pushes Nf3 to empty f4, then Pf2 to f3; replacement move.',
  '11. End White replacement move safely.',
  '12. Bc8-b7 is a one-step diagonal to the vacated b7 square.',
  '13. End Black turn without changing card zones.',
  '14. Passing in the Night simultaneously swaps Pa2/Pc5 and Ph2/Pb6; no captures.',
  '15. End the pawn-swap replacement turn.',
  '16. Nb8-c6 is a Knight jump to an empty square.',
  '17. End Black turn safely.',
  '18. Masquerade moves the non-Pawn Bf1 to empty e2 as a Queen, without capture.',
  '19. End White replacement move.',
  '20. Qd8-c7 moves one diagonal to the vacated pawn square.',
  '21. End Black turn safely.',
  '22. Nf4-d5 uses Knight geometry.',
  '23. End White turn safely.',
  '24. Nc6-a5 uses Knight geometry.',
  '25. Black Treason swaps opposing Ra1 and Nb1 after moving; swap is not a move.',
  '26. End Black turn; preserve the original castling-right square, serialized A.',
  '27. Confabulation merges Pf3 diagonally into friendly Pe4; both identities persist.',
  '28. End the merge replacement turn; retain the physical Confabulation card.',
  '29. Qc7-c6 moves one square down the file.',
  '30. End Black turn safely.',
  '31. Ke1-f2 enters an empty safe adjacent square and revokes White castling rights.',
  '32. End White turn safely.',
  '33. f7-f5 crosses empty f6, creating the f6 opportunity.',
  '34. Black Crab marks its original c7 Pawn now on a2; no displacement.',
  '35. End Black turn; the Crab and f6 opportunity persist.',
  '36. g2-g3 advances one empty square.',
  '37. End White turn safely.',
  '38. e7-e6 advances one empty square.',
  '39. End Black turn safely.',
  '40. Nd5-c7 jumps and checks Ke8.',
  '41. White may end while checking Black; Black receives its escape turn.',
  '42. d7-d6 provisionally leaves Nc7 check; held Doomsayer plus immediate Knight loss cures it.',
  '43. Fortification g4/g5 cannot stop Nc7: fizzle, spend it, and roll back d7-d6.',
  '44. Ke8-e7 answers the Knight check and replaces the inert rollback movement token.',
  '45. End Black turn with the King safe and castling revoked.',
  '46. Rh1-f1 slides through empty g1.',
  '47. End White turn safely.',
  '48. Ng8-f6 is an empty-square Knight jump.',
  '49. Black retains Doomsayer after moving, opening an immediate naming opportunity.',
  '50. White says Queen and loses Qd1 to Black Doomsayer; discard that effect card.',
  '51. End Black turn; Queen remains captured, no extra draw for naming.',
  '52. c2-c4 crosses empty c3; create a c3 opportunity.',
  '53. White Treason swaps opposing Rh8/Na5; preserve c3 as a raw FEN target.',
  '54. End White turn; c3 is serialized but no Black Pawn can capture it.',
  '55. g7-g5 is a double advance through empty g6.',
  '56. White Chaos rewinds g7-g5, restores c3 and the original clocks, and forbids that movement.',
  '57. Nf6xe4 is a different move, captures both merged Pawns, and discards Confabulation.',
  '58. End Black turn with White checked by Ne4.',
  '59. Kf2-e1 leaves the Knight attack.',
  '60. End White turn safely.',
  '61. Ke7-f6 is a safe adjacent King move.',
  '62. End Black turn safely.',
  '63. b2-b3 is a one-square Pawn advance.',
  '64. End White turn safely.',
  '65. Ne4-g5 is a Knight jump.',
  '66. End Black turn safely.',
  '67. Be2-d3 is a one-square diagonal.',
  '68. End White turn safely.',
  '69. Qc6-e4 slides through empty d5 and checks Ke1 along the e-file.',
  '70. Black ends; White must answer the Queen check.',
  '71. Bd3xe4 captures the checking Queen and restores King safety.',
  '72. End White turn with Qd8 physically captured by White.',
  '73. a7-a6 advances one empty square.',
  '74. End Black turn safely.',
  '75. Dubbing moves Bc1-d3 with Knight geometry without changing its Bishop identity.',
  '76. End White replacement move safely.',
  '77. Hidden Passage relocates Black Kf6 to empty safe h3 as the replacement move.',
  '78. End Black replacement move.',
  '79. c5-c6 advances the original a2 Pawn one empty square.',
  '80. End White turn safely.',
  '81. Ra8-a7 slides one square onto empty a7.',
  '82. End Black turn safely.',
  '83. Rb1-d1 passes through empty c1.',
  '84. End White turn safely.',
  '85. Nh8-g6 jumps without traversing forbidden h6.',
  '86. End Black turn safely.',
  '87. Nc7-a8 jumps into the vacated rook square.',
  '88. End White turn safely.',
  '89. Kh3-g4 moves to a safe adjacent square.',
  '90. End Black turn safely.',
  '91. Rd1-b1 slides through empty c1.',
  '92. End White turn safely.',
  '93. Bf8-c5 slides through empty e7 and d6.',
  '94. End Black turn safely.',
  '95. Ke1-d1 moves one safe square.',
  '96. End White turn safely.',
  '97. d7-d5 crosses empty d6 and establishes a d6 opportunity.',
  '98. End Black turn with d6 retained but uncapturable.',
  '99. Be4xf5 captures the physical f7 Pawn and checks Kg4.',
  '100. White ends; Black receives a check-answer turn.',
  '101. Kg4xg3 captures the physical g2 Pawn and leaves the Bishop check.',
  '102. End Black turn safely.',
  '103. Rf1-f4 slides through vacant f2 and f3.',
  '104. End White turn safely.',
  '105. Crab a2xb1 captures White Rook and promotes to Knight; discard Crab.',
  '106. Riposte restores Rb1 and captures the pre-promotion Crab as a Pawn; White loses next move.',
  '107. End Black turn; White automatically forfeits its move, advancing halfmove once.',
  '108. Figure Dance remains legal after forfeiture: Na1-h1 and Na8-a1 rotate simultaneously.',
  '109. End the skipped White turn; the penalty expires.',
  '110. Kg3xf4 captures the other White Rook on an undefended square.',
  '111. End Black turn safely.',
  '112. c4xd5 captures Black original d7 Pawn diagonally.',
  '113. End White turn safely.',
  '114. Fanatic advances Pe6-e3 through empty e5/e4; it creates no en-passant opportunity.',
  '115. End Black replacement move.',
  '116. Bf5-e4 moves one diagonal to an empty square.',
  '117. End White turn safely.',
  '118. Ra5-a3 slides through empty a4.',
  '119. End Black turn safely.',
  '120. Lost Castle Rb1/Ra7 would place a Black Rook on b1 attacking Kd1 through c1; fizzle.',
  '121. End the consumed White replacement turn; board restored and card spent.',
  '122. Resurrection returns Black captured f7 Pawn to empty f7, consuming its move.',
  '123. End Black replacement move safely.',
  '124. Bd3-f1 slides through empty e2.',
  '125. Black Bog shortens that two-square Bishop move to d3-e2; no capture or clock change.',
  '126. End White turn with Bishop on e2.',
  '127. Bc5-b4 moves one diagonal to an empty square.',
  '128. End Black turn; all 50 regular commands and intervening actions reviewed.',
];

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, effects: unknown[]): boolean {
  if (!piece.square || to === 'h6' && effects.some(e => (e as { type?: string }).type === 'forbidden-city')) return false;
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx! - x!, dy = ty! - y!;
  const ax = Math.abs(dx), ay = Math.abs(dy), forward = piece.owner === 'white' ? 1 : -1;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const crab = effects.some(e => (e as { type?: string; pieceId?: string }).type === 'crab' && (e as { pieceId?: string }).pieceId === piece.id);
    if (crab || capture) return ax === 1 && dy === forward;
    return dx === 0 && (dy === forward || dy === forward * 2 && y === (piece.owner === 'white' ? 1 : 6)
      && !at(pieces, `${piece.square[0]}${y! + forward + 1}`));
  }
  if (!(piece.role === 'rook' && (dx === 0 || dy === 0)
    || piece.role === 'bishop' && ax === ay || piece.role === 'queen' && (dx === 0 || dy === 0 || ax === ay))) return false;
  for (let i = 1; i < Math.max(ax, ay); i++) {
    const square = `${String.fromCharCode(97 + x! + Math.sign(dx) * i)}${y! + Math.sign(dy) * i + 1}`;
    if (at(pieces, square) || square === 'h6' && effects.some(e => (e as { type?: string }).type === 'forbidden-city')) return false;
  }
  return true;
}
function threatened(pieces: PieceState[], color: Color, effects: unknown[]): boolean {
  const king = pieces.find(p => p.royal && p.owner === color && p.zone === 'board')!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(pieces, p, king.square!, true, effects));
}
function placement(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, row) => {
    let text = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = at(pieces, `${String.fromCharCode(97 + f)}${8 - row}`);
      if (!p) { empty++; continue; }
      if (empty) { text += empty; empty = 0; }
      text += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return text + (empty || '');
  }).join('/');
}
function immutableAction(state: GameState, action: GameAction): GameState {
  const copy = structuredClone(state), payload = structuredClone(action), result = applyAction(state, action);
  assert.deepEqual(state, copy, 'action input immutability');
  assert.deepEqual(action, payload, 'action payload immutability');
  assert.ok(result.ok, JSON.stringify(action));
  return result.state;
}

test('iteration 191 generated trace replays', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/191.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});

test('iteration 191 independent physical, card, history, FEN and obligation oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/191.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  rationales.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  let actual = createGameState(trace.initial);
  assert.equal(actual.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let pieces = structuredClone(actual.pieces), players = structuredClone(actual.players);
  let effects: unknown[] = [], history: GameEvent[] = [], ep: GameState['enPassant'] = [];
  let turn = structuredClone(actual.turn), fields = actual.fen.split(' ');
  let shield: GameState['shieldMove'], forbidden: GameState['chaosForbidden'];
  let lost: Color[] = [], skipped: Color | undefined;
  let response: GameState['cardResponse'];
  const played: NonNullable<GameState['playedCards']> = [];
  const snapshots = new Map<number, GameState>([[0, actual]]);
  const cardRows: Record<number, [Color, string, string]> = {
    6: ['white','forbidden-city','white-hand-1-forbidden-city'],
    10: ['white','irresistible-force','white-deck-0-irresistible-force'],
    14: ['white','passing-in-the-night','white-hand-3-passing-in-the-night'],
    18: ['white','masquerade','white-hand-2-masquerade'],
    25: ['black','treason','black-hand-0-treason'],
    27: ['white','confabulation','white-deck-2-confabulation'],
    34: ['black','crab','black-hand-1-crab'],
    43: ['black','fortification','black-deck-1-fortification'],
    49: ['black','doomsayer','black-deck-0-doomsayer'],
    53: ['white','treason','white-deck-4-treason'],
    56: ['white','chaos','white-deck-3-chaos'],
    75: ['white','dubbing','white-deck-5-dubbing'],
    77: ['black','hidden-passage','black-deck-2-hidden-passage'],
    106: ['white','riposte','white-hand-0-riposte'],
    108: ['white','figure-dance','white-deck-7-figure-dance'],
    114: ['black','fanatic','black-deck-4-fanatic'],
    120: ['white','lost-castle','white-deck-6-lost-castle'],
    122: ['black','resurrection','black-hand-3-resurrection'],
    125: ['black','bog','black-hand-2-bog'],
  };
  const movePiece = (from: string, to: string) => { const piece = at(pieces, from); assert.ok(piece); piece.square = to as SquareName; return piece; };
  const dropEffect = (type: string) => {
    effects = effects.filter(e => {
      const effect = e as { type: string; owner: Color; card: CardInstance };
      if (effect.type !== type) return true;
      players[effect.owner].discard.push(effect.card); return false;
    });
  };
  const capture = (id: string, by: Color) => {
    const piece = pieces.find(p => p.id === id)!;
    piece.zone = 'captured'; piece.square = null; piece.capturedBy = by;
  };
  const advance = (pawnOrCapture: boolean) => {
    fields[1] = turn.color === 'white' ? 'b' : 'w'; fields[3] = '-';
    fields[4] = pawnOrCapture ? '0' : String(Number(fields[4]) + 1);
    if (turn.color === 'black') fields[5] = String(Number(fields[5]) + 1);
    turn.phase = 'afterMove'; turn.moveMade = true; ep = [];
  };
  const spend = (owner: Color, card: CardInstance, retained: boolean) => {
    assert.equal(turn.cardPlays[owner], 0);
    const player = players[owner];
    assert.ok(player.hand.some(c => c.id === card.id && c.cardId === card.cardId));
    player.hand = player.hand.filter(c => c.id !== card.id);
    if (!retained) player.discard.push(card);
    const drawn = player.deck.shift(); if (drawn) player.hand.push(drawn);
    turn.cardPlays[owner]++;
    played.push({ player: owner, cardInstanceId: card.id });
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, before = actual;
    const beforeFen = fields.join(' '), actor = turn.color;
    const queryCopy = structuredClone(actual);
    const dests = legalDests(actual);
    for (const color of ['white', 'black'] as const) {
      assert.equal(isKingInCheck(actual, color), threatened(pieces, color, effects), `${n}: independent ${color} check`);
    }
    // Enumeration for arbitrary cards can exhaustively search replacement moves.
    // The per-action destination and both check queries above supply the immutable query gate.
    assert.deepEqual(actual, queryCopy, `${n}: queries are immutable`);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to, piece = at(pieces, from)!;
      assert.ok(piece && piece.owner === actor);
      assert.equal(turn.moveMade, false);
      const victim = at(pieces, to);
      assert.ok(!victim || victim.owner !== actor);
      assert.ok(reaches(pieces, piece, to, !!victim, effects), `${n}: independent move geometry`);
      if (n !== 42) assert.ok(dests.get(from as SquareName)?.includes(to as SquareName));
      const role = piece.role, event: GameEvent = { type: 'move', from: from as SquareName, to: to as SquareName };
      if (action.promotion) event.promotion = action.promotion as 'knight';
      if (victim) {
        event.capturedId = victim.id; capture(victim.id, actor);
        if (n === 57) { capture('white-pawn-f2', actor); event.capturedIds = ['white-pawn-e2','white-pawn-f2']; dropEffect('confabulation'); }
      }
      if (actor === 'white') {
        if (['rook','bishop','queen'].includes(role) && Math.max(...xy(from).map((x, i) => Math.abs(x! - xy(to)[i]!))) > 1) event.previousFen = beforeFen;
        event.movedPieceId = piece.id; event.movedRoles = [role];
      }
      movePiece(from, to);
      if (n === 105) { assert.equal(action.promotion, 'knight'); piece.role = 'knight'; piece.promoted = true; dropEffect('crab'); }
      if (piece.royal) fields[2] = actor === 'white' ? fields[2]!.replace(/[KQA-H]/g, '') || '-' : fields[2]!.replace(/[kqa-h]/g, '') || '-';
      advance(role === 'pawn' || !!victim);
      if (role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2) ep = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: piece.id }];
      shield = { player: actor, pieceIds: [piece.id], capturedOpponent: !!victim };
      forbidden = undefined; history.push(event);
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true);
      assert.equal(threatened(pieces, actor, effects), false);
      turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined; forbidden = undefined; response = undefined; skipped = undefined;
      if (n === 107) { assert.deepEqual(lost, ['white']); lost = []; skipped = 'white'; advance(false); }
    } else if (action.type === 'namePiece') {
      assert.equal(n, 50);
      assert.deepEqual(action, { type: 'namePiece', speaker: 'white', name: 'queen', losses: [{ effectId: 'black-deck-0-doomsayer', pieceId: 'white-queen-d1' }] });
      capture('white-queen-d1', 'black'); dropEffect('doomsayer'); fields[4] = '0';
      history.push({ type: 'pieceNamed', speaker: 'white', name: 'queen', capturedIds: ['white-queen-d1'], resolvedEffectIds: ['black-deck-0-doomsayer'] });
    } else if (action.type === 'playCard') {
      const [owner, cardId, id] = cardRows[n]!;
      assert.equal(action.cardId, cardId); assert.equal(action.cardInstanceId, id);
      const card = { id, cardId }, catalog = CARD_CATALOG[cardId]!;
      assert.ok(catalog.timing.includes(owner === actor ? turn.phase : 'afterOpponentMove'));
      let event: GameEvent = { type: 'cardPlayed', cardId }, retained = false;
      const movement: Array<{ from: SquareName; to: SquareName }> = [];
      const relocate = (from: SquareName, to: SquareName) => { movePiece(from, to); movement.push({ from, to }); };
      switch (n) {
        case 6:
          assert.equal(action.target, 'h6'); assert.equal(at(pieces, 'h6'), undefined);
          retained = true; effects.push({ type: cardId, owner, card, square: 'h6' }); event.target = 'h6'; break;
        case 10:
          assert.deepEqual(action.target, [{ from: 'f2', to: 'f3' }]);
          relocate('f3','f4'); relocate('f2','f3'); advance(true);
          shield = { player: owner, capturedOpponent: false, pieceIds: ['white-knight-g1','white-pawn-f2'] };
          event = { ...event, target: action.target as GameEvent['target'], preservePreviousMove: false, movement }; break;
        case 14: {
          assert.deepEqual(action.target, [{ from: 'a2', to: 'c5' }, { from: 'h2', to: 'b6' }]);
          const targets: Record<string, SquareName> = { a2: 'c5', h2: 'b6', b6: 'h2', c5: 'a2' };
          for (const p of pieces) if (p.square && targets[p.square]) { movement.push({ from: p.square, to: targets[p.square]! }); p.square = targets[p.square]!; }
          advance(true); shield = { player: owner, capturedOpponent: false, pieceIds: [] };
          event = { ...event, target: action.target as GameEvent['target'], movement, preservePreviousMove: false }; break;
        }
        case 18: case 75: case 77: {
          const pair = n === 18 ? ['f1','e2'] : n === 75 ? ['c1','d3'] : ['f6','h3'];
          assert.deepEqual(action.target, [{ from: pair[0], to: pair[1] }]);
          const p = at(pieces, pair[0]!)!; assert.equal(at(pieces, pair[1]!), undefined);
          relocate(pair[0] as SquareName, pair[1] as SquareName); advance(false);
          shield = { player: owner, capturedOpponent: false, pieceIds: [p.id] };
          event = { ...event, target: action.target as GameEvent['target'], movement, preservePreviousMove: false }; break;
        }
        case 25: case 53: {
          const rook = n === 25 ? 'a1' : 'h8', knight = n === 25 ? 'b1' : 'a5';
          assert.deepEqual(action.target, { rook, knight });
          const r = at(pieces, rook)!, k = at(pieces, knight)!;
          assert.equal(r.role, 'rook'); assert.equal(k.role, 'knight'); assert.equal(r.owner, opposite(owner)); assert.equal(k.owner, opposite(owner));
          for (const p of pieces) if (p === r || p === k) { const dest = p === r ? knight : rook; movement.push({ from: p.square!, to: dest as SquareName }); p.square = dest as SquareName; }
          if (n === 25) fields[2] = 'KAkq';
          fields[3] = ep[0]?.target ?? '-';
          event = { ...event, target: action.target as GameEvent['target'], movement, preservePreviousMove: true }; break;
        }
        case 27:
          assert.deepEqual(action.target, [{ from: 'f3', to: 'e4' }]);
          assert.equal(at(pieces,'f3')?.role, 'pawn'); assert.equal(at(pieces,'e4')?.role, 'pawn');
          at(pieces,'f3')!.zone = 'away'; pieces.find(p => p.id === 'white-pawn-f2')!.square = null;
          retained = true; effects.push({ type: cardId, owner, card, pieceIds: ['white-pawn-e2','white-pawn-f2'] });
          advance(true); shield = { player: owner, capturedOpponent: false, pieceIds: ['white-pawn-f2'] };
          event = { ...event, target: action.target as GameEvent['target'], movement: [{ from: 'f3',to: 'e4' }], preservePreviousMove: false }; break;
        case 34:
          assert.equal(action.target, 'a2'); assert.equal(at(pieces,'a2')!.id, 'black-pawn-c7');
          retained = true; effects.push({ type: cardId, owner, card, pieceId: 'black-pawn-c7' });
          event = { ...event, target: 'a2', movement: [], preservePreviousMove: true }; break;
        case 43: {
          assert.deepEqual(action.target, { from: 'g4', to: 'g5' });
          assert.equal(threatened(pieces,'black',effects), true);
          const checkpoint = snapshots.get(41)!;
          pieces = structuredClone(checkpoint.pieces); fields = checkpoint.fen.split(' '); ep = structuredClone(checkpoint.enPassant);
          history.pop(); turn.phase = 'beforeMove'; turn.moveMade = false;
          event = { type: 'cardFizzled', cardId, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false }; break;
        }
        case 49:
          assert.equal(action.target, undefined); retained = true; effects.push({ type: cardId, owner, card });
          event = { ...event, movement: [], preservePreviousMove: true }; break;
        case 56: {
          assert.equal(action.target, undefined); const checkpoint = snapshots.get(54)!;
          pieces = structuredClone(checkpoint.pieces); fields = checkpoint.fen.split(' '); ep = structuredClone(checkpoint.enPassant);
          history.pop(); turn.phase = 'beforeMove'; turn.moveMade = false; shield = undefined;
          forbidden = { player: 'black', movement: 'black-pawn-g7:g7:g5' };
          event = { ...event, player: 'white', movement: [{ from: 'g5', to: 'g7' }], preservePreviousMove: true }; break;
        }
        case 106: {
          assert.equal(action.target, undefined);
          const rook = pieces.find(p => p.id === 'white-rook-a1')!; rook.zone = 'board'; rook.square = 'b1'; delete rook.capturedBy;
          const crab = pieces.find(p => p.id === 'black-pawn-c7')!; crab.role = 'pawn'; crab.promoted = false; capture(crab.id,'white');
          lost = ['white']; shield = undefined; ep = []; fields[3] = '-'; fields[4] = '0';
          event = { ...event, player: 'white', capturedId: crab.id, capturedIds: [crab.id], preservePreviousMove: false, movement: [] }; break;
        }
        case 108: {
          assert.deepEqual(action.target, []); const a1 = at(pieces,'a1')!, a8 = at(pieces,'a8')!;
          a1.square = 'h1'; a8.square = 'a1';
          event = { ...event, target: [], movement: [{ from: 'a1', to: 'h1' }, { from: 'a8', to: 'a1' }], preservePreviousMove: true }; break;
        }
        case 114:
          assert.equal(action.target, 'e6'); assert.equal(at(pieces,'e5'),undefined); assert.equal(at(pieces,'e4'),undefined); assert.equal(at(pieces,'e3'),undefined);
          relocate('e6','e3'); advance(true); shield = { player: owner, capturedOpponent: false, pieceIds: ['black-pawn-e7'] };
          event = { ...event, target: 'e6', movement, preservePreviousMove: false }; break;
        case 120: {
          assert.deepEqual(action.target, { own: 'b1', opponent: 'a7' });
          const candidate = structuredClone(pieces), own = at(candidate,'b1')!, enemy = at(candidate,'a7')!; own.square = 'a7'; enemy.square = 'b1';
          assert.equal(threatened(candidate,'white',effects), true); advance(false); shield = undefined;
          event = { type: 'cardFizzled', cardId, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false }; break;
        }
        case 122: {
          assert.deepEqual(action.target, { pieceId: 'black-pawn-f7', to: 'f7' }); assert.equal(at(pieces,'f7'),undefined);
          const p = pieces.find(p => p.id === 'black-pawn-f7')!; assert.equal(p.zone,'captured'); p.zone = 'board'; p.square = 'f7'; delete p.capturedBy;
          advance(true); shield = { player: owner, capturedOpponent: false, pieceIds: [] };
          event = { ...event, target: action.target as GameEvent['target'], movement: [], preservePreviousMove: false }; break;
        }
        case 125:
          assert.equal(action.target, undefined); relocate('f1','e2');
          event = { ...event, movement, preservePreviousMove: true }; break;
        default: assert.fail(`unreviewed card ${n}`);
      }
      spend(owner, card, retained); history.push(event); response = { player: owner, historyLength: history.length };
    } else assert.fail(`unreviewed action ${n}`);
    fields[0] = placement(pieces);
    actual = immutableAction(before, action);
    assert.deepEqual(actual.pieces, pieces, `${n}: full physical records`);
    assert.deepEqual(actual.players, players, `${n}: exact ordered physical card zones`);
    assert.deepEqual(actual.effects, effects, `${n}: full effects`);
    assert.deepEqual(actual.history, history, `${n}: complete history`);
    assert.deepEqual(actual.turn, turn, `${n}: turn and allowances`);
    assert.equal(actual.fen, fields.join(' '), `${n}: six FEN fields`);
    assert.deepEqual(actual.enPassant, ep, `${n}: physical en-passant opportunities`);
    assert.deepEqual(actual.shieldMove, shield, `${n}: full movement token`);
    assert.deepEqual(actual.chaosForbidden, forbidden, `${n}: cancellation restriction`);
    assert.deepEqual(actual.riposteLostMoves ?? [], lost, `${n}: lost moves`);
    assert.equal(actual.riposteSkipped, skipped, `${n}: skipped move`);
    assert.equal(actual.riposteCheckDeferred, undefined);
    assert.equal(actual.plotsExecution, undefined); assert.deepEqual(actual.plotsAllowances ?? [], []);
    assert.deepEqual(actual.fogLocked ?? [], []); assert.equal(actual.orientation, 0);
    assert.deepEqual(actual.playedCards ?? [], played); assert.deepEqual(actual.cardResponse, response);
    assert.equal(actual.outcome, null); assert.equal(actual.pendingAbduction ?? null, null);
    assert.deepEqual(actual.underElfHill ?? [], []);
    assert.equal(!!actual.pendingRescue, n === 42);
    assert.deepEqual(actual.pendingDoomsayer ?? null, n === 49 ? { player: 'white', cardInstanceId: 'black-deck-0-doomsayer' } : null);
    for (const color of ['white','black'] as const) assert.equal(isKingInCheck(actual,color), threatened(pieces,color,effects), `${n}: resulting ${color} royal threats`);
    snapshots.set(n, actual);
    if (n === 42) verifyRescue(before, actual);
    if (n === 43) {
      const probe = structuredClone(actual); probe.turn.cardPlays.black = 0;
      const copy = structuredClone(probe); cardPlayTargets(probe,'doomsayer');
      const invalid = applyAction(probe,{ type:'playCard',cardId:'doomsayer',cardInstanceId:'black-deck-0-doomsayer' });
      assert.deepEqual(probe,copy); assert.equal(invalid.ok,false,'inert d7 token must not permit after-move Doomsayer');
      assert.deepEqual(invalid.state,copy);
    }
    if (n === 56) {
      const copy = structuredClone(actual), invalid = applyAction(actual,{ type: 'move', from: 'g7', to: 'g5' });
      assert.equal(invalid.ok,false); assert.deepEqual(actual,copy); assert.deepEqual(invalid.state,copy);
    }
    // Prospective before-move EP query: simulate the capture and remove its physical victim before checking the royal.
    if (ep.length) {
      const captorColor = fields[1] === 'w' ? 'white' : 'black';
      const prospective = structuredClone(actual); prospective.turn = { color: captorColor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const copy = structuredClone(prospective), available = legalDests(prospective);
      for (const opportunity of ep) for (const p of pieces.filter(p => p.zone === 'board' && p.owner === captorColor && p.role === 'pawn')) {
        const [x,y] = xy(p.square!), [tx,ty] = xy(opportunity.target);
        let legal = Math.abs(x! - tx!) === 1 && ty! - y! === (captorColor === 'white' ? 1 : -1);
        if (legal) {
          const board = structuredClone(pieces); board.find(q => q.id === p.id)!.square = opportunity.target;
          const victim = board.find(q => q.id === opportunity.pawnId)!; victim.square = null; victim.zone = 'captured';
          legal = !threatened(board,captorColor,effects);
        }
        assert.equal(available.get(p.square!)?.includes(opportunity.target) ?? false, legal, `${n}: legal EP availability`);
      }
      assert.deepEqual(prospective,copy);
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length,50);
  assert.equal(Object.keys(cardRows).length,19);
  assert.equal(actual.fen,'8/rb3ppp/pPP3n1/3P2n1/1b2Bk2/rP2p3/3PB2p/NR1K3N w - - 2 30');
});

function verifyRescue(before: GameState, pending: GameState): void {
  assert.deepEqual(pending.pendingRescue, {
    before, fen: before.fen, pieces: before.pieces, enPassant: before.enPassant,
    historyLength: before.history.length, movedPieceIds: ['black-pawn-d7'],
  });
  assert.equal(threatened(pending.pieces,'black',pending.effects),true);
  const card = { id: 'black-deck-0-doomsayer', cardId: 'doomsayer' };
  assert.ok(pending.players.black.hand.some(c => c.id === card.id));
  const armed = immutableAction(pending,{ type: 'playCard', cardId: card.cardId, cardInstanceId: card.id });
  const expectedPlayers = structuredClone(pending.players);
  expectedPlayers.black.hand = expectedPlayers.black.hand.filter(c => c.id !== card.id);
  expectedPlayers.black.hand.push(expectedPlayers.black.deck.shift()!);
  assert.deepEqual(armed.players,expectedPlayers); assert.deepEqual(armed.pieces,pending.pieces);
  assert.deepEqual(armed.effects,[...pending.effects,{ type: 'doomsayer', owner: 'black', card }]);
  assert.deepEqual(armed.history,[...pending.history,{ type: 'cardPlayed', cardId: 'doomsayer', movement: [], preservePreviousMove: true }]);
  assert.equal(armed.fen,pending.fen); assert.deepEqual(armed.enPassant,[]);
  assert.deepEqual(armed.turn,{ color:'black',phase:'afterMove',moveMade:true,cardPlays:{white:0,black:1} });
  assert.deepEqual(armed.pendingDoomsayer,{ player:'white',cardInstanceId:card.id });
  assert.deepEqual(armed.pendingRescue,pending.pendingRescue);
  const rescued = immutableAction(armed,{ type:'namePiece',speaker:'white',name:'knight',losses:[{effectId:card.id,pieceId:'white-knight-g1'}] });
  const board = structuredClone(pending.pieces), victim = board.find(p => p.id === 'white-knight-g1')!;
  victim.square = null; victim.zone = 'captured'; victim.capturedBy = 'black';
  expectedPlayers.black.discard.push(card);
  assert.deepEqual(rescued.pieces,board); assert.deepEqual(rescued.players,expectedPlayers); assert.deepEqual(rescued.effects,pending.effects);
  assert.deepEqual(rescued.history,[...armed.history,{type:'pieceNamed',speaker:'white',name:'knight',capturedIds:[victim.id],resolvedEffectIds:[card.id]}]);
  assert.equal(rescued.fen,'r3kbnr/pb4pp/1Pqpp3/n1P2p2/4P3/6P1/pPPPBK1p/NRBQ3R w kq - 0 11');
  assert.deepEqual(rescued.enPassant,[]); assert.deepEqual(rescued.turn,armed.turn);
  assert.equal(rescued.pendingRescue,null); assert.equal(rescued.pendingDoomsayer,null);
  assert.equal(threatened(board,'black',pending.effects),false); assert.equal(threatened(board,'white',pending.effects),false);
  const ended = immutableAction(rescued,{type:'endTurn'});
  assert.deepEqual(ended.pieces,board); assert.deepEqual(ended.players,expectedPlayers); assert.deepEqual(ended.effects,pending.effects);
  assert.deepEqual(ended.history,rescued.history); assert.equal(ended.fen,rescued.fen); assert.deepEqual(ended.enPassant,[]);
  assert.deepEqual(ended.turn,{ color:'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0} });
  assert.equal(ended.shieldMove,undefined); assert.equal(ended.outcome,null);
  for (const state of [armed,rescued,ended]) {
    assert.equal(state.orientation,0);
    assert.equal(state.chaosForbidden,undefined); assert.equal(state.plotsExecution,undefined);
    assert.deepEqual(state.plotsAllowances ?? [],[]); assert.deepEqual(state.fogLocked ?? [],[]);
    assert.deepEqual(state.riposteLostMoves ?? [],[]); assert.equal(state.riposteSkipped,undefined);
    assert.equal(state.riposteCheckDeferred,undefined); assert.deepEqual(state.underElfHill ?? [],[]);
    assert.equal(state.pendingAbduction ?? null,null);
    assert.deepEqual(state.playedCards,[...(pending.playedCards ?? []),{player:'black',cardInstanceId:card.id}]);
  }
  assert.deepEqual(armed.shieldMove,{player:'black',pieceIds:['black-pawn-d7'],capturedOpponent:false});
  assert.deepEqual(rescued.shieldMove,armed.shieldMove);
  assert.deepEqual(armed.cardResponse,{player:'black',historyLength:armed.history.length});
  assert.deepEqual(rescued.cardResponse,armed.cardResponse); assert.equal(ended.cardResponse,undefined);
}
