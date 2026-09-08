import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed against rules §§8–12,15,17–20 and the thirteen printed cards.
const reasons = [
  '1 Ng1-f3 jumps 1/2 to empty f3.', '2 White closes its safe completed move.',
  '3 Nb8-a6 jumps 1/2 to empty a6.', '4 Black closes its safe completed move.',
  '5 d2-d3 advances one empty square.', '6 White closes its safe completed move.',
  '7 Ra8-b8 crosses no intervening square; queenside rights end.', '8 Black closes its safe completed move.',
  '9 Nf3-e5 jumps to empty e5.', '10 White closes its safe completed move.',
  '11 h7-h6 advances one empty square.', '12 Black closes its safe completed move.',
  '13 d3-d4 advances one empty square.', '14 White closes its safe completed move.',
  '15 Evangelists swaps opposing f8/f1 Bishops instead of moving; no capture.', '16 Black closes the Bishop replacement move.',
  '17 Qd1-d3 traverses empty d2.', '18 White closes its safe completed move.',
  '19 Ke8xf8 captures the swapped Bishop; no white attack reaches f8.', '20 Black closes its safe capture.',
  '21 Ne5xd7 captures the Pawn and checks Kf8.', '22 White may end while checking Black.',
  '23 Ng8-f6 leaves Nd7 checking f8; held Coup c7 is a concrete same-turn cure.',
  '24 Vendetta does not remove Nd7 check; spend it and roll back the provisional Knight move.',
  '25 Qd8xd7 captures the checking Knight and completes the replacement attempt.', '26 Black closes its safe capture.',
  '27 g2-g4 traverses empty g3; no black Pawn can capture en passant.', '28 White closes, retaining the uncapturable opportunity record.',
  '29 h6-h5 advances one empty square and expires g3 opportunity.',
  '30 Coup marks owned Pawn c7 royal and makes f8 Prince; all powers and squares stay.', '31 Black closes with royal identity c7.',
  '32 f2-f4 traverses empty f3; no black Pawn is in capture position.', '33 White closes with the f3 opportunity record.',
  '34 b7-b6 advances to empty b6 and expires f3.', '35 Black closes its safe move.',
  '36 Nb1-d2 jumps to empty d2.', '37 White closes its safe move.',
  '38 Bc8-b7 moves one diagonal.', '39 Black closes its safe move.',
  '40 Resurrection returns captured original Knight g1 to vacant Knight start g1; replaces move.', '41 White closes the return move.',
  '42 Qd7-a4 follows clear c6,b5 diagonal.', '43 Black closes its safe move.',
  '44 Qd3-a3 follows clear c3,b3 rank.', '45 White closes its safe move.',
  '46 Qa4xc2 passes empty b3 and captures white Pawn c2.', '47 Black closes its capture.',
  '48 e2-e3 advances one empty square.', '49 White closes its safe move.',
  '50 b6-b5 advances one empty square.', '51 Black closes its safe move.',
  '52 Ke1-e2 is checked by Bf1; held Holy Quest swapping f1/a6 removes that Bishop.',
  '53 Holy Quest b7/g8 leaves Bf1 checking e2, so spends and rolls King back with rights restored.',
  '54 f4-f5 advances to empty f5; fresh movement token replaces inert King token.', '55 White closes its safe move.',
  '56 Qc2xc1 captures Bishop and checks Ke1 across d1.', '57 Black closes while checking White.',
  '58 Ng1-e2 does not block Qc1-d1-e1; held Forbidden City d1 can cure.',
  '59 Forbidden City g5 cannot block c1-e1; spend and roll Knight back.',
  '60 Ra1xc1 traverses b1 and captures checking Queen; queenside rights end.', '61 White closes its safe capture.',
  '62 Bb7-c6 moves one diagonal.', '63 Black closes its safe move.',
  '64 Irresistible Force pushes Qa3 to empty a4 and Pawn a2-a3 instead of move.',
  '65 Immediate opposing Fog restores both pushed pieces and counters; both cards spent, White may move only.',
  '66 h2-h4 traverses h3; no black Pawn can take en passant; no additional card allowed.',
  '67 White closes and Fog lock expires.',
  '68 Bf1-e2 moves one diagonal.', '69 Black closes its safe move.',
  '70 Qa3-b4 moves one diagonal.', '71 White closes its safe move.',
  '72 Be2-c4 traverses empty d3.', '73 Black closes its safe move.',
  '74 f5-f6 advances one empty square.', '75 White closes its safe move.',
  '76 Bc6-d5 moves one diagonal.', '77 Black closes its safe move.',
  '78 Nd2-b3 jumps to empty b3.', '79 White closes its safe move.',
  '80 Bc4-e2 clears Rc1-c7; held Heresy d5-c5,e2-f2 blocks the royal file.',
  '81 Heresy d5-d6,e2-d2 leaves Rc1-c7 clear; spends and rolls Bishop back.',
  '82 Bd5-g2 follows empty e4,f3; c4 remains blocking Rc1.', '83 Black closes its safe move.',
  '84 Qb4-d6 crosses empty c5 and checks royal c7 diagonally.', '85 White closes while checking Black.',
  '86 e7xd6 captures the checking Queen diagonally forward.', '87 Black closes its safe capture.',
  '88 Rc1-b1 moves one file to empty b1.', '89 White closes its safe move.',
  '90 Prince f8-e7 moves as King but may enter Pawn f6 attack; c7 remains royal.', '91 Black closes with c7 safe.',
  '92 Nb3-c1 jumps to empty c1.', '93 White closes its safe move.',
  '94 Prince e7-e8 moves one square; c7 remains royal.', '95 Black closes its safe move.',
  '96 Passing swaps two distinct Pawn pairs a2/d6,b2/h5 simultaneously; no capture or promotion.',
  '97 White closes replacement Pawn action.',
  '98 Royal Pawn c7xd6 captures diagonally forward; d6 has no white attack.',
  '99 Neutrality marks opposing nonroyal e3 Pawn, retaining white ownership and forward direction.',
  '100 Black closes with retained Neutrality card.',
  '101 White controls neutral e3 Pawn and advances it to e4.',
  '102 Panic starts Black 15000ms next-move obligation without changing board or clocks.',
  '103 White closes while Panic waits for Black.',
  '104 Ng8-h6 jumps to empty h6 and satisfies Panic.',
  '105 Dungeon relocates enemy nonroyal Pawn f6 to empty a8 without promotion; bans its next White move.',
  '106 Black closes with Dungeon obligation active.',
  '107 Nc1xa2 captures black Pawn, leaving Dungeon Pawn unmoved.',
  '108 White closes and Dungeon expires.',
  '109 Na6-c7 jumps to vacated c7.', '110 Black closes its safe move.',
  '111 Ke1-d2 moves one diagonal; neither Bishop nor Pawn attacks d2; castling rights end.',
  '112 White closes its safe completed move.',
];
const cardDeclarations:Record<number,[string,string,unknown]>={
  15:['evangelists','black-hand-3-evangelists',{own:'f8',opponent:'f1'}],
  24:['vendetta','black-hand-1-vendetta',undefined],30:['coup','black-hand-0-coup','c7'],
  40:['resurrection','white-hand-1-resurrection',{pieceId:'white-knight-g1',to:'g1'}],
  53:['holy-quest','white-hand-3-holy-quest',{bishop:'b7',knight:'g8'}],
  59:['forbidden-city','white-deck-0-forbidden-city','g5'],
  64:['irresistible-force','white-deck-1-irresistible-force',[{from:'a2',to:'a3'}]],
  65:['fog-of-war','black-deck-1-fog-of-war',undefined],
  81:['heresy','black-hand-4-heresy',[{from:'d5',to:'d6'},{from:'e2',to:'d2'}]],
  96:['passing-in-the-night','white-deck-2-passing-in-the-night',[{from:'a2',to:'d6'},{from:'b2',to:'h5'}]],
  99:['neutrality','black-deck-3-neutrality','e3'],102:['panic','white-hand-2-panic',undefined],
  105:['dungeon','black-deck-5-dungeon',[{from:'f6',to:'a8'}]],
};

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const at = (pieces: PieceState[], sq: string) => pieces.find(p => p.zone === 'board' && p.square === sq);
const xy = (sq: string) => [sq.charCodeAt(0) - 97, Number(sq[1])] as const;
function attacks(pieces: PieceState[], p: PieceState, to: string, walls: string[] = []): boolean {
  if (!p.square) return false;
  const [x,y] = xy(p.square), [u,v] = xy(to), dx=u-x, dy=v-y;
  if (!dx && !dy || walls.includes(to)) return false;
  if (p.role === 'pawn') return Math.abs(dx) === 1 && dy === (p.owner === 'white' ? 1 : -1);
  if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = !dx || !dy;
  if (!(p.role === 'queen' && (diagonal || straight) || p.role === 'bishop' && diagonal || p.role === 'rook' && straight)) return false;
  for (let i=1;i<Math.max(Math.abs(dx),Math.abs(dy));i++) {
    const sq = String.fromCharCode(97+x+Math.sign(dx)*i)+(y+Math.sign(dy)*i);
    if (at(pieces,sq) || walls.includes(sq)) return false;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color, walls: string[] = []): boolean {
  const king=pieces.find(p=>p.royal && p.owner===color && p.zone==='board')!;
  return pieces.some(p=>p.zone==='board' && (p.owner!==color || p.neutral) && p.id!==king.id && attacks(pieces,p,king.square!,walls)
    && (!p.neutral || (() => {
      // Neutral captures must preserve the prospective controller's own royal.
      const next=structuredClone(pieces), mover=next.find(q=>q.id===p.id)!;
      next.find(q=>q.id===king.id)!.zone='captured'; mover.square=king.square;
      const other=next.find(q=>q.royal && q.owner===opposite(color) && q.zone==='board')!;
      return !next.some(q=>q.zone==='board' && q.owner===color && !q.neutral && attacks(next,q,other.square!,walls));
    })()));
}
function boardFen(pieces: PieceState[]): string {
  const chars={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,r)=>{
    let row='',empty=0;
    for(let f=0;f<8;f++) {const p=at(pieces,String.fromCharCode(97+f)+(8-r));
      if(!p){empty++;continue;} if(empty){row+=empty;empty=0;} const ch=chars[p.role];row+=p.owner==='white'?ch.toUpperCase():ch;
    } return row+(empty||'');
  }).join('/');
}
function immutableApply(s: GameState,a: GameAction): GameState {
  const before=structuredClone(s), payload=structuredClone(a), result=applyAction(s,a);
  assert.deepEqual(s,before,'action input immutable');assert.deepEqual(a,payload,'action payload immutable');
  assert.ok(result.ok,JSON.stringify(a));return result.state;
}
function royalQueries(s: GameState,pieces: PieceState[],walls: string[] = []) {
  for(const color of ['white','black'] as const) {const snap=structuredClone(s);assert.equal(isKingInCheck(s,color),checked(pieces,color,walls),`${color} independent royal geometry`);assert.deepEqual(s,snap,'royal query immutable');}
}
function epQueries(s: GameState,pieces: PieceState[]) {
  for(const ep of s.enPassant) {
    const victim=pieces.find(p=>p.id===ep.pawnId)!;
    const color=opposite(victim.owner), probe=structuredClone(s);
    probe.turn={color,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    probe.pendingRescue=null;probe.shieldMove=undefined;
    const fields=probe.fen.split(' ');fields[1]=color[0]!;probe.fen=fields.join(' ');
    const snap=structuredClone(probe), dests=legalDests(probe);assert.deepEqual(probe,snap,'EP query context immutable');
    for(const pawn of pieces.filter(p=>p.zone==='board' && p.role==='pawn' && (p.owner===color || p.neutral))) {
      let legal=attacks(pieces,pawn,ep.target) && pawn.square?.[1]===victim.square?.[1];
      if(legal){const next=structuredClone(pieces);next.find(p=>p.id===victim.id)!.zone='captured';next.find(p=>p.id===pawn.id)!.square=ep.target;legal=!checked(next,color);}
      assert.equal(dests.get(pawn.square!)?.includes(ep.target) ?? false,legal,'independent EP capture + royal safety');
    }
  }
}

test('iteration 182 independently accounts for every physical transition', () => {
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/182.json',import.meta.url),'utf8')) as RandomTrace;
  assert.equal(trace.steps.length,reasons.length);assert.equal(trace.moves,50);
  let state=createGameState(trace.initial), expected=structuredClone(state);
  const checkpoints=new Map<number,GameState>();
  for(const [index,{action}] of trace.steps.entries()) {
    const n=index+1;assert.ok(reasons[index]!.startsWith(`${n} `));
    const before=structuredClone(state);checkpoints.set(n,before);
    const actor=expected.turn.color;
    const fields=expected.fen.split(' ');
    let active=fields[1]!,rights=fields[2]!,rawEp=fields[3]!,half=Number(fields[4]),full=Number(fields[5]);
    const moveClock=(pawn:boolean,capture=false)=>{half=pawn||capture?0:half+1;full+=actor==='black'?1:0;active=opposite(actor)[0]!;rawEp='-';expected.enPassant=[];expected.turn.phase='afterMove';expected.turn.moveMade=true;};
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to;assert.match(to,/^[a-h][1-8]$/);
      const p=at(expected.pieces,from)!;assert.ok(p);assert.ok(p.owner===actor||p.neutral);
      const victim=at(expected.pieces,to),[x,y]=xy(from),[u,v]=xy(to);
      if(p.role==='pawn' && !victim){assert.equal(x,u);assert.ok(v-y===(p.owner==='white'?1:-1) || y===(p.owner==='white'?2:7) && v-y===(p.owner==='white'?2:-2));assert.equal(at(expected.pieces,String.fromCharCode(97+x)+(y+Math.sign(v-y))),undefined);}
      else assert.ok(attacks(expected.pieces,p,to),'regular movement path');
      if(victim){assert.ok(victim.owner!==actor||victim.neutral);assert.equal(victim.royal,false);victim.zone='captured';victim.square=null;victim.capturedBy=actor;}
      p.square=to as SquareName;
      const event:GameEvent={type:'move',from:from as SquareName,to:to as SquareName,...(victim?{capturedId:victim.id}:{})};expected.history.push(event);
      if(p.role==='king' && p.royal)rights=rights.replace(actor==='white'?/[KQ]/g:/[kq]/g,'');
      if(p.originalRole==='rook') {const right:Record<string,string>={a1:'Q',h1:'K',a8:'q',h8:'k'};rights=rights.replace(right[from]??'!', '');}
      moveClock(p.role==='pawn',!!victim);
      if(p.role==='pawn' && Math.abs(v-y)===2)expected.enPassant=[{target:(from[0]+String((v+y)/2)) as SquareName,pawnId:p.id}];
      expected.shieldMove={player:actor,pieceIds:[p.id],capturedOpponent:!!victim};
      if(n===104)expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='panic');
    } else if(action.type==='endTurn') {
      assert.equal(expected.turn.moveMade,true);assert.equal(checked(expected.pieces,actor),false,'acting royal safe at close');
      expected.turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};expected.shieldMove=undefined;expected.fogLocked=undefined;
      if(n===108)expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='dungeon');
    } else if(action.type==='playCard') {
      assert.deepEqual([action.cardId,action.cardInstanceId,action.target],cardDeclarations[n],'independently recorded declaration');
      const owner:Color=n===65?'black':actor, player=expected.players[owner];
      const card=player.hand.find(c=>c.id===action.cardInstanceId && c.cardId===action.cardId);assert.ok(card,'exact physical card held');
      assert.equal(expected.turn.cardPlays[owner],0);
      assert.equal(expected.turn.phase,[15,40,64,96].includes(n)?'beforeMove':'afterMove');
      player.hand=player.hand.filter(c=>c!==card);player.hand.push(player.deck.shift()!);expected.turn.cardPlays[owner]++;
      if(![30,99].includes(n))player.discard.push(card);
      let movement:NonNullable<GameEvent['movement']>=[],preservePreviousMove=true;
      if([24,53,59,81].includes(n)) {
        const original=checkpoints.get(n-1)!;expected.pieces=structuredClone(original.pieces);expected.enPassant=structuredClone(original.enPassant);
        const f=original.fen.split(' ');[active,rights,rawEp]=[f[1]!,f[2]!,f[3]!];half=Number(f[4]);full=Number(f[5]);
        expected.history=structuredClone(original.history);expected.turn.phase='beforeMove';expected.turn.moveMade=false;
        expected.history.push({type:'cardFizzled',cardId:action.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:false});
      } else {
        if(n===15){at(expected.pieces,'f1')!.square='f8';expected.pieces.find(p=>p.id==='black-bishop-f8')!.square='f1';movement=[{from:'f1',to:'f8'},{from:'f8',to:'f1'}];moveClock(false);preservePreviousMove=false;expected.shieldMove={player:actor,pieceIds:[],capturedOpponent:false};}
        if(n===30){expected.pieces.find(p=>p.id==='black-king-e8')!.royal=false;at(expected.pieces,'c7')!.royal=true;expected.effects.push({type:'coup',owner,card,princeId:'black-king-e8',kingId:'black-pawn-c7',princeRole:'king'});}
        if(n===40){const p=expected.pieces.find(p=>p.id==='white-knight-g1')!;assert.equal(p.zone,'captured');assert.equal(at(expected.pieces,'g1'),undefined);p.zone='board';p.square='g1';delete p.capturedBy;moveClock(false);preservePreviousMove=false;expected.shieldMove={player:actor,pieceIds:[],capturedOpponent:false};}
        if(n===64){at(expected.pieces,'a3')!.square='a4';at(expected.pieces,'a2')!.square='a3';movement=[{from:'a3',to:'a4'},{from:'a2',to:'a3'}];moveClock(true);preservePreviousMove=false;expected.shieldMove={player:actor,pieceIds:['white-queen-d1','white-pawn-a2'],capturedOpponent:false};}
        if(n===65){const original=checkpoints.get(64)!;expected.pieces=structuredClone(original.pieces);expected.enPassant=[];const f=original.fen.split(' ');[active,rights,rawEp]=[f[1]!,f[2]!,f[3]!];half=Number(f[4]);full=Number(f[5]);expected.turn.phase='beforeMove';expected.turn.moveMade=false;expected.shieldMove=undefined;expected.fogLocked=['white'];movement=[{from:'a4',to:'a3'},{from:'a3',to:'a2'}];}
        if(n===96){for(const [id,to] of [['white-pawn-a2','d6'],['white-pawn-b2','h5'],['black-pawn-e7','a2'],['black-pawn-h7','b2']] as const)expected.pieces.find(p=>p.id===id)!.square=to;movement=[{from:'a2',to:'d6'},{from:'b2',to:'h5'},{from:'d6',to:'a2'},{from:'h5',to:'b2'}];moveClock(true);preservePreviousMove=false;expected.shieldMove={player:actor,pieceIds:[],capturedOpponent:false};}
        if(n===99){const p=at(expected.pieces,'e3')!;p.neutral=true;p.neutralBeforeEffects=false;expected.effects.push({type:'neutrality',owner,card,pieceId:p.id});}
        if(n===102)expected.effects.push({type:'panic',owner:'white',player:'black',durationMs:15000});
        if(n===105){const p=at(expected.pieces,'f6')!;assert.equal(at(expected.pieces,'a8'),undefined);p.square='a8';expected.effects.push({type:'dungeon',owner:'black',player:'white',pieceId:p.id});movement=[{from:'f6',to:'a8'}];}
        expected.history.push({type:'cardPlayed',cardId:action.cardId,...(action.target!==undefined?{target:action.target as GameEvent['target']} : {}),...(n===65?{player:owner}:{}),movement,preservePreviousMove});
      }
    } else assert.fail('unreviewed action type');
    expected.fen=`${boardFen(expected.pieces)} ${active} ${rights||'-'} ${rawEp} ${half} ${full}`;
    state=immutableApply(state,action);
    for(const key of ['pieces','players','turn','history','effects','fen','enPassant','shieldMove'] as const)assert.deepEqual(state[key],expected[key],`${n} ${key}: ${reasons[index]}`);
    assert.deepEqual(state.fogLocked??[],expected.fogLocked??[]);
    for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const)assert.equal(state[key],undefined,`${n} ${key}`);
    for(const key of ['plotsAllowances','riposteLostMoves'] as const)assert.deepEqual(state[key]??[],[]);
    assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null);assert.deepEqual(state.underElfHill??[],[]);assert.equal(state.outcome,null);assert.equal(state.orientation,0);
    royalQueries(state,expected.pieces);epQueries(state,expected.pieces);
    if(n===64 || n===65) {
      const cancellationBefore=structuredClone(before);delete cancellationBefore.fogCheckpoint;
      assert.deepEqual(state.fogCheckpoint,{before:cancellationBefore,player:n===64?'white':'black',card:{id:n===64?'white-deck-1-irresistible-force':'black-deck-1-fog-of-war',cardId:n===64?'irresistible-force':'fog-of-war'},historyLength:expected.history.length},'full cancellation checkpoint, without recursive old Fog token');
      assert.deepEqual(state.cardResponse,{player:n===64?'white':'black',historyLength:expected.history.length});
    }
    if([24,53,59,81].includes(n)) {
      // Rollback tokens are historical: an unused allowance cannot reopen after-move timing.
      const probe=structuredClone(state);probe.turn.cardPlays={white:0,black:0};
      const cardId=n===24?'coup':n===81?'neutrality':'panic';
      const card=probe.players[actor].hand.find(c=>c.cardId===cardId)!;assert.ok(card);
      const payload:GameAction={type:'playCard',cardId,cardInstanceId:card.id,...(n===24?{target:'c7'}:n===81?{target:'e3'}:{})};
      const snapshot=structuredClone(probe),actionSnapshot=structuredClone(payload),result=applyAction(probe,payload);
      assert.deepEqual(probe,snapshot);assert.deepEqual(payload,actionSnapshot);assert.equal(result.ok,false,'inert token grants no after-move card permission');
    }
    if([23,52,58,80].includes(n)) {
      assert.ok(state.pendingRescue);assert.deepEqual(state.pendingRescue.before,before);
      assert.equal(state.pendingRescue.fen,before.fen);assert.deepEqual(state.pendingRescue.pieces,before.pieces);assert.deepEqual(state.pendingRescue.enPassant,before.enPassant);assert.equal(state.pendingRescue.historyLength,before.history.length);assert.deepEqual(state.pendingRescue.movedPieceIds,expected.shieldMove!.pieceIds);
      rescueWitness(state,n);
    } else assert.equal(state.pendingRescue??null,null);
  }
  assert.equal(state.fen,trace.finalFen);assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,13);
});

