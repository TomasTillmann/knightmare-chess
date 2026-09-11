import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed prefix. Generated actions 51–113 remain unreviewed.
const rationales = [
  '1 Lost Castle exchanges the physical h1/h8 Rooks, consumes White\'s move, and revokes their castling rights.',
  '2 Toll reacts to White\'s Rook crossing the frontier; White pays its g2 Pawn, captured by Black.',
  '3 End White\'s completed replacement move and clear both card allowances.',
  '4 Black Nb8-a6 is a quiet L jump.',
  '5 End Black\'s completed Knight move.',
  '6 Disintegration makes White\'s e2 Pawn dead before the move without a capture or clock advance.',
  '7 White d2-d3 advances one empty forward square.',
  '8 End White\'s completed Pawn move.',
  '9 Black e7-e6 advances one empty forward square.',
  '10 End Black\'s completed Pawn move.',
  '11 White Bc1-f4 follows the empty d2/e3 diagonal.',
  '12 End White\'s completed Bishop move.',
  '13 Black d7-d5 crosses empty d6; d6 is an EP opportunity but no White Pawn can capture it.',
  '14 End Black\'s turn while retaining the uncapturable d6 opportunity.',
  '15 White a2-a3 is a quiet Pawn advance and expires d6.',
  '16 End White\'s completed Pawn move.',
  '17 Black Na6-b4 is a quiet L jump.',
  '18 End Black\'s completed Knight move.',
  '19 White Rh8xg8 captures the physical Black g8 Knight on an adjacent file.',
  '20 Rebirth places Black\'s b7 Pawn on empty original Pawn square e7 after White\'s move.',
  '21 End White\'s completed capture and card window.',
  '22 Assassin substitutes Black K e8xd8 capturing its own Queen; the royal moves one file and loses castling.',
  '23 End Black\'s completed Assassin replacement.',
  '24 White Bf4-c1 returns through empty e3/d2.',
  '25 End White\'s completed Bishop move.',
  '26 Black a7-a6 advances one empty forward square.',
  '27 End Black\'s completed Pawn move.',
  '28 White Ra1-a2 moves into the Pawn-vacated square and removes its final castling right.',
  '29 Forbidden City marks empty b8 after White\'s move; its physical card remains in play.',
  '30 End White\'s turn; the b8 obstacle persists.',
  '31 Black Rh1xg1 captures the White g1 Knight.',
  '32 End Black\'s completed capture.',
  '33 White b2-b3 advances one empty forward square.',
  '34 End White\'s completed Pawn move.',
  '35 Black h7-h5 crosses empty h6; no White Pawn can capture the h6 EP opportunity.',
  '36 End Black\'s turn retaining the h6 opportunity.',
  '37 White Nb1-d2 jumps to the empty square and expires h6.',
  '38 End White\'s completed Knight move.',
  '39 Black Nb4xa2 jumps to capture the White original a1 Rook.',
  '40 Earthquake rotates clockwise: White now advances west and Black east; a3 promotes to White Rook, h5 to Black Knight, opponent first.',
  '41 End Black\'s turn retaining the rotation and Forbidden City.',
  '42 White Nd2-f3 makes an ordinary quiet L jump under rotation.',
  '43 End White\'s completed Knight move.',
  '44 Black d5-e5 advances east one empty square under Earthquake.',
  '45 End Black\'s completed rotated Pawn move.',
  '46 White promoted Ra3xa6 follows empty a4/a5 and captures Black\'s original a7 Pawn.',
  '47 Holy Quest swaps Black\'s Bf8 and promoted Nh5 after White\'s capture, preserving physical identities and promotion.',
  '48 End White\'s turn with Black\'s promoted Knight shielding Kd8 on f8 from Rg8.',
  '49 Black Nf8-h7 exposes Rg8-f8-e8-d8 check; the provisional move needs rescue. Held Dungeon can move Rg8 to empty h1 and save Kd8.',
  '50 FIRST FINDING: Plots must retain the provisional move and permit the already-legal Dungeon rescue through its immediate additional-card window (§17.3); it must not prematurely fizzle and undo Nf8-h7.',
];

