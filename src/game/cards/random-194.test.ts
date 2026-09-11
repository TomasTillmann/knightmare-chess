import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, rejectPendingCancellation, type RandomTrace } from './random-campaign.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Read in order against rules §§8–15,17,19–22 and the printed catalog timing.
const reasons = `
1. d2-d3 is one quiet forward Pawn step.
2. End White's completed safe turn; no card draw.
3. b8-a6 is a Knight jump.
4. Siege exchanges Black's a6 Knight and h8 Rook after the move, without capture.
5. End Black's turn and refresh both card allowances.
6. e1-d2 moves the King one diagonal and loses White castling rights.
7. End the safe King turn.
8. g7-g6 is one forward Black Pawn step.
9. End Black's safe Pawn turn.
10. d2-e3 is one empty diagonal King step.
11. End White's safe King turn.
12. e7-e6 is a quiet Black Pawn step.
13. End Black's safe turn.
14. a2-a4 crosses empty a3; record a3 EP, with no adjacent captor.
15. End turn retaining the immediately preceding double-step opportunity.
16. h7-h5 crosses empty h6 and replaces the old EP opportunity.
17. End Black turn; no White Pawn can capture h6 EP.
18. d1-d2 is an unobstructed Queen step and expires EP.
19. Earthquake changes forward to east/west; Black a7 promotes Rook first, White h2 Queen second.
20. Black Plots preserves the response after optional Earthquake; Think Again is eligible under FAQ16/37.
21. End turn, closing the unused Plots allowance.
22. d8-e7 is an empty diagonal Queen step.
23. End safe Black turn.
24. Promoted h2 Queen crosses h3,h4 and captures Black h5 Pawn.
25. End White capture turn.
26. e6-d6 is forward for Black after rotation, exposing Queen e7 toward White e3.
27. White Plots opens an empty response allowance; it does not cure check or move.
28. End Black turn, handing the checked White King its escape turn.
29. b1-c3 is provisional: held Charge c3-e4 blocks the e7-e3 Queen ray.
30. Think Again cancels that Knight move, spends only Black's card, and forbids its identical repetition.
31. e3-f3 is a different King move escaping the e-file check.
32. End White turn and close cancellation restriction.
33. a6-b6 moves the original h8 Rook, revoking that Rook's retained right.
34. End Black turn.
35. Promoted h5 Queen returns via empty h4,h3 to h2.
36. End White turn.
37. e7-e6 is a quiet Queen step.
38. End Black turn.
39. Guardian moves d3 Pawn east to e3; following piece is optional and absent.
40. End the completed replacement move.
41. g8-e7 is a quiet Knight jump.
42. End Black turn.
43. h2-h4 is a Queen slide through empty h3.
44. End White turn.
45. f8-g7 is an empty Bishop diagonal.
46. End Black turn.
47. a4-c4 is an allowed double-step from White's rotated first rank via b4.
48. End turn; no Black Pawn is positioned for b4 EP.
49. b6-b5 is one Rook step, expiring EP.
50. End Black turn.
51. d2-a5 is a Queen diagonal through empty c3,b4.
52. End White turn.
53. e6-g4 is a Queen diagonal through f5, checking King f3.
54. Crab attaches permanently to Black c7 Pawn and does not alter that check.
55. End Black turn; White receives the checked turn.
56. h4-g5 is provisional: Fireball g5 removes the checking g4 Queen.
57. Fireball captures its g5 center, g6 Pawn, and g4 Queen, clearing White's check.
58. End the successfully rescued turn.
59. a8-b8 moves the remaining original Rook and revokes its castling right.
60. End Black turn.
61. b1-c3 is an empty Knight jump.
62. End White turn.
63. Assassin lets Black King e8 capture its own Pawn f7 with normal King geometry.
64. End Black's replacement capture move.
65. c4-d4 is a quiet eastward Pawn step.
66. End White turn.
67. f7-e8 is a diagonal King step.
68. End Black turn.
69. c3-d5 is a quiet Knight jump.
70. Charge grants that same Knight d5-f6, checking e8 without mate; d8 is an escape.
71. End White's completed two-step Knight turn.
72. e8-d8 escapes the f6 Knight attack.
73. End Black turn.
74. Bombard replaces White's move with Rook a1-b1; its jump allowance need not be used.
75. End replacement Rook turn.
76. Resurrection returns captured original Black h7 Pawn to empty rotated starting square g3.
77. End Black's replacement return turn.
78. f3-g4 is a safe adjacent King step; westward g3 Pawn attacks f2,f4.
79. End White turn.
80. c7-b6 is Crab's one forward diagonal under westward orientation.
81. End Black turn.
82. g2-h2 reaches White's rotated last rank and promotes the physical Pawn to Rook.
83. End White promotion turn.
84. b5-e5 crosses empty c5,d5 in a Rook line.
85. End Black turn.
86. a5-a3 crosses empty a4 in a Queen line.
87. End White turn.
88. Pacifism marks Black d6 Pawn before the move, forbidding capture both ways.
89. d6-c6 is a quiet westward Pawn step, allowed by Pacifism.
90. End Black turn.
91. f6-g8 is an empty Knight jump.
92. Neutrality marks opposing b8 Rook; Bishop c8 blocks its ray toward Black King d8.
93. End White turn.
94. d7-c7 is westward Pawn movement, exposing Bishop c8 toward King g4.
95. End Black turn; White must answer the Bishop check.
96. White may move neutral b8-a8 provisionally: Forbidden City f5 blocks Bishop c8-g4.
97. Forbidden City a5 misses that ray, so it fizzles and rolls back the illegal Rook move, retaining expenditure.
98. King g4 captures g3 Pawn and escapes the Bishop diagonal without another card.
99. End White's safe replacement move and refresh allowances.
100. c8-e6 is provisional: Crusade e6-c8 reblocks neutral Rook b8's attack on King d8.
101. Crusade returns the same Bishop to c8 and cures Black's check.
102. End the rescued Black turn.
103. g1-h3 is a quiet Knight jump.
104. End White turn.
105. c8-f5 provisionally exposes neutral Rook b8; held Abduction on b8 with failed recall captures the checker.
106. Actual Abduction c1 conceals White Bishop; mandatory recall defers adjudication, but cannot cure b8-d8.
107. Reveal advances only the mandatory Abduction timer phase.
108. Timeout would retain self-check, so restore c1 and rollback c8-f5 while keeping Abduction spent.
109. e7-g6 is a different safe Knight move, replacing the rolled-back move.
110. End Black turn.
111. Promoted h2 Rook moves one square to g2.
112. End White turn.
113. Promoted a7 Rook crosses a6,a5,a4 and captures Queen a3.
114. End Black capture turn.
115. White controls neutral b8 Rook to capture Black Bishop c8, checking King d8.
116. End White turn; Black receives its escape opportunity.
117. e5-g5 checks White King g3; a hypothetical White-controlled neutral capture of d8 would leave White checked, suppressing that neutral threat.
118. End Black turn after its countercheck cures the neutral-piece check under §§11.7,15.1.
119. g3-f3 escapes g5 Rook check; e3 Pawn blocks the a3 Rook's rank ray.
120. End White turn; Black is again checked by neutral c8 Rook and receives its next turn.
`.trim().split('\n');