function rescueWitness(state:GameState,n:number) {
  const cardId=n===23?'coup':n===52?'holy-quest':n===58?'forbidden-city':'heresy';
  const target=n===23?'c7':n===52?{bishop:'f1',knight:'a6'}:n===58?'d1':[{from:'d5',to:'c5'},{from:'e2',to:'f2'}];
  const owner=state.turn.color, card=state.players[owner].hand.find(c=>c.cardId===cardId)!;assert.ok(card);
  const expected=structuredClone(state),action:GameAction={type:'playCard',cardId,cardInstanceId:card.id,target};
  const player=expected.players[owner];player.hand=player.hand.filter(c=>c.id!==card.id);player.hand.push(player.deck.shift()!);
  expected.turn.cardPlays[owner]++;let movement:NonNullable<GameEvent['movement']>=[];const walls:string[]=[];
  if(n===23){expected.pieces.find(p=>p.id==='black-king-e8')!.royal=false;at(expected.pieces,'c7')!.royal=true;expected.effects.push({type:'coup',owner,card,princeId:'black-king-e8',kingId:'black-pawn-c7',princeRole:'king'});}
  if(n===52){const bishop=at(expected.pieces,'f1')!,knight=at(expected.pieces,'a6')!;bishop.square='a6';knight.square='f1';movement=[{from:'a6',to:'f1'},{from:'f1',to:'a6'}];player.discard.push(card);}
  if(n===58){walls.push('d1');expected.effects.push({type:'forbidden-city',owner,card,square:'d1'});}
  if(n===80){at(expected.pieces,'d5')!.square='c5';at(expected.pieces,'e2')!.square='f2';movement=[{from:'d5',to:'c5'},{from:'e2',to:'f2'}];player.discard.push(card);}
  expected.history.push({type:'cardPlayed',cardId,target:target as GameEvent['target'],...(n===58?{}:{movement,preservePreviousMove:true})});
  expected.fen=[boardFen(expected.pieces),...state.fen.split(' ').slice(1)].join(' ');
  assert.equal(checked(expected.pieces,owner,walls),false,'independent concrete rescue');
  const saved=immutableApply(state,action);
  for(const key of ['pieces','players','turn','history','effects','fen','enPassant','shieldMove'] as const)assert.deepEqual(saved[key],expected[key],`rescue ${n}: ${key}`);
  assert.equal(saved.pendingRescue??null,null);royalQueries(saved,expected.pieces,walls);
  for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const)assert.equal(saved[key],undefined);
  for(const key of ['plotsAllowances','riposteLostMoves','fogLocked'] as const)assert.deepEqual(saved[key]??[],[]);
  assert.equal(saved.pendingAbduction??null,null);assert.equal(saved.pendingDoomsayer??null,null);assert.deepEqual(saved.underElfHill??[],[]);assert.equal(saved.outcome,null);
  const ended=immutableApply(saved,{type:'endTurn'});
  for(const key of ['pieces','players','history','effects','fen','enPassant'] as const)assert.deepEqual(ended[key],expected[key],`rescue end ${n}: ${key}`);
  assert.deepEqual(ended.turn,{color:opposite(owner),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}});assert.equal(ended.shieldMove,undefined);
}

test('iteration 182 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/182.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
