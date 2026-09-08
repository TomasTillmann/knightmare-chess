import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

const rationales = [
  '1. Ng1-h3 is an unobstructed knight jump.',
  '2. White ends its completed knight move; no card or board change.',
  '3. Pd7-d6 advances one empty square.',
  '4. Black ends its completed pawn move.',
  '5. Nh3-g5 is a knight jump to an empty square.',
  '6. White Rebirth returns enemy b7 Pawn to vacant starting-rank d7, after the move.',
  '7. White ends; Rebirth remains spent and its replacement remains drawn.',
  '8. Pd6-d5 advances one empty square.',
  '9. Black ends its completed pawn move.',
  '10. Rh1-g1 moves horizontally; White loses kingside rights.',
  '11. White ends its rook move.',
  '12. Ng8-h6 is a knight jump.',
  '13. Black ends its knight move.',
  '14. Pd2-d4 crosses empty d3 from the starting rank; stores d3 opportunity.',
  '15. White ends; no black Pawn can capture d3 en passant.',
  '16. Pc7-c6 advances one square and expires the d3 opportunity.',
  '17. Black ends its pawn move.',
  '18. Pe2-e4 crosses empty e3; stores e3 opportunity.',
  '19. White ends; black d5 Pawn is on rank five, not rank four, so cannot capture e3.',
  '20. Nh6-g8 jumps back and expires en passant.',
  '21. Black ends its knight move.',
  '22. Before moving White Disintegration makes its d4 Pawn dead, without granting a move.',
  '23. Bc1-e3 crosses vacant d2; dead d-Pawn stays dead.',
  '24. White ends; its card allowance resets on the next turn.',
  '25. Ng8-h6 is another legal knight jump.',
  '26. Black ends its knight move.',
  '27. Be3-f4 moves one diagonal square.',
  '28. White ends its bishop move.',
  '29. Pf7-f5 crosses vacant f6; stores f6 opportunity.',
  '30. Black ends; no white Pawn on e5/g5 can capture en passant.',
  '31. Bf1-a6 crosses e2,d3,c4,b5, all empty.',
  '32. White ends its bishop move.',
  '33. Pd5xe4 captures the white e-Pawn, attributed to Black.',
  '34. White Plots responds to Black capture; only held Revenge has legal original timing.',
  '35. Black ends; unused two-card Plots allowance expires.',
  '36. Ke1-f1 steps to a safe square and revokes remaining White castling rights.',
  '37. White ends its king move.',
  '38. Qd8-b6 crosses empty c7.',
  '39. Black ends its queen move.',
  '40. Rg1-h1 is one horizontal square; castling rights do not return.',
  '41. White ends its rook move.',
  '42. Qb6-a5 is one diagonal square.',
  '43. Black ends its queen move.',
  '44. Qd1-e1 is one horizontal square, subject to immediate cancellation.',
  '45. Black Chaos returns that Queen to d1, restores all move state, and forbids d1-e1.',
  '46. Bf4xb8 crosses e5,d6,c7 and captures the black b8 Knight; this differs from canceled move.',
  '47. White ends; Black reaction allowance resets.',
  '48. Reborn black Pawn d7-d5 crosses d6; physical b7 identity survives.',
  '49. Black ends; no white Pawn can capture d6 en passant.',
  '50. Bb8-c7 moves diagonally and expires d6.',
  '51. Heresy moves enemy Bishops c8-d8,f8-f7 first, then c7-c8,a6-b6; each changes square color.',
  '52. White ends after all four mandatory Heresy moves.',
  '53. Bd8xb6 crosses now-empty c7 and captures White original f1 Bishop.',
  '54. Black ends the bishop capture.',
  '55. Nb1-c3 is a knight jump.',
  '56. White ends its knight move.',
  '57. Bb6-c5 moves diagonally.',
  '58. Black Haunting copies nonunique Heresy: White c8-b8 first, Black c5-b5,f7-f8; b5 checks f1. The concrete step-60 move plus step-61 held Haunting cure independently proves an escape, so this is not direct mate.',
  '59. Black may end while checking White along b5-c4-d3-e2-f1.',
  '60. Pa2-a4 leaves that check provisionally; held Haunting can shift b5-c5,f8-f7,b8-b7 to cure it.',
  '61. White Haunting repeats Heresy, enemy Bishops first; c5 no longer attacks f1, fully curing check.',
  '62. White ends the verified cure; raw a3 serialization survives, but no black Pawn can capture there.',
  '63. Ke8-d7 steps to safety and revokes Black castling rights.',
  '64. Black ends its king move.',
  '65. Ra1-c1 crosses vacant b1.',
  '66. White ends its rook move.',
  '67. Ra8-g8 crosses b8,c8,d8,e8,f8, all empty.',
  '68. Black ends its rook move.',
  '69. Qd1-e1 is legal again because the Chaos replacement obligation ended at step 46.',
  '70. White Fireball explodes moved e1 Queen and adjacent f2 Pawn; adjacent royal f1 King survives.',
  '71. White ends; both blast victims stay captured by White.',
  '72. Bc5-b4 moves diagonally.',
  '73. Black ends its bishop move.',
  '74. White Doppelganger copies that Bishop: non-Pawn Rc1-f4 crosses d2,e3 without capture, replacing move.',
  '75. White ends the replacement move; no extra regular move is granted.',
  '76. Kd7-d6 steps to a safe square.',
  '77. Black ends its king move.',
  '78. Kf1-e2 steps diagonally to safety.',
  '79. White ends its king move.',
  '80. Rg8-e8 crosses f8; Bog in enemy hand gives reversible previous-FEN metadata.',
  '81. Black ends its rook move.',
  '82. Ng5-h3 is a knight jump.',
  '83. White ends its knight move.',
  '84. Kd6-e5 steps diagonally to safety.',
  '85. Black ends its king move.',
  '86. Rh1-d1 crosses g1,f1,e1, all vacant.',
  '87. White ends its rook move.',
  '88. Bb4-a3 moves diagonally.',
  '89. Black ends its bishop move.',
  '90. Rf4-f1 crosses f3,f2, cleared by Fireball.',
  '91. White ends its rook move.',
  '92. Bf7-g8 moves diagonally.',
  '93. Black ends its bishop move.',
  '94. Rd1-e1 moves horizontally.',
  '95. White ends its rook move.',
  '96. Ke5-f6 steps diagonally to safety.',
  '97. Black ends its king move.',
  '98. Bb7-a6 moves diagonally.',
  '99. Figure Dance moves the sole corner occupant Rh8-a8 counterclockwise; no capture or clock advance.',
  '100. White ends; Figure Dance remains spent.',
  '101. Pg7-g5 crosses empty g6 and stores g6 opportunity.',
  '102. Black ends; no white Pawn on f5/h5 can capture en passant.',
  '103. Re1-a1 crosses d1,c1,b1 and expires g6.',
  '104. White ends its rook move.',
  '105. Bg8-e6 crosses empty f7; retains previous-FEN metadata for held enemy Bog.',
  '106. Black Cathedral swaps physical a8 Rook and a3 Bishop; no capture, clock advance or new moved identity.',
  '107. Black ends after the simultaneous swap.',
  '108. Ba6-b5 moves diagonally.',
  '109. White ends its bishop move.',
  '110. Qa5-b6 moves diagonally to an empty square.',
  '111. Black ends; White begins turn 26, with no pending obligation.',
];

