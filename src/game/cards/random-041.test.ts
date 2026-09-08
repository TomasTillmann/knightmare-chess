import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Reviewed in action order against rules §§8–13, 17.2, 19.3, 20–22 and printed catalog timing.
const rationales = [
  '1 b2-b3 advances one into an empty square; both Kings remain screened.',
  '2 White ends the completed pawn turn; Black receives fresh allowances.',
  '3 Nb8-c6 is an unobstructed Knight jump; Black advances fullmove.',
  '4 After moving, Black marks its e7 Pawn as Crab; draw Vendetta and retain the continuing card.',
  '5 End turn preserves Crab and the board; White acts next.',
  '6 f2-f3 advances into empty f3; no line reaches the White King.',
  '7 End the White pawn turn without a card or discard.',
  '8 b7-b6 advances one square without capture.',
  '9 End the Black turn; clocks already advanced once.',
  '10 c2-c4 crosses empty c3; expose the c3 en-passant opportunity.',
  '11 End turn retains c3 en-passant for Black.',
  '12 a7-a6 advances one and expires the unused c3 opportunity.',
  '13 End turn preserves all physical identities and hands.',
  '14 h2-h3 advances one into an empty square.',
  '15 White ends; Crab remains on e7.',
  '16 g7-g6 advances one without capture or check.',
  '17 End the Black turn with no card expenditure.',
  '18 a2-a4 crosses clear a3; a3 is available for en-passant.',
  '19 End turn carries the a3 opportunity to Black.',
  '20 Nc6-d4 jumps legally and expires the a3 opportunity.',
  '21 End turn; neither King is threatened.',
  '22 Qd1-c2 moves one diagonal step to the vacated c2.',
  '23 End turn leaves the Queen on c2 and no capture.',
  '24 c7-c5 crosses empty c6, creating c6 en-passant.',
  '25 End turn retains c6 for the opposing reply.',
  '26 Qc2-a2 crosses empty b2 and lands on empty a2; en-passant expires.',
  '27 White ends a safe Queen move.',
  '28 Nd4-c2 jumps and checks Ke1; the Black King remains safe.',
  '29 Black ends while White is checked; White must answer on its turn.',
  '30 Qa2-b2 does not answer Nc2 check yet; §11.6 permits a pending Fireball rescue.',
  '31 Fireball after the noncapture removes Qb2, Ra1, Nb1, Bc1, Pb3 and checking Nc2; Ke1 survives.',
  '32 White can now end safely; captured Ra1 permanently loses queenside rights.',
  '33 Crab e7-d6 moves one forward diagonal without capture, retaining its physical identity.',
  '34 End the Black Crab turn; Pawn halfmove clock remains zero.',
  '35 a4-a5 is an ordinary empty-square Pawn advance.',
  '36 End turn leaves a5 adjacent to the opposing b6 Pawn.',
  '37 Qd8-f6 follows clear e7; neither King is checked.',
  '38 End the Black Queen turn.',
  '39 Ghostwalk Bf1-b5 crosses friendly Pe2 and Pc4 through empty d3; empty b5 permits no capture.',
  '40 Ghostwalk consumed the move; end turn without an additional Regular Move.',
  '41 Qf6-h4 crosses empty g5 and checks Ke1 along g3-f2.',
  '42 Black ends; White has a check escape turn.',
  '43 Ke1-f1 escapes the h4-e1 diagonal; remaining White castling rights disappear.',
  '44 Heresy moves opposing Bc8-b8 first, then own Bb5-b4; Bf8 has no empty color-changing neighbor.',
  '45 End turn preserves Heresy relocation and already advanced clocks.',
  '46 Ng8-f6 jumps into empty f6.',
  '47 End turn without spending another card.',
  '48 Pa5xb6 captures the original b7 Pawn diagonally and resets halfmove.',
  '49 After the capture White plays continuing Doomsayer, draws Hidden Passage, and opens Black immediate choice.',
  '50 Black immediately counters Doomsayer with Fog; both cards are discarded, no piece is lost, and the capture remains.',
  '51 End turn resets both used card allowances; the canceled Doomsayer choice is absent.',
  '52 Nf6-g8 returns with a legal Knight jump.',
  '53 End turn preserves Crab and the prior capture.',
  '54 f3-f4 advances into empty f4 and resets halfmove.',
  '55 End White turn without spending a card.',
  '56 f7-f5 crosses clear f6 and creates f6 en-passant.',
  '57 End turn retains the f6 opportunity.',
  '58 Bb4xc5 captures the c7 Pawn one diagonal step; en-passant expires.',
  '59 End White turn with the Bishop on c5.',
  '60 Qh4-h5 steps up the file to an empty square.',
  '61 End Black turn; White King f1 remains safe.',
  '62 Bc5-d4 moves one diagonal step without capture.',
  '63 End White turn; no effect expires.',
  '64 g6-g5 advances the Black Pawn one square.',
  '65 End Black turn with ordinary card allowances reset.',
  '66 b6-b7 advances into empty b7; no promotion on rank seven.',
  '67 End turn; the Pawn threatens a8 and c8, not the Black King.',
  '68 Ke8-e7 steps to an unattacked square and loses both castling rights.',
  '69 End Black turn; all castling rights are now gone.',
  '70 Bd4-b2 follows clear c3 to empty b2.',
  '71 End White turn, preserving clocks and cards.',
  '72 Crab d6-c5 takes one forward diagonal step into empty c5.',
  '73 End Black turn while retaining the Crab marker.',
  '74 Rh1-h2 advances into the square vacated by its Pawn.',
  '75 End White turn; h3 Pawn still blocks the h-file Queen.',
  '76 Crab c5-d4 moves one forward diagonal without capture.',
  '77 End Black turn; the Crab attacks c3/e3 only.',
  '78 f4xg5 captures the original g7 Pawn diagonally.',
  '79 Siege after the capture swaps own Ng1 and Rh2; ownership, roles and clocks remain unchanged.',
  '80 End turn retains the completed capture and swap.',
  '81 d7-d6 is a one-step advance; the Crab has vacated d6.',
  '82 End Black turn with both Kings safe.',
  '83 Bb2-a1 moves one diagonal into the square vacated by the exploded Rook.',
  '84 End White turn without changing captured identities.',
  '85 Ng8-f6 is a legal empty-square Knight jump.',
  '86 End Black turn with no card expenditure.',
  '87 Ba1-b2 reverses the Bishop diagonal.',
  '88 End White turn; Black still has its own-turn card opportunity.',
  '89 Passing in the Night simultaneously exchanges a6/h3 and Crab d4/g5; owners and Crab identity follow the pieces.',
  '90 End the Black replacement move; its fullmove counter has already advanced.',
  '91 Irresistible Force pushes Bb8 off-board with Pb7-b8; the card does not authorize Pawn promotion.',
  '92 End the White replacement move, leaving an unpromoted Pawn on b8.',
  '93 f5-f4 is an empty-square Black Pawn advance.',
  '94 End Black turn with the pushed Bishop still captured.',
  '95 g2xh3 captures the original a7 Pawn relocated by Passing in the Night.',
  '96 End White turn; identity of the h3 capturer remains original g2.',
  '97 h7-h6 advances one into an empty square.',
  '98 End Black turn; the b8 Pawn has not promoted indirectly.',
  '99 e2-e3 advances one; the f4 Pawn attacks e3 but does not prohibit a nonroyal arrival.',
  '100 End White turn; King f1 is still safe.',
  '101 Crab g5-h4 moves a single forward diagonal, keeping its e7 identity.',
  '102 Treason swaps opposing Rg1 and Nh2 after Black moved; it grants no move and preserves both White identities.',
  '103 End Black turn after the swap, resetting allowances.',
  '104 Bb2-a3 moves one diagonal; Pc4 blocks its further line.',
  '105 End White turn without altering effects.',
  '106 Ke7-e6 steps onto an unattacked square; the White d4 Pawn attacks e5, not e6.',
  '107 End Black King turn with no further castling rights to revoke.',
  '108 Rh2-f2 crosses empty g2 to empty f2; no capture occurs.',
  '109 End White turn with the Rook now on f2.',
  '110 Qh5-g5 moves one file; f4 blocks its diagonal toward e3.',
  '111 End Black turn; neither King is checked.',
  '112 Ng1-f3 makes a legal Knight jump to empty f3.',
  '113 End the fiftieth Regular Move; Black acts next with no pending choice or check.',
];

