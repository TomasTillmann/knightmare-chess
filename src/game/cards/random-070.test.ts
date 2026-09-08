import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/070.json', import.meta.url), 'utf8')) as RandomTrace;

// Individually reviewed against rules §§8–15, 18.3, 20–21 and printed card metadata.
const rationale = [
  '1 c2-c3: clear one-step Pawn advance; reset clock, no en passant.',
  '2 White completes c3; Black receives a fresh allowance; board unchanged.',
  '3 h7-h5: h6 and h5 clear; h6 en-passant opportunity; Black fullmove advances.',
  '4 Black completes h5; retain h6 opportunity for White.',
  '5 Qd1-b3: c2 clear; quiet diagonal clears old en passant.',
  '6 White completes Qb3; neither King attacked.',
  '7 a7-a5: a6 clear; a6 opportunity replaces expired h6.',
  '8 Black completes a5; a6 opportunity remains.',
  '9 Qb3-b6: b4,b5 clear; quiet vertical; a6 opportunity expires.',
  '10 White completes Qb6; Black King shielded by its back rank and pawns.',
  '11 Nb8-c6: legal jump onto empty c6, no capture.',
  '12 Black completes Nc6; White King e1 safe.',
  '13 Qb6-d4: c5 clear; diagonal retreat without capture.',
  '14 White completes Qd4; no royalty change.',
  '15 f7-f6: empty forward square; pawn clock resets.',
  '16 Fortification after Black move: adjacent e8/f7 boundary retained; draw Dark Mirror, no discard or clocks.',
  '17 Black ends; wall persists and both allowances reset.',
  '18 g2-g4: g3,g4 clear; distant wall irrelevant; g3 opportunity.',
  '19 White ends; preserve g3 opportunity for Black.',
  '20 Rh8-h6: h7 clear; no e8/f7 crossing; kingside right lost.',
  '21 Coup after move: safe c7 Pawn becomes royal; e8 becomes capturable Prince; draw No Quarter, retain Coup.',
  '22 Black ends with royal c7 Pawn safe; wall and Coup persist.',
  '23 g4-g5: forward empty square; no check on c7.',
  '24 White ends; Black royal identity remains c7.',
  '25 e7-e6: clear forward step; c7 King remains shielded.',
  '26 Black ends; neither identity nor cards changes.',
  '27 h2-h4: h3,h4 clear; h3 opportunity, no promotion.',
  '28 White ends; h3 opportunity retained.',
  '29 e6-e5: clear step; h3 opportunity expires.',
  '30 Black ends e5; royal c7 safe.',
  '31 Qd4-e3: clear one-square diagonal retreat.',
  '32 Rebirth after White move: opposing Rh6 returns to empty original Rook square h8; no castling restoration; draw Fortification.',
  '33 White ends; Rebirth discarded and five cards held.',
  '34 Ng8-h6: empty knight destination; no wall crossing restriction.',
  '35 Black ends Nh6; no new check.',
  '36 g5xh6: forward diagonal captures black g8 Knight; original white g2 Pawn survives.',
  '37 White ends capture; captured Knight remains recoverable, not dead.',
  '38 Nc6-e7: knight jump onto vacated pawn square; c7 King stays safe.',
  '39 Black ends Ne7; no effects expire.',
  '40 f2-f3: clear pawn step, opens f2 for King.',
  '41 White ends; cards unchanged.',
  '42 Rh8-g8: clear orthogonal step; earlier castling loss persists.',
  '43 Black ends Rg8; no royal threat.',
  '44 b2-b3: clear one-step pawn advance.',
  '45 White ends b3; Black receives turn.',
  '46 b7-b6: clear pawn step; does not expose c7 to Qe3.',
  '47 Black ends b6; c7 royalty still safe.',
  '48 Ke1-f2: adjacent empty unattacked square; both White castling rights lost.',
  '49 White ends Kf2; last moved kind is King.',
  '50 Doppelganger: non-Pawn Rg8 copies preceding King move to empty f7; g8/f7 is not e8/f7 wall; consumes move and draws Anathema.',
  '51 Black completes replacement move; clocks already advanced once.',
  '52 Qe3-c5: d4 clear; Queen now checks royal c7 along empty c6.',
  '53 White may end while giving check; Black must answer c7 threat.',
  '54 b6xc5: black Pawn captures checking Queen diagonally forward and saves c7 King.',
  '55 Black ends with Queen captured and c7 safe.',
  '56 Kf2-g2: empty adjacent square not attacked; no castling rights return.',
  '57 White ends Kg2 safely.',
  '58 d7-d6: empty forward square; no capture.',
  '59 Anathema after Black move: White Bc1/Ra1 exchange, keeping identities; no capture; draw Dungeon.',
  '60 Black ends swap; no extra clock increment.',
  '61 a2-a4: a3,a4 clear; a3 opportunity.',
  '62 White ends; a3 opportunity retained.',
  '63 f6-f5: empty step; expires a3 opportunity.',
  '64 Black ends f5; both Kings safe.',
  '65 d2-d3: empty step; clears d2 but e2 shields e-file.',
  '66 White ends d3; no effects expire.',
  '67 Rf7-f6: empty orthogonal step; does not cross e8/f7 wall.',
  '68 Black ends Rf6; c7 King safe.',
  '69 Rc1-d1: swapped original a1 Rook moves one square; no capture.',
  '70 White ends Rd1; identities and wall retained.',
  '71 Rf6xh6: g6 clear; capture white original g2 Pawn on h6, reset clock.',
  '72 Black ends capture; h6 Pawn captured, not dead.',
  '73 Nb1-a3: empty knight destination; no capture.',
  '74 White ends Na3; no check yet on c7.',
  '75 d6-d5: clear pawn advance; no double-step opportunity.',
  '76 Black ends d5; no effects expire.',
  '77 c3-c4: empty pawn advance; no capture.',
  '78 White ends c4; both Kings safe.',
  '79 d5-d4: empty pawn advance; Black Pawn blocks Bc3 diagonal afterward.',
  '80 Black ends d4; no new check.',
  '81 Ba1-c3: b2 clear; original c1 Bishop travels through vacated pawn square.',
  '82 White ends Bc3; d4 enemy Pawn blocks diagonal.',
  '83 Prince e8-d7: ordinary King geometry, no wall crossing; royal c7 unchanged; final Black castling right lost.',
  '84 Black ends Prince move; c7 remains safe.',
  '85 Na3-b5: Knight checks royal c7; Prince d7 is also attacked but capturable.',
  '86 White ends check; Black receives its escape turn.',
  '87 Prince d7-e8 leaves c7 in check provisionally; §11.6 requires same-turn rescue, pendingRescue true.',
  '88 Dungeon after move: checking nonroyal Nb5 relocates to vacant corner h8, curing c7 check; White cannot move it next turn; draw Knightmare.',
  '89 Black ends rescued turn; Dungeon restriction persists into White turn.',
  '90 Bc3-b4: legal diagonal; does not move imprisoned h8 Knight.',
  '91 White ends following turn: Dungeon expires, continuing wall and Coup persist.',
  '92 Ne7-c6: empty knight destination; no check on Kg2.',
  '93 Black ends Nc6; no additional card action.',
  '94 Rd1-e1: empty one-square orthogonal move.',
  '95 White ends Re1; black c7 King shielded by Nc6.',
  '96 Bf8-e7: adjacent empty diagonal; no wall crossing.',
  '97 Black ends Be7; no new check.',
  '98 Rh1-h3: h2 clear; h4 Pawn stops further travel; no capture.',
  '99 White ends Rh3; King g2 safe.',
  '100 Rh6-e6: g6,f6 clear; quiet Rook slide.',
  '101 Black ends Re6; c7 King safe.',
  '102 Bb4xc5: diagonal capture of original b7 Pawn; c6 Knight blocks any c7 line.',
  '103 White ends capture; captured Pawn remains recoverable.',
  '104 Dark Mirror instead of Black move: d4xc5 is backward diagonal capture of White Bishop; draw Rebirth; capture clock zero.',
  '105 Black ends replacement capture; no second regular move.',
  '106 Lost Castle instead of White move: Re1/Re6 swap owners preserved; g2 King safe behind f1 Bishop; draw No Quarter.',
  '107 White ends swap; one quiet replacement clock increment only.',
  '108 Bc8-b7: empty diagonal step; a8 Rook and c7 royal Pawn remain.',
  '109 Black ends Bb7; no check on g2.',
  '110 Rh3-h2: empty orthogonal step; Kg2 remains safe.',
  '111 White completes fiftieth regular move; Black starts fresh; two continuing cards remain.',
];

