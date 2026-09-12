// Unfixed audit regressions, 12.09.2026; production baseline c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState,SquareName,Color} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
type Fixture={name:string;fen:string;opponentFrom:SquareName;opponentTo:SquareName;king:SquareName;rook:SquareName;kingTo:SquareName;rookTo:SquareName;owner:Color};
const fixtures:Fixture[]=[
 {name:'White right',fen:'k7/8/8/8/8/8/8/4KR2 b - - 0 1',opponentFrom:'a8',opponentTo:'b8',king:'e1',rook:'f1',kingTo:'g1',rookTo:'f1',owner:'white'},
 {name:'White left',fen:'k7/8/8/8/8/8/8/3RK3 b - - 0 1',opponentFrom:'a8',opponentTo:'b8',king:'e1',rook:'d1',kingTo:'c1',rookTo:'d1',owner:'white'},
 {name:'White up',fen:'k7/8/8/8/4R3/4K3/8/8 b - - 0 1',opponentFrom:'a8',opponentTo:'b8',king:'e3',rook:'e4',kingTo:'e5',rookTo:'e4',owner:'white'},
 {name:'Black down',fen:'8/8/4k3/4r3/8/8/8/K7 w - - 0 1',opponentFrom:'a1',opponentTo:'b1',king:'e6',rook:'e5',kingTo:'e4',rookTo:'e5',owner:'black'},
];
function position(f:Fixture,challenged=true){let s=createGameState({fen:f.fen,hands:{white:['challenge','sanctuary'],black:['challenge','sanctuary']}});s=act(s,{type:'move',from:f.opponentFrom,to:f.opponentTo});if(challenged)s=act(s,{type:'playCard',cardId:'challenge',target:f.rook});return act(s,{type:'endTurn'});}
function sanctuary(s:GameState,f:Fixture){return act(s,{type:'playCard',cardId:'sanctuary',target:{king:f.king,rook:f.rook}});}
// Bug: Sanctuary's adjacent Rook stays still, but it is an essential operative
// target of the replacement move (§13.12). It therefore satisfies Challenge
// under the documented recommended ruling in §18.2; the reducer rejects it.
// This expectation follows that recommended ruling, not an explicit official
// card-pair FAQ. Distant challenged Rooks and unchallenged adjacent Rooks control
// for the fixture's legality and isolate stationary operative participation.
function verify(f:Fixture,challenged:boolean){
 const before=position(f,challenged);
 const kingId=before.pieces.find(p=>p.square===f.king)?.id;
 const rookId=before.pieces.find(p=>p.square===f.rook)?.id;
 assert.ok(kingId);assert.ok(rookId);
 const s=sanctuary(before,f);
 assert.equal(s.pieces.find(p=>p.id===kingId)?.square,f.kingTo);
 assert.equal(s.pieces.find(p=>p.id===rookId)?.square,f.rookTo);
 assert.equal(s.turn.moveMade,true);
 assert.equal(act(s,{type:'endTurn'}).turn.color,f.owner==='white'?'black':'white');
}
for(const f of fixtures){
 test(`regression: ${f.name} challenged stationary Rook is used by Sanctuary`,()=>verify(f,true));
 test(`control: ${f.name} unchallenged stationary Rook participates in Sanctuary`,()=>verify(f,false));
}
const distant:Fixture[]=[
 {...fixtures[0],name:'White right distant',fen:'k7/8/8/8/8/8/8/4K2R b - - 0 1',rook:'h1'},
 {...fixtures[3],name:'Black down distant',fen:'8/8/4k3/8/8/8/4r3/K7 w - - 0 1',rook:'e2'},
];
for(const f of distant)test(`control: ${f.name} challenged Rook moves in Sanctuary`,()=>verify(f,true));