const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const sq = (x: number, y: number) => `${String.fromCharCode(97+x)}${y+1}` as SquareName;
const at = (s: GameState, square: string) => s.pieces.find(p => p.zone === 'board' && p.square === square);
const effect = (s: GameState, type: string, id: string) => s.effects.some(e => {
  const v = e as { type?: string; pieceId?: string }; return v.type === type && v.pieceId === id;
});

// Independent fixed-coordinate geometry, including rotated Pawns and Crab.
function reaches(s: GameState, p: PieceState, to: string, capture: boolean): boolean {
  if (!p.square || p.square === to) return false;
  const [x,y] = xy(p.square), [u,v] = xy(to), dx=u-x, dy=v-y;
  if (s.effects.some(e => (e as {type?:string;square?:string}).type === 'forbidden-city'
    && (e as {square?:string}).square === to)) return false;
  if (capture && (effect(s,'pacifism',p.id) || (at(s,to) && effect(s,'pacifism',at(s,to)!.id)))) return false;
  if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const sign=p.owner==='white'?1:-1;
    const forward=(s.orientation===90?dx:dy)*sign, side=s.orientation===90?dy:dx;
    if (capture || effect(s,'crab',p.id)) return forward===1 && Math.abs(side)===1;
    const rank=(s.orientation===90?x:y)*sign+(sign===1?0:7);
    return side===0 && (forward===1 || forward===2 && rank<=1
      && !at(s,sq(x+(s.orientation===90?sign:0),y+(s.orientation===0?sign:0))));
  }
  if (!(p.role==='queen' && (dx===0 || dy===0 || Math.abs(dx)===Math.abs(dy))
    || p.role==='rook' && (dx===0 || dy===0)
    || p.role==='bishop' && Math.abs(dx)===Math.abs(dy))) return false;
  for(let n=1;n<Math.max(Math.abs(dx),Math.abs(dy));n++) {
    const middle=sq(x+Math.sign(dx)*n,y+Math.sign(dy)*n);
    if(at(s,middle) || s.effects.some(e => (e as {type?:string;square?:string}).type==='forbidden-city'
      && (e as {square?:string}).square===middle)) return false;
  }
  return true;
}