const cardActions: Record<number, { cardId: string; cardInstanceId: string; target: unknown }> = {
  1: { cardId: 'lost-castle', cardInstanceId: 'white-hand-3-lost-castle', target: { own: 'h1', opponent: 'h8' } },
  2: { cardId: 'toll', cardInstanceId: 'black-hand-2-toll', target: 'g2' },
  6: { cardId: 'disintegration', cardInstanceId: 'white-hand-4-disintegration', target: 'e2' },
  20: { cardId: 'rebirth', cardInstanceId: 'white-hand-0-rebirth', target: [{ from: 'b7', to: 'e7' }] },
  22: { cardId: 'assassin', cardInstanceId: 'black-hand-0-assassin', target: [{ from: 'e8', to: 'd8' }] },
  29: { cardId: 'forbidden-city', cardInstanceId: 'white-deck-0-forbidden-city', target: 'b8' },
  40: { cardId: 'earthquake', cardInstanceId: 'black-hand-1-earthquake', target: { direction: 'clockwise', promotions: [{ square: 'a3', role: 'rook' }, { square: 'h5', role: 'knight' }] } },
  47: { cardId: 'holy-quest', cardInstanceId: 'white-deck-1-holy-quest', target: { bishop: 'f8', knight: 'h5' } },
  50: { cardId: 'plots-within-plots', cardInstanceId: 'black-deck-2-plots-within-plots', target: { player: 'black' } },
};
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';

