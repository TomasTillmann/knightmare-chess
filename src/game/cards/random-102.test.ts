import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Independently read in order against rules §§8–14, 15.5, 17.1, 18.5,
// cards.md and the printed catalog timing; these are not generated annotations.
const rationale = [
  '1 h-pawn advances one to empty h3.',
  '2 White finishes; Black receives a fresh allowance.',
  '3 b-pawn advances two through b6; b6 is the new EP target.',
  '4 Black finishes while the b6 EP opportunity remains.',
  '5 a-pawn advances two through a3, replacing the b6 EP right.',
  '6 White finishes with a3 EP retained.',
  '7 a7 pawn advances one to a6; old EP expires.',
  '8 Black finishes without changing physical state.',
  '9 a4 pawn captures the opposing b5 pawn, credited to White.',
  '10 Figure Dance simultaneously rotates all four rook identities counterclockwise; no captures and all castling rights end.',
  '11 White finishes after spending Figure Dance.',
  '12 The black rook now at a1 captures the white b1 knight.',
  '13 Black finishes after that capture.',
  '14 f2 pawn advances one to vacant f3.',
  '15 White finishes; board and cards stay fixed.',
  '16 b8 knight jumps to empty c6.',
  '17 Black finishes; a1 remains the sole empty corner.',
  '18 Squaring the Circle replaces White move: e2 pawn goes to a1 without promotion or capture.',
  '19 White finishes its replacement move.',
  '20 g7 pawn crosses vacant g6 to g5; g6 EP opens.',
  '21 Black finishes, retaining g6 EP.',
  '22 h3 pawn advances to empty h4, expiring EP.',
  '23 White finishes after h4.',
  '24 g8 knight jumps to empty f6.',
  '25 Black finishes after the knight jump.',
  '26 h4 pawn diagonally captures g5 pawn; White is captor.',
  '27 White finishes after g5 capture.',
  '28 f8 bishop moves to g7 without capture, exposing e8 King to h8 rook; provisional rescue is required.',
  '29 Fireball at g7 captures g7 bishop, f6 knight, f7/h7 pawns and white h8 rook, all credited to Black; this removes the checking rook.',
  '30 Black safely finishes after the successful rescue.',
  '31 d1 queen moves diagonally to empty e2.',
  '32 White finishes with queen on e2.',
  '33 e8 King steps to safe vacant f8.',
  '34 Black finishes with King on f8.',
  '35 e1 King steps to safe d1; c1 bishop still separates it from b1 rook.',
  '36 White finishes with King on d1.',
  '37 f8 King returns to safe e8.',
  '38 Black finishes without a card.',
  '39 h1 rook travels through empty h2 to h3.',
  '40 White finishes after the rook move.',
  '41 d7 pawn crosses vacant d6 to d5, opening d6 EP.',
  '42 Black finishes retaining d6 EP.',
  '43 d2 pawn advances to vacant d3, expiring EP.',
  '44 White finishes after d3.',
  '45 b1 rook captures b2 pawn, credited to Black.',
  '46 Black finishes after the capture.',
  '47 h3 rook traverses empty h4/h5/h6/h7 to h8 and checks e8 King.',
  '48 White finishes; Black must answer the rook check.',
  '49 e8 King steps to f8 still attacked by h8 rook; only provisional rescue permits this.',
  '50 Forbidden City on b6 does not block h8–f8: spend and discard failed rescue, undo King move and clocks, restore replacement opportunity.',
  '51 e8 King instead steps diagonally to safe d7.',
  '52 Black finishes with its failed rescue card allowance spent.',
  '53 h8 rook traverses g8/f8 to empty e8.',
  '54 White finishes after e8.',
  '55 e7 pawn advances to vacant e6.',
  '56 Black finishes after e6.',
  '57 e8 rook crosses empty e7 and captures e6 pawn for White.',
  '58 White finishes after the capture.',
  '59 d8 queen crosses empty e7 to f6.',
  '60 Black finishes after the diagonal queen move.',
  '61 f3 pawn advances to vacant f4.',
  '62 White finishes after f4.',
  '63 f6 queen captures adjacent e6 rook for Black.',
  '64 Black finishes after taking the rook.',
  '65 b5 pawn captures c6 knight and checks d7 King.',
  '66 White finishes; Black must answer the pawn check.',
  '67 c8 bishop to b7 leaves d7 King attacked by c6 pawn; provisional rescue is required.',
  '68 Haunting Memories copies last Forbidden City, but h2 cannot stop c6 pawn check; spend and undo the provisional bishop move.',
  '69 d7 King instead steps safely to e8.',
  '70 Black finishes its replacement move.',
  '71 e2 queen returns one square to empty e1.',
  '72 White finishes after e1.',
  '73 e8 King steps to safe e7.',
  '74 Black finishes with King on e7.',
  '75 Onslaught replaces White move: c2/g2 pawns simultaneously advance to initially vacant c3/g3; neither captures.',
  '76 White finishes its Pawn replacement move.',
  '77 e6 queen moves one square to vacant e5.',
  '78 Black finishes after e5.',
  '79 f1 bishop moves diagonally to empty g2.',
  '80 White finishes after g2.',
  '81 Resurrection returns captured black g7 pawn to vacant starting-rank d7; clear its White capture attribution, consume move and reset Pawn clock.',
  '82 Black finishes the returned-Pawn move.',
  '83 g1 knight jumps to empty e2.',
  '84 White finishes after e2.',
  '85 b2 rook advances to empty b3.',
  '86 Panic after Black move imposes a 15000ms obligation on White while preserving the board.',
  '87 Black finishes; Panic persists into White turn.',
  '88 c1 bishop crosses empty d2 to e3; timely legal movement fulfills Panic.',
  '89 White finishes after Panic is cleared.',
  '90 original d7 pawn advances d5 to empty d4.',
  '91 Black finishes after d4.',
  '92 c3 pawn advances to vacant c4.',
  '93 White finishes after c4.',
  '94 b3 rook crosses empty b4/b5/b6/b7 to b8.',
  '95 White Think Again cancels that rook move, restores b3 and clocks, and forbids its repetition during the replacement.',
  '96 returned g7 pawn at d7 instead advances through d6 to d5; different physical move opens d6 EP.',
  '97 Black finishes; White reaction allowance resets.',
  '98 e2 knight jumps to d4 and captures original black d7 pawn for White; EP expires.',
  '99 White finishes after d4 capture.',
  '100 c8 bishop crosses empty d7/e6 to f5 without capture.',
  '101 Crusade immediately moves the same bishop back through e6/d7 to c8; no capture or second turn-clock increment.',
  '102 Black finishes after the additional bishop move.',
  '103 e1 queen crosses empty d2 to c3.',
  '104 White finishes after c3.',
  '105 a6 pawn advances to vacant a5.',
  '106 Black finishes after a5.',
  '107 c3 queen returns through empty d2 to e1.',
  '108 White finishes after e1.',
  '109 Disintegration before Black move makes its a5 pawn dead, not captured; no captor, move or clock consumption.',
  '110 a8 rook crosses empty a7/a6/a5 to a4.',
  '111 Black finishes the fiftieth ordinary move; White is next.',
];

