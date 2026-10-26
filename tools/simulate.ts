import {createGame, introductoryPuzzles, serialize, restore, stateHash, step} from '../packages/core/src/index.ts';
import type {Input} from '../packages/core/src/index.ts';

const entry = introductoryPuzzles()[0]!;
const state = createGame({mode: 'puzzle', puzzle: entry.puzzle});
let sequence = 0;
for (const action of entry.solution) {
  const command: Input = {tick: state.tick+1, sequence: sequence++, action, pressed: true};
  for (const event of step(state, [command])) console.log(JSON.stringify(event));
  if (state.status === 'playing') step(state, [{...command, tick: state.tick+1, sequence: sequence++, pressed: false}]);
}
console.log(JSON.stringify({status: state.status, score: state.score, lines: state.lines,
  hash: stateHash(state), restoredHash: stateHash(restore(serialize(state)))}));