function threatened(s: GameState, color: Color, allowNeutral=true): boolean {
  const royal=s.pieces.find(p=>p.royal && p.owner===color && p.zone==='board')!;
  return s.pieces.some(p=> p.zone==='board' && p.id!==royal.id && (p.owner!==color || p.neutral)
    && (allowNeutral || !p.neutral) && reaches(s,p,royal.square!,true) && (!p.neutral || (()=>{
      // The opponent controls a neutral capture, so that opponent's King must remain safe.
      const trial=structuredClone(s), mover=trial.pieces.find(q=>q.id===p.id)!;
      trial.pieces=trial.pieces.filter(q=>q.id!==royal.id); mover.square=royal.square;
      return !threatened(trial,other(color),false);
    })()));
}

function boardFen(s: GameState): string {
  const letters={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,r)=>{
    let out='',empty=0;
    for(let f=0;f<8;f++) {const p=at(s,sq(f,7-r));if(!p){empty++;continue;}
      if(empty){out+=empty;empty=0;}const ch=letters[p.role];out+=p.owner==='white'?ch.toUpperCase():ch;}
    return out+(empty||'');
  }).join('/');
}

const primary=(s:GameState)=>({pieces:s.pieces,players:s.players,effects:s.effects,history:s.history,
  fen:s.fen,orientation:s.orientation,enPassant:s.enPassant,turn:s.turn,shieldMove:s.shieldMove,
  chaosForbidden:s.chaosForbidden,plotsExecution:s.plotsExecution,fogLocked:s.fogLocked??[],
  riposteLostMoves:s.riposteLostMoves??[],riposteSkipped:s.riposteSkipped,riposteCheckDeferred:s.riposteCheckDeferred,
  pendingDoomsayer:s.pendingDoomsayer??null,underElfHill:s.underElfHill??[],outcome:s.outcome});

function immutable(s:GameState,a:GameAction):GameState {
  const copy=structuredClone(s),payload=structuredClone(a),result=applyAction(s,a);
  assert.deepEqual(s,copy,'action input immutability');assert.deepEqual(a,payload,'action payload immutability');assert.ok(result.ok,JSON.stringify(a));return result.state;
}

