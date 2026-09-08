import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Independently reviewed in action order against rules §§8–15 and card metadata.
const rationale = [
  '1 Fanatic moves b2 through empty b3,b4 to b5; consumes move; no en passant.',
  '2 White ends the Fanatic turn, resetting both card allowances.',
  '3 Black knight g8-h6 is an empty L jump.',
  '4 Black ends; White acts next.',
  '5 e2-e4 crosses empty e3; records e3 en passant; pawn clock resets.',
  '6 White ends retaining the immediate en-passant opportunity.',
  '7 c7-c5 crosses c6; replaces e3 opportunity with c6.',
  '8 Black ends; b5 pawn has the c6 en-passant option.',
  '9 a2-a3 is one empty forward step, declining c6 en passant.',
  '10 White ends with no card or piece changes.',
  '11 Evangelists swaps Black f8 and White c1 bishops without capture; replaces move.',
  '12 Black ends after the swap.',
  '13 b5-b6 advances into the empty square.',
  '14 Abduction hides enemy nonroyal d7 pawn after White moves; draws replacement.',
  '15 Reveal opens recall; physical pawn stays away.',
  '16 Timeout captures d7 pawn for White; no second card draw.',
  '17 White ends after resolved Abduction.',
  '18 b8-c6 is a clear knight jump.',
  '19 Black ends.',
  '20 c2-c3 advances one empty square.',
  '21 White ends.',
  '22 e8xf8 captures the swapped White bishop on a safe adjacent square; Black loses castling.',
  '23 Black ends after capture.',
  '24 Queen d1-f3 follows clear e2 diagonal.',
  '25 White ends.',
  '26 Knight c6-b8 jumps back into empty b8.',
  '27 Black ends.',
  '28 Bishop f1-e2 makes one empty diagonal step.',
  '29 White ends.',
  '30 g7-g5 crosses empty g6; creates g6 en passant.',
  '31 Black ends retaining g6 opportunity.',
  '32 a3-a4 advances into empty a4 and expires g6.',
  '33 White ends.',
  '34 Queen d8xd2 follows cleared d7,d6,d5,d4,d3 and captures White pawn, checking e1.',
  '35 Black ends; White may answer the check with a same-turn card.',
  '36 Queen f3-h3 crosses g3; leaves d2-e1 check pending same-turn rescue.',
  '37 Coup makes safe a4 pawn royal and e1 a Prince, curing the check; card stays active.',
  '38 White ends with new royal identity.',
  '39 Disintegration kills own c5 pawn permanently before Black moves.',
  '40 Bishop c8-e6 crosses vacated d7.',
  '41 Black ends.',
  '42 Under Elf Hill removes royal a4 pawn, not e1 Prince; replaces move and clears rights.',
  '43 White ends with royal away until next own turn.',
  '44 a7-a5 crosses a6; records a6 en passant.',
  '45 Black ends; White royal return becomes mandatory.',
  '46 Royal pawn returns on empty safe edge f1, retaining pawn movement; frozen for this turn.',
  '47 Queen h3xh6 crosses h4,h5 and captures Black knight; royal stays f1; checks f8 via g7.',
  '48 White ends and return restriction expires.',
  '49 Knight b8-a6 jumps legally but leaves h6-g7-f8 check pending rescue.',
  '50 Black Abduction hides c3 pawn; this target cannot cure the Queen check.',
  '51 Recall opens with check unresolved.',
  '52 Timeout cannot save f8; spend Abduction and restore pre-move b8 knight and c3 pawn.',
  '53 King f8-e8 escapes h6 diagonal onto safe empty e8.',
  '54 Black ends after legal replacement move with card spent.',
  '55 Bishop e2-h5 crosses empty f3,g4; f1 royal stays safe.',
  '56 White ends.',
  '57 Queen d2-e2 is a one-square rank move and checks f1 royal.',
  '58 White Knightmare cancels d2-e2, restores clocks and forbids repeating that move.',
  '59 Bishop e6-d5 is a different Black move and leaves e8 safe.',
  '60 Black ends, resetting White reaction allowance.',
  '61 Guardian advances c3-c4 without follower; c2 is empty; no en passant; consumes move.',
  '62 White ends.',
  '63 g5-g4 is one empty forward Black pawn step.',
  '64 Black ends.',
  '65 Bishop h5xf7 crosses g6, captures f7 pawn, and checks e8.',
  '66 White ends.',
  '67 King e8-d8 escapes bishop f7 check onto a safe empty square.',
  '68 Black ends.',
  '69 c4-c5 advances into empty c5.',
  '70 White ends.',
  '71 Bishop d5-c4 steps diagonally, checking f1 royal through d3,e2.',
  '72 Black ends.',
  '73 f2-f3 is clear but leaves bishop c4-d3-e2-f1 check pending rescue.',
  '74 Holy War g1/f7 swap cannot cure that check; spend it and restore f2, unswapped bishop/knight.',
  '75 Bishop f7xc4 follows e6,d5 and captures checking bishop for White.',
  '76 White ends with check cured.',
  '77 Hidden Passage relocates Black royal d8-e8, empty and safe, replacing the move.',
  '78 Black ends.',
  '79 Plots opens two immediate extra card slots from the current window, with one replacement draw.',
  '80 Prince e1xd2 captures Black queen by adjacent King movement; royal identity remains f1; taking a move closes immediate Plots window.',
  '81 White ends with the unused Plots window already closed.',
  '82 e7-e5 crosses e6, records e6 en passant.',
  '83 Black ends retaining e6 opportunity.',
  '84 Bishop c4-b5 steps diagonally, checks e8 through c6,d7, and expires en passant.',
  '85 White ends.',
  '86 g4-g3 advances but does not answer b5-c6-d7-e8 check; rescue pending.',
  '87 Curse on h1 rook cannot cure bishop check; spend/discard Curse, restore g4, no Curse effect.',
  '88 Knight b8-c6 blocks the b5-e8 checking diagonal with an L jump.',
  '89 Black ends with e8 safe.',
  '90 Queen h6-g7 makes an empty diagonal step.',
  '91 White ends.',
  '92 Knight c6-e7 jumps but uncovers b5-d7-e8 diagonal; pending rescue.',
  '93 Treason h1/b1 swap cannot block bishop check; spend card, restore c6 and unswapped targets.',
  '94 h7-h6 advances one square while c6 knight still blocks bishop ray.',
  '95 Black ends.',
  '96 Knight g1-h3 makes an empty L jump.',
  '97 White ends.',
  '98 Rook a8-d8 crosses empty b8,c8.',
  '99 Dungeon sends enemy nonroyal h1 rook to vacant corner a8, immobilizing it next White turn.',
  '100 Black ends, Dungeon restriction is still due.',
  '101 Queen g7xh8 captures Black rook diagonally; immobilized a8 rook stays put; Queen checks e8.',
  '102 White ends; a8 Dungeon restriction expires.',
  '103 Rook d8-b8 crosses c8 but leaves Queen h8-g8-f8-e8 check pending rescue.',
  '104 Haunting Memories copies latest card Dungeon: Queen h8 goes to empty h1 and freezes, curing check.',
  '105 Black ends, copied Dungeon remains for White turn.',
  '106 Knight h3-g5 jumps to empty g5; Queen h1 remains frozen.',
  '107 White ends, copied Dungeon expires.',
  '108 h6-h5 advances one empty Black pawn step.',
  '109 Black ends.',
  '110 Rook a1-a3 follows empty a2; royal f1 remains safe.',
  '111 White ends.',
  '112 King e8-d8 moves adjacent onto a safe square; b8 Black rook blocks White a8 rook ray.',
  '113 Black ends.',
  '114 Rook a3-a1 crosses empty a2.',
  '115 White ends.',
  '116 a5-a4 advances one empty Black pawn step.',
  '117 Black ends.',
  '118 Prince d2-d3 moves one square; f1 pawn remains royal.',
  '119 White ends.',
  '120 Bishop c1-b2 moves one empty diagonal step.',
  '121 Black ends at 50 regular move commands, all choices resolved.',
];