// This seed has ordinary roles plus Coup royalty, one wall, and one Dungeon ban.
function reaches(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const from = piece.square;
  const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = Number(to[1]) - Number(from[1]);
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (!dx && !dy) return false;
  if (piece.id === 'white-knight-b1' && state.effects.some(e => (e as { type?: string }).type === 'dungeon')) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    if (capture) { if (ax !== 1 || dy !== direction) return false; }
    else if (dx || dy !== direction && !(dy === direction * 2 && Number(from[1]) === (piece.owner === 'white' ? 2 : 7))) return false;
  } else if (piece.role === 'king') { if (Math.max(ax, ay) !== 1) return false; }
  else if (piece.role === 'bishop' ? ax !== ay : piece.role === 'rook' ? dx !== 0 && dy !== 0 : dx !== 0 && dy !== 0 && ax !== ay) return false;
  let previous = from;
  for (let i = 1; i <= Math.max(ax, ay); i++) {
    const square = String.fromCharCode(from.charCodeAt(0) + Math.sign(dx) * i) + (Number(from[1]) + Math.sign(dy) * i);
    if (state.effects.length && [previous, square].sort().join('/') === 'e8/f7') return false;
    if (square !== to && state.pieces.some(p => p.zone === 'board' && p.square === square)) return false;
    previous = square as SquareName;
  }
  return true;
}