const identityRows = new Set([1,6,10,14,18,24,29,31,35,43,47,51,56,61,65,69,89,94,100]);
const previousFenRows = new Set([84,100,105,113,117]);
// Independent declaration ledger: physical card, original owner, timing row, and exact target.
const declarations: Record<number, GameAction> = {
  4:{type:'playCard',cardId:'siege',cardInstanceId:'black-hand-4-siege',target:{knight:'a6',rook:'h8'}},
  19:{type:'playCard',cardId:'earthquake',cardInstanceId:'white-hand-1-earthquake',target:{direction:'counterclockwise',promotions:[{square:'a7',role:'rook'},{square:'h2',role:'queen'}]}},
  20:{type:'playCard',cardId:'plots-within-plots',cardInstanceId:'black-hand-2-plots-within-plots',target:{player:'black'}},
  27:{type:'playCard',cardId:'plots-within-plots',cardInstanceId:'white-hand-2-plots-within-plots',target:{player:'white'}},
  30:{type:'playCard',cardId:'think-again',cardInstanceId:'black-hand-1-think-again'},
  39:{type:'playCard',cardId:'guardian',cardInstanceId:'white-deck-1-guardian',target:[{from:'d3',to:'e3'}]},
  54:{type:'playCard',cardId:'crab',cardInstanceId:'black-deck-1-crab',target:'c7'},
  57:{type:'playCard',cardId:'fireball',cardInstanceId:'white-hand-0-fireball',target:'g5'},
  63:{type:'playCard',cardId:'assassin',cardInstanceId:'black-hand-3-assassin',target:[{from:'e8',to:'f7'}]},
  70:{type:'playCard',cardId:'charge',cardInstanceId:'white-hand-4-charge',target:[{from:'d5',to:'f6'}]},
  74:{type:'playCard',cardId:'bombard',cardInstanceId:'white-deck-0-bombard',target:[{from:'a1',to:'b1'}]},
  76:{type:'playCard',cardId:'resurrection',cardInstanceId:'black-deck-3-resurrection',target:{pieceId:'black-pawn-h7',to:'g3'}},
  88:{type:'playCard',cardId:'pacifism',cardInstanceId:'black-deck-4-pacifism',target:'d6'},
  92:{type:'playCard',cardId:'neutrality',cardInstanceId:'white-deck-2-neutrality',target:'b8'},
  97:{type:'playCard',cardId:'forbidden-city',cardInstanceId:'white-deck-3-forbidden-city',target:'a5'},
  101:{type:'playCard',cardId:'crusade',cardInstanceId:'black-deck-6-crusade',target:[{from:'e6',to:'c8'}]},
  106:{type:'playCard',cardId:'abduction',cardInstanceId:'black-deck-7-abduction',target:'c1'},
};

