import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, GameState, GameEvent, PieceState, SquareName } from '../types.js';

// Independently reviewed in order against rules §§8–15, 18.1 and 22.6–7,
// cards.md and each played card's printed catalog timing/classification.
const rationales = `
1. White d2-d4 crosses empty d3; creates d3 opportunity but no Black captor.
2. End White turn; preserve d3 opportunity and all clocks.
3. Black e7-e5 crosses empty e6; no White Pawn on d5/f5 can capture yet.
4. End Black turn with e6 opportunity intact.
5. White d4-d5 advances one and expires e6.
6. End White turn without changing the board.
7. Black Ng8-e7 jumps to the vacated Pawn square.
8. End Black turn; no reaction outstanding.
9. White f2-f3 advances into an empty square.
10. End White turn with no card expenditure.
11. Black g7-g5 crosses empty g6; no adjacent White Pawn.
12. Black Figure Dance rotates all four corner Rooks counterclockwise simultaneously; all castling rights end, raw g6 survives.
13. End Black turn; raw g6 serialization survives although uncapturable.
14. White e2-e3 advances one and expires g6.
15. End White turn; no obligations.
16. Black c7-c5 crosses c6; White d5 can legally capture en passant on c6.
17. End Black turn preserves the concrete d5-c6 en-passant option.
18. White Bf1-a6 slides through empty e2,d3,c4,b5 and declines en passant.
19. White Siege swaps owned Nb1 and Rh1 without capture, paths or clock advancement.
20. End White turn; swapped identities persist.
21. Black Blessing moves Pf7-e6 diagonally without capture as its replacement move.
22. End Black turn after its replacement move.
23. White Ke1-f1 moves one square to safety.
24. End White turn; King remains f1.
25. Black h7-h5 crosses empty h6; no White Pawn on g5.
26. End Black turn preserves h6 opportunity.
27. White Ng1-h3 jumps; h6 opportunity expires.
28. End White turn after the Knight jump.
29. Black d7-d6 advances one.
30. End Black turn after the Pawn advance.
31. White Qd1-d2 slides to the vacated d-Pawn square.
32. End White turn after the Queen move.
33. Black Ke8-d7 moves one diagonal square safely.
34. Black Coup makes its Ne7 royal and Kd7 a capturable Prince; powers and squares remain.
35. End Black turn; royal identity remains on e7.
36. White Nh3-f2 jumps to an empty square.
37. End White turn; no effects expire.
38. Black c5-c4 advances one.
39. End Black turn; Coup persists.
40. White h2-h4 crosses h3; no Black Pawn on g4 can capture en passant.
41. End White turn preserves the h3 opportunity.
42. Black Lost Castle swaps Ra1 with White Rb1 as a replacement move; no capture and en passant expires.
43. End Black turn after its Rook swap.
44. White Rh8-h7 slides one square and checks royal Ne7 along g7,f7.
45. End White turn passes the existing check to Black.
46. Black g5xh4 captures White's h-Pawn provisionally while Ne7 stays checked; held Peace Talks can cancel Coup and restore safe Prince d7 as King.
47. Black Truce cannot survive the raw Rh7-e7 check; it fizzles, is spent, and restores the provisional capture with the Regular Move available. The historical shield token is inert beforeMove, verified with held-card timing probes.
48. Black Bf8-g7 interposes on the h7-e7 checking ray and completes a safe move.
49. End Black turn after the checking ray is blocked.
50. White a2-a4 crosses a3; no Black Pawn on b4.
51. End White turn with a3 opportunity intact.
52. Black Qd8-f8 slides through empty e8; a3 expires.
53. End Black turn; Queen now f8.
54. White c2-c3 advances one.
55. End White turn; no obligation.
56. Black Annexation advances Pb7-b5 across empty b6 as a replacement move; raw b6 exists but White has no a5/c5 Pawn.
57. End Black turn retains uncapturable raw b6.
58. White Nf2-e4 jumps and declines the b6 opportunity.
59. End White turn after Knight jump.
60. Black Prince d7-e8 keeps ordinary one-square King movement; Ne7 remains royal.
61. End Black turn after Prince move.
62. White h4xg5 captures the physical black g-Pawn diagonally.
63. White Vendetta establishes compulsory legal captures from Black's next move.
64. End White turn; Black has legal captures so Vendetta persists.
65. Black Qf8xf3 crosses f7,f6,f5,f4 and captures White f-Pawn, checking Kf1.
66. End Black turn; White has the g2xf3 checking-Queen capture.
67. White g2xf3 captures that Queen and cures the f-file check.
68. End White turn; Black still has legal captures.
69. Black Nb8xa6 jumps onto and captures White Bf1's physical identity.
70. End Black turn; White still has legal captures.
71. White Ne4xd6 jumps and captures Black d-Pawn; attacked Prince e8 is capturable, not royal.
72. End White turn; Black has a legal capture.
73. Black Rb1xc1 captures White Bc1 and checks Kf1 along d1,e1.
74. End Black turn; White can capture the checking Rook.
75. White Qd2xc1 captures the checking Black Ra8 identity and cures check.
76. End White turn; Black still has captures.
77. Black b5xa4 captures White a-Pawn diagonally.
78. End Black turn; White still has captures.
79. White Nd6xc8 jumps and captures Black Bc8.
80. End White turn; Black can recapture on c8.
81. Black Ra8xc8 crosses empty b8 and captures White Ng1's physical identity.
82. End Black turn; White can capture the e6 Pawn.
83. White d5xe6 captures Black Pf7, which Blessing placed on e6.
84. End White turn; Black has no legal capture, so Vendetta expires into White discard.
85. Black Na6-b8 may now make a quiet Knight jump.
86. Black Peace Talks cancels its Coup; Ke8 is royal again and Ne7 loses royalty, with both physical pieces otherwise intact.
87. End Black turn after restored royal identity.
88. White Ra1-a2 slides one square.
89. End White turn; no active effect remains.
90. Black a4-a3 advances the original b-Pawn one square.
91. Black Fortification installs the undirected g7-h7 wall after moving; endpoints may be occupied.
92. End Black turn retaining the physical wall card.
93. White Ra2-a1 slides without crossing g7-h7.
94. End White turn; wall persists.
95. Black a7-a5 crosses empty a6; no White Pawn on b5.
96. End Black turn preserves the uncapturable a6 opportunity.
97. White e3-e4 advances one and expires a6.
98. End White turn after Pawn advance.
99. Black Ne7-f5 jumps; it is no longer royal and ignores walls.
100. Black Haunting Memories copies its last non-unique Fortification and retains its own physical card on a1-b2.
101. End Black turn with two independent walls active.
102. White Rh7xh5 crosses empty h6 and captures Black h-Pawn; neither wall lies on that path.
103. End White turn after the Rook capture.
104. Black Nf5-d6 jumps to an empty square.
105. End Black turn after Knight jump.
106. White Qc1-e3 slides through empty d2 without crossing either wall.
107. End White turn after Queen move.
108. Black Ke8-d8 moves one safe square.
109. End Black turn with King d8.
110. White Qe3-e2 slides one square.
111. End White turn with Queen e2.
112. Black Kd8-e8 returns one safe square.
113. End Black turn, with all 50 Regular Move commands and all intervening actions reviewed.
`.trim().split('\n');

