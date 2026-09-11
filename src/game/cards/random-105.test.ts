import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, rejectPendingCancellation, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Ordered independent review: each entry covers the named action; the oracle below
// checks all 32 physical identities, card zones, clocks, effects and royal safety.
const reasons = [
  '1 g2-g4: starting Pawn passes empty g3; g3 en passant opportunity.',
  '2 End White turn; retain g3 opportunity for Black.',
  '3 e7-e6: one forward to empty e6; expire g3 opportunity.',
  '4 End Black turn; no board or card change.',
  '5 Evangelists replaces White move: swap opposing c1/c8 Bishops without capture.',
  '6 End White replacement turn.',
  '7 g8-f6: Knight jumps to empty f6.',
  '8 End Black turn.',
  '9 c2-c3: one forward to empty c3.',
  '10 End White turn.',
  '11 f8-e7: Bishop diagonal to vacated e7.',
  '12 End Black turn.',
  '13 h2-h3: one forward to empty h3.',
  '14 End White turn.',
  '15 Bombard replaces move: h8 Rook jumps exactly h7 Pawn to empty h6; revoke k.',
  '16 End Black replacement turn.',
  '17 d1-c2: Queen one diagonal to vacated c2.',
  '18 Treason after move swaps enemy h6 Rook and f6 Knight; neither captured.',
  '19 End White turn.',
  '20 c1xd2: Black Bishop captures White d2 Pawn, credited Black; checks e1 King.',
  '21 End Black turn; White receives checked position.',
  '22 c2-d1: Queen diagonal; e1 remains checked by d2 Bishop, pending same-turn rescue under 11.6.',
  '23 Chaos reacts and restores Queen c2, clocks and pre-move checked board; disallow repeating c2-d1.',
  '24 c3-c4 differs from canceled move; e1 check still requires same-turn rescue.',
  '25 Rebirth after move returns enemy Bishop d2-c8, captures own c8 Bishop for White card actor; cures e1 check.',
  '26 End rescued White turn; reset both allowances.',
  '27 a7-a5: starting Pawn passes empty a6; record a6 opportunity.',
  '28 End Black turn; retain a6 opportunity.',
  '29 e1-d1: King one file to empty safe d1; revoke KQ; clear en passant.',
  '30 Cowardice after move retreats enemy f7 Pawn to empty f8, its own back rank; no promotion.',
  '31 End White turn.',
  '32 e6-e5: Black Pawn one forward to empty e5.',
  '33 End Black turn.',
  '34 c4-c5: White Pawn one forward to empty c5.',
  '35 Heresy: enemy e7 Bishop moves first to empty opposite-color f7; c8 Bishop has no empty orthogonal neighbor; own f1 Bishop then e1.',
  '36 End White turn.',
  '37 f6-b6: Rook traverses empty e6,d6,c6.',
  '38 End Black turn.',
  '39 Evil Eye replaces move: e1 Bishop threatens a5 via empty d2,c3,b4; remove Black a7 Pawn for White; Bishop stays e1.',
  '40 End White replacement turn.',
  '41 e8-e7: King steps to empty safe e7; revoke q.',
  '42 End Black turn.',
  '43 c2-d2: Queen one file to empty d2.',
  '44 End White turn.',
  '45 b6-b4: Rook passes empty b5.',
  '46 End Black turn.',
  '47 d2-c1: Queen one diagonal to empty c1.',
  '48 End White turn.',
  '49 b4-b6: Rook passes empty b5.',
  '50 End Black turn.',
  '51 c1-c3: Queen passes empty c2.',
  '52 End White turn.',
  '53 a8-a4: Rook passes empty a7,a6,a5 after Evil Eye removal.',
  '54 End Black turn.',
  '55 b1-a3: Knight jumps to empty a3.',
  '56 End White turn.',
  '57 b6-c6: Rook one file to empty c6.',
  '58 End Black turn.',
  '59 f2-f4: Pawn passes empty f3; record f3 opportunity.',
  '60 End White turn; retain f3 opportunity.',
  '61 Hidden Passage replaces Black move: King e7 to vacant safe g6; clear en passant.',
  '62 End Black replacement turn.',
  '63 g1-f3: Knight jumps to empty f3.',
  '64 End White turn.',
  '65 f7xa2: Bishop traverses empty e6,d5,c4,b3; capture White a2 Pawn for Black.',
  '66 End Black turn.',
  '67 h1-h2: Rook steps onto square vacated by h Pawn.',
  '68 End White turn.',
  '69 h6-f7: Knight jumps onto empty f7.',
  '70 End Black turn.',
  '71 d1-c1: King steps onto empty safe c1.',
  '72 End White turn.',
  '73 c6-d6: Rook one file to empty d6.',
  '74 End Black turn.',
  '75 a3-b1: Knight jumps to empty b1.',
  '76 End White turn.',
  '77 d6-b6: Rook passes empty c6.',
  '78 End Black turn.',
  '79 c5-c6: Pawn one forward to vacated c6.',
  '80 End White turn.',
  '81 Tournament replaces Black move: swap own b8 Knight and opposing f3 Knight; preserve identities and owners.',
  '82 End Black replacement turn.',
  '83 h3-h4: Pawn one forward to empty h4.',
  '84 End White turn.',
  '85 g6-h6: King one file to empty safe h6.',
  '86 End Black turn.',
  '87 b1-a3: Knight jumps to empty a3.',
  '88 End White turn.',
  '89 Haunting Memories copies latest nonunique Tournament: swap Black f3 and White a3 Knights, replacing move.',
  '90 End Black replacement turn.',
  '91 c3-c4: Queen one rank to empty c4.',
  '92 Man-Trap after move marks own e2 Pawn square; retain physical card as effect, draw once.',
  '93 End White turn; trap remains armed.',
  '94 h6-g6: King one file to empty safe g6; does not enter e2.',
  '95 End Black turn; trap remains armed.',
  '96 e1-b4: Bishop traverses empty d2,c3; trap untriggered.',
  '97 End White turn.',
  '98 f7-h8: Knight jumps to empty h8; trap untriggered.',
  '99 End Black turn.',
  '100 c4-d5: Queen one diagonal to empty d5.',
  '101 End White turn.',
  '102 Resurrection replaces Black move: return captured original a7 Pawn to vacant a7, clear captor, reset Pawn clock.',
  '103 End Black replacement turn.',
  '104 b4-a5: Bishop one diagonal to empty a5.',
  '105 End White turn.',
  '106 e5-e4: Black Pawn one forward to empty e4.',
  '107 End Black turn.',
  '108 a5-e1: Bishop traverses empty b4,c3,d2.',
  '109 End White turn.',
  '110 e4xf3: Black Pawn captures physical White b1 Knight for Black; trap e2 unaffected.',
  '111 End Black turn.',
  '112 e1-g3: Bishop passes empty f2.',
  '113 Holy War after move swaps own b8 Knight and g3 Bishop, without capture or extra clock advance.',
  '114 End White turn.',
  '115 b6-a6: Rook one file to empty a6.',
  '116 End Black turn.',
  '117 c6xd7: White Pawn captures Black d7 Pawn for White; d7 is not promotion rank.',
  '118 End White turn.',
  '119 d8-e7: Queen one diagonal to vacant e7.',
  '120 End Black turn; all 50 regular moves and 14 card actions resolved.',
];

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x,y] = xy(piece.square!); const [tx,ty] = xy(to);
  const dx = tx-x; const dy = ty-y; const ax = Math.abs(dx); const ay = Math.abs(dy);
  if (!ax && !ay) return false;
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax,ay) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return ax === 1 && dy === forward;
    return !ax && (dy === forward || dy === 2 * forward && y === (forward === 1 ? 1 : 6)
      && !at(pieces, `${String.fromCharCode(97+x)}${y+forward+1}`));
  }
  if (!(piece.role === 'rook' ? !ax || !ay : piece.role === 'bishop' ? ax === ay : !ax || !ay || ax === ay)) return false;
  for (let i = 1; i < Math.max(ax,ay); i++) {
    if (at(pieces, `${String.fromCharCode(97+x+i*Math.sign(dx))}${y+i*Math.sign(dy)+1}`)) return false;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces,p,king.square!,true));
}
function boardFen(pieces: PieceState[]): string {
  const symbols = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' };
  return Array.from({length:8},(_,i) => {
    let row = ''; let empty = 0;
    for (let f=0;f<8;f++) {
      const p=at(pieces,`${String.fromCharCode(97+f)}${8-i}`);
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty=0; }
      const symbol = symbols[p.role]; row += p.owner === 'white' ? symbol.toUpperCase() : symbol;
    }
    return row + (empty || '');
  }).join('/');
}