const cards: Record<number, { owner: Color; action: GameAction; moves: Array<[SquareName, SquareName]> }> = {
  6: { owner: 'white', action: { type: 'playCard', cardId: 'rebirth', cardInstanceId: 'white-hand-1-rebirth', target: [{ from: 'b7', to: 'd7' }] }, moves: [['b7','d7']] },
  22: { owner: 'white', action: { type: 'playCard', cardId: 'disintegration', cardInstanceId: 'white-hand-0-disintegration', target: 'd4' }, moves: [] },
  34: { owner: 'white', action: { type: 'playCard', cardId: 'plots-within-plots', cardInstanceId: 'white-hand-4-plots-within-plots', target: { player: 'white' } }, moves: [] },
  45: { owner: 'black', action: { type: 'playCard', cardId: 'chaos', cardInstanceId: 'black-hand-2-chaos' }, moves: [['e1','d1']] },
  51: { owner: 'white', action: { type: 'playCard', cardId: 'heresy', cardInstanceId: 'white-hand-2-heresy', target: [{from:'c8',to:'d8'},{from:'f8',to:'f7'},{from:'c7',to:'c8'},{from:'a6',to:'b6'}] }, moves: [['c8','d8'],['f8','f7'],['c7','c8'],['a6','b6']] },
  58: { owner: 'black', action: { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: 'black-hand-1-haunting-memories', target: [{from:'c8',to:'b8'},{from:'c5',to:'b5'},{from:'f7',to:'f8'}] }, moves: [['c8','b8'],['c5','b5'],['f7','f8']] },
  61: { owner: 'white', action: { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: 'white-deck-2-haunting-memories', target: [{from:'b5',to:'c5'},{from:'f8',to:'f7'},{from:'b8',to:'b7'}] }, moves: [['b5','c5'],['f8','f7'],['b8','b7']] },
  70: { owner: 'white', action: { type: 'playCard', cardId: 'fireball', cardInstanceId: 'white-deck-4-fireball', target: 'e1' }, moves: [] },
  74: { owner: 'white', action: { type: 'playCard', cardId: 'doppelganger', cardInstanceId: 'white-hand-3-doppelganger', target: [{from:'c1',to:'f4'}] }, moves: [['c1','f4']] },
  99: { owner: 'white', action: { type: 'playCard', cardId: 'figure-dance', cardInstanceId: 'white-deck-3-figure-dance', target: [] }, moves: [['h8','a8']] },
  106: { owner: 'black', action: { type: 'playCard', cardId: 'cathedral', cardInstanceId: 'black-deck-0-cathedral', target: {rook:'a8',bishop:'a3'} }, moves: [['a3','a8'],['a8','a3']] },
};
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1])];
function attacks(pieces: PieceState[], p: PieceState, target: string): boolean {
  const [x,y] = xy(p.square!), [u,v] = xy(target), dx = u! - x!, dy = v! - y!;
  if (!dx && !dy) return false;
  if (p.role === 'pawn') return Math.abs(dx) === 1 && dy === (p.owner === 'white' ? 1 : -1);
  if (p.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  const straight = dx === 0 || dy === 0, diagonal = Math.abs(dx) === Math.abs(dy);
  if (!(p.role === 'rook' ? straight : p.role === 'bishop' ? diagonal : straight || diagonal)) return false;
  for (let i=1;i<Math.max(Math.abs(dx),Math.abs(dy));i++) {
    if (at(pieces, String.fromCharCode(97+x!+i*Math.sign(dx))+(y!+i*Math.sign(dy)))) return false;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  return pieces.some(p => p.zone === 'board' && p.owner !== color && attacks(pieces,p,king.square!));
}
function placement(pieces: PieceState[]): string {
  const letters = {pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,i) => {
    let row='',empty=0;
    for(let x=0;x<8;x++) {
      const p=at(pieces,String.fromCharCode(97+x)+(8-i));
      if(!p) {empty++;continue;}
      if(empty) {row+=empty;empty=0;}
      row+=p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return row+(empty || '');
  }).join('/');
}
function immutableApply(state: GameState, action: GameAction) {
  const saved=structuredClone(state), command=structuredClone(action);
  const result=applyAction(state,action);
  assert.deepEqual(state,saved,'GameState mutation');
  assert.deepEqual(action,command,'GameAction payload mutation');
  return result;
}

test('iteration 202: 111 independently reviewed actions, exact identities and rescue', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/202.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed,860202);
  assert.equal(rationales.length,111);
  assert.equal(trace.steps.length,rationales.length);
  let state=createGameState(trace.initial), pieces=structuredClone(state.pieces), players=structuredClone(state.players);
  let turn=structuredClone(state.turn), history: GameEvent[]=[], ep: GameState['enPassant']=[], shield: GameState['shieldMove'];
  const played: NonNullable<GameState['playedCards']>=[];
  let cardResponse: GameState['cardResponse'];
  let half=0,full=1,rights='KQkq',fenColor:Color='white';
  let beforeCanceled: GameState | undefined;
  let rescueBefore: GameState | undefined;
  let moves=0,cardCount=0;
  for(const [index,step] of trace.steps.entries()) {
    const n=index+1,action=step.action,label=rationales[index]!;
    assert.ok(label.startsWith(`${n}.`));
    const prior=structuredClone(state), actor=turn.color;
    if(action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to;
      assert.match(from,/^[a-h][1-8]$/);assert.match(to,/^[a-h][1-8]$/);
      const mover=at(pieces,from)!, victim=at(pieces,to);
      assert.ok(mover,label);assert.equal(mover.owner,actor);assert.equal(turn.moveMade,false);
      if(mover.role === 'pawn') {
        const [x,y]=xy(from),[u,v]=xy(to),direction=actor === 'white'?1:-1;
        if(victim) {assert.equal(Math.abs(u!-x!),1);assert.equal(v!-y!,direction);}
        else {assert.equal(x,u);assert.ok(v! - y! === direction || y === (actor==='white'?2:7) && v! - y! === 2*direction);assert.equal(at(pieces,from[0]!+(y!+direction)),undefined);}
      } else assert.ok(attacks(pieces,mover,to),label);
      if(victim) {assert.equal(victim.owner,opposite(actor));assert.equal(victim.royal,false);victim.square=null;victim.zone='captured';victim.capturedBy=actor;}
      if(n===44) beforeCanceled=prior;
      if(n===60) rescueBefore=prior;
      mover.square=to as SquareName;
      if(mover.royal) rights=rights.replace(actor==='white'?/[KQ]/g:/[kq]/g,'');
      if(from==='h1') rights=rights.replace('K','');
      if(from==='a1') rights=rights.replace('Q','');
      half=mover.role==='pawn'||victim?0:half+1;
      if(actor==='black')full++;
      fenColor=opposite(actor);
      ep=mover.role==='pawn'&&Math.abs(Number(to[1])-Number(from[1]))===2 ? [{target:(from[0]!+((Number(to[1])+Number(from[1]))/2)) as SquareName,pawnId:mover.id}]:[];
      turn.phase='afterMove';turn.moveMade=true;
      shield={player:actor,pieceIds:[mover.id],capturedOpponent:!!victim};
      history.push({type:'move',from:from as SquareName,to:to as SquareName,...(victim?{capturedId:victim.id}:{}),...([80,105].includes(n)?{previousFen:prior.fen}:{})});
      moves++;
    } else if(action.type === 'playCard') {
      const spec=cards[n]!;assert.ok(spec,label);assert.deepEqual(action,spec.action);
      const owner=spec.owner, player=players[owner], physical=player.hand.find(c=>c.id===action.cardInstanceId);
      assert.ok(physical);assert.equal(physical.cardId,action.cardId);assert.equal(turn.cardPlays[owner],0);
      assert.equal(turn.phase,n===22||n===74?'beforeMove':'afterMove');
      assert.equal(owner===actor,n!==34&&n!==45);
      player.hand=player.hand.filter(c=>c.id!==physical.id);player.discard.push(physical);player.hand.push(player.deck.shift()!);
      turn.cardPlays[owner]++;played.push({player:owner,cardInstanceId:physical.id});
      if(n===45) {
        assert.ok(beforeCanceled);pieces=structuredClone(beforeCanceled.pieces);ep=structuredClone(beforeCanceled.enPassant);
        const f=beforeCanceled.fen.split(' ');half=Number(f[4]);full=Number(f[5]);fenColor='white';
        history.pop();turn.phase='beforeMove';turn.moveMade=false;shield=undefined;
      } else if(n===22) {
        const pawn=at(pieces,'d4')!;assert.equal(pawn.owner,'white');assert.equal(pawn.role,'pawn');pawn.square=null;pawn.zone='dead';delete pawn.capturedBy;
      } else if(n===70) {
        assert.deepEqual(shield,{player:'white',pieceIds:['white-queen-d1'],capturedOpponent:false});
        const victims=pieces.filter(p=>p.zone==='board'&&!p.royal&&Math.max(Math.abs(xy(p.square!)[0]!-4),Math.abs(xy(p.square!)[1]!-1))<=1);
        assert.deepEqual(victims.map(p=>p.id),['white-queen-d1','white-pawn-f2']);
        for(const p of victims){p.square=null;p.zone='captured';p.capturedBy='white';}half=0;
      } else {
        const selected=spec.moves.map(([from,to])=>({p:at(pieces,from)!,from,to}));
        if([51,58,61].includes(n)) {
          assert.equal(selected.length,pieces.filter(p=>p.zone==='board'&&p.role==='bishop').length);
          for(const {p,from,to} of selected) {
            assert.equal(p.role,'bishop');assert.equal(Math.abs(xy(from)[0]!-xy(to)[0]!)+Math.abs(xy(from)[1]!-xy(to)[1]!),1);
            assert.equal(at(pieces,to),undefined);p.square=to;
          }
        } else {
          if(n===74) {
            assert.equal(selected[0]!.p.role,'rook');assert.ok(attacks(pieces,{...selected[0]!.p,role:'bishop'},'f4'));
            assert.equal(at(pieces,'f4'),undefined);assert.deepEqual(history.at(-1),{type:'move',from:'c5',to:'b4'});
            half++;fenColor='black';turn.phase='afterMove';turn.moveMade=true;ep=[];
            shield={player:'white',pieceIds:['white-rook-a1'],capturedOpponent:false};
          }
          for(const {p,to} of selected)p.square=to;
        }
      }
      const event:GameEvent={type:'cardPlayed',cardId:action.cardId};
      if(action.target!==undefined && n!==34) event.target=action.target as GameEvent['target'];
      if([34,45,58,61,70].includes(n))event.player=owner;
      if(n===58||n===61)event.copiedCardId='heresy';
      if(n===70)event.capturedIds=['white-queen-d1','white-pawn-f2'];
      event.movement=spec.moves.map(([from,to])=>({from,to}));event.preservePreviousMove=n!==22&&n!==74;
      history.push(event);cardCount++;
      cardResponse={player:owner,historyLength:history.length};
    } else {
      assert.equal(action.type,'endTurn');assert.equal(turn.moveMade,true);assert.equal(checked(pieces,actor),false,label);
      turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};shield=undefined;
      cardResponse=undefined;
    }
    const result=immutableApply(state,action);assert.ok(result.ok,label);state=result.state;
    assert.deepEqual(state.pieces,pieces,`${label}: every physical identity and capture actor`);
    assert.deepEqual(state.players,players,`${label}: full hand/deck/discard physical accounting`);
    assert.deepEqual(state.history,history,`${label}: complete history including canceled move removal`);
    assert.deepEqual(state.turn,turn,label);assert.deepEqual(state.effects,[]);assert.equal(state.orientation,0);assert.equal(state.outcome,null);
    assert.deepEqual(state.playedCards??[],played);
    assert.deepEqual(state.cardResponse,cardResponse,`${label}: exact response owner and history window`);
    const rawEp=n>=60&&n<=62?'a3':'-';
    assert.equal(state.fen,[placement(pieces),fenColor==='white'?'w':'b',rights||'-',rawEp,half,full].join(' '),`${label}: six FEN fields`);
    assert.deepEqual(state.enPassant,ep,label);
    assert.deepEqual(state.shieldMove,shield,label);
    assert.deepEqual(state.chaosForbidden,n===45?{player:'white',movement:'white-queen-d1:d1:e1'}:undefined);
    assert.equal(state.plotsExecution,undefined);assert.deepEqual(state.fogLocked??[],[]);
    assert.deepEqual(state.riposteLostMoves??[],[]);assert.equal(state.riposteSkipped,undefined);assert.equal(state.riposteCheckDeferred,undefined);
    assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null);assert.deepEqual(state.underElfHill??[],[]);
    assert.deepEqual(state.plotsAllowances??[],n===34?[{player:'white',remaining:2,eligibleCards:['white-deck-0-revenge'],window:{phase:'afterMove',moveMade:true,shieldMove:{player:'black',pieceIds:['black-pawn-d7'],capturedOpponent:true},reaction:{type:'move',from:'d5',to:'e4',capturedId:'white-pawn-e2'},capture:{type:'move',from:'d5',to:'e4',capturedId:'white-pawn-e2'},legacyCapture:{historyLength:18,pieceIds:['white-pawn-e2']},cardResponse:undefined,fogCheckpoint:undefined}}]:[]);
    const querySnapshot=structuredClone(state);
    for(const color of ['white','black'] as const) assert.equal(isKingInCheck(state,color),checked(pieces,color),`${label}: independent royal attacks for ${color}`);
    assert.deepEqual(state,querySnapshot,'royal query mutation');
    if(action.type==='move'||action.type==='playCard') {
      assert.equal(checked(pieces,actor),n===60,`${label}: acting King safe except proven provisional rescue`);
      if(action.type==='playCard')assert.equal(checked(pieces,cards[n]!.owner),false,`${label}: card player's King safe`);
    }
    // Every stored EP opportunity here lacks an opposing Pawn on an adjacent capture rank.
    for(const opportunity of ep) {
      const pawn=pieces.find(p=>p.id===opportunity.pawnId)!;
      const capturing=opposite(pawn.owner), [x,y]=xy(pawn.square!);
      const candidates=pieces.filter(p=>p.zone==='board'&&p.owner===capturing&&p.role==='pawn'&&xy(p.square!)[1]===y&&Math.abs(xy(p.square!)[0]!-x!)===1);
      assert.deepEqual(candidates,[]);
      const probe=structuredClone(state);probe.turn={color:capturing,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      const copy=structuredClone(probe),dests=legalDests(probe);
      for(const p of pieces.filter(p=>p.zone==='board'&&p.owner===capturing&&p.role==='pawn'))assert.equal(dests.get(p.square!)?.includes(opportunity.target)??false,false);
      assert.deepEqual(probe,copy,'EP query mutation');
    }
    if(n===45) {
      const repeated=immutableApply(state,{type:'move',from:'d1',to:'e1'});assert.equal(repeated.ok,false);assert.deepEqual(repeated.state,state);
    }
    if(n===60) {
      assert.ok(rescueBefore);
      assert.deepEqual(state.pendingRescue,{before:rescueBefore,fen:rescueBefore.fen,pieces:rescueBefore.pieces,enPassant:rescueBefore.enPassant,historyLength:rescueBefore.history.length,movedPieceIds:['white-pawn-a2']});
      const failedEnd=immutableApply(state,{type:'endTurn'});assert.equal(failedEnd.ok,false);
      const cure=immutableApply(state,structuredClone(cards[61]!.action));assert.ok(cure.ok);
      const expectedPieces=structuredClone(pieces);
      for(const [from,to] of cards[61]!.moves)at(expectedPieces,from)!.square=to;
      const expectedPlayers=structuredClone(players),p=expectedPlayers.white,c=p.hand.find(c=>c.id==='white-deck-2-haunting-memories')!;
      p.hand=p.hand.filter(x=>x.id!==c.id);p.discard.push(c);p.hand.push(p.deck.shift()!);
      assert.deepEqual(cure.state.pieces,expectedPieces);assert.deepEqual(cure.state.players,expectedPlayers);assert.deepEqual(cure.state.effects,[]);
      assert.deepEqual(cure.state.history,[...history,{type:'cardPlayed',cardId:'haunting-memories',target:[{from:'b5',to:'c5'},{from:'f8',to:'f7'},{from:'b8',to:'b7'}],copiedCardId:'heresy',player:'white',movement:[{from:'b5',to:'c5'},{from:'f8',to:'f7'},{from:'b8',to:'b7'}],preservePreviousMove:true}]);
      assert.equal(cure.state.fen,'r3k2r/pB2pbpp/2p4n/q1bp1pN1/P3p3/2N5/1PP2PPP/R2Q1K1R b kq a3 0 14');
      assert.deepEqual(cure.state.enPassant,[{target:'a3',pawnId:'white-pawn-a2'}]);assert.equal(cure.state.pendingRescue,null);
      assert.deepEqual(cure.state.turn,{color:'white',phase:'afterMove',moveMade:true,cardPlays:{white:1,black:0}});
      assert.deepEqual(cure.state.shieldMove,shield);assert.equal(checked(expectedPieces,'white'),false);
      assert.deepEqual(cure.state.playedCards,[...played,{player:'white',cardInstanceId:'white-deck-2-haunting-memories'}]);
      assert.deepEqual(cure.state.cardResponse,{player:'white',historyLength:34});
      const cureSnapshot=structuredClone(cure.state);
      for(const color of ['white','black'] as const)assert.equal(isKingInCheck(cure.state,color),checked(expectedPieces,color));
      assert.deepEqual(cure.state,cureSnapshot,'rescue royal query mutation');
      const close=immutableApply(cure.state,{type:'endTurn'});assert.ok(close.ok);
      assert.deepEqual(close.state.pieces,expectedPieces);assert.deepEqual(close.state.players,expectedPlayers);assert.deepEqual(close.state.effects,[]);
      assert.deepEqual(close.state.history,cure.state.history);assert.equal(close.state.fen,cure.state.fen);assert.deepEqual(close.state.enPassant,cure.state.enPassant);
      assert.deepEqual(close.state.turn,{color:'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}});assert.equal(close.state.shieldMove,undefined);
      assert.deepEqual(close.state.playedCards,cure.state.playedCards);assert.equal(close.state.cardResponse,undefined);
      for(const checkpoint of [cure.state,close.state]) {
        assert.equal(checkpoint.chaosForbidden,undefined);assert.equal(checkpoint.plotsExecution,undefined);assert.deepEqual(checkpoint.plotsAllowances??[],[]);
        assert.deepEqual(checkpoint.fogLocked??[],[]);assert.deepEqual(checkpoint.riposteLostMoves??[],[]);
        assert.equal(checkpoint.riposteSkipped,undefined);assert.equal(checkpoint.riposteCheckDeferred,undefined);
        assert.equal(checkpoint.pendingRescue??null,null);assert.equal(checkpoint.pendingAbduction??null,null);assert.equal(checkpoint.pendingDoomsayer??null,null);
        assert.deepEqual(checkpoint.underElfHill??[],[]);assert.equal(checkpoint.orientation,0);assert.equal(checkpoint.outcome,null);
      }
    } else assert.equal(state.pendingRescue??null,null);
  }
  assert.equal(moves,50);assert.equal(cardCount,11);
  assert.equal(state.fen,'b3r3/p3p2p/1qp1bk1n/1B1p1pp1/P3p3/r1N4N/1PP1K1PP/R4R2 w - - 4 26');
  assert.equal(replayTrace(trace).fen,state.fen);
});
