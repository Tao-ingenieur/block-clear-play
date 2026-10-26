import test from 'node:test';
import assert from 'node:assert/strict';
import {RULESET, acceptInputs, createInputGate, createSession, sessionStep} from '../packages/core/src/index.ts';
import type {Input} from '../packages/core/src/index.ts';

test('session handshake, ignored out-of-order events and monotonic close',()=>{
  const session=createSession();
  assert.deepEqual(sessionStep(session,{type:'poll',now:0}),[]);
  assert.deepEqual(sessionStep(session,{type:'start',now:1}),['connect']);
  assert.deepEqual(sessionStep(session,{type:'start',now:1}),[]);
  assert.deepEqual(sessionStep(session,{type:'welcome',now:2,protocol:1,ruleset:RULESET}),[]);
  assert.deepEqual(sessionStep(session,{type:'transportOpen',now:3}),['sendHello']);
  assert.deepEqual(sessionStep(session,{type:'welcome',now:4,protocol:1,ruleset:RULESET}),['ready']);
  assert.equal(session.phase,'ready');
  assert.throws(()=>sessionStep(session,{type:'poll',now:3}));
  assert.throws(()=>sessionStep(session,{type:'poll',now:4.5}));
  assert.deepEqual(sessionStep(session,{type:'close',now:5}),['closeTransport']);
  assert.deepEqual(sessionStep(session,{type:'start',now:6}),[]);
});
test('session backoff grows to a cap; successful handshake resets it; incompatible versions close',()=>{
  const session=createSession();
  sessionStep(session,{type:'start',now:0});
  let now=0;
  for(const delay of [500,1000,2000,4000,8000,8000]) {
    assert.deepEqual(sessionStep(session,{type:'disconnect',now}),['closeTransport']);
    assert.equal(session.retryAt,now+delay);
    assert.deepEqual(sessionStep(session,{type:'poll',now:now+delay-1}),[]);
    now+=delay;
    assert.deepEqual(sessionStep(session,{type:'poll',now}),['connect']);
  }
  sessionStep(session,{type:'transportOpen',now});
  sessionStep(session,{type:'welcome',now,protocol:1,ruleset:RULESET});
  assert.equal(session.attempts,0);
  sessionStep(session,{type:'disconnect',now});
  assert.equal(session.retryAt,now+500);
  for(const welcome of [{protocol:2,ruleset:RULESET},{protocol:1,ruleset:'other'}]) {
    const incompatible=createSession();
    sessionStep(incompatible,{type:'start',now:0});
    sessionStep(incompatible,{type:'transportOpen',now:1});
    assert.deepEqual(sessionStep(incompatible,{type:'welcome',now:2,...welcome}),['closeTransport']);
    assert.equal(incompatible.phase,'closed');
  }
});
test('online gate rejects duplicate, future, stale, excessive and illegal input atomically',()=>{
  const gate=createInputGate();
  const input:Input={tick:100,sequence:0,action:'left',pressed:true};
  acceptInputs(gate,[input],100);
  for(const invalid of [input,{...input,tick:39,sequence:1},{...input,tick:107,sequence:1},
    {...input,sequence:1,action:'rotate180'},{...input,sequence:1,action:'invalid'},
    {...input,sequence:1,pressed:1},{...input,sequence:1.5},{...input,tick:0,sequence:1}]) {
    const before=JSON.stringify(gate);
    assert.throws(()=>acceptInputs(gate,[invalid as Input],100));
    assert.equal(JSON.stringify(gate),before);
  }
  acceptInputs(gate,Array.from({length:7},(_,i)=>({...input,sequence:i+1})),100);
  assert.throws(()=>acceptInputs(gate,[{...input,sequence:8}],100));
  assert.throws(()=>acceptInputs(gate,Array(65).fill(input),100));
  assert.throws(()=>acceptInputs(gate,[],-1));
  acceptInputs(gate,[],200);
  assert.deepEqual(gate.acceptedPerTick,{});
});
