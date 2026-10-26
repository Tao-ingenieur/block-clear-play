import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROLS, GRAVITY, createGame, generateHoles, ghost, introductoryPuzzles, receiveGarbage, releaseInputs,
  serialize, step} from '../packages/core/src/index.ts';
import {command, fourLine, positioned, tap, ticks} from './helpers.ts';

test('create validates config and creates independent deterministic state', () => {
  const a = createGame({seed:0}), b = createGame({seed:0});
  assert.equal(serialize(a),serialize(b));
  assert.equal(a.queue.length,5);
  assert.equal(a.active!.y,19);
  a.board[20]![0]='G';
  assert.equal(b.board[20]![0],null);
  assert.throws(() => createGame({seed:-1}));
  assert.throws(() => createGame({seed:2**32}));
  assert.throws(() => createGame({mode:'puzzle'}));
  assert.throws(() => createGame({preset:'invalid' as never}));
  assert.throws(() => createGame({mode:'invalid' as never}));
  assert.throws(() => createGame({allow180:1 as never}));
  const puzzle = introductoryPuzzles()[0]!.puzzle;
  assert.throws(() => createGame({puzzle}));
  for (const invalid of [{board:[]},{queue:[]},{queue:['X']},{maxPieces:0},{targetLines:0},{hold:0},{id:0}]) {
    assert.throws(() => createGame({mode:'puzzle',puzzle:{...puzzle,...invalid} as never}));
  }
});
test('hold is once per lock, preserves canonical spawn and re-enables after lock', () => {
  const state = createGame(), first = state.active!.kind, second = state.queue[0]!;
  tap(state,'cw');
  tap(state,'hold');
  assert.equal(state.hold,first);
  assert.equal(state.active!.kind,second);
  assert.equal(state.active!.rotation,0);
  const heldActive=state.active!.kind;
  tap(state,'hold');
  assert.equal(state.active!.kind,heldActive);
  tap(state,'hard');
  assert.equal(state.holdUsed,false);
  tap(state,'hold');
  assert.equal(state.active!.kind,first);
  assert.equal(state.active!.rotation,0);
});
test('hard drop lands on ghost, immediately locks and scores once', () => {
  const state = positioned('O',3,20);
  const expected = ghost(state.board,state.active!);
  const events = tap(state,'hard');
  const lock = events.find(e => e.type==='lock')!;
  assert.equal(lock.drop,(expected.y-20)*2);
  assert.equal(state.score,lock.total);
  assert.equal(state.pieces,1);
  assert.equal(state.board[39]![4],'O');
});
test('standard gravity is one cell per second; soft drop adds actual-cell points', () => {
  const state=positioned('T',3,20);
  ticks(state,119);
  assert.equal(state.active!.y,20);
  ticks(state,1);
  assert.equal(state.active!.y,21);
  step(state,[command(state,'soft')]);
  ticks(state,5);
  assert.equal(state.active!.y,22);
  assert.equal(state.score,1);
  step(state,[command(state,'soft',false)]);
  assert.equal(state.held.soft,false);
  assert.equal(GRAVITY[0],1_000_000);
  assert.equal(GRAVITY[39],2_400_000_000);
});
test('DAS, ARR, opposing keys, duplicate keydown and key release', () => {
  const state=positioned('O',3,20);
  step(state,[command(state,'left')]);
  assert.equal(state.active!.x,2);
  ticks(state,17);
  assert.equal(state.active!.x,2);
  ticks(state,1);
  assert.equal(state.active!.x,1);
  step(state,[command(state,'left')]);
  assert.equal(state.active!.x,1);
  step(state,[command(state,'right')]);
  assert.equal(state.active!.x,2);
  assert.equal(state.held.direction,1);
  step(state,[command(state,'right',false)]);
  assert.equal(state.held.direction,-1);
  releaseInputs(state);
  ticks(state,30);
  assert.equal(state.active!.x,2);
  assert.equal(state.held.direction,0);
});
test('hardcore ARR=0 reaches wall; failed wall shift does not reset lock', () => {
  const state=positioned('O',3,38);
  state.config.preset='hardcore';
  step(state,[command(state,'left')]);
  ticks(state,12);
  assert.equal(state.active!.x,-1);
  const resets=state.lockResets;
  ticks(state,1);
  assert.equal(state.lockResets,resets);
});
test('lock delay resets on successful grounded moves and is capped at 15', () => {
  const state=positioned('T',3,38);
  ticks(state,59);
  assert.equal(state.pieces,0);
  step(state,[command(state,'left')]);
  assert.equal(state.lockTicks,1);
  assert.equal(state.lockResets,1);
  releaseInputs(state);
  for (let i=0;i<30;i++) tap(state,i%2===0?'right':'left');
  assert.equal(state.lockResets,15);
  ticks(state,60);
  assert.equal(state.pieces,1);
});
test('O rotations cannot renew the lock deadline; failed rotation preserves previous mark', () => {
  const state=positioned('O',3,38);
  ticks(state,59);
  const events=step(state,[command(state,'cw')]);
  assert.ok(events.some(e=>e.type==='lock'));
  assert.equal(state.pieces,1);
  const blocked=positioned('T',3,38);
  blocked.config.allow180=true;
  blocked.rotationMark={kick:2,extended:false};
  step(blocked,[command(blocked,'rotate180')]);
  assert.deepEqual(blocked.rotationMark,{kick:2,extended:false});
});
test('180 extension is disabled by default, enabled explicitly, no Spin reward', () => {
  const state=positioned('T',3,25);
  tap(state,'rotate180');
  assert.equal(state.active!.rotation,0);
  state.config.allow180=true;
  tap(state,'rotate180');
  assert.equal(state.active!.rotation,2);
  assert.equal(state.rotationMark!.extended,true);
  tap(state,'ccw');
  assert.equal(state.active!.rotation,1);
});
test('rotation mark clears only on successful translation or nonzero drop', () => {
  const state=positioned('T',3,30);
  tap(state,'cw');
  assert.ok(state.rotationMark);
  tap(state,'left');
  assert.equal(state.rotationMark,null);
  tap(state,'cw');
  ticks(state,120);
  assert.equal(state.rotationMark,null);
});
test('four-line clear: level-before-clear score, perfect clear and B2B chain', () => {
  const state=createGame();
  state.lines=9;
  fourLine(state);
  let events=tap(state,'hard');
  let lock=events.find(e=>e.type==='lock')!;
  assert.equal(lock.level,1);
  assert.equal(lock.total,2800);
  assert.equal(state.level,2);
  assert.equal(state.b2b,true);
  fourLine(state);
  events=tap(state,'hard');
  lock=events.find(e=>e.type==='lock')!;
  assert.equal(lock.b2b,true);
  assert.equal(lock.combo,1);
  assert.equal(lock.total,6500);
});
test('garbage cancellation, delayed injection, cap=8 and independent random stream', () => {
  const state=createGame(), bagBefore=JSON.stringify(state.random);
  const holes=generateHoles(state,20);
  assert.equal(JSON.stringify(state.random),bagBefore);
  assert.ok(holes.every(h=>h>=0&&h<10));
  assert.throws(()=>generateHoles(state,-1));
  receiveGarbage(state,[0,1,2,3],0,1);
  fourLine(state);
  const lock=tap(state,'hard').find(e=>e.type==='lock')!;
  assert.equal(lock.attack,10);
  assert.equal(state.garbage.length,0);
  receiveGarbage(state,Array(10).fill(3),state.tick+2,2);
  state.active={kind:'O',rotation:0,x:3,y:20};
  step(state,[command(state,'hard')]);
  assert.equal(state.garbage[0]!.holes.length,10);
  state.active={kind:'O',rotation:0,x:0,y:20};
  step(state,[command(state,'hard')]);
  assert.equal(state.garbage[0]!.holes.length,2);
  assert.equal(state.board[39]![3],null);
  assert.equal(state.board[39]![2],'G');
});
test('garbage partial cancellation, packet ordering and invalid packets', () => {
  const state=createGame();
  receiveGarbage(state,[2],10,4);
  receiveGarbage(state,[1],10,3);
  receiveGarbage(state,[0],9,2);
  assert.deepEqual(state.garbage.map(p=>p.sequence),[2,3,4]);
  assert.throws(()=>receiveGarbage(state,[0],0,2));
  assert.throws(()=>receiveGarbage(state,[],0,10));
  assert.throws(()=>receiveGarbage(state,[10],0,10));
  assert.throws(()=>receiveGarbage(state,[0],-1,10));
  assert.throws(()=>receiveGarbage(state,[0],0,-1));
  receiveGarbage(state,Array(20).fill(0),0,5);
  fourLine(state);
  const lock=tap(state,'hard').find(e=>e.type==='lock')!;
  assert.equal(lock.attack,0);
  assert.equal(state.garbage.find(p=>p.sequence===5)!.holes.length,6);
});
test('topout through hidden locked cells, spawn obstruction and garbage overflow', () => {
  const hidden=positioned('O',3,18);
  hidden.board[20]![4]='G'; hidden.board[20]![5]='G';
  assert.equal(tap(hidden,'hard').at(-1)!.type,'end');
  assert.equal(hidden.status,'lost');
  const spawn=createGame();
  spawn.board[19]!.fill('G');
  tap(spawn,'hold');
  assert.equal(spawn.status,'lost');
  const overflow=positioned('O',0,38);
  overflow.board[0]![9]='G';
  receiveGarbage(overflow,[0],0,0);
  tap(overflow,'hard');
  assert.equal(overflow.status,'lost');
  assert.deepEqual(step(overflow),[]);
});
test('Sprint/Master goals, 20G and timed modes exact cutoffs', () => {
  for (const [mode,target] of [['sprint',40],['master',200]] as const) {
    const state=createGame({mode});
    state.lines=target-2;
    fourLine(state);
    tap(state,'hard');
    assert.equal(state.status,'won');
  }
  const master=createGame({mode:'master'}), start=master.active!.y;
  step(master);
  assert.equal(master.active!.y,start+10);
  for (const mode of ['ultra','blitz'] as const) {
    const state=createGame({mode});
    state.tick=14399;
    const events=step(state,[command(state,'hard')]);
    assert.deepEqual(events,[{type:'end',tick:14400,reason:'time'}]);
    assert.equal(state.pieces,0);
  }
  const blitz=createGame({mode:'blitz'});
  blitz.tick=1799;
  step(blitz);
  assert.equal(blitz.level,2);
  blitz.tick=14000;
  step(blitz);
  assert.equal(blitz.level,8);
});
test('20 original puzzles have verifiable solutions, no gravity and restricted Hold', () => {
  const entries=introductoryPuzzles();
  assert.equal(entries.length,20);
  for (const entry of entries) {
    const state=createGame({mode:'puzzle',puzzle:entry.puzzle});
    const y=state.active!.y;
    ticks(state,500);
    assert.equal(state.active!.y,y);
    tap(state,'hold');
    assert.equal(state.hold,null);
    for (const action of entry.solution) tap(state,action);
    assert.equal(state.status,'won',entry.puzzle.id);
    assert.equal(state.lines,entry.puzzle.targetLines);
  }
});
test('puzzle budget failure and exhausted queue are deterministic', () => {
  const entry=introductoryPuzzles()[0]!;
  const state=createGame({mode:'puzzle',puzzle:entry.puzzle});
  tap(state,'hard');
  assert.equal(state.status,'lost');
  const hold=createGame({mode:'puzzle',puzzle:{...entry.puzzle,hold:true}});
  tap(hold,'hold');
  assert.equal(hold.status,'lost');
  const exhausted=createGame({mode:'puzzle',puzzle:{...entry.puzzle,maxPieces:2}});
  tap(exhausted,'hard');
  assert.equal(exhausted.status,'lost');
});
test('invalid input batches reject before mutation; ordering is explicit', () => {
  const state=createGame(), before=serialize(state);
  for (const input of [{...command(state,'left'),tick:2}, {...command(state,'left'),sequence:-1},
    {...command(state,'left'),action:'x'}, {...command(state,'left'),pressed:1}]) {
    assert.throws(()=>step(state,[input as never]));
    assert.equal(serialize(state),before);
  }
  assert.throws(()=>step(state,[command(state,'left'),command(state,'right')]));
  step(state,[command(state,'left',true,1),command(state,'right',true,2)]);
  assert.equal(state.held.direction,1);
  assert.deepEqual(CONTROLS.standard,{das:18,arr:3,lock:60,soft:20,resets:15});
});
test('release falls back to the still-held right key, and master locks after 300ms', () => {
  const state=positioned('O',3,20);
  step(state,[command(state,'right')]);
  step(state,[command(state,'left')]);
  step(state,[command(state,'left',false)]);
  assert.equal(state.held.direction,1);
  step(state,[command(state,'right',false)]);
  assert.equal(state.held.direction,0);
  const master=positioned('O',3,38);
  master.config.mode='master';
  ticks(master,35);
  assert.equal(master.pieces,0);
  ticks(master,1);
  assert.equal(master.pieces,1);
});
test('end-of-game stops further same-tick commands', () => {
  const state=positioned('O',3,18);
  state.board[20]![4]='G';
  step(state,[command(state,'hard',true,0),command(state,'hold',true,1)]);
  assert.equal(state.status,'lost');
  assert.equal(state.hold,null);
});
test('integrated T-Spin Single/Double/Triple are detected at zero-distance hard drop', () => {
  // A valid horizontal rotation into a one-line cavity.
  const single=positioned('T',3,37,1);
  single.board[38]!.fill('G');
  for(const x of [3,4,5]) single.board[38]![x]=null;
  for(const [x,y] of [[3,37],[5,37],[3,39],[5,39]]) single.board[y!]![x!]='G';
  step(single,[command(single,'ccw',true,0),command(single,'hard',true,1)]);
  assert.equal(single.lines,1);
  assert.equal(single.score,800);
  // Double cavity has a valid clockwise entry and three occupied corners.
  const double=positioned('T',3,37,1);
  double.board[38]!.fill('G'); double.board[39]!.fill('G');
  for(const x of [3,4,5]) double.board[38]![x]=null;
  double.board[39]![4]=null;
  double.board[37]![3]='G';
  const result=step(double,[command(double,'cw',true,0),command(double,'hard',true,1)]);
  assert.equal(result.find(e=>e.type==='lock')!.spin,'full');
  assert.equal(double.lines,2);
  assert.equal(double.score,1200);
  // Triple final orientation; mark records the successful final SRS kick.
  const triple=positioned('T',3,37,1);
  for(let y=37;y<40;y++) triple.board[y]!.fill('G');
  for(const [x,y] of [[4,37],[4,38],[5,38],[4,39]]) triple.board[y!]![x!]=null;
  triple.rotationMark={kick:4,extended:false};
  const events=step(triple,[command(triple,'hard')]);
  assert.equal(events.find(e=>e.type==='lock')!.spin,'full');
  assert.equal(events.find(e=>e.type==='lock')!.base,1600);
  assert.equal(events.find(e=>e.type==='lock')!.perfectClear,true);
  assert.equal(triple.lines,3);
  assert.equal(triple.score,3400);
});
