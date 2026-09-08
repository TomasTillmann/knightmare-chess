import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const rationales = [
  '1 Bombard: a1 Rook jumps only its a2 Pawn to empty a3; revoke queenside rights, increment clock.',
  '2 White ends its replacement move; Black starts with fresh allowances.',
  '3 Blessing: g7 Pawn follows clear f6-e5-d4-c3 diagonal without capture; reset Pawn clock.',
  '4 Black ends replacement move, with c3 Pawn attacking b2/d2, not e1 King.',
  '5 Evangelists swaps c1/f8 opposing Bishops without capture or identity changes.',
  '6 White ends the Bishop swap; neither King is threatened by the exchanged Bishops.',
  '7 Black b7-b6 is one empty forward step.',
  '8 Black ends b6; no card or en-passant change.',
  '9 White e2-e3 is an empty forward step, releasing the Queen diagonal.',
  '10 White ends e3; Black allowance resets.',
  '11 Black a7-a5 crosses empty a6; physical en-passant target a6 exists.',
  '12 Black ends a5 retaining en-passant for the next White turn.',
  '13 White d2-d3 is empty, expiring a6 en-passant.',
  '14 White ends d3 with its King safe behind e3.',
  '15 Black Bishop c1 captures b2 Pawn diagonally; original f8 Bishop identity survives.',
  '16 Black ends capture, leaving the b2 Pawn captured rather than dead.',
  '17 White Queen d1-f3 crosses vacant e2 without capture.',
  '18 White ends Queen development; no mandatory obligation yet.',
  '19 Black d7-d5 crosses clear d6 and opens d6 en-passant.',
  '20 After-move Vendetta starts mandatory legal captures, retains d6 en-passant, draws Peace Talks.',
  '21 Black ends; White can capture e7 so Vendetta stays active.',
  '22 White Bishop f8xe7 is a legal capture satisfying Vendetta.',
  '23 White ends; Black King can capture the undefended e7 Bishop.',
  '24 Black King e8xe7 captures that Bishop on a safe square and loses both castling rights.',
  '25 Black ends; White Queen can capture f7 so Vendetta persists.',
  '26 White Queen f3xf7 traverses f4/f5/f6, gives check without exposing e1.',
  '27 White ends check; Black has the safe King capture f7.',
  '28 Black King e7xf7 removes the checking undefended Queen and satisfies Vendetta.',
  '29 Black ends; White Rook can capture c3.',
  '30 White Rook a3xc3 crosses empty b3 and captures the Blessing Pawn.',
  '31 White ends; Black Bishop has the c3 Rook capture.',
  '32 Black Bishop b2xc3 captures the Rook diagonally.',
  '33 Black ends; White Knight can capture c3 so Vendetta continues.',
  '34 Before-move Pacifism attaches to owned nonroyal h2 Pawn, preserving the Regular Move.',
  '35 White Knight b1xc3 captures the Bishop and fulfills Vendetta despite the separate pacifist.',
  '36 Black has no legal capture; Vendetta expires and its card enters Black discard.',
  '37 Black Queen d8-h4 follows clear e7/f6/g5 diagonal; f2 blocks its line to e1.',
  '38 Black ends with neither King checked.',
  '39 White Knight c3-e2 jumps to empty e2, with f2 still blocking Queen check.',
  '40 White ends; Pacifism remains attached to h2.',
  '41 Black c7-c6 is an empty forward step.',
  '42 After-move Holy Quest exchanges White f1 Bishop and g1 Knight; identities and clocks stay.',
  '43 Black ends the non-move swap; e1 remains safe behind f2.',
  '44 White f2-f4 opens h4-g3-f2-e1 check; only a pending same-turn rescue makes acceptance provisional.',
  '45 Figure Dance cannot cure that diagonal: fizzle spends the card and rewinds illegal f4 to f2.',
  '46 White Knight e2-g3 is the replacement ordinary move, now also blocking the Queen diagonal.',
  '47 White ends the legal replacement with Figure Dance allowance still consumed until end.',
  '48 Black Queen h4-c4 traverses g4/f4/e4/d4, all empty after rewind.',
  '49 Black ends; Queen c4 line to e1 is not diagonal.',
  '50 White pacifist h2-h3 is permitted because it captures nothing; marker follows identity.',
  '51 White ends; Pacifism persists on h3.',
  '52 Black King f7-g7 enters a square outside White Knight and Pawn attacks.',
  '53 Black ends the safe King step.',
  '54 Forced March shifts a2-b2 and d3-c3 simultaneously into empty sideways destinations.',
  '55 White ends the two-Pawn replacement move with a reset halfmove clock.',
  '56 Black Knight b8-d7 jumps to empty d7.',
  '57 Black ends Knight development.',
  '58 White Knight g3-e4 jumps to empty e4 without capture.',
  '59 White ends; c3 Pawn still blocks Queen b4/e1 possibilities.',
  '60 Black Queen c4-b4 moves one empty horizontal square.',
  '61 Black ends; c3 Pawn blocks b4-c3-d2-e1 check.',
  '62 White Knight e4-g5 jumps to empty g5.',
  '63 White ends; g7 Black King is not attacked by g5 Knight.',
  '64 Black King g7-f6 is outside g5 Knight attacks and White Pawn reach.',
  '65 Black ends safe f6 relocation.',
  '66 White e3-e4 moves to the square vacated by its Knight.',
  '67 After-move Man-Trap binds occupied b2 secretly; board and clocks remain unchanged.',
  '68 White ends; trap persists and Queen line remains blocked by c3.',
  '69 Black King f6-e7 is not attacked by Knight g5 or Pawn e4.',
  '70 Black ends; White may make its replacement move.',
  '71 Resurrection returns the captured original b2 Pawn to empty starting-rank d2, preserving identity.',
  '72 White ends Resurrection with a Pawn clock reset and no restored castling rights.',
  '73 Black d5-d4 advances without capture.',
  '74 Peace Talks cancels White b2 Man-Trap and discards its physical card for White.',
  '75 Black ends; b2 is no longer trapped.',
  '76 White Knight g5-f3 jumps to empty f3.',
  '77 White ends with c3/d2 still blocking the Queen line.',
  '78 Black Knight d7-e5 jumps to empty e5.',
  '79 Black ends; e5 Knight does not attack e1.',
  '80 White Rook h1-h2 moves into vacated h2 and revokes its last castling right.',
  '81 White ends; all castling rights are gone.',
  '82 Confabulation Queen b4-d4 crosses empty c4 and merges with its Pawn; Queen becomes stored component.',
  '83 Black ends with combined Pawn/Queen powers on d4 and White King screened by d2.',
  '84 White g2-g3 advances to empty g3; composite d4 does not attack e1.',
  '85 White ends while composite identities and powers persist.',
  '86 Black a5-a4 advances to empty a4.',
  '87 Abduction temporarily hides White c3 Pawn after the move; no capture or clock change yet.',
  '88 Reveal ends concealment and begins recall without changing board or hands.',
  '89 Exact White Pawn c3 identity answer restores that same piece and leaves Abduction spent.',
  '90 Black ends after completed recall; no pending challenge remains.',
  '91 Under Elf Hill removes only White royal e1 to away and consumes its move.',
  '92 Immediate Black Fog cancels Elf Hill, restores King/clocks, spends both cards and restores White move.',
  '93 White King e1-d1 is safe: composite d4 line is blocked by the d2 Pawn.',
  '94 White ends; both consumed allowances reset for Black next turn.',
  '95 Breakthrough uses the composite Queen existing forward-capture power to permit diagonal d4xc3.',
  '96 Black ends capture; stored Queen remains part of the c3 composite.',
  '97 Pacifist White h3-h4 advances without capture.',
  '98 White ends; its pawn remains uncapturable and noncapturing.',
  '99 Composite c3xb2 captures original a2 Pawn; canceled Man-Trap cannot trigger.',
  '100 Black ends with composite b2; d1 is screened by c2 on the diagonal.',
  '101 Pacifist White h4-h5 advances without capture or promotion.',
  '102 White ends with persistent h5 marker.',
  '103 Black Knight e5xf3 captures White original b1 Knight.',
  '104 Black ends; f3 Knight does not attack d1 King.',
  '105 White Rook h2-h4 crosses empty h3, stopping behind its h5 Pawn.',
  '106 White ends the uncapturing Rook move.',
  '107 Black b6-b5 advances to empty b5.',
  '108 Black ends; no en-passant arises from a one-step Pawn move.',
  '109 White original g1 Knight f1-h2 jumps to empty h2 after Holy Quest.',
  '110 White Abduction hides Black h8 Rook after its move, preserving clocks until recall outcome.',
  '111 Reveal starts Rook recall; no card is spent again.',
  '112 Recall timeout captures the Rook, resets halfmove clock only, and clears pending challenge.',
  '113 White ends after Abduction capture; original Black King castling rights stay absent.',
  '114 Black composite b2-a3 moves diagonally backward with Queen powers; no capture.',
  '115 Black ends; a3 composite line toward d1 is not straight or diagonal.',
  '116 Resurrected White Pawn d2-d4 crosses clear d3; second-rank double step is permitted again.',
  '117 White ends retaining physical en-passant target d3 for this Pawn.',
  '118 Black composite a3-a2 moves downward without capture, expiring d3 en-passant.',
  '119 Black ends; c2 Pawn blocks composite second-rank line.',
  '120 White King d1-c1 is outside a2 composite and f3 Knight attacks.',
  '121 White ends safe c1 move.',
  '122 Black b5-b4 advances to empty b4.',
  '123 After-move Mystic Shield protects just-moved physical b7 Pawn at b4; board and clocks stay.',
  '124 Black ends; Shield now covers the next White turn.',
  '125 White Rook h4-g4 moves to empty g4 without capturing the shielded Pawn.',
  '126 White ends its protected turn; Mystic Shield expires, permanent effects remain.',
  '127 Black composite a2-d5 uses Queen diagonal via empty b3/c4, preserving both components.',
  '128 Black ends the fiftieth move command; White starts with both Kings safe and no pending obligation.',
];

