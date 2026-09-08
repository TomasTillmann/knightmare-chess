import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, PieceState, SquareName } from '../types.js';
import { parseFen, makeBoardFen } from 'chessops/fen';
import { Board } from 'chessops/board';
import { parseSquare } from 'chessops/util';

const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/086.json', import.meta.url), 'utf8'));
// Individually reviewed in order against rules §§8–15, 17–20, 22 and printed catalog timing.
const rationales = [
  '1. a2-a4: original White a-Pawn crosses empty a3; double-step opportunity a3; Kings screened.',
  '2. End White turn; Black starts, a3 opportunity survives and no cards change.',
  '3. b8-c6: Black b-Knight jumps (1,-2); a3 opportunity expires, Black fullmove increments.',
  '4. End Black turn; White starts with unchanged pieces and cards.',
  '5. h2-h4 crosses empty h3; original White h-Pawn creates h3 opportunity and resets halfmove.',
  '6. End White turn; Black starts and h3 opportunity remains.',
  '7. b7-b6: Black b-Pawn advances one to empty square; no capture or check.',
  '8. End Black turn; White starts with no en-passant opportunity.',
  '9. Confabulation: h1 Rook moves one square into own g1 Knight; both nonroyal. Knight is host, Rook component away; replacement move, retained card, K right lost.',
  '10. End composite replacement turn; Black starts; both components remain merged.',
  '11. f7-f6: original Black f-Pawn advances one; both Kings safe.',
  '12. End Black turn; White starts; Confabulation remains.',
  '13. g1-h1: composite uses its Rook component, not Knight geometry; h1 empty and King e1 screened.',
  '14. End White turn; Black starts; composite identity unchanged.',
  '15. c8-b7: original c8 Bishop moves one diagonal into vacated b7; Black King safe.',
  '16. End Black turn; White starts; Bishop remains b7.',
  '17. h4-h5: White h-Pawn advances one into empty h5; halfmove resets.',
  '18. End White turn; Black starts; no changes beyond turn allowance.',
  '19. e7-e6: Black e-Pawn advances one and opens f8-e7-d6 diagonal.',
  '20. End Black turn; White starts; Black King e8 remains safe.',
  '21. e2-e3: White e-Pawn advances, opens f1-e2-d3 diagonal; no enemy ray reaches e1.',
  '22. End White turn; Black starts; no cards spent.',
  '23. Forced March: b6-a6 and f6-g6 shift distinct Black Pawns sideways into initially empty squares; atomic replacement, no capture, fullmove advances.',
  '24. End Black replacement turn; White starts; both Pawn identities preserved.',
  '25. h1-g1: composite slides one Rook square to empty g1; e1 remains safe.',
  '26. End White turn; Black starts; merge retained.',
  '27. f8-d6: original f8 Bishop slides through empty e7; no capture or check.',
  '28. End Black turn; White starts; Bishop d6 is distinct from Bishop b7.',
  '29. g1-f3: composite selects Knight mode (1,2), jumps pieces; host and Rook component preserved.',
  '30. End White turn; Black starts; composite f3 does not attack e8.',
  '31. h7-h6: Black h-Pawn advances one, h6 empty; no check.',
  '32. End Black turn; White starts; no transient effects.',
  '33. f3-h4: composite Knight jump (2,1) into empty h4; no King exposure.',
  '34. End White turn; Black starts; both original Kings remain screened.',
  '35. d6-f4: original f8 Bishop passes empty e5; its e3 ray stops at occupied White Pawn e3, and f4/e1 are unaligned.',
  '36. Vendetta after Black move retains physical card and draws Tournament; board and clocks unchanged.',
  '37. End Black turn; White has captures including f1xa6, so Vendetta persists.',
  '38. f1xa6: White f-Bishop captures original Black b-Pawn through empty e2,d3,c4,b5; satisfies Vendetta, e1 safe.',
  '39. Fortification after White move installs boundary c2-c3; occupied endpoint c2 is legal. Board and clocks unchanged; card retained.',
  '40. End White turn; Black has b7xa6, so Vendetta persists.',
  '41. b7xa6: original c8 Bishop captures White f-Bishop one diagonal, satisfies Vendetta.',
  '42. End Black turn; White can capture g6 Pawn or f4 Bishop; Vendetta remains.',
  '43. h5xg6: original White h-Pawn captures original Black f-Pawn diagonally forward; King e1 safe.',
  '44. Black Chaos immediately rewinds 43: both Pawns restored, clocks/effects restored, White gets replacement; Black spends Chaos, and h5xg6 is forbidden.',
  '45. h4xf4: composite Rook mode crosses empty g4 to capture original f8 Bishop; different physical move from 43 and satisfies Vendetta.',
  '46. End replacement White turn; Black allowance resets, g6xh5 remains possible.',
  '47. g6xh5: original Black f-Pawn captures original White h-Pawn; legal compulsory capture.',
  '48. End Black turn; White composite can capture h5, so Vendetta remains.',
  '49. f4xh5: composite Knight mode captures original Black f-Pawn on h5; Rook component stays merged.',
  '50. End White turn: Black has no capture (h6 cannot capture straight, Bishop a6 ray has no victim, Knight c6 has no occupied enemy destination); Vendetta is discarded.',
  '51. d8-f6: Black Queen passes empty e7; no Vendetta restriction and no check on e1 (unaligned).',
  '52. End Black turn; White starts; wall and merge persist.',
  '53. h5-h3: composite Rook mode passes empty h4; stops empty h3; h6 Pawn not crossed.',
  '54. End White turn; Black starts; clocks unchanged by endTurn.',
  '55. a6-c8: original c8 Bishop slides through vacated b7 to empty c8.',
  '56. End Black turn; White starts; no captured piece returns.',
  '57. g2-g3: original White g-Pawn advances into empty g3; e1 remains safe.',
  '58. End White turn; Black starts; no en passant.',
  '59. c6-b8: original Black b-Knight jumps to its empty original square; rights unaffected.',
  '60. End Black turn; White starts; composite still h3.',
  '61. Passing in the Night swaps White b2/g3 Pawns with Black g7/d7 Pawns simultaneously; no capture, ownership preserved, Pawn clock reset. New d7 Pawn checks e8, but d8 is a safe escape, so not direct mate.',
  '62. End White turn; Black starts in check from d7 Pawn with d8 available.',
  '63. e8-d8: Black King escapes the d7 Pawn, which attacks c8/e8 rather than d8; Queen d1 ray blocked by White Pawn d2. Both Black rights revoked.',
  '64. End Black turn; White starts; check resolved.',
  '65. h3-g5: composite Knight jump; Queen f6/e1 unaligned and neither Black Knight attacks e1.',
  '66. Dungeon after move sends original g8 Knight to empty h1; it is not the b8 Knight. Enemy Knight h1 cannot move next Black turn; clocks unchanged.',
  '67. End White turn; Dungeon remains active for Black.',
  '68. c8-a6 through empty b7: Black moves its Bishop, not the frozen h1 Knight.',
  '69. End Black turn; Dungeon restriction expires; both Knights keep their physical identities.',
  '70. d1-e2: White Queen moves one diagonal into empty square; no King exposure.',
  '71. End White turn; Black starts; no card accounting changes.',
  '72. h8-h7: original Black h-Rook moves one down to empty h7; Black castling was already lost.',
  '73. End Black turn; White starts; h7 Rook is distinct from a8 Rook.',
  '74. g5-e5: composite slides in Rook mode through empty f5; e5 empty; own King safe.',
  '75. Cathedral after move swaps White a1 Rook and c1 Bishop without capture or path; b1 Knight does not block a swap. Clocks preserved; castling bit remains attached until actual Rook movement.',
  '76. End White turn; Black starts; original c-Bishop now a1 and original a-Rook c1.',
  '77. b8xd7: original b-Knight captures the White original g-Pawn relocated by Passing in the Night; King d8 remains safe.',
  '78. End Black turn; White starts; original White b-Pawn still g7.',
  '79. e5-g6: composite Knight jump to empty g6; not a sliding move through f6 Queen.',
  '80. End White turn; Black starts; wall c2-c3 unchanged.',
  '81. c7-c6: Black original c-Pawn advances one to empty c6; King d8 safe.',
  '82. Doomsayer after Black move retains card and draws Legacy; White receives immediate naming option; board/clocks unchanged.',
  '83. White declines immediate Doomsayer option; effect persists without capturing anything or using a card.',
  '84. End Black turn; White starts; Doomsayer still active.',
  '85. Forced March shifts original White e-Pawn e3-d3 into empty adjacent square; wall c2-c3 is not crossed. Replacement move preserves e1 safety.',
  '86. White intentionally names Knight and selects g6 composite; both original g-Knight and h-Rook captured under §15.4, Confabulation and fulfilled Doomsayer discarded; no extra card allowance consumed.',
  '87. End White turn; Black starts; only c2-c3 wall remains.',
  '88. d7-e5: original Black b-Knight jumps to empty e5; no King exposure.',
  '89. End Black turn; White starts; h1 Knight remains distinct.',
  '90. c1-d1: original White a-Rook moves one into empty d1, revoking its remaining castling right; Bishop stays a1.',
  '91. End White turn; Black starts; no castling rights remain.',
  '92. f6-f5: original Black Queen slides one down; no direct line to e1.',
  '93. End Black turn; White starts; no card effects expire.',
  '94. d3-d4: White original e-Pawn advances one; e1 remains safe and halfmove resets.',
  '95. End White turn; Black starts; c2-c3 wall is irrelevant to d-file move.',
  '96. b2xa1=R: original Black g-Pawn captures original White c-Bishop diagonally and promotes permanently to Rook; b1 Knight screens White King along first rank.',
  '97. Heresy after Black move: White has no board Bishops, then Black only Bishop a6-b6 changes square color into empty adjacent square; clocks unchanged, neither King checked.',
  '98. End Black turn; White starts; both White Bishops are captured as distinct physical pieces.',
  '99. Resurrection returns original c1 Bishop to vacant f1, an allowed Bishop starting square; original f1 Bishop stays captured. Replacement move, no capture, own King safe.',
  '100. End White turn; Black starts; resurrected Bishop retains original c1 identity.',
  '101. Black Under Elf Hill removes royal d8 King to away, spends replacement move and card; no capture and no new direct mate.',
  '102. End Black turn; White starts while Black King is absent and cannot attack.',
  '103. e2-b5: White Queen passes empty d3,c4; own King e1 remains safe, absent Black King cannot be checked.',
  '104. End White turn opens mandatory Black edge-return choice; clocks unchanged.',
  '105. Black King returns on empty edge a2: Queen b5 is unaligned (1,3), Knight b1 attacks a3/c3/d2, Bishop f1 unaligned; King cannot move this turn.',
  '106. f5xf2: Black Queen passes empty f4,f3 and captures original White f-Pawn; returning King stays a2; Queen now checks White e1.',
  '107. End Black turn expires King movement restriction; White starts checked but has Under Elf Hill escape.',
  '108. Haunting Memories copies last played card, opposing Under Elf Hill, and removes checked White King e1; spends only physical Memories, not held Under Elf Hill.',
  '109. End White turn; Black starts while White King remains away.',
  '110. e5-d3: original Black b-Knight jumps to empty d3; King a2 safe, White royal absent.',
  '111. Crab after Black move marks original h-Pawn h6; identity and board unchanged, continuing card retained and Charge drawn.',
  '112. End Black turn opens White mandatory edge return; Crab remains on h6.',
  '113. White King returns h3: Qf2/h3 are unaligned (2,1), Bb6/h3 unaligned (6,3), h7 Rook blocked by occupied h6 Crab; g3 Pawn attacks h2, not h3.',
  '114. b5xd3: White Queen crosses empty c4 to capture original Black b-Knight; White returned King stays h3 and original Black g-Knight stays h1.',
  '115. End White turn expires returned King restriction; Black King a2 remains safe.',
  '116. a8-f8: original Black a-Rook crosses empty b8,c8,d8,e8; h-Rook stays h7 and promoted g-Pawn Rook stays a1.',
  '117. End Black turn; White starts; all three Black Rook identities distinct.',
  '118. d3-e4: White Queen moves one diagonal into empty e4; Black Queen f2 still unaligned to h3.',
  '119. End White turn; Black starts; wall and Crab persist.',
  '120. g3-g2: original Black d-Pawn advances one; it is not h6 Crab. White King h3 remains safe.',
  '121. Plots Within Plots after Black move spends/draws once; grants up to two previously eligible cards, no movement. Newly drawn Fortification is not eligible.',
  '122. End Black turn declines unused extra plays and clears Plots allowance; no pieces or clocks change.',
  '123. White plays its actual Under Elf Hill, removes h3 King and spends replacement move; Memories remains separately discarded.',
  '124. End White turn; Black starts with White King absent.',
  '125. f8-b8: original Black a-Rook passes empty e8,d8,c8 to b8; no capture or castling restoration.',
  '126. End Black turn opens mandatory White edge return; clocks unchanged.',
  '127. White King returns empty h5: h7 Rook blocked by occupied h6 Crab, Crab attacks g5 only, Qf2/h5 unaligned (2,3), Bb6/h5 unaligned (6,1).',
  '128. d4-d5: original White e-Pawn advances one; returned King remains h5 and safe; halfmove resets.',
  '129. End White turn clears return restriction; Black starts, final identities, effects and card zones preserved.',
];