const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const on = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);

// Orthodox geometry from physical records. No transformed/neutral movers occur here.
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(piece.square!); const [tx, ty] = xy(to);
  const dx = tx - x; const dy = ty - y;
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const dir = piece.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === dir;
    if (dx || on(pieces, to)) return false;
    return dy === dir || dy === 2 * dir && (piece.owner === 'white' ? y <= 1 : y >= 6)
      && !on(pieces, `${String.fromCharCode(x + 97)}${y + dir + 1}`);
  }
  const diagonal = Math.abs(dx) === Math.abs(dy);
  const straight = dx === 0 || dy === 0;
  if (!(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    if (on(pieces, `${String.fromCharCode(x + Math.sign(dx) * n + 97)}${y + Math.sign(dy) * n + 1}`)) return false;
  }
  return true;
}
function inCheck(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  assert.equal(king.zone, 'board');
  return pieces.some(p => p.owner !== color && p.zone === 'board' && reaches(pieces, p, king.square!, true));
}

test('iteration 102 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/102.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationale.length, 111);
  assert.equal(trace.steps.length, rationale.length);
  let state = createGameState(trace.initial);
  const snapshots: GameState[] = [];
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1; const label = rationale[index]!;
    assert.ok(label.startsWith(`${n} `));
    const saved = structuredClone(state);
    snapshots.push(saved);
    const expectedPieces = structuredClone(state.pieces);
    let expectedTurn = structuredClone(state.turn);
    const expectedPlayers = structuredClone(state.players);
    let expectedEp = structuredClone(state.enPassant);
    let expectedEffects = structuredClone(state.effects);
    let [, side, rights, ep, half, full] = state.fen.split(' ');
    const actor = state.turn.color;
    const relocate = (from: string, to: string) => {
      const piece = on(expectedPieces, from); assert.ok(piece, label);
      assert.match(to, /^[a-h][1-8]$/); piece.square = to as SquareName;
    };
    const consumeMove = (pawnOrCapture: boolean) => {
      side = actor === 'white' ? 'b' : 'w'; ep = '-';
      half = String(pawnOrCapture ? 0 : Number(half) + 1);
      full = String(Number(full) + (actor === 'black' ? 1 : 0));
      expectedEp = []; expectedTurn.phase = 'afterMove'; expectedTurn.moveMade = true;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = on(state.pieces, action.from); assert.ok(mover, label);
      const victim = on(state.pieces, action.to);
      assert.equal(mover.owner, actor, label);
      assert.equal(state.turn.moveMade, false, label);
      assert.ok(reaches(state.pieces, mover, action.to, !!victim), label);
      if (victim) {
        assert.equal(victim.owner, other(actor)); assert.equal(victim.royal, false);
        Object.assign(expectedPieces.find(p => p.id === victim.id)!, { square: null, zone: 'captured', capturedBy: actor });
      }
      relocate(action.from, action.to); consumeMove(mover.role === 'pawn' || !!victim);
      if (mover.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2) {
        expectedEp = [{ target: `${action.from[0]}${(Number(action.to[1]) + Number(action.from[1])) / 2}` as SquareName, pawnId: mover.id }];
      }
      if (n === 88) expectedEffects = [];
    } else if (action.type === 'endTurn') {
      assert.equal(state.turn.moveMade, true, label); assert.equal(inCheck(state.pieces, actor), false, label);
      expectedTurn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'playCard') {
      const owner = n === 95 ? 'white' : actor;
      const player = expectedPlayers[owner];
      const card = player.hand.find(c => c.id === action.cardInstanceId); assert.ok(card, label);
      assert.equal(card.cardId, action.cardId); assert.equal(state.turn.cardPlays[owner], 0);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(owner === actor ? state.turn.phase : 'afterOpponentMove'));
      player.hand = player.hand.filter(c => c.id !== card.id); player.discard.push(card);
      player.hand.push(player.deck.shift()!); expectedTurn.cardPlays[owner]++;
      switch (n) {
        case 10: {
          const corners: Record<string, SquareName> = { a1: 'h1', h1: 'h8', h8: 'a8', a8: 'a1' };
          for (const p of expectedPieces) if (p.square && corners[p.square]) p.square = corners[p.square]!;
          rights = '-'; break;
        }
        case 18:
          assert.deepEqual(['a1', 'a8', 'h1', 'h8'].filter(s => !on(state.pieces, s)), ['a1']);
          relocate('e2', 'a1'); consumeMove(true); break;
        case 29:
          assert.equal(inCheck(state.pieces, 'black'), true);
          for (const p of expectedPieces) if (['g7', 'f6', 'f7', 'h7', 'h8'].includes(p.square ?? ''))
            Object.assign(p, { square: null, zone: 'captured', capturedBy: 'black' });
          half = '0'; break;
        case 50: case 68: case 95: {
          const original = snapshots[index - 1]!;
          expectedPieces.splice(0, expectedPieces.length, ...structuredClone(original.pieces));
          expectedEp = structuredClone(original.enPassant); expectedEffects = structuredClone(original.effects);
          [, side, rights, ep, half, full] = original.fen.split(' ');
          expectedTurn.phase = 'beforeMove'; expectedTurn.moveMade = false;
          if (n !== 95) {
            assert.equal(inCheck(state.pieces, 'black'), true, label);
            assert.equal(typeof action.target, 'string');
            assert.equal(on(state.pieces, action.target as string), undefined);
          }
          break;
        }
        case 75: relocate('c2', 'c3'); relocate('g2', 'g3'); consumeMove(true); break;
        case 81: {
          const pawn = expectedPieces.find(p => p.id === 'black-pawn-g7')!;
          assert.equal(pawn.zone, 'captured'); assert.equal(pawn.capturedBy, 'white');
          assert.equal(on(expectedPieces, 'd7'), undefined);
          pawn.zone = 'board'; pawn.square = 'd7'; delete pawn.capturedBy; delete pawn.capturedAtPly;
          consumeMove(true); break;
        }
        case 86: expectedEffects = [{ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 }]; break;
        case 101:
          assert.ok(reaches(state.pieces, on(state.pieces, 'f5')!, 'c8', false));
          relocate('f5', 'c8'); break;
        case 109: {
          const pawn = on(expectedPieces, 'a5')!;
          assert.equal(pawn.owner, 'black'); assert.equal(pawn.role, 'pawn');
          pawn.square = null; pawn.zone = 'dead'; delete pawn.capturedBy; break;
        }
        default: assert.fail(`Unreviewed card action ${n}`);
      }
    } else assert.fail(`Unreviewed action ${n}`);
    const result = applyAction(state, action);
    assert.deepEqual(state, saved, `${label}: complete input immutability including capturedBy`);
    assert.ok(result.ok, label); const after = result.state;
    assert.deepEqual(after.pieces, expectedPieces, `${label}: every physical identity including unaffected pieces`);
    assert.deepEqual(after.players, expectedPlayers, `${label}: exact hand/deck/discard identities and order`);
    assert.deepEqual(after.turn, expectedTurn, `${label}: phase, move consumption and allowances`);
    assert.deepEqual(after.effects, expectedEffects, `${label}: complete effect records`);
    assert.deepEqual(after.enPassant, expectedEp, `${label}: complete EP lifecycle`);
    assert.deepEqual(after.fen.split(' ').slice(1), [side, rights, ep, half, full], `${label}: clocks/castling/side`);
    assert.equal(after.orientation, 0); assert.equal(after.outcome, null);
    assert.equal(!!after.pendingRescue, [28, 49, 67].includes(n), label);
    if (action.type !== 'endTurn' && ![28, 49, 50, 67, 68].includes(n)) assert.equal(inCheck(after.pieces, actor), false, label);
    if (action.type === 'playCard' && ![50, 68].includes(n)) assert.equal(inCheck(after.pieces, other(actor)), false, `${label}: no direct card mate`);
    if (n === 50 || n === 68) assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
    if (n === 95) assert.ok(after.chaosForbidden, 'canceled rook move remains forbidden');
    if (n === 96) assert.equal(after.chaosForbidden, undefined, 'different replacement clears prohibition');
    state = after;
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11);
  assert.equal(state.fen, '2b5/2p1k3/2P5/3pq1P1/r1PN1P2/1r1PB1P1/6B1/P2KQ3 w - - 2 26');
  assert.deepEqual(replayTrace(trace), state);
});
