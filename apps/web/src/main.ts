import './style.css';
import './responsive.css';
import {createGame, introductoryPuzzles, playReplay, restore, RULESET, serialize, stateHash, step, TICK_RATE} from '../../../packages/core/src/index.ts';
import type {Action, Config, GameEvent, GameState, Input, Mode, Preset, Replay} from '../../../packages/core/src/index.ts';
import {EchoAudio} from './audio.ts';
import {drawBoard, drawPreview} from './renderer.ts';
import type {Theme} from './renderer.ts';
import {en, zh} from './i18n.ts';
import type {Message} from './i18n.ts';

const DEFAULT_KEYS:Record<Action,string>={left:'ArrowLeft',right:'ArrowRight',soft:'ArrowDown',hard:'Space',cw:'ArrowUp',ccw:'KeyZ',rotate180:'KeyA',hold:'KeyC'};
interface Settings {language:'zh'|'en';theme:Theme;symbols:boolean;reduced:boolean;large:boolean;preset:Preset;allow180:boolean;gestures:boolean;music:number;effects:number;muted:boolean;keys:Record<Action,string>}
interface RecordEntry {score:number;time:number;lines:number}
const settings:Settings={language:'zh',theme:'dark',symbols:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
  large:false,preset:'standard',allow180:false,gestures:true,music:.25,effects:.45,muted:false,keys:{...DEFAULT_KEYS}};
