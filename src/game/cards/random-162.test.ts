import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Every entry was reviewed in order against rules §§8–13, 17 and cards.md.
const rationales = [
 '1 Tournament exchanges opposing g1/b8 Knights; replacement move, no capture.',
 '2 White ends its replacement move; reset both card allowances.',
 '3 Black c7-c6 single pawn step.', '4 Black hands over after c6.',
 '5 White b1-c3 Knight leap.', '6 White hands over after Nc3.',
 '7 Black g7-g6 single pawn step.', '8 Black hands over after g6.',
 '9 White c3-a4 Knight leap.',
 '10 Rebirth returns enemy g1 Knight to its original b8 square, capturing the white Knight there; white is the captor.',
 '11 End turn after Rebirth without another clock increment.',
 '12 Black f7-f5 clears f6; record f6 opportunity but no adjacent white capturer.',
 '13 Retain f6 opportunity into the white before-move window.',
 '14 White b2-b4 clears b3; replaces old opportunity with b3.',
 '15 Retain b3 opportunity; no black pawn can take it.',
 '16 Black d7-d6 expires b3.', '17 End black d6 turn.',
 '18 White a4-c5 Knight leap.', '19 End white Nc5 turn.',
 '20 Black e7-e6 single pawn step.', '21 End black e6 turn.',
 '22 White c1-b2 diagonal to vacated pawn square.', '23 End white Bb2 turn.',
 '24 Black b8-a6 Knight leap.', '25 End black Na6 turn.',
 '26 Masquerade moves white bishop b2-b1 as a Queen without capture; replacement move.',
 '27 End white Masquerade turn.',
 '28 Black Queen d8-c7 diagonal to vacant c7.', '29 End black Qc7 turn.',
 '30 White c5-d7 Knight leap.', '31 End white Nd7 turn.',
 '32 Black royal e8-f7 one diagonal; revoke black castling.', '33 End black Kf7 turn.',
 '34 White g2-g4 clears g3, no black pawn adjacent to g4.', '35 Preserve g3 opportunity.',
 '36 Black h7-h6 single step expires g3.', '37 End black h6 turn.',
 '38 White d7-b8 Knight leap.', '39 End white Nb8 turn.',
 '40 Black e6-e5 single step.', '41 End black e5 turn.',
 '42 White b8-d7 Knight leap.', '43 End white Nd7 turn.',
 '44 Black f7-f6 enters Nd7 attack; held Holy Quest f1/d7 exchanges the attacker with a bishop and cures it.',
 '45 Holy Quest swaps enemy bishop f1 with Knight d7, curing black check without capture.',
 '46 End black rescued turn.',
 '47 White f2-f3 single step.', '48 End white f3 turn.',
 '49 Black d6-d5 single step.', '50 End black d5 turn.',
 '51 White bishop d7xc6 captures physical black c7 Pawn, captor white.', '52 End white Bxc6 turn.',
 '53 Black Queen c7-f7 traverses empty d7,e7.', '54 End black Qf7 turn.',
 '55 White Queen d1-c1 adjacent empty square.', '56 End white Qc1 turn.',
 '57 Black e5-e4 single step.', '58 End black e4 turn.',
 '59 White h2-h4 double step clears h3; no adjacent black capturer.',
 '60 Cathedral swaps a1 Rook and b1 Bishop; opens Ba1-f6 check with Ke7 escape. Non-move preserves clocks and raw h3 EP.',
 '61 End turn with black checked; retained h3 remains uncapturable.',
 '62 Black h6-h5 leaves Ba1 check; held Coup c8 makes safe Bishop c8 the royal.',
 '63 Coup marks black c8 Bishop royal and f6 King a capturable Prince; continuing card stays active.',
 '64 End black Coup rescue.',
 '65 White Bishop c6-b5 single diagonal.', '66 End white Bb5 turn.',
 '67 Black Bishop f8xb4 crosses empty e7,d6,c5 and captures white b2 Pawn.',
 '68 Cowardice retreats enemy white f3 Pawn to empty f2, no capture, unchanged clocks.',
 '69 End black Cowardice turn.',
 '70 Forced March shifts white c2-b2 and f2-g2 sideways; opens Qc1 check on royal c8 with royal Bishop e6 escape.',
 '71 End replacement turn; black receives check.',
 '72 Black Bishop b4-f8 leaves Qc1-c8 check; held Heresy moves enemy b5-c5 to block the file, royal c8-c7 and f8-e8.',
 '73 Heresy moves movable opposing bishop first; white a1 bishop has no orthogonal empty square. Both black bishops change color.',
 '74 White Vulture immediately retrieves black Heresy; discards white top Curse, draws Lost Castle and adds retrieved physical card.',
 '75 End black turn, both allowances reset.',
 '76 White d2-d3 single pawn step.',
 '77 Black Knightmare cancels d2-d3; restores clocks and board, forbids exact white-pawn-d2:d2:d3 token.',
 '78 White royal e1-f2 is a different move; revoke white castling and clear cancellation token.',
 '79 End white alternative move.',
 '80 Black Queen f7-f8 single step.', '81 End black Qf8 turn.',
 '82 White Queen c1-d1 single step.',
 '83 White Man-Trap marks occupied own Rook square h1; persistent square effect, no move.',
 '84 End white Man-Trap turn.',
 '85 Black Rook a8-b8 single step.', '86 End black Rb8 turn.',
 '87 White royal f2-g3 enters royal Bishop c7 diagonal; held Heresy c7-c6,e8-d8,c5-b5 removes the attack.',
 '88 Crab g2 cannot cure that bishop attack; spend card, discard it, restore pre-move f2 position and clocks.',
 '89 White g4xf5 captures black f7 Pawn diagonally; spent allowance remains used.',
 '90 End white capture turn.',
 '91 Black Prince f6-g7 one diagonal; the royal remains Bishop c7.', '92 End black Prince move.',
 '93 White Queen d1-c2 one diagonal.',
 '94 Retrieved Heresy is now played by white: black bishops c7-c8,e8-e7 first, then white c5-b5; blocked a1 stays. Gives Qc2-c8 check with royal Bxf5 escape.',
 '95 End white Heresy turn.',
 '96 Black Prince g7-h7 leaves royal c8 checked; held Fortification wall c7-c8 blocks Qc2-c8.',
 '97 Chosen Fortification d4-e4 does not block the c-file; spend card and restore pre-move Prince g7 and clocks.',
 '98 Royal Bishop c8xf5 traverses empty d7,e6 and captures white g2 Pawn, escaping check.',
 '99 End black royal capture turn.',
 '100 White Knight f1-g3 gives check on royal f5.', '101 End white Ng3 checking turn.',
 '102 Black royal Bishop f5-g4 escapes Knight attack and opens Qf8-f2 check.',
 '103 White Toll reacts to black crossing rank5 to rank4; selected black e4 Pawn is captured by white, clocks reset. White can answer check next turn.',
 '104 End black turn with white checked.',
 '105 White Bishop b5-a4 leaves Qf8 check; held Forbidden City f3 blocks the f-file.',
 '106 Vendetta does not cure Qf8 check; spend, discard and restore b5 and pre-move clocks.',
 '107 White Queen c2-f5 traverses d3,e4 and interposes on the f-file; no capture.',
 '108 End white Qf5 escape.',
 '109 Black g6xf5 captures the white Queen, captor black.', '110 End black pawn capture turn.',
 '111 Lost Castle swaps white b1 Rook with black h8 Rook; replacement move without capture.',
 '112 End white rook-swap turn.',
 '113 Black Queen f8-d8 traverses empty e8.', '114 End black Qd8 turn.',
 '115 White Bishop b5xa6 captures black b8 Knight, captor white.', '116 End white bishop capture turn.',
 '117 Black Queen d8-d7 single step.', '118 End 50th regular-move command with no pending obligations.',
];

