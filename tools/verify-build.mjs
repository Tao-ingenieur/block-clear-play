import assert from 'node:assert/strict';
import fs from 'node:fs';
import {playReplay as sourceReplay, stateHash as sourceHash} from '../packages/core/src/index.ts';
import {playReplay, stateHash, introductoryPuzzles, createGame, step} from '../../dist/core/index.js';

const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/seed-17.json',import.meta.url),'utf8'));
const source=sourceReplay(fixture), built=playReplay(fixture);
assert.deepEqual(built.state,source.state);
assert.deepEqual(built.events,source.events);
assert.equal(stateHash(built.state),sourceHash(source.state));
assert.equal(stateHash(built.state),fixture.expectedHash,'ruleset golden replay changed');
for (const {puzzle,solution} of introductoryPuzzles()) {
  const state=createGame({mode:'puzzle',puzzle});
  for (const action of solution) {
    step(state,[{tick:state.tick+1,sequence:0,action,pressed:true}]);
    if(state.status==='playing') step(state,[{tick:state.tick+1,sequence:0,action,pressed:false}]);
  }
  assert.equal(state.status,'won',puzzle.id);
}
console.log(JSON.stringify({ruleset:fixture.ruleset,tick:built.state.tick,score:built.state.score,
  pieces:built.state.pieces,hash:stateHash(built.state),puzzles:20,sourceMatchesBuild:true},null,2));