function geometry(state: GameState, piece: PieceState, to: string): boolean {
  assert.ok(piece.square);
  const from = piece.square;
  const dx = to.charCodeAt(0) - from.charCodeAt(0);
  const dy = Number(to[1]) - Number(from[1]);
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (piece.role === 'pawn') return ax === 1 && dy === (piece.owner === 'white' ? 1 : -1);
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (!(piece.role !== 'rook' && ax === ay || piece.role !== 'bishop' && (dx === 0 || dy === 0))) return false;
  const distance = Math.max(ax, ay);
  for (let n = 1; n < distance; n++) {
    const square = String.fromCharCode(from.charCodeAt(0) + Math.sign(dx) * n) + (Number(from[1]) + Math.sign(dy) * n);
    if (state.pieces.some(p => p.square === square)) return false;
  }
  return distance > 0;
}

test('iteration 041 independently reviewed deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/041.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860041);
  assert.equal(rationales.length, trace.steps.length);
  const crab = { type: 'crab', owner: 'black', card: { id: 'black-hand-2-crab', cardId: 'crab' }, pieceId: 'black-pawn-e7' };
  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    assert.ok(rationales[index]!.startsWith(`${step} `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    const at = (square: string) => state.pieces.find(p => p.square === square);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from;
      const mover = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      assert.equal(mover.owner, before.turn.color);
      assert.ok(!victim || victim.owner !== mover.owner && !victim.royal);
      if (mover.role === 'pawn' && mover.id !== 'black-pawn-e7' && !victim) {
        assert.equal(action.from[0], action.to[0]);
        const advance = (Number(action.to[1]) - Number(action.from[1])) * (mover.owner === 'white' ? 1 : -1);
        assert.ok(advance === 1 || advance === 2 && ['2', '7'].includes(action.from[1]!));
        if (advance === 2) assert.ok(!before.pieces.some(p => p.square === from[0]! + (Number(from[1]) + (mover.owner === 'white' ? 1 : -1))));
      } else assert.ok(geometry(before, mover, action.to), rationales[index]);
      assert.equal(at(action.to)?.id, mover.id);
      assert.equal(at(action.to)?.role, mover.role);
      assert.equal(at(action.to)?.promoted, false);
      for (const piece of before.pieces) {
        const after = state.pieces.find(p => p.id === piece.id)!;
        if (piece.id === mover.id) assert.deepEqual(after, { ...piece, square: action.to });
        else if (piece.id === victim?.id) {
          assert.equal(after.zone, 'captured'); assert.equal(after.square, null);
          assert.equal(after.owner, piece.owner); assert.equal(after.role, piece.role);
        } else assert.deepEqual(after, piece);
      }
      const oldFen = before.fen.split(' '), newFen = state.fen.split(' ');
      assert.equal(Number(newFen[4]), mover.role === 'pawn' || victim ? 0 : Number(oldFen[4]) + 1);
      assert.equal(Number(newFen[5]), Number(oldFen[5]) + (mover.owner === 'black' ? 1 : 0));
      const double = mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2;
      assert.deepEqual(state.enPassant, double ? [{ pawnId: mover.id, target: action.from[0]! + (Number(action.from[1]) + Number(action.to[1])) / 2 }] : []);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true });
    } else if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.pieces, before.pieces);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.enPassant, before.enPassant);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else if (action.type === 'playCard') {
      const owner = action.cardId === 'fog-of-war' ? 'black' : before.turn.color;
      const player = before.players[owner];
      const card = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card);
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c.id !== card.id), player.deck[0]]);
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1));
      assert.equal(state.turn.cardPlays[owner], 1);
      if (!['crab', 'doomsayer'].includes(action.cardId)) assert.deepEqual(state.players[owner].discard, [...player.discard, card]);
      else assert.deepEqual(state.players[owner].discard, player.discard);
      assert.equal(before.turn.phase, ['ghostwalk', 'passing-in-the-night', 'irresistible-force'].includes(action.cardId) ? 'beforeMove' : 'afterMove');
      assert.equal(state.turn.phase, 'afterMove');
      assert.equal(state.turn.moveMade, true);
      const relocations: Record<number, Record<string, string>> = {
        39: { 'white-bishop-f1': 'b5' },
        44: { 'black-bishop-c8': 'b8', 'white-bishop-f1': 'b4' },
        79: { 'white-knight-g1': 'h2', 'white-rook-h1': 'g1' },
        89: { 'black-pawn-a7': 'h3', 'white-pawn-h2': 'a6', 'black-pawn-e7': 'g5', 'white-pawn-f2': 'd4' },
        91: { 'white-pawn-a2': 'b8' },
        102: { 'white-rook-h1': 'h2', 'white-knight-g1': 'g1' },
      };
      const captures = step === 31 ? ['white-rook-a1', 'white-knight-b1', 'white-bishop-c1', 'white-queen-d1', 'white-pawn-b2', 'black-knight-b8'] : step === 91 ? ['black-bishop-c8'] : [];
      for (const piece of before.pieces) {
        const after = state.pieces.find(p => p.id === piece.id)!;
        if (captures.includes(piece.id)) {
          assert.equal(after.zone, 'captured'); assert.equal(after.square, null);
          assert.equal(after.owner, piece.owner); assert.equal(after.role, piece.role);
        } else assert.deepEqual(after, { ...piece, ...(relocations[step]?.[piece.id] ? { square: relocations[step]![piece.id] } : {}) });
      }
      if (step === 50) {
        assert.equal(state.fen, before.fen);
        assert.equal(state.players.white.discard.at(-1)?.cardId, 'doomsayer');
        assert.deepEqual(state.players.white.hand, before.players.white.hand);
        assert.deepEqual(state.players.white.deck, before.players.white.deck);
        assert.ok(!state.pendingDoomsayer);
      }
      if ([4, 44, 49, 79, 102].includes(step)) assert.deepEqual(state.fen.split(' ').slice(1), before.fen.split(' ').slice(1));
      if ([31, 89, 91].includes(step)) assert.equal(state.fen.split(' ')[4], '0');
    } else assert.fail(`unreviewed action ${step}`);
    assert.deepEqual(state.effects, step < 4 ? [] : step === 49 ? [crab, { type: 'doomsayer', owner: 'white', card: { id: 'white-deck-1-doomsayer', cardId: 'doomsayer' } }] : [crab]);
    assert.equal(Boolean(state.pendingRescue), step === 30);
    assert.equal(Boolean(state.pendingDoomsayer), step === 49);
    assert.ok(!state.outcome);
    for (const color of ['white', 'black'] as const) {
      const king = state.pieces.find(p => p.owner === color && p.royal)!;
      assert.ok(king.square);
      const check = state.pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(state, p, king.square!));
      assert.equal(check, color === 'white' && [28, 29, 30, 41, 42].includes(step), `step ${step}: independent ${color} King safety`);
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10);
  assert.equal(state.fen, 'rP3b1r/8/P2pkn1p/6q1/2PP1p1p/B3PN1P/3P1R2/5K2 b - - 5 27');
  assert.equal(replayTrace(trace).fen, state.fen);
});