const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const square = (x: number, y: number) => `${String.fromCharCode(97+x)}${y+1}` as SquareName;
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);
type Wall = { from: string; to: string };
function reaches(pieces: PieceState[], p: PieceState, to: string, walls: Wall[], capture: boolean): boolean {
  if (!p.square || p.square === to) return false;
  const [x,y] = xy(p.square), [tx,ty] = xy(to), dx = tx-x, dy = ty-y;
  if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  const dir = p.owner === 'white' ? 1 : -1;
  if (p.role === 'pawn') {
    if (capture ? Math.abs(dx)!==1 || dy!==dir : dx!==0 || !(dy===dir || dy===2*dir && y===(dir===1?1:6))) return false;
  } else if (p.role === 'king') { if (Math.max(Math.abs(dx),Math.abs(dy))!==1) return false; }
  else if (!(p.role !== 'bishop' && (dx===0 || dy===0) || p.role !== 'rook' && Math.abs(dx)===Math.abs(dy))) return false;
  const n = Math.max(Math.abs(dx),Math.abs(dy));
  let previous = p.square;
  for (let j=1;j<=n;j++) {
    const next = square(x+Math.sign(dx)*j,y+Math.sign(dy)*j);
    if (walls.some(w => w.from===previous && w.to===next || w.to===previous && w.from===next)) return false;
    if (j<n && at(pieces,next)) return false;
    previous=next;
  }
  return true;
}
const checked = (pieces: PieceState[], color: Color, walls: Wall[]) => pieces.some(k => k.royal && k.owner===color && k.zone==='board'
  && pieces.some(p => p.owner!==color && p.zone==='board' && reaches(pieces,p,k.square!,walls,true)));
