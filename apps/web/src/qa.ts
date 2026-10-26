import {createGame,playReplay,stateHash} from '../../../packages/core/src/index.ts';
const {state}=playReplay({schema:1,ruleset:'echo-v1',config:createGame({seed:17}).config,endTick:500,inputs:[
  {tick:1,sequence:0,action:'left',pressed:true},{tick:24,sequence:1,action:'left',pressed:false},
  {tick:25,sequence:2,action:'cw',pressed:true},{tick:26,sequence:3,action:'hard',pressed:true},
  {tick:30,sequence:4,action:'hold',pressed:true},
]});
const hash=stateHash(state);
document.getElementById('result')!.textContent=JSON.stringify({pass:hash==='7f3279ab',ruleset:state.ruleset,tick:state.tick,score:state.score,pieces:state.pieces,hash,expected:'7f3279ab'},null,2);
