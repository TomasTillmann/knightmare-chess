// Iteration 100: assigned fresh-agent regression target.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName, Color } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Each entry was reviewed in order against rules §§8–14, 17.1, 18.6 and cards.md.
const rationales = [
  '1 f2-f4 crosses empty f3; double Pawn advance creates f3 en passant.',
  '2 White completes f4; Black receives the move and f3 opportunity.',
  '3 b8-c6 is a Knight jump; the unused f3 right expires.',
  '4 Black completes Nc6 and passes to White.',
  '5 c2-c3 is an empty one-square Pawn advance.',
  '6 White completes c3 and passes to Black.',
  '7 c6-b8 is a legal reverse Knight jump.',
  '8 Black completes Nb8 and passes to White.',
  '9 c3-c4 advances the same c2 Pawn without capture.',
  '10 White completes c4 and passes to Black.',
  '11 g7-g5 crosses empty g6 and creates g6 en passant.',
  '12 Black completes g5 and preserves the response opportunity.',
  '13 d2-d4 crosses empty d3 and replaces g6 with d3 en passant.',
  '14 White completes d4 and preserves d3 until the opposing move.',
  '15 d7-d6 advances one square and expires d3.',
  '16 Black completes d6 and passes to White.',
  '17 Qd1-c2 moves one diagonal square vacated by the c-Pawn.',
  '18 White completes Qc2 and passes to Black.',
  '19 Ng8-h6 jumps to an empty square.',
  '20 Black completes Nh6 and passes to White.',
  '21 h2-h4 crosses empty h3 and creates h3 en passant.',
  '22 White completes h4 and preserves h3.',
  '23 b7-b5 crosses empty b6 and replaces h3 with b6 en passant.',
  '24 Black completes b5 and passes to White.',
  '25 Guardian replaces the move with c4-c5; no follower is required; no en passant survives.',
  '26 Guardian spent the White move; Black starts with fresh allowances.',
  '27 Bc8-g4 crosses empty d7/e6/f5 diagonally.',
  '28 Black completes Bg4 and passes to White.',
  '29 Bombard Ra1-a4 jumps exactly the a2 Pawn; a3/a4 are empty, and a2 remains intact.',
  '30 Bombard consumed the move and queenside Rook right; Black starts.',
  '31 Bg4-h3 moves one diagonal square.',
  '32 Black completes Bh3 and passes to White.',
  '33 Ra4-a3 is a quiet one-square file move.',
  '34 White completes Ra3 and passes to Black.',
  '35 Bh3-c8 crosses empty g4/f5/e6/d7.',
  '36 Black completes Bc8 and passes to White.',
  '37 Qc2-d3 moves one empty diagonal square.',
  '38 White completes Qd3 and passes to Black.',
  '39 Bf8-g7 moves onto the square vacated by the g-Pawn.',
  '40 Black completes Bg7 and passes to White.',
  '41 b2-b4 crosses empty b3 and creates b3 en passant.',
  '42 White completes b4 and preserves b3.',
  '43 Qd8-d7 moves one empty file square; b3 expires.',
  '44 Black completes Qd7 and passes to White.',
  '45 g2-g3 is a one-square empty Pawn advance.',
  '46 White completes g3 and passes to Black.',
  '47 g5xh4 captures the original White h2 Pawn for Black; the g7 identity reaches h4.',
  '48 Black completes gxh4; the captured Pawn stays captured by Black.',
  '49 g3-g4 advances the original White g2 Pawn one square.',
  '50 White completes g4 and passes to Black.',
  '51 Bg7xd4 crosses f6/e5 and captures the original White d2 Pawn for Black.',
  '52 Black completes Bxd4 and retains the capture.',
  '53 Bf1-h3 crosses empty g2; no capture.',
  '54 Anathema swaps opposing Bc8 and Rh8 without capture or clock advancement; identities remain intact.',
  '55 White completes the after-move swap and passes to Black.',
  '56 f7-f5 crosses empty f6 and creates f6 en passant.',
  '57 Black completes f5 and preserves f6.',
  '58 Ra3-b3 is an empty rank move and expires f6.',
  '59 White completes Rb3 and passes to Black.',
  '60 Bd4-g7 crosses empty e5/f6 diagonally.',
  '61 Black completes Bg7 and passes to White.',
  '62 Qd3-c2 moves one diagonal square.',
  '63 White completes Qc2 and passes to Black.',
  '64 The original h8 Rook moves c8-d8; its retained original castling right now expires.',
  '65 Black makes Ke8 a Fatal Attraction magnet after its move, retaining the physical card.',
  '66 Black passes; its magnet and frozen neighbors persist.',
  '67 Ke1-d2 is a safe adjacent move and removes White castling rights.',
  '68 White completes Kd2 and passes to Black.',
  '69 Bg7-f8 starts outside the e8 magnet neighborhood; arrival freezes the Bishop, which is allowed.',
  '70 Black completes Bf8 and passes to White.',
  '71 Kd2-c3 enters the h8 Bishop ray via g7/f6/e5/d4; this is provisional self-check requiring rescue.',
  '72 Curse on f8 cannot stop the distinct h8 Bishop; spend/draw Curse and restore Kd2 with its move available.',
  '73 Kd2-d3 is safe; the already-spent Curse allowance remains consumed.',
  '74 White completes the legal replacement Kd3 and passes to Black.',
  '75 f5xg4 captures the White g2 Pawn for Black with the original f7 Pawn.',
  '76 Black completes fxg4 and retains the captured identity.',
  '77 c5-c6 advances one square; Black Qd7 becomes attacked without mate.',
  '78 Forbidden City marks empty e1 after the move; retain its card, draw one, preserve clocks.',
  '79 White passes; the e1 barrier and e8 magnet persist.',
  '80 Ke8-f7 is a safe adjacent King move; moving the magnet discards Fatal Attraction and releases neighbors.',
  '81 Black passes with all its castling rights now lost.',
  '82 c6xd7 captures the Black Queen for White; seventh rank does not promote.',
  '83 White completes cxd7 and passes to Black.',
  '84 a7-a5 crosses empty a6 and creates a6 en passant.',
  '85 Black completes a5 and preserves a6.',
  '86 Forced March simultaneously moves a2-b2 and b4-c4 to empty sideways squares; consumes the move.',
  '87 White completes Forced March; no en passant survives the replacement move.',
  '88 a5-a4 advances the same Black a7 Pawn one square.',
  '89 Black completes a4 and passes to White.',
  '90 c4-c5 advances the original White b2 Pawn; the c2 identity remains d7.',
  '91 White completes c5 and passes to Black.',
  '92 Ra8-a6 crosses empty a7 and makes a quiet move.',
  '93 White Chaos rewinds Ra6 to a8 and clocks; Black must make a different move; White spends/draws once.',
  '94 Bh8-f6 crosses empty g7 and is different from the canceled Rook move.',
  '95 Black completes its replacement move; the Chaos restriction and allowances expire.',
  '96 Bh3-f1 crosses empty g2 and avoids forbidden e1.',
  '97 White Panic imposes a 15000ms obligation on Black; board and clocks stay fixed.',
  '98 White passes; Panic remains due on Black upcoming move.',
  '99 g4-g3 is a timely Black Pawn move, satisfying and removing Panic.',
  '100 Black completes g3 and passes to White.',
  '101 Kd3-e4 is a safe adjacent diagonal move.',
  '102 White completes Ke4 and passes to Black.',
  '103 Bf6-d4 crosses empty e5; adjacent Ke4 is not on the Bishop diagonal.',
  '104 Black completes Bd4 and passes to White.',
  '105 Rb3-c3 is a quiet rank move; White King remains safe on e4.',
  '106 White completes Rc3 and passes to Black.',
  '107 d6-d5 advances one square and gives Pawn check to Ke4.',
  '108 Black passes; White receives its escape turn in Pawn check.',
  '109 Ke4-e3 escapes the Pawn but enters adjacent Bd4 diagonal check; provisional rescue is required.',
  '110 Fatal Attraction on Ke3 freezes adjacent Bd4, suppressing its check and validating the King move.',
  '111 White completes the rescued move; the e3 magnet and e1 barrier persist for Black.',
];

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const adjacent = (a: string, b: string) => Math.max(...xy(a).map((v, i) => Math.abs(v - xy(b)[i]!))) === 1;
function frozen(state: GameState, piece: PieceState): boolean {
  return !piece.royal && state.effects.some(value => {
    const effect = value as { type: string; pieceId?: string };
    const magnet = state.pieces.find(p => p.id === effect.pieceId && p.zone === 'board');
    return effect.type === 'fatal-attraction' && magnet && piece.square && adjacent(piece.square, magnet.square!);
  });
}
function geometry(state: GameState, piece: PieceState, to: string, capture: boolean, jump = false): boolean {
  const [x, y] = xy(piece.square!); const [tx, ty] = xy(to);
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
  if ((!ax && !ay) || frozen(state, piece)) return false;
  const barriers = state.effects.flatMap(v => { const e = v as { type: string; square?: string }; return e.type === 'forbidden-city' ? [e.square] : []; });
  if (barriers.includes(to)) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === direction;
    if (ax || !(dy === direction || dy === 2 * direction && (piece.owner === 'white' ? y <= 1 : y >= 6))) return false;
  } else if (!(piece.role === 'bishop' ? ax === ay : piece.role === 'rook' ? !ax || !ay : ax === ay || !ax || !ay)) return false;
  let blockers = 0;
  for (let i = 1; i < Math.max(ax, ay); i++) {
    const square = `${String.fromCharCode(97 + x + Math.sign(dx) * i)}${y + Math.sign(dy) * i + 1}`;
    if (barriers.includes(square) || state.pieces.some(p => p.zone === 'board' && p.square === square)) blockers++;
  }
  return blockers <= (jump ? 1 : 0);
}
function checked(state: GameState, owner: Color): boolean {
  const king = state.pieces.find(p => p.owner === owner && p.royal)!;
  return state.pieces.some(p => p.zone === 'board' && p.owner !== owner && geometry(state, p, king.square!, true));
}