const pacifism = { type: 'pacifism', owner: 'white', card: { id: 'white-hand-3-pacifism', cardId: 'pacifism' }, pieceId: 'white-pawn-h2' };
const confabulation = { type: 'confabulation', owner: 'black', card: { id: 'black-deck-3-confabulation', cardId: 'confabulation' }, pieceIds: ['black-pawn-d7', 'black-queen-d8'] };
const shield = { type: 'mystic-shield', owner: 'black', player: 'black', pieceId: 'black-pawn-b7' };
const pieceProjection = (state: GameState) => state.pieces.map(({ capturedAtPly: _, capturedBy: _actor, ...piece }) => piece);

test('iteration 040 deterministic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/040.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860040);
  assert.equal(trace.steps.length, rationales.length);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 18);
  let state = createGameState(trace.initial);
  const states = [state];
  const relocations: Record<number, Array<[string, string | null, string]>> = {
    1: [['white-rook-a1', 'a3', 'board']], 3: [['black-pawn-g7', 'c3', 'board']],
    5: [['white-bishop-c1', 'f8', 'board'], ['black-bishop-f8', 'c1', 'board']],
    42: [['white-bishop-f1', 'g1', 'board'], ['white-knight-g1', 'f1', 'board']],
    45: [['white-pawn-f2', 'f2', 'board']],
    54: [['white-pawn-a2', 'b2', 'board'], ['white-pawn-d2', 'c3', 'board']],
    71: [['white-pawn-b2', 'd2', 'board']], 82: [['black-queen-d8', null, 'away']],
    87: [['white-pawn-d2', null, 'away']], 89: [['white-pawn-d2', 'c3', 'board']],
    91: [['white-king-e1', null, 'away']], 92: [['white-king-e1', 'e1', 'board']],
    95: [['black-pawn-d7', 'c3', 'board'], ['white-pawn-d2', null, 'captured']],
    110: [['black-rook-h8', null, 'away']], 112: [['black-rook-h8', null, 'captured']],
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    assert.ok(rationales[index]!.startsWith(`${step} `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    const changes = [...(relocations[step] ?? [])];
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const moving = before.pieces.find(p => p.square === action.from)!;
      const victim = before.pieces.find(p => p.square === action.to);
      const setup = parseFen(before.fen).unwrap();
      // In this trace the merged Queen subsumes every Pawn movement actually used.
      if (step > 82) {
        const combined = before.pieces.find(p => p.id === 'black-pawn-d7')!;
        setup.board.set(parseSquare(combined.square!)!, { color: 'black', role: 'queen' });
      }
      const chess = Chess.fromSetup(setup).unwrap();
      assert.equal(chess.isLegal({ from: parseSquare(action.from)!, to: parseSquare(action.to)! }), step !== 44, rationales[index]);
      changes.push([moving.id, action.to, 'board']);
      if (victim) changes.push([victim.id, null, 'captured']);
      assert.equal(state.turn.phase, 'afterMove');
      assert.equal(state.turn.color, before.turn.color);
      assert.equal(state.turn.moveMade, true);
      assert.deepEqual(state.turn.cardPlays, before.turn.cardPlays);
      const oldFen = parseFen(before.fen).unwrap();
      const newFen = parseFen(state.fen).unwrap();
      assert.equal(newFen.halfmoves, victim || moving.originalRole === 'pawn' ? 0 : oldFen.halfmoves + 1);
      assert.equal(newFen.fullmoves, oldFen.fullmoves + Number(before.turn.color === 'black'));
      assert.equal(Boolean(state.pendingRescue), step === 44);
      const double = moving.originalRole === 'pawn' && action.from[0] === action.to[0]
        && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2;
      assert.deepEqual(state.enPassant, double ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: moving.id }] : []);
    }
    assert.deepEqual(pieceProjection(state), pieceProjection(before).map(piece => {
      const change = changes.find(([id]) => id === piece.id);
      return change ? { ...piece, square: change[1], zone: change[2] } : piece;
    }), rationales[index]);
    const expectedEffects: unknown[] = [];
    if (step >= 20 && step < 36) expectedEffects.push({ type: 'vendetta', owner: 'black', card: { id: 'black-hand-3-vendetta', cardId: 'vendetta' } });
    if (step >= 34) expectedEffects.push(pacifism);
    if (step >= 67 && step < 74) expectedEffects.push({ type: 'man-trap', owner: 'white', card: { id: 'white-deck-3-man-trap', cardId: 'man-trap' }, square: 'b2' });
    if (step >= 82) expectedEffects.push(confabulation);
    if (step >= 123 && step < 126) expectedEffects.push(shield);
    assert.deepEqual(state.effects, expectedEffects, rationales[index]);
    if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const player = before.players[owner];
      const card = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(owner === before.turn.color ? before.turn.phase : 'afterOpponentCard'));
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c.id !== card.id), player.deck[0]]);
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1));
      assert.equal(state.turn.cardPlays[owner], 1);
      assert.equal(state.players[owner].discard.some(c => c.id === card.id), !CARD_CATALOG[card.cardId]!.continuing);
    } else {
      for (const color of ['white', 'black'] as const) {
        assert.deepEqual(state.players[color].hand, before.players[color].hand);
        assert.deepEqual(state.players[color].deck, before.players[color].deck);
      }
    }
    if (action.type === 'endTurn') {
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
      assert.ok(!state.pendingRescue && !state.pendingAbduction);
      assert.deepEqual(state.enPassant, before.enPassant);
    }
    if (step === 45) {
      assert.equal(state.fen, states[43]!.fen);
      assert.equal(state.turn.moveMade, false);
      assert.equal(state.turn.cardPlays.white, 1);
      assert.equal(state.history.at(-1)?.type, 'cardFizzled');
    }
    if (step === 89) assert.equal(state.fen, states[86]!.fen);
    if (step === 92) {
      assert.equal(state.fen, states[90]!.fen);
      assert.ok(!state.underElfHill?.length);
      assert.deepEqual(state.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 1, black: 1 } });
    }
    if ([87, 110].includes(step)) assert.equal(state.pendingAbduction?.phase, 'concealment');
    if ([88, 111].includes(step)) assert.equal(state.pendingAbduction?.phase, 'recall');
    if ([89, 112].includes(step)) assert.ok(!state.pendingAbduction);
    states.push(state);
  }
  assert.equal(state.fen, 'r1b3n1/4k2p/2p5/3p3P/pp1PP1R1/5nP1/2P2P1N/2K3B1 w - - 0 29');
  assert.deepEqual(replayTrace(trace), state);
});