function captures(pieces: PieceState[], color: Color, walls: Wall[]): string[] {
  return pieces.filter(p => p.owner===color && p.zone==='board').flatMap(p => pieces.filter(q => q.owner!==color && q.zone==='board' && !q.royal)
    .flatMap(q => {
      if (!reaches(pieces,p,q.square!,walls,true)) return [];
      const board=structuredClone(pieces); at(board,p.square!)!.square=q.square; const victim=board.find(r=>r.id===q.id)!; victim.zone='captured';victim.square=null;
      return checked(board,color,walls)?[]:[`${p.square}-${q.square}`];
    }));
}
function placement(pieces: PieceState[]): string {
  const letters={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,r)=>{let out='',empty=0;for(let f=0;f<8;f++) {const p=at(pieces,square(f,7-r));if(!p){empty++;continue;}if(empty)out+=empty;empty=0;const c=letters[p.role];out+=p.owner==='white'?c.toUpperCase():c;}return out+(empty||'');}).join('/');
}

test('iteration 172: independent physical, card, geometry and obligation oracle', () => {
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/172.json', import.meta.url),'utf8')) as RandomTrace;
  assert.equal(trace.steps.length,113); assert.equal(rationales.length,113);
  let actual=createGameState(trace.initial), expected=structuredClone(actual);
  let rights='KQkq', epFen='-', half=0, full=1, active='w';
  let rescueBefore: GameState | undefined;
  let walls: Wall[]=[];
  const continuing=new Set(['coup','vendetta','fortification','haunting-memories']);
  const cardRows: Record<number,[string,string,unknown]>={
    12:['figure-dance','black-hand-4-figure-dance',[]],19:['siege','white-hand-2-siege',{knight:'b1',rook:'h1'}],
    21:['blessing','black-deck-0-blessing',[{from:'f7',to:'e6'}]],34:['coup','black-hand-2-coup','e7'],
    42:['lost-castle','black-hand-0-lost-castle',{own:'a1',opponent:'b1'}],47:['truce','black-hand-3-truce',undefined],
    56:['annexation','black-deck-4-annexation',[{from:'b7',to:'b5'}]],63:['vendetta','white-hand-4-vendetta',undefined],
    86:['peace-talks','black-hand-1-peace-talks','black-hand-2-coup'],91:['fortification','black-deck-5-fortification',{from:'g7',to:'h7'}],
    100:['haunting-memories','black-deck-1-haunting-memories',{from:'a1',to:'b2'}],
  };
  for(const [i,{action}] of trace.steps.entries()) {
    const n=i+1, label=rationales[i]!; assert.ok(label.startsWith(`${n}. `));
    const before=structuredClone(expected), input=structuredClone(actual), actor=expected.turn.color;
    let moved: string[]=[];
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to;assert.match(from,/^[a-h][1-8]$/);assert.match(to,/^[a-h][1-8]$/);
      const p=at(expected.pieces,from)!;assert.ok(p,label);assert.equal(p.owner,actor,label);assert.equal(expected.turn.moveMade,false,label);
      const victim=at(expected.pieces,to);assert.ok(!victim || victim.owner!==actor && !victim.royal,label);
      assert.ok(reaches(expected.pieces,p,to,walls,!!victim),label);assert.equal(action.promotion,undefined,label);
      if(n>=65 && n<=83) assert.ok(victim,`${label}: Vendetta capture`);
      if(victim){victim.square=null;victim.zone='captured';victim.capturedBy=actor;}
      moved=[p.id];p.square=to as SquareName;
      half=p.role==='pawn'||victim?0:half+1;full+=actor==='black'?1:0;active=actor==='white'?'b':'w';epFen='-';
      expected.enPassant=[];
      if(p.role==='pawn' && Math.abs(xy(from)[1]-xy(to)[1])===2) {
        const target=square(xy(from)[0],(xy(from)[1]+xy(to)[1])/2);expected.enPassant=[{target,pawnId:p.id}];
        if(n===16) epFen='c6';
      }
      expected.turn.phase='afterMove';expected.turn.moveMade=true;
      expected.shieldMove={player:actor,pieceIds:moved,capturedOpponent:!!victim};
      const event: GameEvent={type:'move',from:from as SquareName,to:to as SquareName};
      if(victim)event.capturedId=victim.id;
      if(actor==='white'){event.movedPieceId=p.id;event.movedRoles=[p.role];}
      expected.history.push(event);
      if(n===46){rescueBefore=structuredClone(before);expected.pendingRescue={before:input,fen:before.fen,pieces:before.pieces,enPassant:before.enPassant,historyLength:before.history.length,movedPieceIds:moved};}
    } else if(action.type==='endTurn') {
      assert.equal(expected.turn.moveMade,true,label);assert.equal(checked(expected.pieces,actor,walls),false,label);
      expected.turn={color:other(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};delete expected.shieldMove;
      if(n>=64 && n<=84) {
        const options=captures(expected.pieces,other(actor),walls);
        assert.equal(options.length===0,n===84,`${label}: independent Vendetta expiry`);
        if(n===84){expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='vendetta');expected.players.white.discard.push({id:'white-hand-4-vendetta',cardId:'vendetta'});}
      }
    } else {
      assert.equal(action.type,'playCard',label);if(action.type!=='playCard')throw Error(label);
      const [id,instance,target]=cardRows[n]!;assert.deepEqual([action.cardId,action.cardInstanceId,action.target],[id,instance,target],label);
      assert.ok(CARD_CATALOG[id]!.timing.includes(before.turn.phase),label);
      assert.equal(before.turn.cardPlays[actor],0,label);
      const player=expected.players[actor],card=player.hand.find(c=>c.id===instance)!;assert.ok(card,label);assert.equal(card.cardId,id,label);
      player.hand=player.hand.filter(c=>c.id!==instance);player.hand.push(player.deck.shift()!);expected.turn.cardPlays[actor]=1;
      if(!continuing.has(id))player.discard.push(card);
      let movement: Array<{from:SquareName;to:SquareName}>=[];
      const relocate=(pairs: Array<[SquareName,SquareName]>)=>{
        movement=pairs.map(([from,to])=>({from,to}));
        const changes=pairs.map(([from,to])=>({p:at(expected.pieces,from)!,to}));
        for(const {p,to} of changes){assert.ok(p,label);moved.push(p.id);p.square=to;}
      };
      if(n===12){relocate([['a1','h1'],['h1','h8'],['a8','a1'],['h8','a8']]);rights='-';epFen='g6';}
      if(n===19)relocate([['h1','b1'],['b1','h1']]);
      if(n===21)relocate([['f7','e6']]);
      if(n===42)relocate([['b1','a1'],['a1','b1']]);
      if(n===56){relocate([['b7','b5']]);expected.enPassant=[{target:'b6',pawnId:'black-pawn-b7'}];epFen='b6';}
      if([21,42,56].includes(n)) {
        expected.turn.phase='afterMove';expected.turn.moveMade=true;active='w';full++;half=n===42?half+1:0;
        if(n!==56){expected.enPassant=[];epFen='-';}
        expected.shieldMove={player:actor,pieceIds:n===42?[]:moved,capturedOpponent:false};
      }
      if(n===34){at(expected.pieces,'d7')!.royal=false;at(expected.pieces,'e7')!.royal=true;expected.effects.push({type:'coup',owner:actor,card,princeId:'black-king-e8',kingId:'black-knight-g8',princeRole:'king'});}
      if(n===63)expected.effects.push({type:'vendetta',owner:actor,card});
      if(n===86){at(expected.pieces,'e8')!.royal=true;at(expected.pieces,'e7')!.royal=false;expected.effects=[];player.discard.push({id:'black-hand-2-coup',cardId:'coup'});}
      if(n===91||n===100){const wall=n===91?{from:'g7',to:'h7'}:{from:'a1',to:'b2'};walls.push(wall);expected.effects.push({type:'fortification',owner:actor,card,...wall});}
      let event: GameEvent={type:'cardPlayed',cardId:id,movement,preservePreviousMove:![21,42,56].includes(n)};
      if(target!==undefined && n!==86)event.target=target as GameEvent['target'];
      if(n===91)event={type:'cardPlayed',cardId:id,target:{from:'g7',to:'h7'}};
      if(n===100)event={type:'cardPlayed',cardId:id,target:{from:'a1',to:'b2'},copiedCardId:'fortification',player:'black'};
      if(n===47) {
        assert.ok(checked(expected.pieces,'black',walls),'Truce immediately expires under raw royal check');
        expected.pieces=structuredClone(rescueBefore!.pieces);expected.enPassant=structuredClone(rescueBefore!.enPassant);
        expected.history=structuredClone(rescueBefore!.history);expected.turn.phase='beforeMove';expected.turn.moveMade=false;
        expected.pendingRescue=null;half=2;full=11;active='b';epFen='-';
        event={type:'cardFizzled',cardId:'truce',reason:'SELF_CHECK',movement:[],preservePreviousMove:false};
      }
      expected.history.push(event);
    }
    expected.fen=`${placement(expected.pieces)} ${active} ${rights} ${epFen} ${half} ${full}`;
    const result=applyAction(actual,action);assert.deepEqual(actual,input,`${label}: complete input immutability`);assert.ok(result.ok,label);actual=result.state;
    assert.deepEqual(actual.pieces,expected.pieces,`${label}: physical identities, captors and zones`);
    assert.deepEqual(actual.players,expected.players,`${label}: exact card identity, order, spending and draws`);
    assert.deepEqual(actual.fen.split(' '),expected.fen.split(' '),`${label}: all six FEN fields`);
    assert.deepEqual(actual.turn,expected.turn,label);assert.deepEqual(actual.effects,expected.effects,label);assert.deepEqual(actual.history,expected.history,label);
    assert.deepEqual(actual.enPassant,expected.enPassant,label);assert.deepEqual(actual.shieldMove,expected.shieldMove,label);
    assert.deepEqual(actual.pendingRescue??null,expected.pendingRescue??null,`${label}: complete rescue checkpoint`);
    for(const key of ['chaosForbidden','plotsExecution','plotsAllowances','fogLocked','riposteLostMoves','riposteSkipped','riposteCheckDeferred','pendingAbduction','pendingDoomsayer','underElfHill'] as const) {
      const value=actual[key];assert.ok(value==null || Array.isArray(value)&&value.length===0,`${label}: ${key} absent`);
    }
    assert.equal(actual.orientation,0,label);assert.equal(actual.outcome,null,label);
    for(const color of ['white','black'] as const) assert.equal(isKingInCheck(actual,color),checked(expected.pieces,color,walls),`${label}: independent ${color} royal attacks`);
    // Check every prospective EP capture in a before-move context, regardless of raw FEN serialization.
    const captor=active==='w'?'white':'black';
    const context=structuredClone(actual);context.turn={color:captor,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};context.pendingRescue=null;
    const epContextBefore=structuredClone(context);
    const epDests=expected.enPassant.length?legalDests(context):new Map<SquareName,SquareName[]>();
    assert.deepEqual(context,epContextBefore,`${label}: EP destination query input immutable`);
    for(const ep of expected.enPassant)for(const pawn of expected.pieces.filter(p=>p.owner===captor && p.role==='pawn' && p.zone==='board')) {
      const board=structuredClone(expected.pieces), victim=board.find(p=>p.id===ep.pawnId)!;
      let legal=reaches(board,pawn,ep.target,walls,true)&&!at(board,ep.target);
      if(legal){board.find(p=>p.id===pawn.id)!.square=ep.target;victim.square=null;victim.zone='captured';legal=!checked(board,captor,walls);}
      assert.equal(epDests.get(pawn.square!)?.includes(ep.target)??false,legal,`${label}: EP ${pawn.square}-${ep.target}`);
    }
    if(n===46) {
      const checkpoint=structuredClone(actual);
      const witness=applyAction(actual,{type:'playCard',cardId:'peace-talks',cardInstanceId:'black-hand-1-peace-talks',target:'black-hand-2-coup'});
      assert.deepEqual(actual,checkpoint,'rescue witness input immutable');assert.ok(witness.ok,'held Peace Talks rescue executes');
      const rescued=structuredClone(expected.pieces);rescued.find(p=>p.id==='black-king-e8')!.royal=true;rescued.find(p=>p.id==='black-knight-g8')!.royal=false;
      assert.deepEqual(witness.state.pieces,rescued,'rescue preserves actual g5xh4 capture and restores Prince d7 royalty');
      assert.equal(checked(rescued,'black',walls),false,'d7 King safe after Coup cancellation');assert.equal(witness.state.pendingRescue??null,null);
      assert.equal(witness.state.history.at(-1)?.type,'cardPlayed');assert.equal(witness.state.fen,expected.fen);
      const rescuedPlayers=structuredClone(expected.players), black=rescuedPlayers.black;
      black.hand=black.hand.filter(card=>card.id!=='black-hand-1-peace-talks');
      black.hand.push(black.deck.shift()!);
      black.discard.push({id:'black-hand-1-peace-talks',cardId:'peace-talks'},{id:'black-hand-2-coup',cardId:'coup'});
      assert.deepEqual(witness.state.players,rescuedPlayers,'rescue spends Peace Talks once, draws one and discards the canceled physical Coup');
      assert.deepEqual(witness.state.turn,{color:'black',phase:'afterMove',moveMade:true,cardPlays:{white:0,black:1}},'rescue consumes Black card allowance and retains completed capture');
      assert.deepEqual(witness.state.effects,[],'rescue cancels the only continuing effect');
      const rescueEndInput=structuredClone(witness.state), ended=applyAction(witness.state,{type:'endTurn'});
      assert.deepEqual(witness.state,rescueEndInput,'rescue endTurn input immutable');assert.ok(ended.ok,'rescued capture can complete its turn');
      assert.deepEqual(ended.state.turn,{color:'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}});
    }
    if(n===47)for(const cardId of ['mystic-shield','fireball']) {
      const probe=structuredClone(actual);probe.turn.cardPlays.black=0;probe.players.black.hand.push({id:`probe-${cardId}`,cardId});
      const unchanged=structuredClone(probe), result=applyAction(probe,{type:'playCard',cardId,cardInstanceId:`probe-${cardId}`,target:'g5'});
      assert.deepEqual(probe,unchanged,'inert historical shield timing probe is immutable');assert.equal(result.ok,false);
      if(!result.ok)assert.equal(result.error.code,'INVALID_TIMING','canceled move cannot authorize an after-move card');
    }
  }
  assert.equal(trace.moves,50);assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,11);
  assert.equal(actual.fen,'1nr1k3/6b1/3nP3/p3p1PR/2p1P3/p1P2P2/1P2Q3/R4K1N w - - 5 27');
});

test('iteration 172: deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/172.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
