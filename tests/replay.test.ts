import test from 'node:test';
import assert from 'node:assert/strict';
import {RULESET, collides, createDuel, createGame, playReplay, receiveGarbage, restore, serialize, stateHash, step, stepDuel} from '../packages/core/src/index.ts';
import type {Action, GameState, Input, Replay} from '../packages/core/src/index.ts';
import {command, fourLine, positioned} from './helpers.ts';

test('snapshot restores exact deterministic state, including pressed keys and future garbage', () => {
  const a=createGame({seed:4294967295});
  step(a,[command(a,'left')]);
  receiveGarbage(a,[0,1,2],50,1);
  const b=restore(serialize(a));
  assert.equal(stateHash(a),stateHash(b));
  for (let i=0;i<200;i++) {
    const inputs = i===100 ? [command(a,'hard')] : [];
    assert.deepEqual(step(a,inputs),step(b,inputs));
    assert.equal(stateHash(a),stateHash(b));
  }
  const reversed=Object.fromEntries(Object.entries(a).reverse()) as unknown as GameState;
  assert.equal(stateHash(a),stateHash(reversed));
});
test('replay uses input tick/sequence and reproduces events and state', () => {
  const inputs: Input[]=[
    {tick:1,sequence:0,action:'left',pressed:true},
    {tick:24,sequence:1,action:'left',pressed:false},
    {tick:25,sequence:2,action:'cw',pressed:true},
    {tick:26,sequence:3,action:'hard',pressed:true},
    {tick:30,sequence:4,action:'hold',pressed:true},
  ];
  const replay: Replay={schema:1,ruleset:RULESET,config:createGame({seed:17}).config,endTick:500,inputs};
  const a=playReplay(replay), b=playReplay(replay);
  assert.deepEqual(a.events,b.events);
  assert.equal(stateHash(a.state),stateHash(b.state));
  const direct=createGame(replay.config);
  for (let tick=1;tick<=500;tick++) step(direct,inputs.filter(i=>i.tick===tick));
  assert.deepEqual(a.state,direct);
});
test('replay rejects wrong rules, excessive limits, unordered or post-game input', () => {
  const base: Replay={schema:1,ruleset:RULESET,config:createGame().config,endTick:1,inputs:[]};
  for (const invalid of [{schema:2},{ruleset:'other'},{endTick:-1},{endTick:10_000_001},{inputs:null},
    {inputs:[{tick:0,sequence:0,action:'hard',pressed:true}]},
    {inputs:[{tick:1,sequence:0,action:'left',pressed:true},{tick:1,sequence:0,action:'right',pressed:true}]},
    {endTick:2,inputs:[{tick:2,sequence:0,action:'left',pressed:true},{tick:1,sequence:1,action:'right',pressed:true}]},
    {config:{...base.config,mode:'ultra'},endTick:14401}]) assert.throws(()=>playReplay({...base,...invalid} as never));
  const game=createGame(), inputs: Input[]=[];
  while (game.status==='playing') {
    const input=command(game,'hard',true,game.tick);
    inputs.push(input);
    step(game,[input]);
  }
  const exact=playReplay({...base,endTick:game.tick,inputs});
  assert.equal(exact.state.status,'lost');
  assert.throws(()=>playReplay({...base,endTick:game.tick+1,inputs}));
  assert.throws(()=>playReplay({...base,endTick:game.tick+1,inputs:[...inputs,{tick:game.tick+1,sequence:game.tick,action:'hard',pressed:true}]}));
});
test('snapshot rejects malformed and inconsistent state instead of silently loading', () => {
  const state=createGame();
  const invalids: Record<string,unknown>[]=[
    {schema:2},{ruleset:'unknown'},{config:null},{board:[]},{score:-1},{tick:1.5},{level:0},
    {combo:-2},{lockResets:16},{gravity:120_000_000},{b2b:0},{holdUsed:'yes'},
    {hold:'X'},{status:'unknown'},{queue:['X']},{queue:Array(6).fill('I')},
    {random:{value:-1,bag:[]}},{random:{value:1,bag:['I','I']}},{garbageRandom:-1},
    {active:{kind:'I',x:30,y:20,rotation:0}},{active:{kind:'X',x:3,y:20,rotation:0}},
    {active:null},{active:0},{held:null},{held:{...state.held,direction:2}},
    {rotationMark:{kick:5,extended:false}},{garbage:null},
    {garbage:[{due:1,sequence:0,holes:[10]}]},
    {garbage:[{due:1,sequence:0,holes:[0]},{due:1,sequence:0,holes:[1]}]},
    {garbage:[{due:2,sequence:0,holes:[0]},{due:1,sequence:1,holes:[1]}]},
    {garbage:[{due:1,sequence:1,holes:[0]},{due:1,sequence:0,holes:[1]}]},
  ];
  for (const change of invalids) assert.throws(()=>restore(JSON.stringify({...state,...change})),JSON.stringify(change));
  assert.throws(()=>restore(JSON.stringify({...state,extra:1})));
  assert.throws(()=>restore(JSON.stringify({schema:1,ruleset:RULESET,config:state.config})));
  assert.throws(()=>restore('null'));
  assert.throws(()=>restore('{broken'));
  assert.throws(()=>restore(' '.repeat(1_000_001)));
  const obstructed=createGame();
  obstructed.board[20]!.fill('G');
  assert.throws(()=>restore(serialize(obstructed)));
});
test('fuzz: legal state invariants and snapshot continuation over 100 seeds', () => {
  const actions: Action[]=['left','right','cw','ccw','rotate180','hard','hold','soft'];
  for (let seed=0;seed<100;seed++) {
    let state=createGame({seed,allow180:true});
    let rng=seed+1;
    for (let tick=1;tick<=600&&state.status==='playing';tick++) {
      rng=(Math.imul(rng,1664525)+1013904223)>>>0;
      const input: Input={tick,sequence:tick,action:actions[rng%actions.length]!,pressed:(rng&16)!==0};
      step(state,[input]);
      assert.equal(state.board.length,40);
      assert.ok(state.board.every(r=>r.length===10));
      assert.ok(Number.isSafeInteger(state.score));
      if (state.active) assert.equal(collides(state.board,state.active),false);
      if (tick%50===0) {
        const recovered=restore(serialize(state));
        assert.equal(stateHash(state),stateHash(recovered));
        state=recovered;
      }
    }
  }
});
test('duel uses same bag, delays outgoing garbage, preserves deterministic ordering', () => {
  const duel=createDuel(17);
  assert.equal(duel.players[0].active!.kind,duel.players[1].active!.kind);
  fourLine(duel.players[0]);
  fourLine(duel.players[1]);
  const events=stepDuel(duel,[[command(duel.players[0],'hard')],[command(duel.players[1],'hard')]]);
  assert.equal(events[0].find(e=>e.type==='lock')!.attack,14);
  assert.equal(events[1].find(e=>e.type==='lock')!.attack,14);
  assert.equal(duel.players[0].garbage[0]!.due,61);
  assert.equal(duel.players[1].garbage[0]!.due,61);
  assert.deepEqual(duel.players.map(p=>p.garbage[0]!.sequence),[1,0]);
  const snapshot=JSON.stringify(duel);
  assert.throws(()=>stepDuel(duel,[[],[{tick:999,sequence:0,action:'hard',pressed:true}]]));
  assert.equal(JSON.stringify(duel),snapshot);
});
test('duel handles win and simultaneous loss, stops after completion', () => {
  for (const both of [false,true]) {
    const duel=createDuel(1);
    duel.players[0]=positioned('O',3,18);
    duel.players[0].board[20]![4]='G';
    if (both) {
      duel.players[1]=positioned('O',3,18);
      duel.players[1].board[20]![4]='G';
    }
    stepDuel(duel,[[command(duel.players[0],'hard')],both?[command(duel.players[1],'hard')]:[]]);
    assert.equal(duel.result,both?'draw':'player1');
    assert.deepEqual(stepDuel(duel,[[],[]]),[[],[]]);
  }
  const duel=createDuel(1);
  duel.players[1]=positioned('O',3,18);
  duel.players[1].board[20]![4]='G';
  stepDuel(duel,[[],[command(duel.players[1],'hard')]]);
  assert.equal(duel.result,'player0');
});