test('iteration 148: independent first 49 rows, then Plots must keep a legal Dungeon rescue available', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/148.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860148);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.length, 113);
  assert.equal(rationales.length, 50);
  rationales.forEach((reason, i) => assert.ok(reason.startsWith(`${i + 1} `)));
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  const turn = structuredClone(state.turn);
  const effects: unknown[] = [];
  let orientation: 0 | 270 = 0;
  let active: Color = 'white', rights = 'KQkq', half = 0, full = 1;
  let ep: GameState['enPassant'] = [];
  let shieldMove: GameState['shieldMove'];
  let beforeRescue: GameState | undefined;
  let historyLength = 0;
  const at = (square: string) => pieces.find(piece => piece.square === square && piece.zone === 'board');
  const move = (from: string, to: SquareName) => { const piece = at(from); assert.ok(piece); piece.square = to; return piece; };
  const remove = (square: string, zone: 'captured' | 'dead', captor?: Color) => {
    const piece = at(square); assert.ok(piece); piece.square = null; piece.zone = zone;
    if (captor) piece.capturedBy = captor;
  };
  const reaches = (piece: PieceState, to: string, capture: boolean): boolean => {
    assert.ok(piece.square);
    const [x,y] = xy(piece.square), [tx,ty] = xy(to), dx = tx-x, dy = ty-y;
    if (!dx && !dy || (effects.length && to === 'b8')) return false;
    if (piece.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
    if (piece.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
    if (piece.role === 'pawn') {
      const direction = piece.owner === 'white' ? 1 : -1;
      const forward = orientation === 0 ? dy*direction : -dx*direction;
      const lateral = orientation === 0 ? dx : dy;
      if (capture) return forward === 1 && Math.abs(lateral) === 1;
      if (lateral || forward < 1 || forward > 2 || at(to)) return false;
      if (forward === 1) return true;
      if (orientation !== 0 || y !== (piece.owner === 'white' ? 1 : 6)) return false;
      return !at(`${piece.square[0]}${y+1+direction}`);
    }
    const straight = !dx || !dy, diagonal = Math.abs(dx) === Math.abs(dy);
    if (!(piece.role === 'rook' ? straight : piece.role === 'bishop' ? diagonal : straight || diagonal)) return false;
    for (let n = 1; n < Math.max(Math.abs(dx),Math.abs(dy)); n++) {
      const square = `${String.fromCharCode(97+x+Math.sign(dx)*n)}${y+Math.sign(dy)*n+1}`;
      if (at(square) || effects.length && square === 'b8') return false;
    }
    return true;
  };
  const checked = (color: Color) => {
    const king = pieces.find(piece => piece.royal && piece.owner === color)!;
    return pieces.some(piece => piece.zone === 'board' && piece.owner !== color && reaches(piece, king.square!, true));
  };
  const fen = () => {
    const ranks = [];
    for (let y = 7; y >= 0; y--) {
      let rank = '', empty = 0;
      for (let x = 0; x < 8; x++) {
        const piece = at(`${String.fromCharCode(97+x)}${y+1}`);
        if (!piece) { empty++; continue; }
        if (empty) { rank += empty; empty = 0; }
        const char = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[piece.role];
        rank += piece.owner === 'white' ? char.toUpperCase() : char;
      }
      ranks.push(rank + (empty || ''));
    }
    return `${ranks.join('/')} ${active === 'white' ? 'w' : 'b'} ${rights || '-'} - ${half} ${full}`;
  };
  for (const [i, step] of trace.steps.slice(0,49).entries()) {
    const row = i+1, action = step.action, original = structuredClone(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(to, /^[a-h][1-8]$/);
      const piece = at(from); assert.ok(piece);
      assert.equal(piece.owner, turn.color);
      const victim = at(to);
      shieldMove = { player: turn.color, pieceIds: [piece.id], capturedOpponent: !!victim };
      assert.ok(!victim || victim.owner !== turn.color);
      assert.ok(reaches(piece,to,!!victim), rationales[i]);
      assert.equal(action.promotion, undefined);
      ep = [];
      if (piece.role === 'pawn' && Math.abs(Number(from[1])-Number(to[1])) === 2) {
        ep = [{ target: `${from[0]}${(Number(from[1])+Number(to[1]))/2}` as SquareName, pawnId: piece.id }];
      }
      half = piece.role === 'pawn' || victim ? 0 : half+1;
      if (victim) remove(to,'captured',turn.color);
      move(from,to as SquareName);
      if (row === 28) rights = '';
      active = opposite(turn.color); if (turn.color === 'black') full++;
      turn.phase = 'afterMove'; turn.moveMade = true;
      if (row === 49) beforeRescue = original;
      historyLength++;
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade,true);
      turn.color = opposite(turn.color); turn.phase = 'beforeMove'; turn.moveMade = false;
      turn.cardPlays = { white: 0, black: 0 };
      shieldMove = undefined;
    } else {
      assert.equal(action.type,'playCard');
      if (action.type !== 'playCard') throw new Error('unexpected action');
      assert.deepEqual(action,{type:'playCard',...cardActions[row]});
      const owner: Color = [2,22,40].includes(row) ? 'black' : 'white';
      const player = players[owner];
      const index = player.hand.findIndex(card => card.id === action.cardInstanceId);
      assert.ok(index >= 0); const [card] = player.hand.splice(index,1); assert.ok(card);
      assert.equal(turn.cardPlays[owner],0);
      turn.cardPlays[owner]++;
      if (![29,40].includes(row)) player.discard.push(card);
      const draw = player.deck.shift(); assert.ok(draw); player.hand.push(draw);
      if (row === 1) { const own = at('h1')!, enemy = at('h8')!; own.square = 'h8'; enemy.square = 'h1'; rights = 'Qq'; half++; active = 'black'; turn.phase = 'afterMove'; turn.moveMade = true; }
      if (row === 2) { remove('g2','captured','black'); half = 0; }
      if (row === 6) remove('e2','dead');
      if (row === 20) move('b7','e7');
      if (row === 22) { remove('d8','captured','black'); move('e8','d8'); rights = 'Q'; half = 0; full++; active = 'white'; turn.phase = 'afterMove'; turn.moveMade = true; }
      if (row === 1) shieldMove = { player: 'white', capturedOpponent: false, pieceIds: [] };
      if (row === 22) shieldMove = { player: 'black', capturedOpponent: false, pieceIds: ['black-king-e8'] };
      if (row === 29) effects.push({type:'forbidden-city',owner,card,square:'b8'});
      if (row === 40) {
        orientation = 270;
        const pawn = at('a3')!, opponent = at('h5')!;
        assert.equal(pawn.originalRole,'pawn'); assert.equal(opponent.originalRole,'pawn');
        pawn.role = 'rook'; pawn.promoted = true; opponent.role = 'knight'; opponent.promoted = true;
        effects.push({type:'earthquake',owner,card,direction:'clockwise',target:cardActions[40]!.target});
      }
      if (row === 47) { const bishop = at('f8')!, knight = at('h5')!; bishop.square = 'h5'; knight.square = 'f8'; }
      historyLength++;
    }
    const result = applyAction(state,action);
    assert.deepEqual(state,original,`row ${row}: complete immutable input`);
    assert.ok(result.ok,rationales[i]); state = result.state;
    assert.deepEqual(state.pieces,pieces,`row ${row}: physical identity, capture actor and promotion`);
    assert.deepEqual(state.players,players,`row ${row}: exact hand/deck/discard IDs and order`);
    assert.deepEqual(state.turn,turn,`row ${row}: phase and exact allowances`);
    assert.deepEqual(state.effects,effects);
    assert.equal(state.orientation,orientation);
    assert.equal(state.fen,fen(),`row ${row}: independent six-field FEN`);
    assert.deepEqual(state.enPassant,ep);
    // Neither d6 nor h6 has an adjacent capturing Pawn; evaluate the next actor beforeMove.
    for (const opportunity of ep) {
      assert.ok(!pieces.some(piece => piece.zone === 'board' && piece.role === 'pawn' && piece.owner === active && reaches(piece,opportunity.target,true)));
      const prospective = { ...state, turn: { ...state.turn, color: active, phase: 'beforeMove' as const, moveMade: false } };
      const destinations = legalDests(prospective);
      for (const piece of pieces.filter(piece => piece.zone === 'board' && piece.role === 'pawn' && piece.owner === active)) {
        assert.ok(!destinations.get(piece.square!)?.includes(opportunity.target));
      }
    }
    for (const color of ['white','black'] as const) {
      assert.equal(checked(color),row === 49 && color === 'black',`row ${row}: independent ${color} royal rays`);
      assert.equal(isKingInCheck(state,color),checked(color));
    }
    assert.equal(state.history.length,historyLength);
    assert.equal(state.outcome,null);
    assert.equal(state.chaosForbidden,undefined); assert.equal(state.plotsExecution,undefined);
    assert.deepEqual(state.plotsAllowances ?? [],[]); assert.deepEqual(state.fogLocked ?? [],[]);
    assert.deepEqual(state.riposteLostMoves ?? [],[]); assert.equal(state.riposteSkipped,undefined); assert.equal(state.riposteCheckDeferred,undefined);
    assert.equal(state.pendingAbduction ?? null,null); assert.equal(state.pendingDoomsayer ?? null,null);
    assert.deepEqual(state.underElfHill ?? [],[]); assert.deepEqual(state.shieldMove,shieldMove);
    if (row !== 49) assert.equal(state.pendingRescue ?? null,null);
    else {
      assert.ok(beforeRescue);
      assert.deepEqual(state.pendingRescue,{before:beforeRescue,fen:beforeRescue.fen,pieces:beforeRescue.pieces,enPassant:[],historyLength:27,movedPieceIds:['black-pawn-h7']});
    }
  }
  assert.equal(state.fen,'r1bk2R1/2p1pppn/R3p3/4p2b/8/1P1P1N2/n1P2P1P/2BQKBr1 w - - 1 12');
  // A concrete independent rescue witness: relocate the checking Rook to h1.
  // The new Rook square shares no rank/file with d8; every other attacker remains unchanged.
  const rook = at('g8')!; rook.square = 'h1'; assert.equal(checked('black'),false); rook.square = 'g8';
  const rescue = applyAction(state,{type:'playCard',cardId:'dungeon',cardInstanceId:'black-deck-0-dungeon',target:[{from:'g8',to:'h1'}]});
  assert.ok(rescue.ok); assert.equal(rescue.state.pendingRescue,null);
  assert.equal(isKingInCheck(rescue.state,'black'),false);
  const original = structuredClone(state), action = trace.steps[49]!.action;
  assert.deepEqual(action,{type:'playCard',...cardActions[50]});
  const result = applyAction(state,action);
  assert.deepEqual(state,original,'row 50: complete immutable input');
  assert.ok(result.ok);
  const expectedPlayers = structuredClone(players), black = expectedPlayers.black;
  const [plots] = black.hand.splice(black.hand.findIndex(card => card.id === 'black-deck-2-plots-within-plots'),1);
  assert.ok(plots); black.discard.push(plots);
  const replacement = black.deck.shift(); assert.ok(replacement); black.hand.push(replacement);
  assert.deepEqual(result.state.players,expectedPlayers,'row 50: exact Plots expenditure and replacement');
  // First invalid row: Plots must keep its immediate legal rescue sequence available.
  assert.equal(result.state.fen,original.fen,'row 50: Plots must not rewind the still-rescuable Knight move');
  assert.deepEqual(result.state.pieces,original.pieces);
  assert.deepEqual(result.state.pendingRescue,original.pendingRescue);
  assert.equal(result.state.turn.phase,'afterMove'); assert.equal(result.state.turn.moveMade,true);
  assert.equal(result.state.turn.cardPlays.black,1);
  assert.equal(result.state.plotsAllowances?.length,1);
  const allowance = result.state.plotsAllowances![0]!;
  assert.equal(allowance.player,'black'); assert.equal(allowance.remaining,2);
  assert.deepEqual(allowance.eligibleCards,['black-deck-0-dungeon']);
  assert.equal(allowance.window.phase,'afterMove'); assert.equal(allowance.window.moveMade,true);
  assert.deepEqual(allowance.window.shieldMove,original.shieldMove);
  assert.equal(result.state.chaosForbidden,undefined); assert.equal(result.state.plotsExecution,undefined);
  assert.deepEqual(result.state.fogLocked ?? [],[]); assert.deepEqual(result.state.riposteLostMoves ?? [],[]);
  assert.equal(result.state.riposteSkipped,undefined); assert.equal(result.state.riposteCheckDeferred,undefined);
  assert.deepEqual(result.state.effects,effects); assert.equal(result.state.orientation,270);
  assert.deepEqual(result.state.enPassant,[]);
  assert.equal(isKingInCheck(result.state,'white'),false); assert.equal(isKingInCheck(result.state,'black'),true);
});