// F4 / FAQ p.16: only actions 1–29 are a legal prefix. Later artifact actions
// depend on the rejected cancellation at action 30; original artifact hashes remain unchanged.
test('iteration 194 independently reviewed full physical, card, turn, FEN and royal oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/194.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(reasons.length,120);assert.equal(trace.steps.length,120);
  let actual=createGameState(trace.initial), expected=structuredClone(actual);
  const checkpoints=new Map<number,GameState>();
  let half=0,full=1,side:Color='white',rights='KQkq';
  const capture=(p:PieceState,owner:Color)=>{p.zone='captured';p.square=null;p.capturedBy=owner;};
  const relocate=(from:string,to:string,owner:Color)=>{
    const p=at(expected,from)!;assert.ok(p,from);const victim=at(expected,to);
    if(victim)capture(victim,owner);p.square=to as SquareName;return {p,victim};
  };
  const restore=(n:number)=>{
    const saved=checkpoints.get(n)!;
    expected.pieces=structuredClone(saved.pieces);expected.effects=structuredClone(saved.effects);
    expected.history=structuredClone(saved.history);expected.enPassant=structuredClone(saved.enPassant);
    const parts=saved.fen.split(' ');side=parts[1]==='w'?'white':'black';rights=parts[2]!;half=Number(parts[4]);full=Number(parts[5]);
    expected.turn.phase='beforeMove';expected.turn.moveMade=false;
  };
  for(const [i,{action}] of trace.steps.slice(0, 29).entries()) {
    const n=i+1;assert.ok(reasons[i]!.startsWith(`${n}. `));checkpoints.set(n,structuredClone(expected));
    const before=structuredClone(expected),actor=expected.turn.color;
    if(action.type==='move') {
      assert.ok(typeof action.from==='string' && typeof action.to==='string');
      const from=action.from,to=action.to,p=at(expected,from)!;assert.ok(p);
      assert.ok(p.owner===actor || p.neutral);assert.ok(!expected.turn.moveMade);
      assert.ok(!at(expected,to) || at(expected,to)!.owner!==actor || p.neutral);
      assert.ok(reaches(expected,p,to,!!at(expected,to)),`row ${n} independent geometry`);
      const isPawn=p.role==='pawn', oldRole=p.role, {victim}=relocate(from,to,actor);
      if(action.promotion){assert.equal(isPawn,true);assert.equal(to[0],'h');p.role=action.promotion as PieceState['role'];p.promoted=true;}
      half=isPawn||victim?0:half+1;full+=actor==='black'?1:0;side=other(actor);
      if(n===6)rights='hq';if(n===33)rights='q';if(n===59)rights='-';
      expected.enPassant=[];
      const [x,y]=xy(from),[u,v]=xy(to);
      if(isPawn && Math.max(Math.abs(u-x),Math.abs(v-y))===2)expected.enPassant=[{target:sq((x+u)/2,(y+v)/2),pawnId:p.id}];
      const event:GameEvent={type:'move',from:from as SquareName,to:to as SquareName};
      if(action.promotion)event.promotion=p.role;if(victim)event.capturedId=victim.id;
      if(identityRows.has(n)){event.movedPieceId=p.id;event.movedRoles=[oldRole];}
      if(previousFenRows.has(n))event.previousFen=before.fen;
      expected.history.push(event);expected.turn.phase='afterMove';expected.turn.moveMade=true;
      expected.shieldMove={player:actor,pieceIds:[p.id],capturedOpponent:!!victim && victim.owner!==actor};
      delete expected.chaosForbidden;expected.plotsAllowances=[];
    } else if(action.type==='endTurn') {
      assert.equal(expected.turn.moveMade,true);assert.equal(threatened(expected,actor),false,`row ${n} end-turn safety`);
      expected.turn={color:other(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      delete expected.shieldMove;delete expected.chaosForbidden;expected.plotsAllowances=[];
    } else if(action.type==='playCard') {
      assert.deepEqual(action,declarations[n],`row ${n} exact physical card declaration`);
      const owner=(['white','black'] as const).find(c=>expected.players[c].hand.some(k=>k.id===action.cardInstanceId))!;
      assert.ok(owner);assert.equal(expected.turn.cardPlays[owner],0);
      const player=expected.players[owner],idx=player.hand.findIndex(k=>k.id===action.cardInstanceId),card=player.hand[idx]!;
      assert.equal(card.cardId,action.cardId);const meta=CARD_CATALOG[card.cardId]!;
      assert.ok(meta.timing.includes(owner===actor?expected.turn.phase:'afterOpponentMove'));
      player.hand.splice(idx,1);player.hand.push(player.deck.shift()!);expected.turn.cardPlays[owner]++;
      if(!meta.continuing || n===97)player.discard.push(card);
      const event:GameEvent={type:'cardPlayed',cardId:card.cardId,target:action.target as GameEvent['target'],movement:[],preservePreviousMove:expected.turn.moveMade};
      if(n===4){relocate('a6','a5',owner);relocate('h8','a6',owner);relocate('a5','h8',owner);rights='KQhq';event.movement=[{from:'a6',to:'h8'},{from:'h8',to:'a6'}];}
      else if(n===19){expected.orientation=90;for(const [square,role] of [['a7','rook'],['h2','queen']] as const){at(expected,square)!.role=role;at(expected,square)!.promoted=true;}
        expected.effects.push({type:'earthquake',owner,card,direction:'counterclockwise',target:action.target});}
      else if(n===20 || n===27){delete event.target;event.player=owner;event.preservePreviousMove=true;
        expected.plotsAllowances=[{player:owner,remaining:2,eligibleCards:n===20?['black-hand-1-think-again']:[],window:{phase:'afterMove',moveMade:true,shieldMove:structuredClone(expected.shieldMove),reaction:structuredClone([...expected.history].reverse().find(e=>e.type==='move'))}}];}
      else if(n===30){restore(29);event.player=owner;delete event.target;event.movement=[{from:'c3',to:'b1'}];
        expected.chaosForbidden={player:'white',movement:'white-knight-b1:b1:c3'};delete expected.shieldMove;expected.plotsAllowances=[];}
      else if([39,63,70,74,101].includes(n)) {
        const moves=action.target as Array<{from:string;to:string}>;const {from,to}=moves[0]!;
        assert.ok(reaches(expected,at(expected,from)!,to,!!at(expected,to)));
        if(n===63){assert.equal(at(expected,from)!.owner,owner);assert.equal(at(expected,to)!.owner,owner);assert.equal(at(expected,to)!.royal,false);}
        const {p,victim}=relocate(from,to,owner);event.movement=moves as GameEvent['movement'];event.preservePreviousMove=false;
        if(victim)event.capturedId=victim.id;
        if(n===70 || n===101){event.from=from as SquareName;event.to=to as SquareName;event.movedPieceId=p.id;event.movedRoles=[p.role];if(n===101)event.previousFen=before.fen;}
        else {half=n===39||n===63?0:half+1;full+=owner==='black'?1:0;side=other(owner);}
        expected.turn.phase='afterMove';expected.turn.moveMade=true;expected.enPassant=[];
        expected.shieldMove={player:owner,pieceIds:[p.id],capturedOpponent:!!victim && victim.owner!==owner};
      } else if(n===54 || n===88 || n===92) {
        const p=at(expected,action.target as string)!;assert.ok(p);
        expected.effects.push({type:card.cardId,owner,card,pieceId:p.id});
        if(n===92){p.neutral=true;p.neutralBeforeEffects=false;}
      } else if(n===57){
        const victims=['white-pawn-h2','black-pawn-g7','black-queen-d8'];
        for(const id of victims)capture(expected.pieces.find(p=>p.id===id)!,owner);
        half=0;event.capturedIds=victims;event.player=owner;
      } else if(n===76){
        const p=expected.pieces.find(p=>p.id==='black-pawn-h7')!;assert.equal(p.zone,'captured');assert.equal(at(expected,'g3'),undefined);
        p.zone='board';p.square='g3';delete p.capturedBy;half=0;full++;side='white';expected.enPassant=[];
        expected.turn.phase='afterMove';expected.turn.moveMade=true;expected.shieldMove={player:owner,pieceIds:[],capturedOpponent:false};
      } else if(n===97){restore(96);event.type='cardFizzled';event.reason='SELF_CHECK';event.preservePreviousMove=false;delete event.target;}
      else if(n===106){const p=at(expected,'c1')!;p.zone='away';p.square=null;delete event.target;}
      else assert.fail(`unreviewed card row ${n}`);
      expected.history.push(event);
    } else if(action.type==='revealAbduction'){assert.equal(n,107);}
    else if(action.type==='abductionTimeout'){assert.equal(n,108);restore(105);expected.history.push({type:'cardFizzled',cardId:'abduction',movement:[],preservePreviousMove:true,reason:'SELF_CHECK'});}
    else assert.fail(`unreviewed action ${n}`);
    expected.fen=`${boardFen(expected)} ${side[0]} ${rights} - ${half} ${full}`;
    actual=immutable(actual,action);
    assert.deepEqual(primary(actual),primary(expected),`row ${n}: ${reasons[i]}`);
    for(const color of ['white','black'] as const) {
      const copy=structuredClone(actual);assert.equal(isKingInCheck(actual,color),threatened(expected,color),`row ${n} ${color} threat`);assert.deepEqual(actual,copy);
    }
    const snapshot=structuredClone(actual);legalDests(actual);if(action.type==='playCard')cardPlayTargets(actual,action.cardId);assert.deepEqual(actual,snapshot,'query immutability');
    // All three double steps are uncapturable even for the prospective opponent in beforeMove.
    if(expected.enPassant.length){const prospect=structuredClone(expected);prospect.turn={color:side,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      const prospectBefore=structuredClone(prospect),destinations=legalDests(prospect);assert.deepEqual(prospect,prospectBefore,'prospective EP query immutability');
      for(const ep of expected.enPassant)for(const p of prospect.pieces.filter(p=>p.owner===side&&p.zone==='board'&&p.role==='pawn')) {
        assert.equal(reaches(prospect,p,ep.target,true),false);assert.equal(destinations.get(p.square!)?.includes(ep.target)??false,false);
      }}
    const pending=[29,56,96,100,105,106,107].includes(n);assert.equal(!!actual.pendingRescue,pending,`row ${n} rescue obligation`);
    if(pending){const source=checkpoints.get(n>=105?105:n)!;const token=actual.pendingRescue!;
      assert.deepEqual(token.pieces,source.pieces);assert.equal(token.fen,source.fen);assert.deepEqual(token.enPassant,source.enPassant);
      assert.equal(token.historyLength,source.history.length);assert.deepEqual(token.history??token.before?.history,source.history);
      assert.deepEqual(token.movedPieceIds,actual.shieldMove!.pieceIds);
      assert.ok(token.before);assert.deepEqual(primary(token.before!),primary(source));
    }
    assert.equal(!!actual.pendingAbduction,n===106||n===107);
    if(actual.pendingAbduction){assert.equal(actual.pendingAbduction.phase,n===106?'concealment':'recall');assert.equal(actual.pendingAbduction.pieceId,'white-bishop-c1');assert.equal(actual.pendingAbduction.player,'white');assert.equal(actual.pendingAbduction.durationMs,10000);assert.equal(actual.pendingAbduction.requiresPieceId,false);}
    if(n===20 || n===27){const allowance=actual.plotsAllowances![0]!;assert.equal(actual.plotsAllowances!.length,1);
      assert.equal(allowance.player,n===20?'black':'white');assert.equal(allowance.remaining,2);assert.deepEqual(allowance.eligibleCards,n===20?['black-hand-1-think-again']:[]);
      assert.equal(allowance.window.phase,'afterMove');assert.equal(allowance.window.moveMade,true);assert.deepEqual(allowance.window.shieldMove,expected.shieldMove);
      assert.deepEqual(allowance.window.reaction,expected.plotsAllowances![0]!.window.reaction);
      assert.equal(allowance.window.capture,undefined);assert.equal(allowance.window.legacyCapture,undefined);
      if(n===27){assert.equal(allowance.window.cardResponse,undefined);assert.equal(allowance.window.fogCheckpoint,undefined);}
      if(n===20){assert.deepEqual(allowance.window.cardResponse,{player:'white',historyLength:expected.history.length-1});assert.ok(allowance.window.fogCheckpoint);assert.deepEqual(primary(allowance.window.fogCheckpoint!.before),primary(checkpoints.get(19)!));}
    } else assert.deepEqual(actual.plotsAllowances??[],[]);
    if([29,56,96,100,105].includes(n))verifyCure(actual,n);
    if(n===97 || n===108){
      // The stale movement token is historical, not permission to play after-move cards.
      const probe=structuredClone(actual),player=probe.players[actor];probe.turn.cardPlays[actor]=0;
      const zone=player.discard.some(c=>c.cardId==='fireball')?player.discard:player.deck;
      const index=zone.findIndex(c=>c.cardId==='fireball');assert.ok(index>=0);
      const [fireball]=zone.splice(index,1);player.hand.push(fireball!);
      const original=structuredClone(probe);assert.deepEqual(cardPlayTargets(probe,'fireball'),[]);
      const result=applyAction(probe,{type:'playCard',cardId:'fireball',cardInstanceId:fireball!.id,target:n===97?'b8':'c8'});
      assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'INVALID_TIMING');assert.deepEqual(probe,original);
    }
  }
  assert.equal(trace.moves,50);
  rejectPendingCancellation(actual, trace.steps[29]!.action, [{"type":"playCard","cardId":"charge","cardInstanceId":"white-hand-4-charge","target":[{"from":"c3","to":"e4"}]}]);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,17);
});

