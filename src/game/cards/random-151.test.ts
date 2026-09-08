import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Every numbered line was reviewed in order against rules §§8–14, 18.5, 21.1, 22.10.
const rationales = `
1 c2c3: White Pawn advances one empty square.
2 end: Black starts; no replacement draw without a discard.
3 blessing: e7-h4 is a clear diagonal through f6,g5; no capture; Black consumes move.
4 end: White starts after Blessing; Black allowance resets.
5 d1b3: Queen diagonal through vacated c2.
6 end: Black starts with board and clocks preserved.
7 b8a6: Knight jumps to empty a6.
8 end: White starts with both allowances reset.
9 b3d1: Queen returns diagonally through empty c2.
10 end: Black starts; no cards change zones.
11 bombard: h8-h5 jumps only h7 Pawn via empty h6; Black kingside right ends.
12 end: White starts after replacement Rook move.
13 d2d4: Pawn double through d3; opportunity d3 exists but no Black captor.
14 end: Black receives d3 opportunity; raw FEN has no legal EP target.
15 h5c5: Rook crosses g5,f5,e5,d5; previous EP expires.
16 end: White starts; no capture or pending rescue.
17 d1d2: Queen moves one empty file square.
18 end: Black starts with unchanged pieces.
19 evil-eye: Rook c5 legally threatens c3 via c4; remove only White c-Pawn; Rook stays.
20 end: White starts after stationary capture; Black card allowance resets.
21 b2b3: White b-Pawn advances into empty b3.
22 end: Black starts; no extra draw.
23 squaring-the-circle: a1,a8,h1 occupied; sole empty corner h8 receives Black Queen from d8.
24 end: White starts after geometry-free Queen relocation.
25 a2a4: Pawn double through a3; no Black Pawn can capture en passant.
26 end: Black receives a3 opportunity, with raw FEN target absent.
27 annexation: d7-d5 and f7-f5 have empty initial paths; preserve both d6,f6 opportunities.
28 end: White starts; no White Pawn is on rank five to use either opportunity.
29 d2h6: Queen crosses empty e3,f4,g5; Annexation opportunities expire.
30 panic: White spends after-move card; Black next move gets 15000ms; board and clocks unchanged.
31 end: Black begins timed turn; Panic survives.
32 timeout: Black loses safe turn; Panic ends; clock increments and fullmove advances.
33 e1d1: White King moves to safe empty d1; both White castling rights end.
34 end: Black starts; no card or move obligation remains.
35 b7b5: Black Pawn doubles through b6; no White Pawn on a5/c5 can capture EP.
36 end: White starts with b6 opportunity but no legal EP target.
37 h6e3: Queen retreats through g5,f4; EP expires.
38 end: Black starts after ordinary Queen move.
39 e8d7: Black King steps diagonally to safe d7; final Black castling right ends.
40 end: White starts with no castling rights.
41 e3f4: Queen moves one diagonal square.
42 end: Black starts; no changes to card zones.
43 c5c2: Rook crosses vacated c4,c3 to empty c2.
44 end: White starts; Rook on c2 does not attack King d1.
45 f4h4: Queen crosses g4 and captures physical Black e-Pawn on h4.
46 end: Black starts; capturedBy remains White.
47 c7c6: Black c-Pawn advances one empty square.
48 end: White starts after Pawn move.
49 h4f4: Queen traverses empty g4.
50 end: Black starts; no extra draw.
51 c2c5: Rook returns up empty c3,c4.
52 end: White starts with both Kings safe.
53 f4f5: Queen captures Black f-Pawn, checking d7 along e6.
54 end: Black receives check and must answer it.
55 d7e7: Black King leaves f5 diagonal and reaches safe e7.
56 end: White starts after check resolved.
57 f5d5: Queen crosses e5 and captures physical Black d-Pawn.
58 end: Black starts after capture; no rescue pending.
59 c8h3: Bishop traverses d7,e6,f5,g4, all empty.
60 end: White starts; Bishop h3 has no line to King d1.
61 d5f5: Queen crosses empty e5.
62 end: Black starts after quiet Queen move.
63 c5e5: Rook moves through newly empty d5.
64 end: White starts; no card allowances spent.
65 f5g4: Queen makes one diagonal move.
66 end: Black starts; all capture records persist.
67 e5e4: Rook advances one empty file square.
68 end: White starts; e4 Rook is not aligned with d1 King.
69 c1d2: Bishop moves to empty d2.
70 end: Black starts after Bishop move.
71 h3g2: Bishop captures White g-Pawn diagonally.
72 end: White starts; g-Pawn capturedBy Black.
73 h2h3: White h-Pawn advances one square.
74 end: Black starts; no replacement draw.
75 g7g6: Black g-Pawn advances one square.
76 end: White starts after Pawn move.
77 g4f4: Queen moves one empty rank square.
78 forbidden-city: Empty b2 becomes impassable; retained card draws Vulture without entering discard.
79 end: Black starts; b2 marker persists.
80 c6c5: Black c-Pawn advances; b2 obstruction irrelevant to this path.
81 end: White starts; marker stays b2.
82 g1f3: Knight jumps to empty f3.
83 end: Black starts; no mandatory choices.
84 h8e5: Queen crosses g7,f6, both empty.
85 end: White starts after Queen move.
86 a4b5: White a-Pawn captures physical Black b-Pawn normally, not en passant.
87 end: Black starts; capturedBy White persists.
88 g2h3: Bishop captures physical White h-Pawn.
89 end: White starts; Black remains the h-Pawn captor.
90 f4e5: Queen captures Black Queen and checks King e7 through empty e6.
91 end: Black receives check along e-file.
92 h3e6: Bishop crosses g4,f5 and interposes e6 between e5 Queen and e7 King.
93 end: White starts after Black blocks check.
94 e5g3: Queen crosses empty f4.
95 end: Black starts; no capture or promotion occurs.
96 e7d8: Black King steps to safe empty d8.
97 end: White starts; marker and captured identities persist.
98 d2b4: Bishop crosses empty c3; forbidden b2 is not on this diagonal.
99 end: Black starts; b4 Bishop does not check d8.
100 c5c4: Black c-Pawn advances into empty c4.
101 end: White starts; no EP opportunity from a single step.
102 b4c5: Bishop advances diagonally into just-vacated c5.
103 end: Black starts; board and clocks unchanged.
104 e4e3: Rook advances one empty file square.
105 end: White starts; e3 Rook does not check d1.
106 c5b6: Bishop steps diagonally and checks King d8 through c7.
107 end: Black starts in Bishop check.
108 d8d7: Black King leaves Bishop diagonal for safe d7.
109 end: White starts after check resolved.
110 b6c5: Bishop retreats diagonally one square.
111 end: Black starts with marker still b2.
112 a6b4: Knight jumps to empty b4; no capture or check.
113 end: White starts after fiftieth ordinary move command.
`.trim().split('\n');