const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const sq = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName; };
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);

// Independent geometry operates solely on the expected physical records.
function reaches(pieces: PieceState[], p: PieceState, to: string, capture: boolean): boolean {
  assert.ok(p.square);
  const [x,y] = xy(p.square), [u,v] = xy(to), dx = u-x, dy = v-y;
  if (!dx && !dy) return false;
  if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const direction = p.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === direction;
    return dx === 0 && (dy === direction || dy === direction*2 && (p.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, `${p.square[0]}${y+direction+1}`));
  }
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
  if (!(p.role === 'bishop' ? diagonal : p.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let i = 1; i < Math.max(Math.abs(dx),Math.abs(dy)); i++) {
    if (at(pieces, `${String.fromCharCode(97+x+Math.sign(dx)*i)}${y+Math.sign(dy)*i+1}`)) return false;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color): boolean {
  const royal = pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  assert.ok(royal?.square);
  return pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(pieces,p,royal.square!,true));
}
function placement(pieces: PieceState[]): string {
  const symbols = {pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,i) => {
    let row='', empty=0;
    for (let f=0;f<8;f++) {
      const p=at(pieces,`${String.fromCharCode(97+f)}${8-i}`);
      if (!p) { empty++; continue; }
      if (empty) row+=empty; empty=0;
      const char=symbols[p.role]; row+=p.owner==='white'?char.toUpperCase():char;
    }
    return row+(empty||'');
  }).join('/');
}