function checked(state: GameState, color: 'white' | 'black'): boolean {
  const king = state.pieces.find(p => p.owner === color && p.royal)!;
  assert.equal(king.zone, 'board');
  return state.pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(state, p, king.square!, true));
}

test('iteration 070 independently reviewed board, capture, royalty, cards, effects and clocks', () => {
  assert.equal(rationale.length, trace.steps.length);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 8);
  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, why = rationale[index]!;
    assert.ok(why.startsWith(`${n} `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    state = result.state;
    const expected = before.pieces.map(p => ({ ...p }));
    const at = (square: string) => expected.find(p => p.zone === 'board' && p.square === square)!;
    let resets = false;
    let enPassant = before.enPassant;
    const completedMove = action.type === 'move' || [50, 104, 106].includes(n);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const mover = at(action.from), victim = at(action.to);
      assert.ok(mover, why);
      assert.equal(mover.owner, before.turn.color, why);
      assert.ok(reaches(before, mover, action.to, !!victim), why);
      resets = mover.role === 'pawn' || !!victim;
      enPassant = mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2
        ? [{ target: (action.from[0]! + (Number(action.from[1]) + Number(action.to[1])) / 2) as SquareName, pawnId: mover.id }] : [];
      if (victim) {
        assert.notEqual(victim.owner, mover.owner, why);
        assert.equal(victim.royal, false, why);
        victim.zone = 'captured'; victim.square = null;
      }
      mover.square = action.to as SquareName;
    }
    const relocate = (from: string, to: SquareName) => { at(from).square = to; };
    const swap = (a: SquareName, b: SquareName) => { const first = at(a), second = at(b); first.square = b; second.square = a; };
    if (n === 21) { at('e8').royal = false; at('c7').royal = true; }
    if (n === 32) relocate('h6', 'h8');
    if (n === 50) { relocate('g8', 'f7'); enPassant = []; }
    if (n === 59) swap('c1', 'a1');
    if (n === 88) relocate('b5', 'h8');
    if (n === 104) { const victim = at('c5'); victim.zone = 'captured'; victim.square = null; relocate('d4', 'c5'); resets = true; enPassant = []; }
    if (n === 106) { swap('e1', 'e6'); enPassant = []; }
    const physical = (pieces: PieceState[]) => pieces.map(({ capturedAtPly: _ply, capturedBy: _actor, ...p }) => p);
    assert.deepEqual(physical(state.pieces), physical(expected), why);
    assert.deepEqual(state.enPassant, enPassant, why);
    assert.equal(!!state.pendingRescue, n === 87, why);
    assert.equal(checked(state, before.turn.color), n === 87, why);
    assert.equal(checked(state, 'white'), false, why);
    assert.equal(checked(state, 'black'), [52, 53, 85, 86, 87].includes(n), why);
    assert.equal(state.pieces.find(p => p.owner === 'black' && p.royal)!.id, n >= 21 ? 'black-pawn-c7' : 'black-king-e8', why);
    assert.equal(state.pieces.find(p => p.owner === 'white' && p.royal)!.id, 'white-king-e1', why);
    assert.equal(state.orientation, 0, why);
    assert.equal(state.outcome, null, why);
    const effects: unknown[] = [];
    if (n >= 16) effects.push({ type: 'fortification', owner: 'black', card: { id: 'black-hand-1-fortification', cardId: 'fortification' }, from: 'e8', to: 'f7' });
    if (n >= 21) effects.push({ type: 'coup', owner: 'black', card: { id: 'black-hand-2-coup', cardId: 'coup' }, princeId: 'black-king-e8', kingId: 'black-pawn-c7', princeRole: 'king' });
    if (n >= 88 && n <= 90) effects.push({ type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-knight-b1' });
    assert.deepEqual(state.effects, effects, why);
    const oldFen = before.fen.split(' '), newFen = state.fen.split(' ');
    assert.equal(Number(newFen[4]), completedMove ? resets ? 0 : Number(oldFen[4]) + 1 : Number(oldFen[4]), why);
    assert.equal(Number(newFen[5]), Number(oldFen[5]) + (completedMove && before.turn.color === 'black' ? 1 : 0), why);
    assert.equal(newFen[2], n >= 83 ? '-' : n >= 48 ? 'q' : n >= 20 ? 'KQq' : 'KQkq', why);
    if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true, why);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', why);
      assert.equal(state.turn.phase, 'beforeMove', why);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 }, why);
    } else {
      assert.equal(state.turn.color, before.turn.color, why);
      assert.equal(state.turn.moveMade, true, why);
      assert.equal(state.turn.phase, 'afterMove', why);
    }
    for (const color of ['white', 'black'] as const) {
      const prior = before.players[color], next = state.players[color];
      if (action.type === 'playCard' && prior.hand.some(c => c.id === action.cardInstanceId)) {
        const card = prior.hand.find(c => c.id === action.cardInstanceId)!;
        assert.equal(before.turn.cardPlays[color], 0, why);
        assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(before.turn.phase), why);
        assert.equal(state.turn.cardPlays[color], 1, why);
        assert.deepEqual(next.hand, [...prior.hand.filter(c => c.id !== card.id), prior.deck[0]], why);
        assert.deepEqual(next.deck, prior.deck.slice(1), why);
        assert.deepEqual(next.discard, CARD_CATALOG[card.cardId]!.continuing ? prior.discard : [...prior.discard, card], why);
      } else assert.deepEqual(next, prior, why);
    }
  }
  assert.equal(state.fen, 'r2qk2N/1bp1b1p1/2n1R3/p1p1pp1p/P1P4P/1P1P1P2/4P1KR/4rBN1 b - - 3 27');
});

test('iteration 070 deterministic replay', () => {
  assert.equal(trace.seed, 860070);
  replayTrace(trace);
});