try {
  const saved=JSON.parse(localStorage.getItem('echo.settings')??'null') as Partial<Settings>|null;
  if(saved){
    if(saved.language==='zh'||saved.language==='en')settings.language=saved.language;
    if(['dark','light','contrast'].includes(saved.theme??''))settings.theme=saved.theme!;
    if(['beginner','standard','hardcore'].includes(saved.preset??''))settings.preset=saved.preset!;
    for(const key of ['symbols','reduced','large','allow180','gestures','muted']as const)if(typeof saved[key]==='boolean')settings[key]=saved[key];
    for(const key of ['music','effects']as const)if(typeof saved[key]==='number'&&saved[key]!>=0&&saved[key]!<=1)settings[key]=saved[key]!;
    if(saved.keys&&Object.keys(DEFAULT_KEYS).every(k=>/^[A-Za-z0-9]{1,30}$/.test(saved.keys![k as Action]??''))&&
      new Set(Object.values(saved.keys)).size===8&&!Object.values(saved.keys).includes('Escape'))settings.keys={...saved.keys};
  }
}catch{/* Defaults work even when storage is unavailable. */}
const audio=new EchoAudio(),puzzles=introductoryPuzzles();
const MODES:Mode[]=['marathon','sprint','ultra','master','blitz','puzzle'];
const modeMeta:Record<Mode,{number:string;icon:string;desc:Message;badge:string}>={
  marathon:{number:'01',icon:'∞',desc:'marathonDesc',badge:'ENDLESS'},sprint:{number:'02',icon:'↗',desc:'sprintDesc',badge:'40 LINES'},
  ultra:{number:'03',icon:'◷',desc:'ultraDesc',badge:'120 SEC'},master:{number:'04',icon:'≋',desc:'masterDesc',badge:'20 G'},
  blitz:{number:'05',icon:'ϟ',desc:'blitzDesc',badge:'120 SEC'},puzzle:{number:'06',icon:'▧',desc:'puzzleDesc',badge:'20 STUDIES'},
};
let mode:Mode='marathon',puzzleIndex=0,game=createGame(),running=false,paused=false,started=false;
let initialConfig:Config=game.config,log:Input[]=[],sequence=0,queued:{action:Action;pressed:boolean}[]=[];
let playback:Replay|null=null,playbackIndex=0,lastReplay:Replay|null=null;
let accumulator=0,lastFrame=0,feedbackUntil=0,feedbackText='',remapping:Action|null=null;
let bestNotice=false,storageNotice=false,settingsOpen=false;
const records:Record<string,RecordEntry>={};
try{
  const stored=JSON.parse(localStorage.getItem('echo.records')??'{}') as Record<string,RecordEntry>;
  for(const [key,value]of Object.entries(stored))if(value&&[value.score,value.time,value.lines].every(n=>Number.isFinite(n)&&n>=0))records[key]=value;
}catch{/* empty local records */}
let savedSession:{state:GameState;config:Config;inputs:Input[]}|null=null;
try{
  const stored=JSON.parse(localStorage.getItem('echo.session')??'null');
  if(stored){
    const state=restore(stored.state);
    const verified=playReplay({schema:1,ruleset:RULESET,config:stored.config,endTick:state.tick,inputs:stored.inputs});
    if(state.status==='playing'&&stateHash(verified.state)===stateHash(state))savedSession={state,config:stored.config,inputs:stored.inputs};
  }
}catch{/* Ignore incompatible or incomplete saved sessions. */}
function t(key:Message):string{return(settings.language==='zh'?zh:en)[key];}
function $(id:string):HTMLElement{return document.getElementById(id)!;}
function text(id:string,value:string):void{const el=$(id);if(el.textContent!==value)el.textContent=value;}
function keyLabel(code:string):string{return({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'Space'}as Record<string,string>)[code]??code.replace(/^(Key|Digit)/,'');}
function recordKey():string{return`${game.config.mode}:${game.config.preset}:${game.config.allow180}:${game.config.puzzle?.id??''}`;}
function formatTime(ticks:number):string{const seconds=Math.max(0,ticks/TICK_RATE);return`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds)%60).padStart(2,'0')}.${String(Math.floor(seconds*100)%100).padStart(2,'0')}`;}
function saveSettings():void{try{localStorage.setItem('echo.settings',JSON.stringify(settings));}catch{/* current session still works */}applySettings();}
function applySettings():void{
  document.documentElement.dataset.theme=settings.theme;document.documentElement.lang=settings.language==='zh'?'zh-CN':'en';
  document.documentElement.classList.toggle('large-text',settings.large);document.documentElement.classList.toggle('reduced',settings.reduced);
  audio.music=settings.music;audio.effects=settings.effects;audio.muted=settings.muted;
  if(settings.muted)audio.silence();
}
function toast(message:string):void{text('toast',message);$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function saveSession():void{
  if(playback||!started||game.status!=='playing')return;
  try{
    localStorage.setItem('echo.session',JSON.stringify({state:serialize(game),config:initialConfig,inputs:log}));
    savedSession={state:restore(serialize(game)),config:initialConfig,inputs:[...log]};
  }
  catch{if(!storageNotice){toast(t('storageError'));storageNotice=true;}}
}
function shell():void{
  const app=$('app');
  app.innerHTML=`<div class="app-shell">
    <header class="topbar"><a class="brand" href="#" aria-label="${t('title')}"><span class="brand-mark"><i></i><i></i><i></i><i></i></span><span><b>${t('title')}</b><small>${t('edition')}</small></span></a>
    <span class="header-note">${t('tagline')}</span><div class="header-actions"><button id="help-button" class="icon-button" aria-label="${t('help')}">?</button><button id="mute-button" class="icon-button" aria-label="${t('sound')}" aria-pressed="${settings.muted}">${settings.muted?'♪̸':'♪'}</button><button id="language-button" class="text-button">${t('language')}</button><button id="settings-button" class="settings-button"><span>⚙</span> ${t('settings')}</button></div></header>
    <main class="main-layout"><aside class="mode-rail"><div class="eyebrow"><span class="status-dot"></span>${t('solo')}</div><h1>${t('mode')}</h1>
    <nav aria-label="${t('mode')}">${MODES.map(m=>`<button class="mode-button ${m===mode?'selected':''}" data-mode="${m}" aria-pressed="${m===mode}"><span class="mode-number">${modeMeta[m].number}</span><span class="mode-name">${t(m)}<small>${modeMeta[m].badge}</small></span><span class="mode-icon">${modeMeta[m].icon}</span></button>`).join('')}</nav>
    <div class="rail-note"><div class="echo-art"><i></i><i></i><i></i><i></i><i></i></div><p id="mode-description">${t(modeMeta[mode].desc)}</p><button id="tutorial-button" class="link-button">${t('tutorial')} ↗</button></div></aside>
    <section class="arena" aria-label="${t('title')}"><div class="arena-heading"><span class="eyebrow"><span id="play-dot" class="status-dot"></span><span id="play-status">${t('ready')}</span></span><span class="arena-mode">${modeMeta[mode].badge}</span><button id="pause-button" class="icon-button" aria-label="${t('pause')}">Ⅱ</button></div>
    <div class="puzzle-switch ${mode==='puzzle'?'':'hidden'}"><button id="puzzle-prev" aria-label="${t('puzzlePrev')}">←</button><span>${t('puzzleLabel')} ${String(puzzleIndex+1).padStart(2,'0')} / 20</span><button id="puzzle-next" aria-label="${t('puzzleNext')}">→</button></div>
    <div class="game-layout"><div class="piece-column hold-column"><span class="eyebrow">${t('hold')}</span><canvas id="hold-canvas" width="80" height="64" aria-label="${t('hold')}"></canvas><kbd>${keyLabel(settings.keys.hold)}</kbd><div class="vertical-label">TAKE YOUR TIME.<br>FIND YOUR FLOW.</div></div>
    <div class="board-frame"><canvas id="board" width="600" height="1200" aria-label="${t('title')}" role="img"></canvas><div id="overlay" class="board-overlay"></div><div id="feedback" class="board-feedback" aria-live="polite"></div><div class="board-corner top-left"></div><div class="board-corner bottom-right"></div></div>
    <div class="piece-column next-column"><span class="eyebrow">${t('next')}</span>${Array.from({length:5},(_,i)=>`<canvas id="next-${i}" width="80" height="60" aria-label="${t('next')} ${i+1}"></canvas>`).join('')}<div class="queue-line"></div></div></div>
    <div class="touch-controls" aria-label="${t('keys')}"><button data-action="hold" aria-label="${t('holdKey')}">C</button><button data-action="ccw" aria-label="${t('counter')}">↶</button><button data-action="cw" aria-label="${t('clockwise')}">↷</button><button data-action="hard" class="drop-button" aria-label="${t('hard')}">⤓</button><button data-action="left" aria-label="${t('leftRight')}">←</button><button data-action="soft" aria-label="${t('soft')}">↓</button><button data-action="right" aria-label="${t('leftRight')}">→</button></div>
    <div class="keyboard-strip">${keyboardHints()}</div></section>
    <aside class="score-rail"><section class="score-section"><span class="eyebrow">${t('score')}</span><div id="score" class="score-value">0</div><div class="score-divider"></div><div class="record-row"><span>${t(mode==='sprint'?'bestTime':'best')}</span><strong id="best">—</strong></div></section>
    <section class="metrics"><div><span class="eyebrow">${t('lines')}</span><strong id="lines">000</strong><small id="line-target"></small></div><div><span class="eyebrow">${t('level')}</span><strong id="level">01</strong></div><div class="timer-metric"><span id="time-label" class="eyebrow">${t(mode==='ultra'||mode==='blitz'?'remaining':'time')}</span><strong id="time">00:00<span>.00</span></strong></div></section>
    <div class="session-actions"><button id="restart-button" class="secondary-button">↻ ${t('restart')}</button><button id="replay-save" class="link-button">${t('downloadReplay')} ↓</button><button id="replay-load" class="link-button">${t('loadReplay')} ↑</button><input id="replay-file" type="file" accept=".json,application/json" hidden></div>
    <div class="rhythm-note"><span>“</span><p>${t('tagline')}</p><div class="rhythm-line"></div><small>DROP. CLEAR. ECHO.</small></div></aside></main>
    <footer><span><i class="status-dot"></i>${t('local')}</span><span>DROPGRID ECHO <i>01</i></span></footer></div>
    <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-top"><h2 id="settings-title">${t('settings')}</h2><button class="icon-button" data-close aria-label="${t('close')}">×</button></div><div class="settings-body">
    <fieldset><legend>${t('appearance')}</legend><label>${t('theme')}<select id="setting-theme">${(['dark','light','contrast']as const).map(v=>`<option value="${v}" ${settings.theme===v?'selected':''}>${t(v)}</option>`).join('')}</select></label>
    <label>${t('font')}<select id="setting-font"><option value="normal">${t('normal')}</option><option value="large" ${settings.large?'selected':''}>${t('large')}</option></select></label>
    ${check('symbols','colorblind')}${check('reduced','reduced')}</fieldset>
    <fieldset><legend>${t('controls')}</legend><label>${t('preset')}<select id="setting-preset">${(['beginner','standard','hardcore']as const).map(v=>`<option value="${v}" ${settings.preset===v?'selected':''}>${t(v)}</option>`).join('')}</select></label>${check('allow180','extension')}${check('gestures','gestureLabel')}<p class="setting-note">${t('changes')}</p></fieldset>
    <fieldset><legend>${t('audio')}</legend><label>${t('music')}<input id="setting-music" type="range" min="0" max="1" step="0.05" value="${settings.music}"></label><label>${t('effects')}<input id="setting-effects" type="range" min="0" max="1" step="0.05" value="${settings.effects}"></label>${check('muted','mute')}</fieldset>
    <fieldset><legend>${t('remap')}</legend><p class="setting-note">${t('remapHint')}</p><div class="key-map">${(Object.keys(DEFAULT_KEYS)as Action[]).map(action=>`<button data-remap="${action}"><span>${t(actionLabel(action))}</span><kbd>${keyLabel(settings.keys[action])}</kbd></button>`).join('')}</div><p id="remap-status" class="setting-note" aria-live="polite"></p><button id="reset-keys" class="link-button">${t('resetKeys')}</button></fieldset><div class="mobile-tools"><button id="mobile-replay-save" class="link-button">${t('downloadReplay')} ↓</button><button id="mobile-replay-load" class="link-button">${t('loadReplay')} ↑</button></div></div><button class="primary-button dialog-done" data-close>${t('close')}</button></dialog>
    <dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-top"><h2 id="help-title">${t('tutorial')}</h2><button class="icon-button" data-close aria-label="${t('close')}">×</button></div><div class="help-body"><div class="help-illustration">▧<span>→</span>▦<span>→</span>✧</div><p>${t('tutorialText')}</p><p>${t('gestures')}</p><dl><dt>${t('counter')}</dt><dd>${keyLabel(settings.keys.ccw)}</dd><dt>${t('holdKey')}</dt><dd>${keyLabel(settings.keys.hold)}</dd><dt>${t('escape')}</dt><dd>Esc</dd></dl></div><button class="primary-button dialog-done" data-close>${t('close')}</button></dialog><div id="toast" role="status"></div>`;
  bindShell();applySettings();updateOverlay();updateHud();
}
function check(key:'symbols'|'reduced'|'allow180'|'gestures'|'muted',label:Message):string{return`<label>${t(label)}<input id="setting-${key}" type="checkbox" ${settings[key]?'checked':''}></label>`;}
function actionLabel(action:Action):Message{return({left:'left',right:'right',soft:'soft',hard:'hard',cw:'clockwise',ccw:'counter',rotate180:'half',hold:'holdKey'}as const)[action];}
function keyboardHints():string{return`<span><kbd>${keyLabel(settings.keys.left)}</kbd><kbd>${keyLabel(settings.keys.right)}</kbd> ${t('leftRight')}</span><span><kbd>${keyLabel(settings.keys.cw)}</kbd><kbd>${keyLabel(settings.keys.ccw)}</kbd> ${t('rotate')}</span><span><kbd>${keyLabel(settings.keys.hard)}</kbd> ${t('hard')}</span>`;}
function bindShell():void{
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(el=>el.onclick=()=>{
    if(running&&!paused)pauseGame();mode=el.dataset.mode as Mode;running=false;started=false;paused=false;playback=null;queued=[];
    game=createGame({mode,preset:settings.preset,allow180:settings.allow180,puzzle:mode==='puzzle'?puzzles[puzzleIndex]!.puzzle:null});shell();
  });
  $('language-button').onclick=()=>{if(running&&!paused)pauseGame();settings.language=settings.language==='zh'?'en':'zh';saveSettings();shell();};
  $('mute-button').onclick=()=>{settings.muted=!settings.muted;saveSettings();$('mute-button').textContent=settings.muted?'♪̸':'♪';$('mute-button').setAttribute('aria-pressed',String(settings.muted));};
  $('settings-button').onclick=()=>openDialog('settings-dialog');
  $('help-button').onclick=$('tutorial-button').onclick=()=>openDialog('help-dialog');
  $('pause-button').onclick=()=>paused?resumeGame():pauseGame();
  $('restart-button').onclick=()=>newGame();
  $('replay-save').onclick=()=>downloadReplay();
  $('mobile-replay-save').onclick=()=>downloadReplay();
  $('mobile-replay-load').onclick=()=>{($('settings-dialog')as HTMLDialogElement).close();($('replay-file')as HTMLInputElement).click();};
  $('replay-load').onclick=()=>{if(running&&!paused)pauseGame();($('replay-file')as HTMLInputElement).click();};
  $('replay-file').onchange=()=>{const file=($('replay-file')as HTMLInputElement).files?.[0];if(file)void importReplay(file);};
  $('puzzle-prev').onclick=()=>changePuzzle(-1);$('puzzle-next').onclick=()=>changePuzzle(1);
  for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')){
    dialog.querySelectorAll<HTMLElement>('[data-close]').forEach(el=>el.onclick=()=>dialog.close());
    dialog.addEventListener('close',()=>{settingsOpen=false;remapping=null;});
  }
  $('setting-theme').onchange=e=>{settings.theme=(e.target as HTMLSelectElement).value as Theme;saveSettings();};
  $('setting-font').onchange=e=>{settings.large=(e.target as HTMLSelectElement).value==='large';saveSettings();};
  $('setting-preset').onchange=e=>{settings.preset=(e.target as HTMLSelectElement).value as Preset;saveSettings();};
  for(const key of ['symbols','reduced','allow180','gestures','muted']as const)$(`setting-${key}`).onchange=e=>{settings[key]=(e.target as HTMLInputElement).checked;saveSettings();};
  for(const key of ['music','effects']as const)$(`setting-${key}`).oninput=e=>{settings[key]=Number((e.target as HTMLInputElement).value);saveSettings();};
  document.querySelectorAll<HTMLButtonElement>('[data-remap]').forEach(el=>el.onclick=()=>{remapping=el.dataset.remap as Action;text('remap-status',t('waitingKey'));});
  $('reset-keys').onclick=()=>{settings.keys={...DEFAULT_KEYS};saveSettings();updateKeyMap();};
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(el=>{
    const action=el.dataset.action as Action;
    el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);enqueue(action,true);el.classList.add('pressed');};
    el.onpointerup=el.onpointercancel=()=>{enqueue(action,false);el.classList.remove('pressed');};
  });
  let gesture:{x:number;y:number}|null=null;
  $('board').onpointerdown=e=>{if(settings.gestures&&running&&!paused&&!playback){gesture={x:e.clientX,y:e.clientY};$('board').setPointerCapture(e.pointerId);}};
  $('board').onpointercancel=()=>{gesture=null;};
  $('board').onpointerup=e=>{
    if(!gesture)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture=null;
    if(dy>60&&dy>Math.abs(dx))enqueue('hard',true);
    else if(Math.abs(dx)>20){for(let i=0;i<Math.min(9,Math.round(Math.abs(dx)/28));i++){enqueue(dx<0?'left':'right',true);enqueue(dx<0?'left':'right',false);}}
    else if(Math.abs(dy)<20)enqueue('cw',true);
  };
}
function updateKeyMap():void{
  for(const el of document.querySelectorAll<HTMLElement>('[data-remap] kbd')){const action=el.parentElement!.dataset.remap as Action;el.textContent=keyLabel(settings.keys[action]);}
  document.querySelector('.keyboard-strip')!.innerHTML=keyboardHints();
  document.querySelector('.hold-column kbd')!.textContent=keyLabel(settings.keys.hold);
}
function changePuzzle(direction:number):void{if(running&&!paused)pauseGame();puzzleIndex=(puzzleIndex+direction+20)%20;running=false;started=false;paused=false;playback=null;game=createGame({mode:'puzzle',puzzle:puzzles[puzzleIndex]!.puzzle});shell();}
function openDialog(id:string):void{if(running&&!paused)pauseGame();settingsOpen=true;($(`${id}`)as HTMLDialogElement).showModal();}
function enqueue(action:Action,pressed:boolean):void{if(running&&!paused&&!playback)queued.push({action,pressed});}
function unlockAudio():void{void audio.unlock().catch(()=>{/* Gameplay remains usable without audio permission. */});}
function newGame():void{
  const seed=crypto.getRandomValues(new Uint32Array(1))[0]!;
  game=createGame({seed,mode,preset:settings.preset,allow180:settings.allow180,puzzle:mode==='puzzle'?puzzles[puzzleIndex]!.puzzle:null});
  initialConfig=game.config;log=[];sequence=0;queued=[];playback=null;playbackIndex=0;started=true;running=true;paused=false;bestNotice=false;
  accumulator=0;lastFrame=performance.now();feedbackUntil=0;audio.active=true;unlockAudio();updateOverlay();saveSession();
  (document.activeElement as HTMLElement|null)?.blur();
}
function continueSaved():void{
  if(!savedSession)return;
  game=savedSession.state;initialConfig=savedSession.config;log=savedSession.inputs;sequence=(log.at(-1)?.sequence??-1)+1;
  mode=game.config.mode;puzzleIndex=Math.max(0,puzzles.findIndex(p=>p.puzzle.id===game.config.puzzle?.id));
  savedSession=null;playback=null;started=true;running=true;paused=false;queued=[];accumulator=0;lastFrame=performance.now();audio.active=true;unlockAudio();shell();toast(t('saved'));
}
function pauseGame():void{
  if(!running||paused)return;
  if(!playback){
    const pending:Input[]=queued.map(input=>({tick:game.tick+1,sequence:sequence++,...input}));
    queued=[];
    const releases=(['left','right','soft']as const).map(action=>({tick:game.tick+1,sequence:sequence++,action,pressed:false}));
    const inputs=[...pending,...releases];
    log.push(...inputs);handleEvents(step(game,inputs));
  }
  paused=true;audio.active=false;audio.silence();saveSession();updateOverlay();
}
function resumeGame():void{if(!running||game.status!=='playing')return;paused=false;accumulator=0;lastFrame=performance.now();audio.active=true;unlockAudio();updateOverlay();}
function updateOverlay():void{
  const overlay=$('overlay');
  overlay.classList.toggle('hidden',running&&!paused);
  if(running&&!paused){overlay.innerHTML='';return;}
  let title=t('welcome'),description=t('welcomeDesc'),button=t('start');
  if(started&&(game.status!=='playing'||(playback&&!running))){title=playback?t('replayDone'):game.status==='won'?t('won'):t('gameover');description=bestNotice?t('newBest'):t('endDesc');button=t('play');}
  else if(paused){title=t('paused');description=t('pausedDesc');button=t('resume');}
  overlay.innerHTML=`<span class="overlay-orbit">${paused?'Ⅱ':started?'✧':'↳'}</span><h2>${title}</h2><p>${description}</p>${started&&game.status!=='playing'?`<strong class="end-score">${game.score.toLocaleString(settings.language)}</strong>`:''}<button id="overlay-action" class="primary-button">${button} <span>→</span></button>${!started&&savedSession?`<button id="continue-saved" class="link-button">${t('continueSaved')}</button>`:''}${mode==='puzzle'&&game.status==='won'?`<button id="next-puzzle-action" class="link-button">${t('puzzleNext')} →</button>`:''}`;
  $('overlay-action').onclick=()=>paused?resumeGame():newGame();
  if(document.getElementById('continue-saved'))$('continue-saved').onclick=continueSaved;
  if(document.getElementById('next-puzzle-action'))$('next-puzzle-action').onclick=()=>{changePuzzle(1);newGame();};
}
function finish():void{
  running=false;audio.active=false;audio.silence();
  if(!playback){
    lastReplay={schema:1,ruleset:RULESET,config:initialConfig,endTick:game.tick,inputs:[...log]};
    const key=recordKey(),old=records[key],time=game.tick;
    const eligible=mode!=='sprint'||game.status==='won';
    const better=eligible&&(!old||(mode==='sprint'?time<old.time:game.score>old.score));
    if(better){records[key]={score:game.score,time,lines:game.lines};bestNotice=true;}
    savedSession=null;
    try{localStorage.setItem('echo.records',JSON.stringify(records));localStorage.removeItem('echo.session');}catch{/* no persistence */}
  }
  updateOverlay();audio.play('end');
}
function handleEvents(events:GameEvent[]):void{
  for(const event of events){
    if(event.type==='lock'){
      if(event.lines>0){
        feedbackText=event.perfectClear?t('allclear'):event.spin!=='none'?`${event.spin==='mini'?'MINI ':''}T-SPIN`:
          [t('single'),t('double'),t('triple'),t('four')][event.lines-1]!;
        if(event.combo>0)feedbackText+=` · ${event.combo} ${t('combo')}`;
        feedbackText+=`  +${event.total}`;feedbackUntil=performance.now()+1700;
        audio.play(event.perfectClear?'perfect':event.spin!=='none'?'spin':'line',event.lines);
        if(!settings.reduced){$('board').animate([{opacity:.65},{opacity:1}],{duration:160});}
      }else audio.play('drop');
      saveSession();
    }else if(event.type==='end')finish();
  }
}
function updateHud():void{
  text('score',game.score.toLocaleString(settings.language));text('lines',String(game.lines).padStart(3,'0'));text('level',String(game.level).padStart(2,'0'));
  text('line-target',mode==='sprint'?'/ 40':mode==='master'?'/ 200':mode==='puzzle'?`/ ${game.config.puzzle!.targetLines}`:'');
  const timed=mode==='ultra'||mode==='blitz';text('time',formatTime(timed?14400-game.tick:game.tick));
  const record=records[recordKey()];text('best',record?(mode==='sprint'?formatTime(record.time):record.score.toLocaleString(settings.language)):t('empty'));
  text('play-status',playback?t('replay'):running&&!paused?t('live'):paused?t('paused'):t('ready'));
  $('play-dot').classList.toggle('active',running&&!paused);$('hold-canvas').style.opacity=game.holdUsed?'.35':'1';
  audio.level=game.level;
}
function frame(now:number):void{
  const elapsed=lastFrame?now-lastFrame:0;lastFrame=now;
  if(running&&!paused&&!settingsOpen){
    if(elapsed>500){pauseGame();}else{
      accumulator+=elapsed;
      while(accumulator>=1000/TICK_RATE&&running&&!paused){
        const inputs:Input[]=[];
        if(playback){while(playback.inputs[playbackIndex]?.tick===game.tick+1)inputs.push(playback.inputs[playbackIndex++]!);}
        else{for(const input of queued)inputs.push({tick:game.tick+1,sequence:sequence++,...input});queued=[];log.push(...inputs);}
        handleEvents(step(game,inputs));accumulator-=1000/TICK_RATE;
        if(playback&&game.tick>=playback.endTick&&running){running=false;audio.active=false;updateOverlay();}
      }
    }
  }
  updateHud();drawBoard($('board')as HTMLCanvasElement,game,settings.theme,settings.symbols,!paused);
  drawPreview($('hold-canvas')as HTMLCanvasElement,game.hold,settings.theme,settings.symbols);
  const queue=game.config.puzzle?game.config.puzzle.queue.slice(game.puzzleIndex):game.queue;
  for(let i=0;i<5;i++)drawPreview($(`next-${i}`)as HTMLCanvasElement,queue[i]??null,settings.theme,settings.symbols);
  text('feedback',now<feedbackUntil?feedbackText:'');$('feedback').classList.toggle('visible',now<feedbackUntil);
  requestAnimationFrame(frame);
}
function downloadReplay():void{
  const replay=playback??(started?{schema:1,ruleset:RULESET,config:initialConfig,endTick:game.tick,inputs:log}:lastReplay);
  if(!replay||game.tick===0){toast(t('noReplay'));return;}
  const native=(window as Window & {NativeReplay?:{postMessage(message:string):void}}).NativeReplay;
  if(native){native.postMessage(JSON.stringify({content:JSON.stringify(replay)}));return;}
  const blob=new Blob([JSON.stringify(replay)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`dropgrid-${mode}-${game.tick}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importReplay(file:File):Promise<void>{
  try{
    if(file.size>2_000_000)throw new Error('too large');
    const candidate=JSON.parse(await file.text())as Replay;
    if(candidate.endTick>864000||candidate.inputs.length>200000)throw new Error('too long');
    playReplay(candidate);
    game=createGame(candidate.config);mode=candidate.config.mode;initialConfig=game.config;
    puzzleIndex=Math.max(0,puzzles.findIndex(p=>p.puzzle.id===game.config.puzzle?.id));
    playback=candidate;playbackIndex=0;started=true;running=candidate.endTick>0;paused=false;queued=[];accumulator=0;lastFrame=performance.now();
    audio.active=true;unlockAudio();shell();
  }catch{toast(t('invalidReplay'));}
}
window.addEventListener('keydown',event=>{
  if(remapping){
    event.preventDefault();
    if(event.code==='Escape'){remapping=null;text('remap-status','');return;}
    if(Object.entries(settings.keys).some(([action,key])=>key===event.code&&action!==remapping)){text('remap-status',t('conflict'));return;}
    if(!/^[A-Za-z0-9]{1,30}$/.test(event.code))return;
    settings.keys[remapping]=event.code;remapping=null;saveSettings();updateKeyMap();text('remap-status','');return;
  }
  if(settingsOpen)return;
  if(event.code==='Escape'){event.preventDefault();if(event.repeat)return;paused?resumeGame():pauseGame();return;}
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
  const action=(Object.keys(settings.keys)as Action[]).find(a=>settings.keys[a]===event.code);
  if(action&&running&&!paused){event.preventDefault();if(!event.repeat){enqueue(action,true);if(action==='cw'||action==='ccw')audio.play('turn');}}
});
window.addEventListener('keyup',event=>{const action=(Object.keys(settings.keys)as Action[]).find(a=>settings.keys[a]===event.code);if(action)enqueue(action,false);});
window.addEventListener('blur',()=>pauseGame());
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
window.addEventListener('pagehide',()=>{pauseGame();saveSession();});
shell();requestAnimationFrame(frame);