test('iteration 162 independent semantic oracle, every physical piece and action', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/162.json', import.meta.url), 'utf8'));
  assert.equal(trace.seed,860162); assert.equal(trace.steps.length,118); assert.equal(rationales.length,118);
  let state=createGameState(trace.initial);
  let pieces=structuredClone(state.pieces), players=structuredClone(state.players), turn=structuredClone(state.turn);
  let effects: unknown[]=[], ep: GameState['enPassant']=[], shield: GameState['shieldMove'];
  let half=0, full=1, active: Color='white', rights='KQkq', rawEp='-', historyLength=0;
  let expectedHistory: GameEvent[]=[];
  let checkpoint: {pieces:PieceState[];ep:GameState['enPassant'];half:number;full:number;active:Color;rights:string;rawEp:string;historyLength:number};
  const cardMoves: Record<number, string[][]> = {
    1:[['g1','b8'],['b8','g1']],10:[['g1','b8']],26:[['b2','b1']],45:[['f1','d7'],['d7','f1']],
    60:[['a1','b1'],['b1','a1']],68:[['f3','f2']],70:[['c2','b2'],['f2','g2']],
    73:[['b5','c5'],['c8','c7'],['f8','e8']],94:[['c7','c8'],['e8','e7'],['c5','b5']],111:[['b1','h8'],['h8','b1']],
  };
  const targets: Record<number,unknown> = {
    1:{own:'g1',opponent:'b8'},10:[{from:'g1',to:'b8'}],26:[{from:'b2',to:'b1'}],45:{bishop:'f1',knight:'d7'},
    60:{rook:'a1',bishop:'b1'},63:'c8',68:[{from:'f3',to:'f2'}],70:[{from:'c2',to:'b2'},{from:'f2',to:'g2'}],
    73:[{from:'b5',to:'c5'},{from:'c8',to:'c7'},{from:'f8',to:'e8'}],74:undefined,77:undefined,83:'h1',88:'g2',
    94:[{from:'c7',to:'c8'},{from:'e8',to:'e7'},{from:'c5',to:'b5'}],97:{from:'d4',to:'e4'},103:'e4',106:undefined,111:{own:'b1',opponent:'h8'},
  };
  const cardIds: Record<number,string> = {
    1:'white-hand-2-tournament',10:'white-hand-1-rebirth',26:'white-deck-0-masquerade',45:'black-hand-2-holy-quest',
    60:'white-hand-3-cathedral',63:'black-deck-0-coup',68:'black-hand-4-cowardice',70:'white-deck-2-forced-march',
    73:'black-deck-1-heresy',74:'white-deck-1-vulture',77:'black-deck-3-knightmare',83:'white-deck-3-man-trap',
    88:'white-hand-4-crab',94:'black-deck-1-heresy',97:'black-hand-0-fortification',103:'white-deck-7-toll',
    106:'white-deck-10-vendetta',111:'white-deck-6-lost-castle',
  };
  const rescue: Record<number,{cardId:string;target:unknown}> = {
    44:{cardId:'holy-quest',target:{bishop:'f1',knight:'d7'}},62:{cardId:'coup',target:'c8'},
    72:{cardId:'heresy',target:[{from:'b5',to:'c5'},{from:'c8',to:'c7'},{from:'f8',to:'e8'}]},
    87:{cardId:'heresy',target:[{from:'c7',to:'c6'},{from:'e8',to:'d8'},{from:'c5',to:'b5'}]},
    96:{cardId:'fortification',target:{from:'c7',to:'c8'}},105:{cardId:'forbidden-city',target:'f3'},
  };
  for (const [index,step] of trace.steps.entries()) {
    const n=index+1, action=step.action, before=state, immutable=structuredClone(before), actor=turn.color;
    assert.ok(rationales[index]!.startsWith(`${n} `));
    const take = (p:PieceState,captor:Color) => { assert.equal(p.royal,false); p.zone='captured'; p.square=null; p.capturedBy=captor; };
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to,p=at(pieces,from); assert.ok(p); assert.equal(p.owner,actor);
      const victim=at(pieces,to); if(victim) assert.notEqual(victim.owner,actor);
      assert.ok(reaches(pieces,p,to,!!victim),`step ${n}: independent move geometry`);
      assert.equal(action.promotion,undefined);
      checkpoint={pieces:structuredClone(pieces),ep:structuredClone(ep),half,full,active,rights,rawEp,historyLength};
      if(victim) take(victim,actor);
      p.square=sq(to); half=p.role==='pawn'||victim?0:half+1; full+=actor==='black'?1:0; active=opposite(actor);
      if(p.royal && p.role==='king') rights=actor==='black'?'KQ':'-';
      ep=p.role==='pawn'&&Math.abs(xy(from)[1]-xy(to)[1])===2?[{target:sq(`${from[0]}${(Number(from[1])+Number(to[1]))/2}`),pawnId:p.id}]:[];
      rawEp='-'; // Every double-step in this trace has no legal adjacent capturing Pawn.
      shield={player:actor,pieceIds:[p.id],capturedOpponent:!!victim}; turn.phase='afterMove'; turn.moveMade=true; historyLength++;
      expectedHistory.push({type:'move',from:sq(from),to:sq(to),...(victim?{capturedId:victim.id}:{}),
        ...(actor==='black'?{movedPieceId:p.id,movedRoles:[p.role]}:{})});
    } else if(action.type==='endTurn') {
      assert.equal(checked(pieces,actor),false,`step ${n}: cannot finish checked`);
      turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}; shield=undefined;
    } else {
      assert.equal(action.type,'playCard'); if(action.type!=='playCard') throw Error('unexpected action');
      assert.deepEqual(action.target,targets[n],`step ${n}: exact reviewed card target`);
      assert.equal(action.cardInstanceId,cardIds[n],`step ${n}: exact reviewed physical card`);
      const owner:Color=players.white.hand.some(c=>c.id===action.cardInstanceId)?'white':'black';
      const hand=players[owner].hand,ci=hand.findIndex(c=>c.id===action.cardInstanceId); assert.ok(ci>=0);
      const card=hand[ci]!; assert.equal(card.cardId,action.cardId); assert.equal(turn.cardPlays[owner],0);
      const meta=CARD_CATALOG[card.cardId]!;
      assert.ok(meta.timing.includes(owner===actor?turn.phase:n===74?'afterOpponentCard':'afterOpponentMove'));
      hand.splice(ci,1); turn.cardPlays[owner]=1;
      if(n===74) players.white.discard.push(players.white.deck.shift()!);
      if(![63,83].includes(n)) players[owner].discard.push(card);
      hand.push(players[owner].deck.shift()!);
      if(n===74) hand.push(players.black.discard.pop()!);
      if([77,88,97,106].includes(n)) {
        assert.ok(checkpoint!);
        ({pieces,ep,half,full,active,rights,rawEp,historyLength}=structuredClone(checkpoint!));
        turn.phase='beforeMove';turn.moveMade=false;
        if(n===77) shield=undefined;
      } else {
        const moves=cardMoves[n];
        if(moves) {
          const moving=moves.map(([from,to])=>({p:at(pieces,from!)!,to:sq(to!)}));
          assert.ok(moving.every(m=>m.p));
          if(n===10) { take(at(pieces,'b8')!,'white');half=0; }
          for(const m of moving) m.p.square=m.to;
        }
        if([1,26,70,111].includes(n)) {
          turn.moveMade=true;turn.phase='afterMove';active=opposite(actor); ep=[];rawEp='-';half=n===70?0:half+1;
          shield={player:actor,capturedOpponent:false,pieceIds:n===26?['white-bishop-c1']:n===70?['white-pawn-c2','white-pawn-f2']:[]};
        }
        if(n===60) {rights='KA';rawEp='h3';}
        if(n===63) {
          at(pieces,'c8')!.royal=true;at(pieces,'f6')!.royal=false;
          effects.push({type:'coup',owner:'black',card,princeId:'black-king-e8',kingId:'black-bishop-c8',princeRole:'king'});
        }
        if(n===83) effects.push({type:'man-trap',owner:'white',card,square:'h1'});
        if(n===103) {take(at(pieces,'e4')!,'white');half=0;}
      }
      historyLength++;
      if([77,88,97,106].includes(n)) expectedHistory.pop();
      if([88,97,106].includes(n)) expectedHistory.push({type:'cardFizzled',cardId:card.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:false});
      else if(n===77) expectedHistory.push({type:'cardPlayed',cardId:card.cardId,player:'black',movement:[{from:'d3',to:'d2'}],preservePreviousMove:true});
      else {
        const movement=(n===45?[['d7','f1'],['f1','d7']]:cardMoves[n]??[]).map(([from,to])=>({from:sq(from!),to:sq(to!)}));
        expectedHistory.push({type:'cardPlayed',cardId:card.cardId,
          ...(![74,83].includes(n)?{target:action.target as GameEvent['target']}:{}),
          ...([74,103].includes(n)?{player:'white' as const}:{}),
          ...(n===10?{capturedId:'white-knight-g1'}:n===103?{capturedId:'black-pawn-e7'}:{}),
          movement,preservePreviousMove:![1,26,70,111].includes(n)});
      }
    }
    const result=applyAction(before,action); assert.deepEqual(before,immutable,`step ${n}: input immutability`); assert.ok(result.ok,`step ${n}: accepted`);state=result.state;
    assert.deepEqual(state.pieces,pieces,`step ${n}: all physical identities, squares, roles, zones and captors`);
    assert.equal(state.fen,`${placement(pieces)} ${active[0]} ${rights} ${rawEp} ${half} ${full}`,`step ${n}: six FEN fields`);
    assert.deepEqual(state.players,players,`step ${n}: complete physical card accounting`);
    assert.deepEqual(state.turn,turn,`step ${n}: phase and allowance`);assert.equal(state.history.length,historyLength);
    assert.deepEqual(state.history,expectedHistory,`step ${n}: exact history including cancellation and fizzle rewinds`);
    assert.deepEqual(state.effects,effects);assert.deepEqual(state.enPassant,ep);assert.equal(state.orientation,0);
    for(const color of ['white','black'] as const) assert.equal(isKingInCheck(state,color),checked(pieces,color),`step ${n}: independent ${color} royal threats`);
    if([60,70,94].includes(n)) {
      const escape=structuredClone(pieces),from=n===60?'f6':'c8',to=n===60?'e7':n===70?'e6':'f5';
      const royal=at(escape,from)!;assert.equal(royal.royal,true);
      const victim=at(escape,to);assert.ok(reaches(escape,royal,to,!!victim));
      if(victim) {assert.equal(victim.owner,'white');victim.zone='captured';victim.square=null;}
      royal.square=sq(to);assert.equal(checked(escape,'black'),false,`step ${n}: card check is not direct mate`);
    }
    assert.deepEqual(state.shieldMove,shield,`step ${n}: full shield movement`);
    assert.deepEqual(state.chaosForbidden,n===77?{player:'white',movement:'white-pawn-d2:d2:d3'}:undefined);
    assert.equal(state.plotsExecution,undefined);assert.deepEqual(state.plotsAllowances??[],[]);assert.deepEqual(state.fogLocked??[],[]);
    assert.deepEqual(state.riposteLostMoves??[],[]);assert.equal(state.riposteSkipped,undefined);assert.equal(state.riposteCheckDeferred,undefined);
    assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null);assert.deepEqual(state.underElfHill??[],[]);assert.equal(state.outcome,null);
    if(rescue[n]) {
      const pending=state.pendingRescue;assert.ok(pending);
      assert.deepEqual(pending.before,before);assert.equal(pending.fen,before.fen);assert.deepEqual(pending.pieces,checkpoint!.pieces);
      assert.deepEqual(pending.enPassant,checkpoint!.ep);assert.equal(pending.historyLength,checkpoint!.historyLength);
      assert.deepEqual(pending.movedPieceIds,shield!.pieceIds);
      const witness=rescue[n]!,card=players[actor].hand.find(c=>c.cardId===witness.cardId);assert.ok(card);
      const witnessBoard=structuredClone(pieces);
      if(n===44) {at(witnessBoard,'f1')!.square='d7';witnessBoard.find(p=>p.id==='white-knight-b1')!.square='f1';}
      if(n===62) {at(witnessBoard,'f6')!.royal=false;at(witnessBoard,'c8')!.royal=true;}
      if(n===72||n===87) {
        const moves=witness.target as Array<{from:string;to:string}>;
        const moving=moves.map(m=>({p:at(witnessBoard,m.from)!,to:sq(m.to)}));
        for(const m of moving) {assert.ok(m.p);m.p.square=m.to;}
      }
      const witnessInput=structuredClone(state);
      const saved=applyAction(state,{type:'playCard',cardId:card.cardId,cardInstanceId:card.id,target:witness.target});
      assert.deepEqual(state,witnessInput,`step ${n}: rescue witness input immutability`);
      assert.ok(saved.ok,`step ${n}: concrete held rescue accepted`);assert.equal(saved.state.pendingRescue??null,null);
      assert.deepEqual(saved.state.pieces,witnessBoard,`step ${n}: independent rescue physical result`);
      assert.equal(isKingInCheck(saved.state,actor),false,`step ${n}: concrete rescue cures check`);
      // Each listed wall blocks the sole straight ray; other witnesses physically remove the attacker or royal.
      if(n!==96&&n!==105) assert.equal(checked(witnessBoard,actor),false);
      else {
        const king=pieces.find(p=>p.royal&&p.owner===actor)!;
        const attackers=pieces.filter(p=>p.zone==='board'&&p.owner!==actor&&reaches(pieces,p,king.square!,true));
        assert.deepEqual(attackers.map(p=>p.id),[n===96?'white-queen-d1':'black-queen-d8']);
        assert.deepEqual([attackers[0]!.square,king.square],n===96?['c2','c8']:['f8','f2']);
        assert.deepEqual(saved.state.effects,[...effects,n===96?{type:'fortification',owner:actor,card,from:'c7',to:'c8'}:
          {type:'forbidden-city',owner:actor,card,square:'f3'}]);
      }
    } else assert.equal(state.pendingRescue??null,null,`step ${n}: no unexplained rescue`);
    if(ep.length) {
      const capturer=opposite(pieces.find(p=>p.id===ep[0]!.pawnId)!.owner);
      const prospective={...state,turn:{...state.turn,color:capturer,phase:'beforeMove' as const,moveMade:false}};
      const destinations=legalDests(prospective);
      for(const p of pieces.filter(p=>p.owner===capturer&&p.role==='pawn'&&p.zone==='board')) {
        assert.equal(reaches(pieces,p,ep[0]!.target,true),false,'no adjacent EP capturer in this trace');
        assert.equal(destinations.get(p.square!)?.includes(ep[0]!.target)??false,false);
      }
    }
  }
  assert.equal(trace.moves,50);assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,18);
  assert.equal(state.fen,trace.finalFen);
});

test('iteration 162 deterministic replay', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/162.json', import.meta.url), 'utf8'));
  assert.ok(replayTrace(trace));
});