test('iteration 100: independent physical and semantic review of every action', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/100.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const states = [structuredClone(state)];
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, why = rationales[index]!;
    assert.ok(why.startsWith(`${n} `));
    const original = structuredClone(state);
    const result = applyAction(state, action);
    assert.deepEqual(state, original, `${why}: complete input, including capturedBy, stays immutable`);
    assert.ok(result.ok, why);
    const after = result.state;
    let pieces = structuredClone(state.pieces);
    let effects = structuredClone(state.effects);
    const players = structuredClone(state.players);
    let turn = structuredClone(state.turn);
    let ep = structuredClone(state.enPassant);
    let fields = state.fen.split(' ');
    const place = (from: string, to: string, jump = false, sideways = false) => {
      assert.match(to, /^[a-h][1-8]$/);
      const mover = pieces.find(p => p.square === from && p.zone === 'board');
      assert.ok(mover, why);
      const victim = pieces.find(p => p.square === to && p.zone === 'board');
      assert.equal(mover.owner, state.turn.color, why);
      if (sideways) {
        assert.equal(mover.role, 'pawn', why);
        assert.equal(xy(from)[1], xy(to)[1], why);
        assert.equal(Math.abs(xy(from)[0] - xy(to)[0]), 1, why);
        assert.ok(!victim && !frozen(state, mover), why);
      } else assert.ok(geometry(state, mover, to, !!victim, jump), why);
      if (victim) {
        assert.notEqual(victim.owner, mover.owner, why);
        assert.equal(victim.royal, false, why);
        victim.square = null; victim.zone = 'captured'; victim.capturedBy = state.turn.color;
      }
      mover.square = to as SquareName;
      return { mover, victim };
    };
    const completeMove = (pawnOrCapture: boolean) => {
      fields[1] = state.turn.color === 'white' ? 'b' : 'w';
      fields[4] = pawnOrCapture ? '0' : String(Number(fields[4]) + 1);
      fields[5] = String(Number(fields[5]) + (state.turn.color === 'black' ? 1 : 0));
      turn.moveMade = true; turn.phase = 'afterMove'; ep = [];
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.equal(state.turn.moveMade, false, why);
      const { mover, victim } = place(action.from, action.to);
      completeMove(mover.role === 'pawn' || !!victim);
      if (mover.role === 'pawn' && Math.abs(xy(action.from)[1] - xy(action.to)[1]) === 2) {
        ep = [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: mover.id }];
      }
      if (n === 64) fields[2] = 'Kq';
      if (n === 67) fields[2] = 'q';
      if (n === 80) {
        fields[2] = '-';
        const magnet = { id: 'black-hand-0-fatal-attraction', cardId: 'fatal-attraction' };
        players.black.discard.push(magnet);
        effects = effects.filter(e => (e as { type: string }).type !== 'fatal-attraction');
      }
      if (n === 99) effects = effects.filter(e => (e as { type: string }).type !== 'panic');
      if (n === 71 || n === 109) assert.ok(checked({ ...after, pieces, effects }, state.turn.color), why);
    } else if (action.type === 'endTurn') {
      assert.ok(state.turn.moveMade && !state.pendingRescue, why);
      turn = { color: state.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'playCard') {
      const owner = (['white', 'black'] as const).find(c => players[c].hand.some(card => card.id === action.cardInstanceId));
      assert.ok(owner, why);
      const hand = players[owner].hand;
      const cardIndex = hand.findIndex(c => c.id === action.cardInstanceId);
      const card = hand.splice(cardIndex, 1)[0]!;
      assert.equal(card.cardId, action.cardId, why);
      const metadata = CARD_CATALOG[card.cardId]!;
      assert.ok(metadata.timing.includes(owner === state.turn.color ? state.turn.phase : 'afterOpponentMove'), why);
      assert.equal(turn.cardPlays[owner], 0, why);
      turn.cardPlays[owner]++;
      const drawn = players[owner].deck.shift(); assert.ok(drawn, why); hand.push(drawn);
      if (!metadata.continuing || n === 72) players[owner].discard.push(card);
      switch (n) {
        case 25:
          assert.deepEqual(action.target, [{ from: 'c4', to: 'c5' }]);
          place('c4', 'c5'); completeMove(true); break;
        case 29:
          assert.deepEqual(action.target, [{ from: 'a1', to: 'a4' }]);
          assert.equal(state.pieces.find(p => p.square === 'a2')?.id, 'white-pawn-a2');
          place('a1', 'a4', true); completeMove(false); fields[2] = 'Kkq'; break;
        case 54: {
          assert.deepEqual(action.target, { bishop: 'c8', rook: 'h8' });
          const bishop = pieces.find(p => p.id === 'black-bishop-c8')!;
          const rook = pieces.find(p => p.id === 'black-rook-h8')!;
          assert.equal(bishop.square, 'c8'); assert.equal(rook.square, 'h8');
          bishop.square = 'h8'; rook.square = 'c8'; fields[2] = 'Khq'; break;
        }
        case 65:
          assert.equal(action.target, 'e8');
          effects.push({ type: 'fatal-attraction', owner, card, pieceId: 'black-king-e8' }); break;
        case 72:
          assert.equal(action.target, 'f8');
          assert.ok(state.pendingRescue, why);
          assert.ok(geometry(state, pieces.find(p => p.id === 'black-bishop-c8')!, 'c3', true), why);
          pieces = structuredClone(states[70]!.pieces); fields = states[70]!.fen.split(' ');
          ep = structuredClone(states[70]!.enPassant);
          turn.moveMade = false; turn.phase = 'beforeMove'; break;
        case 78:
          assert.equal(action.target, 'e1'); assert.ok(!pieces.some(p => p.square === 'e1'));
          effects.push({ type: 'forbidden-city', owner, card, square: 'e1' }); break;
        case 86:
          assert.deepEqual(action.target, [{ from: 'a2', to: 'b2' }, { from: 'b4', to: 'c4' }]);
          place('a2', 'b2', false, true); place('b4', 'c4', false, true); completeMove(true); break;
        case 93:
          pieces = structuredClone(states[91]!.pieces); fields = states[91]!.fen.split(' ');
          ep = structuredClone(states[91]!.enPassant);
          turn.moveMade = false; turn.phase = 'beforeMove';
          assert.ok(after.chaosForbidden, why); break;
        case 97:
          effects.push({ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 }); break;
        case 110:
          assert.equal(action.target, 'e3'); assert.ok(state.pendingRescue, why);
          effects.push({ type: 'fatal-attraction', owner, card, pieceId: 'white-king-e1' });
          assert.ok(frozen({ ...after, pieces, effects }, pieces.find(p => p.id === 'black-bishop-c8')!), why); break;
        default: assert.fail(`Unreviewed card at ${n}`);
      }
    } else assert.fail(`Unreviewed action at ${n}`);
    assert.deepEqual(after.pieces, pieces, `${why}: all physical identities and lifecycle fields`);
    assert.deepEqual(after.effects, effects, `${why}: complete retained effects`);
    assert.deepEqual(after.players, players, `${why}: physical hand/deck/discard accounting`);
    assert.deepEqual(after.turn, turn, `${why}: turn and card allowances`);
    assert.deepEqual(after.enPassant, ep, `${why}: en-passant opportunities`);
    assert.deepEqual(after.fen.split(' ').slice(1, 3), fields.slice(1, 3), `${why}: active side and castling`);
    // None of the double advances in this trace has an immediately adjacent enemy Pawn.
    assert.equal(after.fen.split(' ')[3], '-', `${why}: no FEN-encoded legal en-passant capture`);
    assert.deepEqual(after.fen.split(' ').slice(4), fields.slice(4), `${why}: half/full move clocks`);
    assert.equal(!!after.pendingRescue, n === 71 || n === 109, `${why}: rescue window`);
    if (n !== 71 && n !== 109) assert.equal(checked(after, state.turn.color), false, `${why}: outgoing King safe under current effects`);
    if ([25, 29, 54, 86, 93, 97].includes(n)) {
      const opponent = action.type === 'playCard' && n === 93 ? 'black' : state.turn.color === 'white' ? 'black' : 'white';
      assert.equal(checked(after, opponent), false, `${why}: regular card creates no check, hence no direct mate`);
    }
    assert.equal(after.orientation, 0, why);
    assert.equal(after.outcome, null, why);
    assert.ok(!after.pendingAbduction && !after.pendingDoomsayer && !after.underElfHill?.length, why);
    state = after; states.push(structuredClone(after));
  }
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10);
  assert.equal(state.fen, trace.finalFen);
  assert.deepEqual(replayTrace(trace), state);
});