const coordinates = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
function geometry(piece: PieceState, to: string, pieces: PieceState[], capture: boolean): boolean {
  assert.ok(piece.square);
  const [x, y] = coordinates(piece.square), [tx, ty] = coordinates(to);
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
  const occupied = (file: number, rank: number) => pieces.some(p => p.zone === 'board' && p.square === `${String.fromCharCode(97 + file)}${rank + 1}`);
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    return capture ? ax === 1 && dy === forward : dx === 0 && (dy === forward || dy === 2 * forward && (piece.owner === 'white' ? y <= 1 : y >= 6) && !occupied(x, y + forward));
  }
  if (!(piece.role === 'bishop' ? ax === ay : piece.role === 'rook' ? dx === 0 || dy === 0 : ax === ay || dx === 0 || dy === 0)) return false;
  for (let n = 1; n < Math.max(ax, ay); n++) if (occupied(x + Math.sign(dx) * n, y + Math.sign(dy) * n)) return false;
  return Math.max(ax, ay) > 0;
}

test('iteration 103: independent physical, royal, lifecycle, turn and card accounting for all 121 actions', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/103.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length, rationale.length);
  assert.equal(trace.moves, 50);
  let state = createGameState(trace.initial);
  const snapshots: GameState[] = [structuredClone(state)];
  const pending = new Set([36, 49, 50, 51, 73, 86, 92, 103]);
  const rewind: Record<number, number> = { 52: 48, 58: 56, 74: 72, 87: 85, 93: 91 };
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, reason = rationale[index]!;
    assert.ok(reason.startsWith(`${n} `));
    const before = structuredClone(state);
    const expected = structuredClone(before);
    const actor = before.turn.color, opponent = actor === 'white' ? 'black' : 'white';
    let clock = before.fen.split(' ').slice(4).map(Number);
    let fenTurn = before.fen.split(' ')[1];
    const relocate = (id: string, square: SquareName | null, zone: PieceState['zone'] = 'board') => {
      const piece = expected.pieces.find(p => p.id === id)!;
      assert.ok(piece, reason);
      piece.square = square; piece.zone = zone; delete piece.capturedBy;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.to, /^[a-h][1-8]$/);
      assert.equal(before.turn.moveMade, false, reason);
      const mover = expected.pieces.find(p => p.square === action.from && p.zone === 'board')!;
      assert.equal(mover.owner, actor, reason);
      const victim = expected.pieces.find(p => p.square === action.to && p.zone === 'board');
      assert.ok(geometry(mover, action.to, before.pieces, !!victim), reason);
      if (victim) { assert.equal(victim.owner, opponent); assert.equal(victim.royal, false); relocate(victim.id, null, 'captured'); victim.capturedBy = actor; }
      relocate(mover.id, action.to as SquareName);
      expected.enPassant = [];
      if (mover.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2) expected.enPassant = [{ pawnId: mover.id, target: `${action.from[0]}${(Number(action.to[1]) + Number(action.from[1])) / 2}` as SquareName }];
      clock = [mover.role === 'pawn' || victim ? 0 : clock[0]! + 1, clock[1]! + (actor === 'black' ? 1 : 0)];
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true; fenTurn = opponent[0];
    } else if (action.type === 'endTurn') {
      assert.ok(before.turn.moveMade, reason);
      expected.turn = { color: opponent, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'playCard') {
      const owner = n === 58 ? 'white' : actor;
      const player = expected.players[owner];
      const cardIndex = player.hand.findIndex(card => card.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0, reason);
      const card = player.hand.splice(cardIndex, 1)[0]!;
      assert.equal(card.cardId, action.cardId);
      assert.equal(before.turn.cardPlays[owner], 0, reason);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(n === 58 ? 'afterOpponentMove' : before.turn.phase), reason);
      expected.turn.cardPlays[owner]++;
      if (n !== 37) player.discard.push(card);
      player.hand.push(player.deck.shift()!);
      if ([1, 11, 42, 61, 77].includes(n)) {
        expected.turn.phase = 'afterMove'; expected.turn.moveMade = true; expected.enPassant = [];
        clock = [[1, 42, 61].includes(n) ? 0 : clock[0]! + 1, clock[1]! + (actor === 'black' ? 1 : 0)]; fenTurn = opponent[0];
      }
    }
    if (n === 1) relocate('white-pawn-b2', 'b5');
    if (n === 11) { relocate('white-bishop-c1', 'f8'); relocate('black-bishop-f8', 'c1'); }
    if (n === 14) relocate('black-pawn-d7', null, 'away');
    if (n === 16) { relocate('black-pawn-d7', null, 'captured'); expected.pieces.find(p => p.id === 'black-pawn-d7')!.capturedBy = 'white'; }
    if (n === 37) { expected.pieces.find(p => p.id === 'white-king-e1')!.royal = false; expected.pieces.find(p => p.id === 'white-pawn-a2')!.royal = true; }
    if (n === 39) relocate('black-pawn-c7', null, 'dead');
    if (n === 42) relocate('white-pawn-a2', null, 'away');
    if (n === 46) relocate('white-pawn-a2', 'f1');
    if (n === 50) relocate('white-pawn-c2', null, 'away');
    if (n === 61) relocate('white-pawn-c2', 'c4');
    if (n === 77) relocate('black-king-e8', 'e8');
    if (n === 99) relocate('white-rook-h1', 'a8');
    if (n === 104) relocate('white-queen-d1', 'h1');
    if (rewind[n] !== undefined) {
      const restore = snapshots[rewind[n]!]!;
      expected.pieces = structuredClone(restore.pieces); expected.enPassant = structuredClone(restore.enPassant);
      expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false;
      clock = restore.fen.split(' ').slice(4).map(Number); fenTurn = actor[0];
    }
    const effects: unknown[] = n < 37 ? [] : [{ type: 'coup', owner: 'white', card: { id: 'white-deck-0-coup', cardId: 'coup' }, princeId: 'white-king-e1', kingId: 'white-pawn-a2', princeRole: 'king' }];
    if (n >= 99 && n < 102) effects.push({ type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-rook-h1' });
    if (n >= 104 && n < 107) effects.push({ type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-queen-d1' });
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${reason}: complete input immutability including capturedBy`);
    assert.ok(result.ok, reason);
    state = result.state;
    assert.deepEqual(state.pieces, expected.pieces, `${reason}: complete identities and lifecycle`);
    assert.deepEqual(state.players, expected.players, `${reason}: exact hand/deck/discard identities and ordering`);
    assert.deepEqual(state.turn, expected.turn, `${reason}: timing and allowances`);
    assert.deepEqual(state.effects, effects, `${reason}: complete active effects`);
    assert.deepEqual(state.chaosForbidden ?? null, n === 58 ? { player: 'black', movement: 'black-queen-d8:d2:e2' } : null, `${reason}: exact forbidden repeat`);
    assert.deepEqual(state.plotsAllowances ?? [], n === 79 ? [{
      player: 'white', remaining: 2, eligibleCards: ['white-deck-4-annexation'],
      window: { phase: 'beforeMove', moveMade: false, capture: undefined, cardResponse: undefined,
        fogCheckpoint: undefined, legacyCapture: undefined, shieldMove: undefined, reaction: {
        type: 'cardPlayed', cardId: 'hidden-passage', target: [{ from: 'd8', to: 'e8' }],
        movement: [{ from: 'd8', to: 'e8' }], preservePreviousMove: false,
      } },
    }] : [], `${reason}: Plots saves only the legal Annexation card from this window, not the drawn Charge`);
    assert.deepEqual(state.enPassant, expected.enPassant, `${reason}: en passant`);
    assert.deepEqual(state.fen.split(' ').slice(4).map(Number), clock, `${reason}: both clocks`);
    assert.equal(state.fen.split(' ')[1], fenTurn, `${reason}: FEN turn`);
    assert.equal(state.fen.split(' ')[2], n < 22 ? 'KQkq' : n < 42 ? 'KQ' : '-', `${reason}: castling lifecycle`);
    assert.equal(state.fen.split(' ')[3], [7, 8].includes(n) ? 'c6' : n === 46 ? 'a6' : '-', `${reason}: FEN en-passant encoding`);
    assert.equal(!!state.pendingRescue, pending.has(n), `${reason}: rescue obligation`);
    assert.equal(state.orientation, 0);
    assert.equal(state.outcome, null);
    const abduction = n >= 14 && n <= 15 ? ['black-pawn-d7', n === 14 ? 'concealment' : 'recall'] : n >= 50 && n <= 51 ? ['white-pawn-c2', n === 50 ? 'concealment' : 'recall'] : null;
    assert.deepEqual(state.pendingAbduction ? [state.pendingAbduction.pieceId, state.pendingAbduction.phase] : null, abduction, reason);
    const hill = n >= 42 && n < 48 ? [{ pieceId: 'white-pawn-a2', player: 'white', returning: n >= 45, ...(n >= 46 ? { returned: true } : {}) }] : [];
    assert.deepEqual(state.underElfHill ?? [], hill, reason);
    if (!pending.has(n) && ![52, 74, 87].includes(n)) {
      for (const king of state.pieces.filter(p => p.royal && p.owner === actor && p.zone === 'board')) {
        for (const attacker of state.pieces.filter(p => p.owner !== actor && p.zone === 'board')) {
          const frozen = effects.some(e => typeof e === 'object' && e !== null && 'type' in e && e.type === 'dungeon' && 'pieceId' in e && e.pieceId === attacker.id);
          assert.ok(frozen || !geometry(attacker, king.square!, state.pieces, true), `${reason}: ${attacker.id} must not check ${king.id}`);
        }
      }
    }
    if ([52, 74, 87].includes(n)) {
      const king = state.pieces.find(p => p.royal && p.owner === actor)!;
      assert.ok(state.pieces.some(p => p.owner !== actor && p.zone === 'board' && geometry(p, king.square!, state.pieces, true)), `${reason}: restored original check must still be answered`);
      assert.equal(state.turn.moveMade, false);
    }
    snapshots.push(structuredClone(state));
  }
  assert.equal(state.fen, 'Rr1k4/1p6/1Pn5/1BP1p1Np/p3P1p1/3K4/1b3PPP/RN3P1Q w - - 2 26');
});

test('iteration 103 replay remains deterministic', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/103.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