// F4 / FAQ p.16: only actions 1–22 are a legal prefix. Later artifact actions
// depend on the rejected cancellation at action 23; original artifact hashes remain unchanged.
test('iteration 105 reviewed random trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/105.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(reasons.length, trace.steps.length);
  let state = createGameState(trace.initial);
  let beforeCanceledMove = structuredClone(state);
  for (const [index, {action}] of trace.steps.slice(0, 22).entries()) {
    const n=index+1; const message=reasons[index];
    assert.ok(message?.startsWith(`${n} `));
    const original=structuredClone(state);
    const expected=structuredClone(state);
    if (n===22) beforeCanceledMove=structuredClone(state);
    const actor=state.turn.color;
    const fields=state.fen.split(' ');
    let half=Number(fields[4]); let full=Number(fields[5]); let rights=fields[2]!;
    let fenActor=fields[1]!;
    let consumes=false; let resets=false;
    const relocate=(from:string,to:string) => { const piece=at(expected.pieces,from); assert.ok(piece,message); piece.square=to as SquareName; };
    const swap=(a:string,b:string) => { const p=at(expected.pieces,a); const q=at(expected.pieces,b); assert.ok(p&&q,message); p.square=b as SquareName;q.square=a as SquareName; };
    const capture=(square:string,owner:Color) => { const p=at(expected.pieces,square);assert.ok(p&&!p.royal,message); p.square=null;p.zone='captured';p.capturedBy=owner;resets=true; };
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const p=at(state.pieces,action.from); assert.ok(p,message); assert.equal(p.owner,actor,message);
      const victim=at(state.pieces,action.to); assert.ok(!victim || victim.owner!==actor,message);
      assert.ok(geometry(state.pieces,p,action.to,!!victim),message);
      if(victim) capture(action.to,actor);
      relocate(action.from,action.to); consumes=true; resets ||= p.role==='pawn';
      assert.equal(action.promotion,undefined,message);
      expected.enPassant=[];
      if(p.role==='pawn' && Math.abs(Number(action.to[1])-Number(action.from[1]))===2) {
        expected.enPassant=[{target:`${action.from[0]}${(Number(action.to[1])+Number(action.from[1]))/2}` as SquareName,pawnId:p.id}];
      }
      if(p.royal) rights=rights.replace(actor==='white'?/[KQ]/g:/[kq]/g,'');
      if(p.role==='rook') rights=rights.replace(({a1:'Q',h1:'K',a8:'q',h8:'k'} as Record<string,string>)[action.from]??'!','');
    } else if(action.type==='playCard') {
      const owner:Color=n===23?'black':actor;
      const card=expected.players[owner].hand.find(c=>c.id===action.cardInstanceId);
      assert.ok(card,message); assert.equal(card.cardId,action.cardId,message);
      assert.equal(expected.turn.cardPlays[owner],0,message);
      const definition=CARD_CATALOG[action.cardId]!;
      assert.ok(definition.timing.includes(n===23?'afterOpponentMove':state.turn.phase),message);
      expected.players[owner].hand=expected.players[owner].hand.filter(c=>c.id!==card.id);
      if(action.cardId!=='man-trap') expected.players[owner].discard.push(card);
      const drawn=expected.players[owner].deck.shift(); assert.ok(drawn,message); expected.players[owner].hand.push(drawn);
      expected.turn.cardPlays[owner]++;
      switch(n) {
        case 5: swap('c1','c8');consumes=true;break;
        case 15: assert.equal(at(state.pieces,'h7')?.role,'pawn');relocate('h8','h6');rights=rights.replace('k','');consumes=true;break;
        case 18: swap('h6','f6');break;
        case 23: expected.pieces=structuredClone(beforeCanceledMove.pieces);expected.enPassant=structuredClone(beforeCanceledMove.enPassant);expected.turn={...structuredClone(beforeCanceledMove.turn),cardPlays:{white:0,black:1}};break;
        case 25: capture('c8','white');relocate('d2','c8');break;
        case 30: assert.equal(at(state.pieces,'f8'),undefined);relocate('f7','f8');break;
        case 35: relocate('e7','f7');relocate('f1','e1');break;
        case 39: assert.ok(geometry(state.pieces,at(state.pieces,'e1')!,'a5',true));capture('a5','white');consumes=true;break;
        case 61: assert.equal(at(state.pieces,'g6'),undefined);relocate('e7','g6');consumes=true;break;
        case 81: swap('b8','f3');consumes=true;break;
        case 89: assert.equal(CARD_CATALOG.tournament?.unique,false);assert.equal(state.history.filter(h=>h.type==='cardPlayed').at(-1)?.cardId,'tournament');swap('f3','a3');consumes=true;break;
        case 92: assert.equal(at(state.pieces,'e2')?.owner,'white');expected.effects.push({type:'man-trap',owner:'white',card,square:'e2'});break;
        case 102: { const p=expected.pieces.find(p=>p.id==='black-pawn-a7')!;assert.equal(p.zone,'captured');assert.equal(p.capturedBy,'white');assert.equal(at(state.pieces,'a7'),undefined);p.zone='board';p.square='a7';delete p.capturedBy;consumes=true;resets=true;break; }
        case 113: swap('b8','g3');break;
        default: assert.fail(`Unreviewed card at ${n}`);
      }
      if(consumes) expected.enPassant=[];
    } else {
      assert.equal(action.type,'endTurn',message);
      assert.equal(state.turn.moveMade,true,message);
      expected.turn={color:actor==='white'?'black':'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    }
    if(consumes) { half=resets?0:half+1;full+=actor==='black'?1:0;fenActor=actor==='white'?'b':'w';expected.turn.phase='afterMove';expected.turn.moveMade=true; }
    else if(resets) half=0;
    expected.fen=n===23?beforeCanceledMove.fen:`${boardFen(expected.pieces)} ${fenActor} ${rights&&rights!=='-'?rights:'-'} - ${half} ${full}`;
    const result=applyAction(state,action);
    assert.deepEqual(state,original,`${message}: full input immutability including capturedBy`);
    assert.ok(result.ok,message);
    const after=result.state;
    assert.deepEqual(after.pieces,expected.pieces,`${message}: all physical identities`);
    assert.deepEqual(after.players,expected.players,`${message}: all hand/deck/discard identities`);
    assert.deepEqual(after.turn,expected.turn,`${message}: turn and card allowances`);
    assert.deepEqual(after.effects,expected.effects,`${message}: complete effects`);
    assert.deepEqual(after.enPassant,expected.enPassant,`${message}: en passant lifecycle`);
    assert.equal(after.fen,expected.fen,`${message}: independent board and clocks`);
    assert.equal(after.orientation,0,message);assert.equal(after.outcome,null,message);
    assert.equal(!!after.pendingRescue,n===22||n===24,message);
    if(![22,23,24].includes(n)) assert.equal(checked(expected.pieces,actor),false,`${message}: royal safety`);
    if(n===22||n===24) assert.equal(checked(expected.pieces,'white'),true,message);
    if(action.type==='playCard') {
      const cardActor:Color=n===23?'black':actor;
      // Chaos restores pre-existing White check; every other reviewed card leaves
      // its opponent unchecked, so none can directly produce forbidden mate.
      if(n!==23) assert.equal(checked(expected.pieces,cardActor==='white'?'black':'white'),false,`${message}: no direct card mate`);
    }
    state=after;
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,14);
  assert.deepEqual(replayTrace(trace, 23), state);
  rejectPendingCancellation(state, trace.steps[22]!.action, [{"type":"playCard","cardId":"rebirth","cardInstanceId":"white-hand-3-rebirth","target":[{"from":"d2","to":"c8"}]}]);
});