function verifyCure(state:GameState,row:number):void {
  const owner=state.turn.color,copy=structuredClone(state),expected=structuredClone(state);
  const cardId=row===29?'charge':row===56?'fireball':row===96?'forbidden-city':row===100?'crusade':'abduction';
  const card=expected.players[owner].hand.find(c=>c.cardId===cardId)!;assert.ok(card,'concrete held cure');
  const target=row===29?[{from:'c3',to:'e4'}]:row===56?'g5':row===96?'f5':row===100?[{from:'e6',to:'c8'}]:'b8';
  const player=expected.players[owner];player.hand=player.hand.filter(c=>c.id!==card.id);player.hand.push(player.deck.shift()!);
  expected.turn.cardPlays[owner]++;if(cardId!=='forbidden-city')player.discard.push(card);
  let event:GameEvent={type:'cardPlayed',cardId,target:target as GameEvent['target'],movement:[],preservePreviousMove:true};
  let cured=immutable(state,{type:'playCard',cardId,cardInstanceId:card.id,target});
  if(row===29 || row===100){const from=row===29?'c3':'e6',to=row===29?'e4':'c8',p=at(expected,from)!;
    assert.ok(reaches(expected,p,to,false));p.square=to;expected.shieldMove={player:owner,pieceIds:[p.id],capturedOpponent:false};
    event={type:'cardPlayed',cardId,from,to,movedPieceId:p.id,movedRoles:[p.role],target:[{from,to}],movement:[{from,to}],preservePreviousMove:false,...(row===100?{previousFen:state.fen}:{})};
  } else if(row===56){const victims=expected.pieces.filter(p=>p.zone==='board'&&!p.royal&&Math.max(Math.abs(xy(p.square!)[0]-6),Math.abs(xy(p.square!)[1]-4))<=1);
    assert.deepEqual(victims.map(p=>p.id),['white-pawn-h2','black-pawn-g7','black-queen-d8']);for(const p of victims){p.zone='captured';p.square=null;p.capturedBy=owner;}
    event.capturedIds=victims.map(p=>p.id);event.player=owner;
  } else if(row===96){expected.effects.push({type:'forbidden-city',owner,card,square:'f5'});delete event.movement;delete event.preservePreviousMove;}
  else {const p=at(expected,'b8')!;p.zone='captured';p.square=null;p.capturedBy=owner;
    // §15.1: capture ends the printed Neutrality duration, even for immediate rescue.
    const marker=expected.effects.find(e=>(e as {type?:string}).type==='neutrality') as {card:{id:string;cardId:string}};
    expected.players.white.discard.push(marker.card);expected.effects=expected.effects.filter(e=>e!==marker);
    p.neutral=false;delete p.neutralBeforeEffects;event.capturedId=p.id;event.capturedIds=[p.id];
    cured=immutable(cured,{type:'revealAbduction'});cured=immutable(cured,{type:'abductionTimeout'});
  }
  expected.history.push(event);
  const fields=state.fen.split(' ');if(row===56||row===105)fields[4]='0';fields[0]=boardFen(expected);expected.fen=fields.join(' ');
  assert.deepEqual(primary(cured),primary(expected),`row ${row} full cure accounting`);
  assert.equal(!!cured.pendingRescue,false);assert.equal(!!cured.pendingAbduction,false);
  assert.equal(threatened(expected,owner),false);for(const color of ['white','black'] as const)assert.equal(isKingInCheck(cured,color),threatened(expected,color));
  const ended=immutable(cured,{type:'endTurn'});expected.turn={color:other(owner),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};delete expected.shieldMove;
  assert.deepEqual(primary(ended),primary(expected),`row ${row} immutable successful turn closure`);assert.deepEqual(state,copy);
}

test('iteration 194 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/194.json', import.meta.url), 'utf8')) as RandomTrace;
  rejectPendingCancellation(replayTrace(trace, 30), trace.steps[29]!.action, [{"type":"playCard","cardId":"charge","cardInstanceId":"white-hand-4-charge","target":[{"from":"c3","to":"e4"}]}]);
});