test('iteration 086 independent semantic review', () => {
  assert.equal(rationales.length, 129);
  assert.equal(trace.steps.length, rationales.length);
  assert.equal(trace.moves, 50);
  rationales.forEach((reason, index) => assert.ok(reason.startsWith(`${index + 1}. `)));
  let state = createGameState(trace.initial);
  let expectedPieces = structuredClone(state.pieces);
  const expectedPlayers = structuredClone(state.players);
  const composite = { type: 'confabulation', owner: 'white', card: { id: 'white-hand-4-confabulation', cardId: 'confabulation' }, pieceIds: ['white-knight-g1', 'white-rook-h1'] };
  const wall = { type: 'fortification', owner: 'white', card: { id: 'white-hand-2-fortification', cardId: 'fortification' }, from: 'c2', to: 'c3' };
  const vendetta = { type: 'vendetta', owner: 'black', card: { id: 'black-hand-3-vendetta', cardId: 'vendetta' } };
  const doomsayer = { type: 'doomsayer', owner: 'black', card: { id: 'black-hand-4-doomsayer', cardId: 'doomsayer' } };
  const crab = { type: 'crab', owner: 'black', card: { id: 'black-deck-5-crab', cardId: 'crab' }, pieceId: 'black-pawn-h7' };
  const piece = (id: string) => { const p = expectedPieces.find(p => p.id === id); assert.ok(p); return p; };
  const relocate = (id: string, square: string | null, zone: PieceState['zone'] = 'board') => {
    if (square !== null) assert.match(square, /^[a-h][1-8]$/);
    Object.assign(piece(id), { square: square as SquareName | null, zone });
    if (zone === 'captured') piece(id).capturedBy = state.turn.color;
    else delete piece(id).capturedBy;
  };
  const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
  const occupant = (square: string) => expectedPieces.find(p => p.zone === 'board' && p.square === square);
  // Independent geometric oracle: this trace has no neutral pieces, pins giving variant checks,
  // castling, EP capture, capture immunity or movement powers beyond the composite and Crab.
  const reaches = (p: PieceState, target: string, n: number, capture: boolean) => {
    assert.ok(p.square);
    const [x, y] = xy(p.square), [tx, ty] = xy(target), dx = tx - x, dy = ty - y;
    if (!dx && !dy) return false;
    if (p.royal && state.underElfHill?.some(e => e.pieceId === p.id && e.returned)) return false;
    if (p.id === 'black-knight-g8' && n >= 66 && n <= 69) return false;
    const roles = p.id === 'white-knight-g1' && n >= 9 && n < 86 ? ['knight', 'rook'] : [p.role];
    return roles.some(role => {
      if (role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
      if (role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
      if (role === 'pawn') {
        const forward = p.owner === 'white' ? 1 : -1;
        if (capture || p.id === 'black-pawn-h7' && n >= 111) return Math.abs(dx) === 1 && dy === forward;
        if (dx !== 0 || dy !== forward && !(dy === 2 * forward && (p.owner === 'white' ? y <= 1 : y >= 6))) return false;
      } else if (!(role === 'rook' && (dx === 0 || dy === 0)
        || role === 'bishop' && Math.abs(dx) === Math.abs(dy)
        || role === 'queen' && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)))) return false;
      const length = Math.max(Math.abs(dx), Math.abs(dy));
      let previous: string = p.square!;
      for (let k = 1; k <= length; k++) {
        const next: string = `${String.fromCharCode(97 + x + Math.sign(dx) * k)}${y + Math.sign(dy) * k + 1}`;
        if (n >= 39 && [previous, next].sort().join(':') === 'c2:c3') return false;
        if (k < length && occupant(next)) return false;
        previous = next;
      }
      return true;
    });
  };
  const safe = (color: Color, n: number) => {
    const king = expectedPieces.find(p => p.royal && p.owner === color && p.zone === 'board');
    return !king || !expectedPieces.some(p => p.zone === 'board' && p.owner !== color && reaches(p, king.square!, n, true));
  };
  const replacementCards = new Set([9, 23, 61, 85, 99, 101, 108, 123]);
  const pawnReplacements = new Set([23, 61, 85]);
  const continuingCards = new Set([9, 36, 39, 82, 111]);
  let rewindPieces = structuredClone(expectedPieces);
  let halfmove = 0, fullmove = 1;
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, actor = state.turn.color, before = state;
    const message = rationales[index];
    let capture = false, pawnMove = false;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/);
      const mover = occupant(action.from); assert.ok(mover, message); assert.equal(mover.owner, actor, message);
      const victim = occupant(action.to);
      assert.ok(reaches(mover, action.to, n, !!victim), message);
      if (n >= 38 && n < 50) assert.ok(victim, 'Vendetta requires a capture');
      if (victim) { assert.notEqual(victim.owner, actor); assert.equal(victim.royal, false); relocate(victim.id, null, 'captured'); capture = true; }
      if (n === 43) rewindPieces = structuredClone(before.pieces);
      pawnMove = mover.originalRole === 'pawn' && !mover.promoted;
      relocate(mover.id, action.to);
      if (n === 96) { assert.equal(action.promotion, 'rook'); assert.equal(mover.id, 'black-pawn-g7'); Object.assign(mover, { role: 'rook', promoted: true }); }
      else assert.equal(action.promotion, undefined);
    }
    switch (n) {
      case 9: relocate('white-rook-h1', null, 'away'); break;
      case 23: relocate('black-pawn-b7', 'a6'); relocate('black-pawn-f7', 'g6'); break;
      case 44: expectedPieces = structuredClone(rewindPieces); break;
      case 61: relocate('white-pawn-b2', 'g7'); relocate('white-pawn-g2', 'd7'); relocate('black-pawn-d7', 'g3'); relocate('black-pawn-g7', 'b2'); break;
      case 66: relocate('black-knight-g8', 'h1'); break;
      case 75: relocate('white-rook-a1', 'c1'); relocate('white-bishop-c1', 'a1'); break;
      case 85: relocate('white-pawn-e2', 'd3'); break;
      case 86:
        relocate('white-knight-g1', null, 'captured'); relocate('white-rook-h1', null, 'captured');
        piece('white-knight-g1').capturedBy = 'black'; piece('white-rook-h1').capturedBy = 'black';
        break;
      case 97: relocate('black-bishop-c8', 'b6'); break;
      case 99: relocate('white-bishop-c1', 'f1'); break;
      case 101: relocate('black-king-e8', null, 'away'); break;
      case 105: relocate('black-king-e8', 'a2'); break;
      case 108: case 123: relocate('white-king-e1', null, 'away'); break;
      case 113: relocate('white-king-e1', 'h3'); break;
      case 127: relocate('white-king-e1', 'h5'); break;
    }
    if (action.type === 'playCard') {
      const owner: Color = n === 44 ? 'black' : actor;
      const player = expectedPlayers[owner], cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0, message);
      const [card] = player.hand.splice(cardIndex, 1); assert.ok(card); assert.equal(card.cardId, action.cardId);
      if (!continuingCards.has(n)) player.discard.push(card);
      const draw = player.deck.shift(); assert.ok(draw); player.hand.push(draw);
      assert.equal(before.turn.cardPlays[owner], 0, message);
      if (n === 44) assert.equal(before.turn.phase, 'afterMove');
      else assert.equal(before.turn.phase, replacementCards.has(n) ? 'beforeMove' : 'afterMove', message);
    }
    if (n === 50) expectedPlayers.black.discard.push(vendetta.card);
    if (n === 86) { expectedPlayers.white.discard.push(composite.card); expectedPlayers.black.discard.push(doomsayer.card); }
    if (action.type === 'move' || replacementCards.has(n)) {
      halfmove = capture || pawnMove || pawnReplacements.has(n) ? 0 : halfmove + 1;
      if (actor === 'black') fullmove++;
    }
    const result = applyAction(before, action); assert.ok(result.ok, message); state = result.state;
    assert.deepEqual(state.pieces, expectedPieces, message);
    assert.deepEqual(state.players, expectedPlayers, message);
    const effects: unknown[] = [];
    if (n >= 9 && n < 86) effects.push(composite);
    if (n >= 36 && n < 50) effects.push(vendetta);
    if (n >= 39) effects.push(wall);
    if (n >= 66 && n < 69) effects.push({ type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-knight-g8' });
    if (n >= 82 && n < 86) effects.push(doomsayer);
    if (n >= 111) effects.push(crab);
    assert.deepEqual(state.effects, effects, message);
    const returnOwner: Color | undefined = n >= 101 && n <= 106 ? 'black' : n >= 108 && n <= 114 || n >= 123 && n <= 128 ? 'white' : undefined;
    const returned = [105, 106, 113, 114, 127, 128].includes(n);
    const returning = returned || [104, 112, 126].includes(n);
    assert.deepEqual(state.underElfHill ?? [], returnOwner ? [{ pieceId: returnOwner === 'white' ? 'white-king-e1' : 'black-king-e8', player: returnOwner, returning, ...(returned ? { returned: true } : {}) }] : [], message);
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 82 ? { player: 'white', cardInstanceId: 'black-hand-4-doomsayer' } : null, message);
    const fen = parseFen(state.fen).unwrap(), board = Board.empty();
    for (const p of expectedPieces) if (p.zone === 'board') board.set(parseSquare(p.square!)!, { role: p.role, color: p.owner });
    assert.equal(state.fen.split(' ')[0], makeBoardFen(board), message);
    assert.equal(fen.halfmoves, halfmove, message); assert.equal(fen.fullmoves, fullmove, message);
    assert.equal(state.fen.split(' ')[2], n < 9 ? 'KQkq' : n < 63 ? 'Qkq' : n < 75 ? 'Q' : n < 90 ? 'A' : '-', message);
    assert.deepEqual(state.enPassant, n <= 2 ? [{ target: 'a3', pawnId: 'white-pawn-a2' }] : n >= 5 && n <= 6 ? [{ target: 'h3', pawnId: 'white-pawn-h2' }] : [], message);
    assert.equal(state.orientation, 0); assert.equal(state.pendingRescue ?? null, null); assert.equal(state.outcome, null);
    if (action.type === 'endTurn') {
      assert.equal(state.turn.color, actor === 'white' ? 'black' : 'white');
      assert.equal(state.turn.phase, 'beforeMove'); assert.equal(state.turn.moveMade, false);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
    } else if (n === 44) {
      assert.deepEqual(state.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 1 } });
      assert.deepEqual(state.chaosForbidden, { player: 'white', movement: 'black-pawn-f7:g6:captured|white-pawn-h2:h5:g6' });
      assert.equal(applyAction(state, { type: 'move', from: 'h5', to: 'g6' }).ok, false);
    } else {
      assert.equal(state.turn.color, actor, message);
      const completed = action.type === 'move' || replacementCards.has(n) || before.turn.moveMade;
      assert.equal(state.turn.moveMade, completed); assert.equal(state.turn.phase, completed ? 'afterMove' : 'beforeMove');
      const allowance = { ...before.turn.cardPlays };
      if (action.type === 'playCard') allowance[actor]++;
      assert.deepEqual(state.turn.cardPlays, allowance);
    }
    assert.equal(fen.turn, state.turn.moveMade ? (state.turn.color === 'white' ? 'black' : 'white') : state.turn.color, message);
    // The checked opponent may receive a turn, but every completed actor and every return must be safe.
    if (action.type !== 'endTurn' && n !== 44 && n !== 83) assert.ok(safe(actor, n), message);
    if (action.type === 'endTurn') assert.ok(safe(actor, n), message);
    if (action.type === 'playCard' && !continuingCards.has(n) && n !== 61) assert.ok(safe(actor === 'white' ? 'black' : 'white', n), 'regular card does not directly checkmate');
    if (n === 61) {
      assert.equal(safe('black', n), false);
      relocate('black-king-e8', 'd8'); assert.ok(safe('black', n), 'Passing in the Night gives check but not mate'); relocate('black-king-e8', 'e8');
    }
    if ([105, 113, 127].includes(n)) {
      const royal = expectedPieces.find(p => p.owner === actor && p.royal)!;
      assert.deepEqual(state.underElfHill, [{ pieceId: royal.id, player: actor, returning: true, returned: true }]);
      const destination = n === 105 ? 'a3' : n === 113 ? 'h4' : 'h4';
      assert.equal(applyAction(state, { type: 'move', from: royal.square, to: destination }).ok, false, 'returned physical King cannot move');
    }
    if (n === 108) assert.equal(state.history.at(-1)?.copiedCardId, 'under-elf-hill');
    if (n === 121) {
      assert.equal(state.plotsAllowances?.[0]?.remaining, 2);
      assert.deepEqual(state.plotsAllowances?.[0]?.eligibleCards, [], 'no already held card was eligible after this noncapturing Pawn move');
    }
    if (n === 122) assert.ok(!state.plotsAllowances?.length);
  }
  assert.equal(state.fen, '1r6/p5Pr/1bp1p2p/3P3K/P3Q3/8/k1PP1qp1/rN1R1B1n b - - 0 29');
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 17);
  assert.equal(replayTrace(trace).fen, state.fen);
});