const cardActions: Record<number, GameAction> = {
  3: { type: 'playCard', cardId: 'blessing', cardInstanceId: 'black-hand-4-blessing', target: [{ from: 'e7', to: 'h4' }] },
  11: { type: 'playCard', cardId: 'bombard', cardInstanceId: 'black-hand-1-bombard', target: [{ from: 'h8', to: 'h5' }] },
  19: { type: 'playCard', cardId: 'evil-eye', cardInstanceId: 'black-deck-0-evil-eye', target: { attacker: 'c5', victim: 'c3' } },
  23: { type: 'playCard', cardId: 'squaring-the-circle', cardInstanceId: 'black-hand-3-squaring-the-circle', target: [{ from: 'd8', to: 'h8' }] },
  27: { type: 'playCard', cardId: 'annexation', cardInstanceId: 'black-deck-3-annexation', target: [{ from: 'd7', to: 'd5' }, { from: 'f7', to: 'f5' }] },
  30: { type: 'playCard', cardId: 'panic', cardInstanceId: 'white-hand-2-panic' },
  78: { type: 'playCard', cardId: 'forbidden-city', cardInstanceId: 'white-deck-0-forbidden-city', target: 'b2' },
};

test('iteration 151: deterministic campaign review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/151.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860151);
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.length, 113);
  assert.equal(rationales.length, trace.steps.length);
  let actual = createGameState(trace.initial);
  const expected = structuredClone(actual);
  let halfmove = 0, fullmove = 1, fenTurn: Color = 'white', castles = 'KQkq';
  let city = false;
  const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
  const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1];
  const at = (s: string, pieces = expected.pieces) => pieces.find(p => p.zone === 'board' && p.square === s);
  const geometry = (p: PieceState, to: string, capture: boolean, pieces = expected.pieces): boolean => {
    assert.ok(p.square);
    if (city && to === 'b2') return false;
    const [x,y] = xy(p.square), [tx,ty] = xy(to), dx = tx-x, dy = ty-y;
    if (!dx && !dy) return false;
    if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
    if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
    if (p.role === 'pawn') {
      const forward = p.owner === 'white' ? 1 : -1;
      if (capture) return Math.abs(dx) === 1 && dy === forward;
      if (dx || at(to,pieces)) return false;
      if (dy === forward) return true;
      const middle = `${String.fromCharCode(97+x)}${y+forward+1}`;
      return dy === 2*forward && (p.owner === 'white' ? y <= 1 : y >= 6)
        && !at(middle,pieces) && !(city && middle === 'b2');
    }
    const diagonal = Math.abs(dx) === Math.abs(dy), straight = !dx || !dy;
    if (!(p.role === 'queen' ? diagonal || straight : p.role === 'bishop' ? diagonal : straight)) return false;
    for (let i=1;i<Math.max(Math.abs(dx),Math.abs(dy));i++) {
      const square = `${String.fromCharCode(97+x+i*Math.sign(dx))}${y+i*Math.sign(dy)+1}`;
      if (at(square,pieces) || city && square === 'b2') return false;
    }
    return true;
  };
  // Only ordinary owned pieces and Forbidden City occur here. Assert this scope below;
  // there is no Pacifism, Truce, neutral controller, or other suppressed capture to omit.
  const checked = (color: Color, pieces = expected.pieces) => {
    const king = pieces.find(p => p.royal && p.owner === color)!;
    assert.ok(king.square);
    return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(p,king.square!,true,pieces));
  };
  const capture = (p: PieceState, actor: Color) => {
    assert.equal(p.royal,false);
    p.square = null; p.zone = 'captured'; p.capturedBy = actor;
  };
  const move = (from: string, to: string, actor: Color) => {
    assert.match(to,/^[a-h][1-8]$/);
    const p = at(from)!;
    assert.ok(p); assert.equal(p.owner,actor);
    const victim = at(to);
    if (victim) { assert.notEqual(victim.owner,actor); capture(victim,actor); }
    if (p.royal) castles = castles.replace(actor === 'white' ? /[KQ]/g : /[kq]/g,'');
    if (p.role === 'rook') {
      const right: Record<string,string> = { a1:'Q',h1:'K',a8:'q',h8:'k' };
      if (right[from]) castles = castles.replace(right[from],'');
    }
    p.square = to as SquareName;
    return p.role === 'pawn' || !!victim;
  };
  const advance = (actor: Color, reset: boolean) => {
    halfmove = reset ? 0 : halfmove+1;
    if (actor === 'black') fullmove++;
    fenTurn = other(actor);
    expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
  };
  const fen = () => {
    const ranks: string[] = [];
    const letters = { pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k' };
    for (let rank=8;rank>=1;rank--) {
      let row='', empty=0;
      for (const file of 'abcdefgh') {
        const piece=at(`${file}${rank}`);
        if (!piece) { empty++; continue; }
        if (empty) row+=empty;
        empty=0;
        row+=piece.owner === 'white' ? letters[piece.role].toUpperCase() : letters[piece.role];
      }
      if (empty) row+=empty;
      ranks.push(row);
    }
    // All four double-step events have no prospective legal capturing Pawn.
    return `${ranks.join('/')} ${fenTurn[0]} ${castles || '-'} - ${halfmove} ${fullmove}`;
  };
  for (const [i,step] of trace.steps.entries()) {
    const n=i+1, action=step.action, actor=expected.turn.color;
    assert.ok(rationales[i].startsWith(`${n} `));
    const token = rationales[i].split(' ')[1].replace(':','');
    const snapshot = structuredClone(actual);
    const previousPieces = structuredClone(expected.pieces);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from, to=action.to;
      assert.equal(token,from+to);
      assert.deepEqual(action,{type:'move',from,to});
      assert.equal(expected.turn.phase,'beforeMove');
      const p=at(from)!;
      assert.ok(p); assert.equal(geometry(p,to,!!at(to)),true,`step ${n}: physical geometry`);
      expected.enPassant=[];
      if (p.role === 'pawn' && Math.abs(Number(to[1])-Number(from[1])) === 2) {
        expected.enPassant=[{target:`${from[0]}${(Number(from[1])+Number(to[1]))/2}` as SquareName,pawnId:p.id}];
      }
      advance(actor,move(from,to,actor));
    } else if (action.type === 'playCard') {
      assert.deepEqual(action,cardActions[n],`step ${n}: exact card and target`);
      assert.equal(expected.turn.cardPlays[actor],0);
      const replacement = !['panic','forbidden-city'].includes(action.cardId);
      assert.equal(expected.turn.phase,replacement ? 'beforeMove' : 'afterMove');
      const player=expected.players[actor], index=player.hand.findIndex(c=>c.id === action.cardInstanceId);
      assert.ok(index>=0);
      const [card]=player.hand.splice(index,1);
      assert.equal(card.cardId,action.cardId);
      if (action.cardId !== 'forbidden-city') player.discard.push(card);
      player.hand.push(player.deck.shift()!);
      expected.turn.cardPlays[actor]++;
      if (replacement) expected.enPassant=[];
      if (n === 3) { assert.equal(geometry({...at('e7')!,role:'bishop'},'h4',false),true); advance(actor,move('e7','h4',actor)); }
      if (n === 11) {
        assert.equal(at('h7')?.role,'pawn'); assert.equal(at('h6'),undefined); assert.equal(at('h5'),undefined);
        advance(actor,move('h8','h5',actor));
      }
      if (n === 19) {
        assert.equal(geometry(at('c5')!,'c3',true),true);
        const hypothetical=structuredClone(expected.pieces);
        const attacker=at('c5',hypothetical)!;
        const victim=at('c3',hypothetical)!;
        victim.zone='captured'; victim.square=null; attacker.square='c3';
        assert.equal(checked(actor,hypothetical),false,'Evil Eye requires a legal capture, not only a ray');
        capture(at('c3')!,actor); advance(actor,true);
      }
      if (n === 23) {
        assert.deepEqual(['a1','a8','h1','h8'].filter(s=>!at(s)),['h8']);
        advance(actor,move('d8','h8',actor));
      }
      if (n === 27) {
        for (const square of ['d6','d5','f6','f5']) assert.equal(at(square),undefined);
        const d=at('d7')!, f=at('f7')!;
        expected.enPassant=[{target:'d6',pawnId:d.id},{target:'f6',pawnId:f.id}];
        move('d7','d5',actor); move('f7','f5',actor); advance(actor,true);
      }
      if (n === 30) expected.effects=[{type:'panic',owner:'white',player:'black',durationMs:15000}];
      if (n === 78) {
        assert.equal(at('b2'),undefined); city=true;
        expected.effects=[{type:'forbidden-city',owner:'white',card,square:'b2'}];
      }
      if (replacement) assert.equal(checked(other(actor)),false,'regular card does not directly checkmate');
    } else if (action.type === 'panicTimeout') {
      assert.equal(token,'timeout'); assert.equal(actor,'black'); assert.equal(checked(actor),false);
      expected.effects=[]; expected.enPassant=[]; advance(actor,false);
      expected.turn={color:'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    } else {
      assert.equal(action.type,'endTurn'); assert.equal(token,'end');
      assert.equal(expected.turn.moveMade,true); assert.equal(checked(actor),false);
      expected.turn={color:other(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    }
    if (action.type === 'endTurn' || action.type === 'panicTimeout') expected.shieldMove=undefined;
    else if (action.type === 'move' || action.type === 'playCard' && !['panic','forbidden-city'].includes(action.cardId)) {
      expected.shieldMove={player:actor,
        pieceIds:expected.pieces.filter((p,j)=>p.zone === 'board' && p.square !== previousPieces[j].square).map(p=>p.id),
        capturedOpponent:expected.pieces.some((p,j)=>p.zone === 'captured' && previousPieces[j].zone === 'board')};
    }
    expected.fen=fen();
    const result=applyAction(actual,action);
    assert.deepEqual(actual,snapshot,`step ${n}: complete input immutability`);
    assert.ok(result.ok,`step ${n}: ${rationales[i]}`);
    actual=result.state;
    assert.equal(actual.fen,expected.fen,`step ${n}: all six independently calculated FEN fields`);
    assert.deepEqual(actual.pieces,expected.pieces,`step ${n}: all physical identities and captors`);
    assert.deepEqual(actual.turn,expected.turn,`step ${n}: phase and exact card allowances`);
    assert.deepEqual(actual.players,expected.players,`step ${n}: exact card-zone order and replacement`);
    assert.deepEqual(actual.effects,expected.effects,`step ${n}: complete continuing/timed effects`);
    assert.deepEqual(actual.enPassant,expected.enPassant,`step ${n}: recorded opportunities`);
    assert.equal(actual.orientation,0); assert.equal(actual.outcome,null);
    assert.equal(actual.pendingRescue ?? null,null); assert.equal(actual.pendingDoomsayer ?? null,null);
    assert.equal(actual.pendingAbduction ?? null,null); assert.deepEqual(actual.underElfHill ?? [],[]);
    assert.equal(actual.chaosForbidden,undefined); assert.equal(actual.plotsExecution,undefined);
    assert.deepEqual(actual.plotsAllowances ?? [],[]); assert.deepEqual(actual.fogLocked ?? [],[]);
    assert.deepEqual(actual.riposteLostMoves ?? [],[]); assert.equal(actual.riposteSkipped,undefined);
    assert.equal(actual.riposteCheckDeferred,undefined); assert.deepEqual(actual.shieldMove,expected.shieldMove);
    for (const p of expected.pieces) {
      assert.equal(p.neutral,false); assert.equal(p.role,p.originalRole); assert.equal(p.promoted,false);
    }
    for (const color of ['white','black'] as const) {
      assert.equal(isKingInCheck(actual,color),checked(color),`step ${n}: independent ${color} royal attacks`);
    }
    if (action.type !== 'endTurn' && action.type !== 'panicTimeout') assert.equal(checked(actor),false);
    const prospective = structuredClone(actual);
    prospective.turn={color:fenTurn,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    const prospectiveDests=expected.enPassant.length ? legalDests(prospective) : new Map<SquareName,SquareName[]>();
    for (const ep of expected.enPassant) {
      const candidates=expected.pieces.filter(p=>p.zone === 'board' && p.owner === fenTurn && p.role === 'pawn' && geometry(p,ep.target,true));
      assert.deepEqual(candidates,[],`step ${n}: no prospective Pawn can use ${ep.target}`);
      for (const p of expected.pieces.filter(p=>p.zone === 'board' && p.owner === fenTurn && p.role === 'pawn')) {
        assert.equal((prospectiveDests.get(p.square!) ?? []).includes(ep.target),false,`step ${n}: uncapturable EP`);
      }
    }
  }
  assert.equal(actual.fen,'r4bn1/p2k3p/4b1p1/1PB5/1npP4/1P2rNQ1/4PP2/RN1K1B1R w - - 6 29');
  assert.equal(replayTrace(trace).fen, trace.finalFen);
});
